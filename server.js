import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { EPub } from 'epub2';
import { z } from 'zod';

const root = path.dirname(fileURLToPath(import.meta.url));
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});
const loginSchema = registerSchema.pick({ email: true, password: true });
const importSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(1000)
});
const paymentSchema = z.object({
  bookId: z.string().trim().min(1).max(120),
  pageIndex: z.number().int().positive(),
  scope: z.enum(['page', 'story']).default('page'),
  paymentMethod: z.enum(['mobile_money', 'card']),
  momoNumber: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,19}$/).optional(),
  momoProvider: z.enum(['mtn', 'vod', 'tgo']).optional()
}).superRefine((value, context) => {
  if (value.paymentMethod === 'mobile_money' && !value.momoNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['momoNumber'], message: 'A MoMo number is required' });
  if (value.paymentMethod === 'mobile_money' && !value.momoProvider) context.addIssue({ code: z.ZodIssueCode.custom, path: ['momoProvider'], message: 'A MoMo provider is required' });
});
const referenceSchema = z.object({ reference: z.string().trim().min(1).max(100) });
const jobIdSchema = z.string().uuid();
const MAX_EXTRACTED_TEXT = 10 * 1024 * 1024;

function runTransaction(database, callback) {
  database.exec('BEGIN IMMEDIATE');
  try {
    callback();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function createDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader', 'admin')),
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      balance_minor INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      provider_reference TEXT UNIQUE,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS page_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      book_id TEXT NOT NULL,
      page_index INTEGER NOT NULL,
      payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, book_id, page_index)
    );
    CREATE TABLE IF NOT EXISTS story_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      book_id TEXT NOT NULL,
      payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      source_file TEXT NOT NULL,
      original_name TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      chapters INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT,
      error_message TEXT,
      published_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const paymentColumns = database.prepare('PRAGMA table_info(payments)').all().map((column) => column.name);
  if (!paymentColumns.includes('book_id')) database.exec('ALTER TABLE payments ADD COLUMN book_id TEXT');
  if (!paymentColumns.includes('page_index')) database.exec('ALTER TABLE payments ADD COLUMN page_index INTEGER');
  if (!paymentColumns.includes('scope')) database.exec("ALTER TABLE payments ADD COLUMN scope TEXT NOT NULL DEFAULT 'page'");
  if (!paymentColumns.includes('payment_method')) database.exec("ALTER TABLE payments ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'mobile_money'");
  if (!paymentColumns.includes('momo_number')) database.exec('ALTER TABLE payments ADD COLUMN momo_number TEXT');
  const importColumns = database.prepare('PRAGMA table_info(import_jobs)').all().map((column) => column.name);
  if (!importColumns.includes('extracted_text')) database.exec('ALTER TABLE import_jobs ADD COLUMN extracted_text TEXT');
  if (!importColumns.includes('error_message')) database.exec('ALTER TABLE import_jobs ADD COLUMN error_message TEXT');
  if (!importColumns.includes('published_at')) database.exec('ALTER TABLE import_jobs ADD COLUMN published_at TEXT');
  if (!importColumns.includes('updated_at')) database.exec("ALTER TABLE import_jobs ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  if (!importColumns.includes('original_name')) database.exec('ALTER TABLE import_jobs ADD COLUMN original_name TEXT');
  const userColumns = database.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (!userColumns.includes('avatar_url')) database.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  return database;
}

