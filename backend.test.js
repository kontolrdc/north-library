import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './server.js';

test('health endpoint reports backend readiness', async () => {
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'northern-heritage-library' });
  } finally {
    server.close();
  }
});

test('registration and login return a bearer token', async () => {
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const register = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Reader One', email: 'reader@example.com', password: 'strong-password' })
    });
    assert.equal(register.status, 201);
    const registered = await register.json();
    assert.equal(registered.user.role, 'reader');
    assert.ok(registered.token);

    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com', password: 'strong-password' })
    });
    assert.equal(login.status, 200);
    assert.ok((await login.json()).token);
  } finally {
    server.close();
  }
});

test('configured administrator can upload a story file', async () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'admin-test@example.com';
  process.env.ADMIN_PASSWORD = 'admin@1234';
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin-test@example.com', password: 'admin@1234' })
    });
    assert.equal(login.status, 200);
    const { token, user } = await login.json();
    assert.equal(user.role, 'admin');

    const form = new FormData();
    form.append('file', new File(['story content'], 'story.doc', { type: 'application/msword' }));
    form.append('title', 'Test Story');
    form.append('category', 'history');
    form.append('description', 'A test story upload.');
    const upload = await fetch(`http://127.0.0.1:${port}/api/books/import`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    assert.equal(upload.status, 202);
    assert.equal((await upload.json()).status, 'queued');
  } finally {
    server.close();
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('administrator can extract, publish, and delete a story import', async () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'lifecycle-admin@example.com';
  process.env.ADMIN_PASSWORD = 'admin@1234';
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'lifecycle-admin@example.com', password: 'admin@1234' })
    });
    const { token } = await login.json();
    const headers = { authorization: `Bearer ${token}` };
    const form = new FormData();
    form.append('file', new File(['Chapter one\n\nChapter two'], 'lifecycle.doc', { type: 'application/msword' }));
    form.append('title', 'Lifecycle Story');
    form.append('category', 'history');
    form.append('description', 'A lifecycle test story.');
    const upload = await fetch(`http://127.0.0.1:${port}/api/books/import`, { method: 'POST', headers, body: form });
    assert.equal(upload.status, 202);
    const job = await upload.json();
    let status;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const result = await fetch(`http://127.0.0.1:${port}/api/books/import/${job.id}`, { headers });
      status = await result.json();
      if (status.status === 'ready') break;
    }
    assert.equal(status.status, 'ready');
    assert.equal(status.chapters, 2);

    const publish = await fetch(`http://127.0.0.1:${port}/api/admin/imports/${job.id}/publish`, { method: 'POST', headers });
    assert.equal(publish.status, 200);
    const publicBooks = await fetch(`http://127.0.0.1:${port}/api/books`);
    assert.equal((await publicBooks.json()).books[0].title, 'Lifecycle Story');

    const deletion = await fetch(`http://127.0.0.1:${port}/api/admin/imports/${job.id}`, { method: 'DELETE', headers });
    assert.equal(deletion.status, 204);
    const afterDelete = await fetch(`http://127.0.0.1:${port}/api/admin/imports`, { headers });
    assert.equal((await afterDelete.json()).jobs.length, 0);
  } finally {
    server.close();
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('PDF uploads are parsed even when storage removes the file extension', async () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'pdf-admin@example.com';
  process.env.ADMIN_PASSWORD = 'admin@1234';
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pdf-admin@example.com', password: 'admin@1234' })
    });
    const { token } = await login.json();
    const form = new FormData();
    const fixturePath = path.join(process.cwd(), 'storage', 'uploads', 'cf18ad75fc7aa782cac843cd88ebd8c3');
    assert.equal(fs.existsSync(fixturePath), true);
    form.append('file', new File([fs.readFileSync(fixturePath)], 'research.pdf', { type: 'application/pdf' }));
    form.append('title', 'PDF Detection Test');
    form.append('category', 'history');
    form.append('description', 'Checks PDF signature detection.');
    const upload = await fetch(`http://127.0.0.1:${port}/api/books/import`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    const job = await upload.json();
    let result;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const status = await fetch(`http://127.0.0.1:${port}/api/books/import/${job.id}`, { headers: { authorization: `Bearer ${token}` } });
      result = await status.json();
      if (result.status === 'ready' || result.status === 'failed') break;
    }
    assert.equal(result.status, 'ready');
    assert.equal(result.errorMessage, null);
    assert.ok(result.chapters > 0);
  } finally {
    server.close();
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('authenticated users can upload a profile picture', async () => {
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const register = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Photo Reader', email: 'photo@example.com', password: 'strong-password' })
    });
    const { token } = await register.json();
    const form = new FormData();
    form.append('avatar', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], 'avatar.png', { type: 'image/png' }));
    const upload = await fetch(`http://127.0.0.1:${port}/api/auth/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    assert.equal(upload.status, 200);
    const result = await upload.json();
    assert.match(result.user.avatarUrl, /^\/uploads\/avatars\//);
  } finally {
    server.close();
  }
});

test('account data can be exported and deleted', async () => {
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret', frontendOrigin: 'http://localhost:3001' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const register = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Privacy Reader', email: 'privacy@example.com', password: 'strong-password' })
    });
    const { token, user } = await register.json();
    const headers = { authorization: `Bearer ${token}` };
    const exported = await fetch(`http://127.0.0.1:${port}/api/auth/export`, { headers });
    assert.equal(exported.status, 200);
    assert.equal((await exported.json()).user.email, 'privacy@example.com');
    const deleted = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { method: 'DELETE', headers });
    assert.equal(deleted.status, 204);
    const me = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers });
    assert.equal(me.status, 401);
    assert.ok(user.id);
  } finally {
    server.close();
  }
});

test('rejects a document whose content does not match its extension', async () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'validation-admin@example.com';
  process.env.ADMIN_PASSWORD = 'admin@1234';
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'validation-admin@example.com', password: 'admin@1234' }) });
    const { token } = await login.json();
    const form = new FormData();
    form.append('file', new File([Buffer.from('not a pdf')], 'fake.pdf', { type: 'application/pdf' }));
    form.append('title', 'Invalid upload');
    form.append('category', 'history');
    form.append('description', 'Invalid document.');
    const response = await fetch(`http://127.0.0.1:${port}/api/books/import`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /file content/i);
  } finally {
    server.close();
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('CORS only allows the configured frontend origin', async () => {
  const app = createApp({ databasePath: ':memory:', jwtSecret: 'test-secret', frontendOrigin: 'http://allowed.example' });
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { origin: 'http://blocked.example' } });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    server.close();
  }
});