function cleanExtractedText(value) {
  return String(value || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function validateDocumentUpload(file) {
  const buffer = await fs.promises.readFile(file.path);
  const extension = path.extname(file.originalname).toLowerCase();
  const detected = await fileTypeFromBuffer(buffer);
  const valid = extension === '.pdf' ? detected?.ext === 'pdf' : extension === '.doc' ? file.mimetype === 'application/msword' : ['.docx', '.epub'].includes(extension) ? detected?.ext === 'zip' : false;
  if (!valid) {
    fs.rmSync(file.path, { force: true });
    throw new Error('The uploaded file content does not match its file type');
  }
}

async function validateAvatarUpload(file) {
  const detected = await fileTypeFromBuffer(await fs.promises.readFile(file.path));
  if (!detected || !['jpg', 'png', 'webp', 'gif'].includes(detected.ext)) {
    fs.rmSync(file.path, { force: true });
    throw new Error('The uploaded avatar is not a supported image');
  }
}

async function extractStoryText(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  if (buffer.length > 50 * 1024 * 1024) throw new Error('The story file must be 50 MB or smaller');
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf' || buffer.subarray(0, 5).toString() === '%PDF-') {
    const parser = new PDFParse({ data: buffer });
    try {
      return cleanExtractedText((await parser.getText()).text);
    } finally {
      await parser.destroy();
    }
  }
  if (extension === '.docx' || buffer.subarray(0, 2).toString() === 'PK') return cleanExtractedText((await mammoth.extractRawText({ buffer })).value);
  if (extension === '.epub') {
    const epub = await EPub.createAsync(filePath);
    const chapters = await Promise.all((epub.flow || []).map((chapter) => new Promise((resolve, reject) => {
      epub.getChapter(chapter.id, (error, text) => error ? reject(error) : resolve(text));
    })));
    return cleanExtractedText(chapters.join('\n\n'));
  }
  return cleanExtractedText(buffer.toString('utf8'));
}

async function processImportJob(database, uploadDirectory, jobId) {
  const job = database.prepare('SELECT id, source_file AS sourceFile, original_name AS originalName, status FROM import_jobs WHERE id = ?').get(jobId);
  if (!job || !['queued', 'extracting', 'failed'].includes(job.status)) return;
  const startedAt = new Date().toISOString();
  database.prepare("UPDATE import_jobs SET status = 'extracting', error_message = NULL, updated_at = ? WHERE id = ?").run(startedAt, jobId);
  try {
    const sourcePath = path.join(uploadDirectory, job.sourceFile);
    const extractionPath = job.originalName ? sourcePath + path.extname(job.originalName) : sourcePath;
    if (extractionPath !== sourcePath && !fs.existsSync(extractionPath)) await fs.promises.copyFile(sourcePath, extractionPath);
    const text = await extractStoryText(extractionPath);
    if (!text) throw new Error('No readable text was found in the uploaded story');
    if (Buffer.byteLength(text, 'utf8') > MAX_EXTRACTED_TEXT) throw new Error('The extracted story text is too large to process');
    const chapters = Math.max(1, text.split(/\n{2,}/).filter(Boolean).length);
    database.prepare("UPDATE import_jobs SET status = 'ready', chapters = ?, extracted_text = ?, error_message = NULL, updated_at = ? WHERE id = ?").run(chapters, text, new Date().toISOString(), jobId);
  } catch (error) {
    database.prepare("UPDATE import_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?").run(error.message.slice(0, 500), new Date().toISOString(), jobId);
  }
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatar_url || user.avatarUrl || null };
}

function ensureConfiguredAdmin(database) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const now = new Date().toISOString();
  if (existing) {
    database.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 12), existing.id);
    return;
  }
  const id = crypto.randomUUID();
  database.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, 'Library Administrator', email, bcrypt.hashSync(password, 12), 'admin', now);
  database.prepare('INSERT INTO wallets (user_id, balance_minor, updated_at) VALUES (?, 0, ?)').run(id, now);
}

function issueToken(user, secret) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: '2h', issuer: 'northern-heritage-library' });
}

function authRequired(database, secret) {
  return (request, response, next) => {
    const header = request.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return response.status(401).json({ error: 'Authentication required' });
    try {
      const claims = jwt.verify(token, secret, { issuer: 'northern-heritage-library' });
      const user = database.prepare('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?').get(claims.sub);
      if (!user) return response.status(401).json({ error: 'Session is no longer valid' });
      request.user = user;
      next();
    } catch {
      return response.status(401).json({ error: 'Invalid or expired session' });
    }
  };
}

function adminRequired(request, response, next) {
  if (request.user?.role !== 'admin') return response.status(403).json({ error: 'Administrator access required' });
  next();
}

function createApp(options = {}) {
  const database = createDatabase(options.databasePath || process.env.DATABASE_PATH || path.join(root, 'data', 'library.db'));
  ensureConfiguredAdmin(database);
  database.prepare("UPDATE import_jobs SET status = 'queued', error_message = NULL, updated_at = ? WHERE status = 'ready' AND substr(extracted_text, 1, 5) = '%PDF-'").run(new Date().toISOString());
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET must be configured');
  if (process.env.NODE_ENV === 'production' && (jwtSecret.includes('replace') || jwtSecret.length < 32)) throw new Error('A strong production JWT_SECRET must be configured');

  const app = express();
  const uploadDirectory = options.uploadDirectory || process.env.UPLOAD_DIR || path.join(root, 'storage', 'uploads');
  fs.mkdirSync(uploadDirectory, { recursive: true });
  const upload = multer({
    dest: uploadDirectory,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, /\.(pdf|epub|doc|docx)$/i.test(file.originalname))
  });
  const avatarDirectory = path.join(root, 'storage', 'avatars');
  fs.mkdirSync(avatarDirectory, { recursive: true });
  const avatarUpload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => callback(null, avatarDirectory),
      filename: (_request, file, callback) => callback(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype))
  });
  const auth = authRequired(database, jwtSecret);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many login attempts. Try again later.' }, standardHeaders: true, legacyHeaders: false });

  app.use(helmet({ contentSecurityPolicy: false }));
  const allowedOrigin = options.frontendOrigin || process.env.FRONTEND_ORIGIN;
  if (!allowedOrigin) throw new Error('FRONTEND_ORIGIN must be configured');
  app.use(cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || requestOrigin === allowedOrigin) return callback(null, true);
      return callback(null, false);
    },
    credentials: false
  }));
  if (process.env.NODE_ENV === 'production') app.use((request, response, next) => {
    if (request.secure || request.get('x-forwarded-proto') === 'https') return next();
    return response.status(426).json({ error: 'HTTPS is required' });
  });
  app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'northern-heritage-library' }));

  app.post('/api/auth/register', async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Name, valid email, and password of at least 8 characters are required' });
    const email = parsed.data.email.toLowerCase();
    if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) return response.status(409).json({ error: 'Email is already registered' });
    const user = { id: crypto.randomUUID(), name: parsed.data.name, email, role: 'reader', createdAt: new Date().toISOString() };
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    runTransaction(database, () => {
      database.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, user.name, user.email, passwordHash, user.role, user.createdAt);
      database.prepare('INSERT INTO wallets (user_id, balance_minor, updated_at) VALUES (?, 0, ?)').run(user.id, user.createdAt);
    });
    return response.status(201).json({ user, token: issueToken(user, jwtSecret) });
  });

  app.post('/api/auth/login', loginLimiter, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Valid email and password are required' });
    const user = database.prepare('SELECT id, name, email, role, avatar_url, password_hash FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return response.status(401).json({ error: 'The email or password is incorrect' });
    return response.json({ user: publicUser(user), token: issueToken(user, jwtSecret) });
  });

  app.get('/api/auth/me', auth, (request, response) => response.json({ user: publicUser(request.user) }));

  app.get('/api/auth/export', auth, (request, response) => {
    const user = database.prepare('SELECT id, name, email, role, avatar_url AS avatarUrl, created_at AS createdAt FROM users WHERE id = ?').get(request.user.id);
    const payments = database.prepare("SELECT provider, provider_reference AS reference, amount_minor AS amountMinor, currency, status, created_at AS createdAt FROM payments WHERE user_id = ?").all(request.user.id);
    const pageEntitlements = database.prepare('SELECT book_id AS bookId, page_index AS pageIndex, created_at AS createdAt FROM page_entitlements WHERE user_id = ?').all(request.user.id);
    const storyEntitlements = database.prepare('SELECT book_id AS bookId, created_at AS createdAt FROM story_entitlements WHERE user_id = ?').all(request.user.id);
    response.set('Content-Disposition', 'attachment; filename="northern-heritage-library-data.json"');
    response.json({ exportedAt: new Date().toISOString(), user, payments, pageEntitlements, storyEntitlements });
  });

  app.delete('/api/auth/me', auth, (request, response) => {
    const avatar = database.prepare('SELECT avatar_url AS avatarUrl FROM users WHERE id = ?').get(request.user.id);
    const imports = database.prepare('SELECT source_file AS sourceFile, original_name AS originalName FROM import_jobs WHERE uploaded_by = ?').all(request.user.id);
    runTransaction(database, () => {
      database.prepare('DELETE FROM page_entitlements WHERE user_id = ?').run(request.user.id);
      database.prepare('DELETE FROM story_entitlements WHERE user_id = ?').run(request.user.id);
      database.prepare('DELETE FROM payments WHERE user_id = ?').run(request.user.id);
      database.prepare('DELETE FROM import_jobs WHERE uploaded_by = ?').run(request.user.id);
      database.prepare('DELETE FROM wallets WHERE user_id = ?').run(request.user.id);
      database.prepare('DELETE FROM users WHERE id = ?').run(request.user.id);
    });
    if (avatar?.avatarUrl?.startsWith('/uploads/avatars/')) fs.rmSync(path.join(avatarDirectory, path.basename(avatar.avatarUrl)), { force: true });
    imports.forEach((job) => {
      fs.rmSync(path.join(uploadDirectory, job.sourceFile), { force: true });
      if (job.originalName) fs.rmSync(path.join(uploadDirectory, job.sourceFile + path.extname(job.originalName)), { force: true });
    });
    response.status(204).end();
  });

  app.post('/api/auth/avatar', auth, avatarUpload.single('avatar'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'Choose a JPG, PNG, WEBP, or GIF image up to 5 MB' });
    try {
      await validateAvatarUpload(request.file);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
    const avatarUrl = '/uploads/avatars/' + request.file.filename;
    const previous = database.prepare('SELECT avatar_url AS avatarUrl FROM users WHERE id = ?').get(request.user.id);
    database.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, request.user.id);
    if (previous?.avatarUrl?.startsWith('/uploads/avatars/')) fs.rmSync(path.join(root, 'storage', 'avatars', path.basename(previous.avatarUrl)), { force: true });
    response.json({ user: { ...publicUser(request.user), avatarUrl } });
  });

  app.post('/api/books/import', auth, adminRequired, upload.single('file'), async (request, response) => {
    const parsed = importSchema.safeParse(request.body);
    if (!parsed.success || !request.file) {
      if (request.file) fs.rmSync(request.file.path, { force: true });
      return response.status(400).json({ error: 'A supported book file and metadata are required' });
    }
    try {
      await validateDocumentUpload(request.file);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
    const job = { id: crypto.randomUUID(), uploadedBy: request.user.id, ...parsed.data, sourceFile: request.file.filename, status: 'queued', createdAt: new Date().toISOString() };
    database.prepare('INSERT INTO import_jobs (id, uploaded_by, title, category, description, source_file, original_name, status, chapters, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(job.id, job.uploadedBy, job.title, job.category, job.description, job.sourceFile, request.file.originalname, job.status, 0, job.createdAt, job.createdAt);
    void processImportJob(database, uploadDirectory, job.id);
    return response.status(202).json({ id: job.id, title: job.title, category: job.category, description: job.description, chapters: 0, status: job.status });
  });

  app.get('/api/books/import/:id', auth, adminRequired, (request, response) => {
    const job = database.prepare('SELECT id, title, category, description, status, chapters, error_message AS errorMessage, published_at AS publishedAt, updated_at AS updatedAt, created_at AS createdAt FROM import_jobs WHERE id = ?').get(request.params.id);
    if (!job) return response.status(404).json({ error: 'Import job not found' });
    response.json(job);
  });

  app.get('/api/admin/imports', auth, adminRequired, (_request, response) => {
    const jobs = database.prepare('SELECT id, title, category, description, status, chapters, error_message AS errorMessage, published_at AS publishedAt, updated_at AS updatedAt, created_at AS createdAt FROM import_jobs ORDER BY created_at DESC').all();
    response.json({ jobs });
  });

  app.post('/api/admin/imports/:id/retry', auth, adminRequired, (request, response) => {
    const parsedId = jobIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return response.status(400).json({ error: 'Invalid import job id' });
    const job = database.prepare('SELECT id, status FROM import_jobs WHERE id = ?').get(parsedId.data);
    if (!job) return response.status(404).json({ error: 'Import job not found' });
    if (job.status !== 'failed') return response.status(409).json({ error: 'Only failed imports can be retried' });
    database.prepare("UPDATE import_jobs SET status = 'queued', error_message = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), job.id);
    void processImportJob(database, uploadDirectory, job.id);
    response.status(202).json({ id: job.id, status: 'queued' });
  });

  app.post('/api/admin/imports/:id/publish', auth, adminRequired, (request, response) => {
    const parsedId = jobIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return response.status(400).json({ error: 'Invalid import job id' });
    const publishedAt = new Date().toISOString();
    const result = database.prepare("UPDATE import_jobs SET status = 'published', published_at = ?, updated_at = ? WHERE id = ? AND status = 'ready'").run(publishedAt, publishedAt, parsedId.data);
    if (!result.changes) return response.status(409).json({ error: 'Only ready imports can be published' });
    response.json({ id: parsedId.data, status: 'published', publishedAt });
  });

  app.delete('/api/admin/imports/:id', auth, adminRequired, (request, response) => {
    const parsedId = jobIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return response.status(400).json({ error: 'Invalid import job id' });
    const job = database.prepare('SELECT id, source_file AS sourceFile, original_name AS originalName FROM import_jobs WHERE id = ?').get(parsedId.data);
    if (!job) return response.status(404).json({ error: 'Import job not found' });
    database.prepare('DELETE FROM import_jobs WHERE id = ?').run(job.id);
    fs.rmSync(path.join(uploadDirectory, job.sourceFile), { force: true });
    if (job.originalName) fs.rmSync(path.join(uploadDirectory, job.sourceFile + path.extname(job.originalName)), { force: true });
    response.status(204).end();
  });

  app.get('/api/books', (_request, response) => {
    const books = database.prepare("SELECT id, title, category, description, chapters, status, published_at AS publishedAt FROM import_jobs WHERE status = 'published' ORDER BY published_at DESC").all();
    response.json({ books });
  });

  app.get('/api/books/:id/content', (request, response) => {
    const book = database.prepare("SELECT title, extracted_text AS extractedText FROM import_jobs WHERE id = ? AND status = 'published'").get(request.params.id);
    if (!book) return response.status(404).json({ error: 'Published story not found' });
    const pages = book.extractedText.split(/\n{2,}/).map((page) => page.trim()).filter(Boolean).map((page) => '<p>' + page.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '</p><p>') + '</p>');
    response.json({ title: book.title, pages });
  });

  app.use((error, _request, response, next) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'The story file must be 50 MB or smaller' : 'The story upload could not be processed';
      return response.status(400).json({ error: message });
    }
    if (error.message === 'Unexpected field' || error.message?.includes('File type')) return response.status(400).json({ error: error.message });
    return next(error);
  });

  database.prepare("SELECT id FROM import_jobs WHERE status IN ('queued', 'extracting')").all().forEach((job) => {
    void processImportJob(database, uploadDirectory, job.id);
  });

  app.post('/api/payments/paystack/initialize', auth, async (request, response) => {
    const parsed = paymentSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Choose a payment method and provide your MoMo details' });
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ error: 'Payment provider is not configured' });
    const amountMinor = Math.round(Number(process.env[parsed.data.scope === 'story' ? 'PAYSTACK_STORY_PRICE_GHS' : 'PAYSTACK_PAGE_PRICE_GHS'] || (parsed.data.scope === 'story' ? 10 : 1)) * 100);
    const reference = `nhl_${crypto.randomUUID().replaceAll('-', '')}`;
    const callbackUrl = new URL(process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:3001/');
    callbackUrl.searchParams.set('payment_book', parsed.data.bookId);
    callbackUrl.searchParams.set('payment_page', String(parsed.data.pageIndex));
    callbackUrl.searchParams.set('payment_scope', parsed.data.scope);
    const transaction = { email: request.user.email, amount: amountMinor, currency: 'GHS', reference, callback_url: callbackUrl.toString(), channels: [parsed.data.paymentMethod], metadata: { bookId: parsed.data.bookId, pageIndex: parsed.data.pageIndex, scope: parsed.data.scope, paymentMethod: parsed.data.paymentMethod } };
    if (parsed.data.paymentMethod === 'mobile_money') transaction.mobile_money = { phone: parsed.data.momoNumber, provider: parsed.data.momoProvider };
    const providerResponse = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(transaction) });
    const providerBody = await providerResponse.json();
    if (!providerResponse.ok || !providerBody.status) return response.status(502).json({ error: 'Payment provider initialization failed' });
    database.prepare('INSERT INTO payments (id, user_id, provider, provider_reference, amount_minor, currency, status, book_id, page_index, scope, payment_method, momo_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), request.user.id, 'paystack', reference, amountMinor, 'GHS', 'pending', parsed.data.bookId, parsed.data.pageIndex, parsed.data.scope, parsed.data.paymentMethod, parsed.data.momoNumber || null, new Date().toISOString());
    response.status(201).json({ authorizationUrl: providerBody.data.authorization_url, reference });
  });

  async function settlePaystackPayment(reference, userId) {
    const payment = database.prepare('SELECT * FROM payments WHERE provider_reference = ? AND user_id = ?').get(reference, userId);
    if (!payment) return { status: 'not_found' };
    if (payment.status === 'success') return { status: 'success', payment };
    const providerResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const providerBody = await providerResponse.json();
    const transaction = providerBody.data;
    if (!providerResponse.ok || !providerBody.status || transaction?.status !== 'success') return { status: 'pending' };
    if (transaction.amount !== payment.amount_minor || transaction.currency !== payment.currency) return { status: 'invalid' };
    runTransaction(database, () => {
      database.prepare("UPDATE payments SET status = 'success' WHERE id = ? AND status = 'pending'").run(payment.id);
      if (payment.scope === 'story') database.prepare('INSERT OR IGNORE INTO story_entitlements (id, user_id, book_id, payment_id, created_at) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), payment.user_id, payment.book_id, payment.id, new Date().toISOString());
      else database.prepare('INSERT OR IGNORE INTO page_entitlements (id, user_id, book_id, page_index, payment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), payment.user_id, payment.book_id, payment.page_index, payment.id, new Date().toISOString());
    });
    return { status: 'success', payment: { ...payment, status: 'success' } };
  }

  app.post('/api/payments/paystack/verify', auth, async (request, response) => {
    const parsed = referenceSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'A payment reference is required' });
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ error: 'Payment provider is not configured' });
    const result = await settlePaystackPayment(parsed.data.reference, request.user.id);
    if (result.status === 'not_found') return response.status(404).json({ error: 'Payment reference not found' });
    if (result.status === 'invalid') return response.status(400).json({ error: 'Payment amount or currency could not be verified' });
    response.json({ status: result.status, payment: result.payment || null });
  });

  app.get('/api/payments/me', auth, (request, response) => {
    const payments = database.prepare("SELECT provider_reference AS reference, amount_minor AS amountMinor, currency, status, book_id AS bookId, page_index AS pageIndex, scope, payment_method AS paymentMethod, created_at AS createdAt FROM payments WHERE user_id = ? AND status = 'success' ORDER BY created_at DESC").all(request.user.id);
    response.json({ payments });
  });

  app.get('/api/payments/entitlements', auth, (request, response) => {
    const entitlements = database.prepare('SELECT book_id AS bookId, page_index AS pageIndex FROM page_entitlements WHERE user_id = ?').all(request.user.id);
    const stories = database.prepare('SELECT book_id AS bookId FROM story_entitlements WHERE user_id = ?').all(request.user.id);
    response.json({ entitlements, stories });
  });

  app.post('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }), (request, response) => {
    const signature = request.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!signature || !secret) return response.status(401).end();
    const expected = crypto.createHmac('sha512', secret).update(request.body).digest('hex');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return response.status(401).end();
    const event = JSON.parse(request.body.toString('utf8'));
    if (event.event === 'charge.success') {
      const payment = database.prepare('SELECT * FROM payments WHERE provider_reference = ?').get(event.data.reference);
      if (payment && payment.status !== 'success' && event.data.amount === payment.amount_minor && event.data.currency === payment.currency) {
        runTransaction(database, () => {
          database.prepare("UPDATE payments SET status = 'success' WHERE id = ?").run(payment.id);
          if (payment.scope === 'story') database.prepare('INSERT OR IGNORE INTO story_entitlements (id, user_id, book_id, payment_id, created_at) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), payment.user_id, payment.book_id, payment.id, new Date().toISOString());
          else database.prepare('INSERT OR IGNORE INTO page_entitlements (id, user_id, book_id, page_index, payment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), payment.user_id, payment.book_id, payment.page_index, payment.id, new Date().toISOString());
        });
      }
    }
    response.json({ received: true });
  });

  if (options.serveFrontend !== false) {
    app.use('/uploads/avatars', express.static(avatarDirectory));
    app.use(express.static(root));
  }
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, () => console.log(`Northern Heritage Library API listening on http://localhost:${port}`));
}

export { createApp };
