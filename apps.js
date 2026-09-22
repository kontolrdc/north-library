let balance = 0;
let selectedTopUpAmount = 10;
let savedBooks = JSON.parse(localStorage.getItem('nhl-saved-books') || '[]');
let chaptersRead = Number(localStorage.getItem('nhl-chapters-read') || 3);
let currentChapterId = 'kingship-of-yikpee-chapter-3';
let unlockedChapters = JSON.parse(localStorage.getItem('nhl-unlocked-chapters') || '[]');
let unlockedPages = JSON.parse(localStorage.getItem('nhl-unlocked-pages') || '{}');
let unlockedStories = JSON.parse(localStorage.getItem('nhl-unlocked-stories') || '{}');
let activeBookId = 'kingship-of-yikpee';
let bookProgress = JSON.parse(localStorage.getItem('nhl-book-progress') || '{}');
let importedBooks = JSON.parse(localStorage.getItem('nhl-imported-books') || '[]');
let readerPage = 0;
let adminImportTimer;
const BUSINESS_RULES = {
  pagePrice: 1,
  pagesPerUnlockedChapter: 3,
  defaultFreePages: 1,
  topUpOptions: [10, 20, 50, 100],
  uploadsRequireAdmin: true,
  adminRole: 'admin',
  antiCaptureEnabled: true
};

function getSessionToken() {
  return localStorage.getItem('nhl-token') || '';
}

async function apiRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getSessionToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}
const defaultReaderPages = [
  '<p>At the edge of the northern market, elders gathered beneath the shade of the baobab to speak about memory, inheritance, and the path of the seasons. Every story was evidence that the land had been shaped by people who listened closely.</p>',
  '<p>From Lawra to Wa and the broader northern belt, oral tradition carried names, laws, and cautionary lessons from one generation to the next. The children learned early that history is not only memorized; it is lived.</p><p>What was shared that afternoon was not a myth. It was a map made of song, ceremony, land, and the remembering of elders who refused to let it fade.</p>',
  '<p>By sunset, the drums had told the story far beyond the market square. The community understood that knowledge could travel without losing its roots, and that a people are strongest when they keep their memory alive.</p>'
];
let readerPages = defaultReaderPages;

if (!bookProgress['kingship-of-yikpee'] && chaptersRead > 0) {
  bookProgress['kingship-of-yikpee'] = { currentChapter: Math.min(chaptersRead, 9), completedChapters: [] };
  localStorage.setItem('nhl-book-progress', JSON.stringify(bookProgress));
}
const bookDetails = {
  'root-of-kontol': { title: 'Roots of the North', category: 'History', description: 'How the earliest communities shaped the traditions, trade, and identity of northern Ghana.', chapters: 6, readerTitle: 'Roots of the North', freeChapter: 1 },
  'kingship-of-yikpee': { title: 'The Royal Line of Lawra', category: 'History · Leadership', description: 'How leadership, ritual, and memory were carried through northern communities across generations.', chapters: 9, readerTitle: 'The Royal Line of Lawra', freeChapter: 3 },
  'kobine-festival': { title: 'The Story behind Kobine Festival', category: 'Festivals', description: 'Why the festival remains a living expression of identity, gratitude, and community memory.', chapters: 4, readerTitle: 'The story behind Kobine Festival', freeChapter: 2 },
  'dagbon-kingdom': { title: 'The Dagbon Kingdom', category: 'History · Leadership', description: 'Leadership, succession, and the institutions that held one of the north’s great kingdoms together.', chapters: 11, readerTitle: 'The Dagbon Kingdom', freeChapter: 1 },
  'nkrumah-lawra': { title: 'Nkrumah in the North', category: 'History', description: 'A look at how national politics and local memory met in the villages beyond the capital.', chapters: 5, readerTitle: 'Nkrumah in the North', freeChapter: 1 },
  'education-north': { title: 'Education in the North', category: 'Education', description: 'How schools, teachers, and communities built access to learning across the region.', chapters: 7, readerTitle: 'Education in the North', freeChapter: 1 }
};

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getChapterNumberFromId(chapterId) {
  return Number(String(chapterId || '').match(/chapter-(\d+)$/)?.[1] || 0);
}

function getFreeChapterLimit(bookId) {
  const book = bookDetails[bookId];
  return Number(book?.freeChapter || BUSINESS_RULES.defaultFreeChapter);
}

function isFreeChapterAccess(bookId, chapterId = currentChapterId) {
  const chapterNumber = getChapterNumberFromId(chapterId);
  return chapterNumber <= getFreeChapterLimit(bookId);
}

function addImportedBook(book) {
  importedBooks.push(book);
  bookDetails[book.id] = book;
  localStorage.setItem('nhl-imported-books', JSON.stringify(importedBooks));
}

function renderImportedBook(book) {
  const grid = document.querySelector('.book-grid');
  if (!grid || grid.querySelector('[data-book-id="' + book.id + '"]')) return;

  const card = document.createElement('div');
  card.className = 'card book-card';
  card.dataset.bookId = book.id;
  card.dataset.bookTitle = book.title;
  card.dataset.category = normalizeCategories(book.category);
  card.dataset.chapters = String(book.chapters || 0);
  card.dataset.progress = '0';

  const pill = document.createElement('span');
  pill.className = 'pill pill-processing sans';
  pill.textContent = book.status === 'published' ? 'Published' : book.status === 'ready' ? 'Ready to review' : book.status === 'failed' ? 'Extraction failed' : 'Extraction pending';
  card.appendChild(pill);

  const title = document.createElement('h3');
  title.style.cssText = 'font-size:20px;margin:12px 0 8px;';
  title.textContent = book.title;
  card.appendChild(title);

  const description = document.createElement('p');
  description.className = 'sans';
  description.style.cssText = 'font-size:13px;color:var(--ink-dim);line-height:1.6;margin:0 0 14px;';
  description.textContent = book.description;
  card.appendChild(description);

  const meta = document.createElement('div');
  meta.className = 'sans';
  meta.style.cssText = 'font-size:12px;color:var(--ink-dim);';
  meta.textContent = book.chapters ? book.chapters + ' chapters · Extraction ' + book.status : 'Chapters will appear after extraction';
  card.appendChild(meta);

  const progress = document.createElement('div');
  progress.className = 'book-progress';
  progress.innerHTML = '<span style="width:0%"></span>';
  card.appendChild(progress);

  const progressLabel = document.createElement('div');
  progressLabel.className = 'progress-label';
  progressLabel.textContent = 'Not started';
  card.appendChild(progressLabel);

  const openButton = document.createElement('button');
  openButton.className = 'cta book-open';
  openButton.type = 'button';
  openButton.textContent = ['ready', 'published'].includes(book.status) ? 'Review chapters' : 'View extraction status';
  openButton.addEventListener('click', () => openBookDetails(book.id));
  card.appendChild(openButton);

  const saveButton = document.createElement('button');
  saveButton.className = 'save-book';
  saveButton.type = 'button';
  saveButton.textContent = 'Save for later';
  saveButton.addEventListener('click', () => saveBook(book.id));
  card.appendChild(saveButton);
  grid.appendChild(card);
}

function normalizeCategories(value) {
  return String(value || '').toLowerCase().split(/[,·|]+|\s+/).map((category) => category.trim()).filter(Boolean).join(' ');
}

function renderImportedBooks() {
  importedBooks.forEach((book) => {
    bookDetails[book.id] = book;
    renderImportedBook(book);
  });
}

async function loadPublishedBooks() {
  try {
    const result = await apiRequest('/api/books');
    result.books.forEach((book) => {
      if (bookDetails[book.id]) return;
      const publishedBook = { ...book, readerTitle: book.title, freeChapter: 1 };
      bookDetails[book.id] = publishedBook;
      renderImportedBook(publishedBook);
    });
    updateLibraryProgress();
    sortAndFilterLibrary();
  } catch {
    // The built-in collection remains available if the public API is unavailable.
  }
}

function renderAdminImports(jobs) {
  const list = document.getElementById('admin-import-list');
  if (!list) return;
  list.innerHTML = '';
  if (!jobs.length) {
    list.innerHTML = '<p class="admin-import-empty">No story imports yet.</p>';
    return;
  }
  jobs.forEach((job) => {
    const row = document.createElement('article');
    row.className = 'admin-import-row';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = job.title;
    const meta = document.createElement('span');
    meta.textContent = job.chapters ? job.chapters + ' chapters · ' + job.status : job.status;
    details.append(title, meta);
    if (job.errorMessage) {
      const error = document.createElement('small');
      error.textContent = job.errorMessage;
      details.appendChild(error);
    }
    const actions = document.createElement('div');
    actions.className = 'admin-import-actions';
    if (job.status === 'failed') actions.appendChild(createImportAction(job, 'Retry', 'retry'));
    if (job.status === 'ready') actions.appendChild(createImportAction(job, 'Publish to readers', 'publish'));
    actions.appendChild(createImportAction(job, 'Delete', 'delete'));
    row.append(details, actions);
    list.appendChild(row);
  });
}

function createImportAction(job, label, action) {
  const button = document.createElement('button');
  button.className = action === 'publish' ? 'cta' : action === 'delete' ? 'save-book' : 'ghost';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => manageImport(job.id, action));
  return button;
}

async function loadAdminImports() {
  if (!isAdmin()) return;
  try {
    const result = await apiRequest('/api/admin/imports');
    renderAdminImports(result.jobs);
    const active = result.jobs.some((job) => ['queued', 'extracting'].includes(job.status));
    if (active && !adminImportTimer) adminImportTimer = window.setInterval(loadAdminImports, 3000);
    if (!active && adminImportTimer) {
      window.clearInterval(adminImportTimer);
      adminImportTimer = undefined;
    }
  } catch (error) {
    const list = document.getElementById('admin-import-list');
    if (list) list.textContent = error.message;
  }
}

async function manageImport(id, action) {
  if (action === 'delete' && !window.confirm('Delete this story import and its uploaded file?')) return;
  try {
    const endpoint = action === 'delete' ? '/api/admin/imports/' + id : '/api/admin/imports/' + id + '/' + action;
    await apiRequest(endpoint, { method: action === 'delete' ? 'DELETE' : 'POST' });
    await loadAdminImports();
    if (action === 'publish') await loadPublishedBooks();
  } catch (error) {
    const list = document.getElementById('admin-import-list');
    if (list) list.textContent = error.message;
  }
}

function openUpload() {
  if (!isAdmin()) {
    openProfileScreen('login');
    const status = document.getElementById('login-status');
    if (status) {
      status.textContent = 'Administrator access is required to upload books.';
      status.className = 'auth-status error';
    }
    return;
  }
  showScreen('upload', null);
  loadAdminImports();
  document.getElementById('book-file')?.focus();
}

function bindUpload() {
  document.querySelectorAll('[data-open-upload]').forEach((button) => button.addEventListener('click', openUpload));
  document.getElementById('refresh-imports')?.addEventListener('click', loadAdminImports);
  const form = document.getElementById('book-upload-form');
  const fileInput = document.getElementById('book-file');
  const fileName = document.getElementById('book-file-name');
  const submitButton = form?.querySelector('button[type="submit"]');
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) fileName.textContent = fileInput.files[0].name;
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput?.files[0];
    const status = document.getElementById('upload-status');
    if (!file) return;

    const book = {
      id: 'import-' + slugify(document.getElementById('book-title').value) + '-' + Date.now(),
      title: document.getElementById('book-title').value.trim(),
      category: document.getElementById('book-category').value,
      description: document.getElementById('book-description').value.trim(),
      chapters: 0,
      status: 'queued',
      sourceFileName: file.name,
      uploadedAt: new Date().toISOString()
    };

    status.textContent = 'Sending ' + file.name + ' for extraction...';
    status.className = 'upload-status';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Uploading story...';
    }
    const payload = new FormData();
    payload.append('file', file);
    payload.append('title', book.title);
    payload.append('category', book.category);
    payload.append('description', book.description);

    try {
      const imported = await apiRequest('/api/books/import', { method: 'POST', body: payload });
      Object.assign(book, imported, { id: imported.id || book.id, status: imported.status || 'queued' });
      status.textContent = 'Upload received. Chapter extraction is in progress.';
      addImportedBook(book);
      renderImportedBook(book);
      updateSaveButtons();
      sortAndFilterLibrary();
      form.reset();
      fileName.textContent = 'PDF, EPUB, DOC, or DOCX up to 50 MB';
      status.classList.add('success');
    } catch (error) {
      status.textContent = error.message;
      status.className = 'upload-status error';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Send for chapter extraction';
      }
    }
    loadAdminImports();
  });
}

function fmt(n) {
  return 'GHS ' + n.toFixed(2);
}

function syncNav(id) {
  const navButtons = document.querySelectorAll('.navbtn');
  navButtons.forEach((button) => button.classList.remove('active'));

  const map = { library: 0, reader: 1, wallet: 2 };
  const index = map[id];

  if (index !== undefined && navButtons[index]) {
    navButtons[index].classList.add('active');
  }
}

function showScreen(id, btn) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
  }

  syncNav(id);

  window.scrollTo({ top: 0, behavior: 'auto' });
}

function openBook(title, totalChapters, freeChapters) {
  const matchingBook = Object.entries(bookDetails).find(([, book]) => book.readerTitle === title || book.title === title);
  if (matchingBook) {
    activeBookId = matchingBook[0];
  }

  currentChapterId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-chapter-' + freeChapters;
  readerPage = 0;
  readerPages = defaultReaderPages;
  const currentProgress = bookProgress[activeBookId] || { currentChapter: 0, completedChapters: [] };
  currentProgress.currentChapter = Math.max(currentProgress.currentChapter, Number(freeChapters));
  bookProgress[activeBookId] = currentProgress;
  localStorage.setItem('nhl-book-progress', JSON.stringify(bookProgress));
  const readerTitle = document.getElementById('reader-title');
  const readerProgress = document.getElementById('reader-progress');
  if (readerTitle) readerTitle.textContent = 'Reading ' + title;
  if (readerProgress) readerProgress.textContent = 'Chapter ' + freeChapters + ' of ' + totalChapters;
  const label = document.getElementById('reader-chapter-label');
  if (label) {
    label.textContent = title + ' · Chapter ' + freeChapters;
  }

  showScreen('reader', null);
  syncNav('reader');
  localStorage.setItem('nhl-last-chapter', currentChapterId);
  updateLibraryProgress();
  renderReaderState();
  if (bookDetails[activeBookId]?.status === 'published') loadPublishedContent(activeBookId);
}

async function loadPublishedContent(bookId) {
  try {
    const result = await apiRequest('/api/books/' + encodeURIComponent(bookId) + '/content');
    if (activeBookId !== bookId || !result.pages.length) return;
    readerPages = result.pages;
    readerPage = Math.min(readerPage, readerPages.length - 1);
    renderReaderState();
  } catch {
    // Keep the reader shell available if published content is temporarily unavailable.
  }
}

function restorePaymentReader(bookId, pageIndex) {
  const book = bookDetails[bookId];
  if (!book) return;
  openBook(book.readerTitle || book.title, String(book.chapters), String(book.freeChapter || 1));
  readerPage = Math.max(0, Number(pageIndex) || 0);
  renderReaderState();
}

function goToBook(title, totalChapters, freeChapters) {
  openBook(title, totalChapters, freeChapters);
}

function openBookDetails(id) {
  const book = bookDetails[id];
  if (!book) return;
  activeBookId = id;
  document.getElementById('details-title').textContent = book.title;
  document.getElementById('details-category').textContent = book.category;
  document.getElementById('details-description').textContent = book.description;
  document.getElementById('details-chapters').textContent = book.chapters ? book.chapters + ' chapters' : 'Chapters pending extraction';
  const saved = savedBooks.some((item) => item.id === id);
  document.getElementById('details-save').textContent = saved ? 'Remove from saved' : 'Save for later';
  const progress = bookProgress[id]?.currentChapter || 0;
  document.getElementById('details-progress').textContent = book.status && book.status !== 'ready' ? 'Extraction ' + book.status : progress ? 'In progress · Chapter ' + progress : 'Not started';
  const unavailable = book.status && !['ready', 'published'].includes(book.status);
  document.getElementById('details-open').textContent = unavailable ? 'Awaiting extraction' : 'Continue reading';
  document.getElementById('details-open').disabled = Boolean(unavailable);
  showScreen('book-details', null);
}

function sortAndFilterLibrary() {
  const category = document.getElementById('library-category')?.value || 'all';
  const sort = document.getElementById('library-sort')?.value || 'featured';
  const query = document.getElementById('site-search')?.value.trim().toLowerCase() || '';
  const grid = document.querySelector('.book-grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.book-card')];
  const filtered = cards.filter((card) => {
    const matchesQuery = !query || card.textContent.toLowerCase().includes(query);
    const categories = normalizeCategories(card.dataset.category).split(' ');
    const matchesCategory = category === 'all' || (category === 'saved' ? savedBooks.some((book) => book.id === card.dataset.bookId) : category === 'progress' ? Number(card.dataset.progress) > 0 : categories.includes(category));
    return matchesQuery && matchesCategory;
  });
  filtered.sort((a, b) => {
    if (sort === 'title') return a.dataset.bookTitle.localeCompare(b.dataset.bookTitle);
    if (sort === 'chapters-asc') return Number(a.dataset.chapters) - Number(b.dataset.chapters);
    if (sort === 'chapters-desc') return Number(b.dataset.chapters) - Number(a.dataset.chapters);
    if (sort === 'progress') return Number(b.dataset.progress) - Number(a.dataset.progress);
    return cards.indexOf(a) - cards.indexOf(b);
  });
  cards.forEach((card) => { card.hidden = !filtered.includes(card); });
  filtered.forEach((card) => grid.appendChild(card));
  const emptyState = document.getElementById('library-empty');
  if (emptyState) emptyState.hidden = filtered.length > 0;
  const count = document.getElementById('library-result-count');
  const context = document.getElementById('library-result-context');
  if (count) count.textContent = filtered.length + (filtered.length === 1 ? ' book' : ' books');
  if (context) context.textContent = query ? 'matching your search' : 'in the collection';
  document.querySelectorAll('[data-library-category]').forEach((button) => {
    const active = button.dataset.libraryCategory === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setLibraryCategory(category) {
  const select = document.getElementById('library-category');
  if (select) select.value = category;
  sortAndFilterLibrary();
}

function getPageUnlockKey(pageIndex) {
  return activeBookId + ':' + pageIndex;
}

function isPageUnlocked(pageIndex = readerPage) {
  if (pageIndex === 0) return true;
  return Boolean(unlockedStories[activeBookId] || unlockedPages[getPageUnlockKey(pageIndex)]);
}

async function loadPaymentState() {
  if (!getSessionToken()) return;
  try {
    const result = await apiRequest('/api/payments/entitlements');
    result.entitlements.forEach((entitlement) => {
      unlockedPages[entitlement.bookId + ':' + entitlement.pageIndex] = true;
    });
    result.stories.forEach((story) => {
      unlockedStories[story.bookId] = true;
    });
    localStorage.setItem('nhl-unlocked-pages', JSON.stringify(unlockedPages));
    localStorage.setItem('nhl-unlocked-stories', JSON.stringify(unlockedStories));
    renderReaderState();
    const payments = await apiRequest('/api/payments/me');
    const list = document.getElementById('activity-list');
    if (list) {
      list.innerHTML = '';
      payments.payments.forEach((payment) => {
        const row = document.createElement('div');
        row.className = 'activity-row';
        const access = payment.scope === 'story' ? 'Whole story' : 'Page ' + (payment.pageIndex + 1);
        row.innerHTML = '<span>' + access + ' · ' + payment.bookId + '</span><span class="pos">Paid GHS ' + (payment.amountMinor / 100).toFixed(2) + '</span>';
        list.appendChild(row);
      });
    }
  } catch {
    // A signed-out or unavailable account should not prevent free previews.
  }
}

function refreshBalanceDisplays() {
  const navBalance = document.getElementById('nav-balance');
  const walletBalance = document.getElementById('wallet-balance');
  const libraryBalance = document.getElementById('library-balance');
  const readerBalance = document.getElementById('reader-balance-line');

  if (navBalance) navBalance.textContent = 'Pay per page';
  if (walletBalance) walletBalance.textContent = 'PayStack';
  if (libraryBalance) libraryBalance.textContent = 'PayStack';

  if (readerBalance) {
    readerBalance.textContent = 'Secure PayStack payment · This page: GHS ' + BUSINESS_RULES.pagePrice.toFixed(2);
  }

  const profileBalance = document.querySelector('.profile-stats strong[data-profile-balance]');
  const profileChapters = document.querySelector('[data-profile-chapters]');
  if (profileBalance) profileBalance.textContent = 'Pay per page';
  if (profileChapters) profileChapters.textContent = chaptersRead;
}

function topUp(amount) {
  const status = document.getElementById('topup-status');
  if (status) {
    status.textContent = 'Pages are paid for individually when you reach them.';
    status.className = 'topup-status error';
  }
}

function openTopUp() {
  showScreen('topup', null);
  toggleProfileMenu(false);
}

function bindTopUp() {
  document.querySelectorAll('[data-open-topup]').forEach((button) => {
    button.addEventListener('click', openTopUp);
  });

  document.querySelectorAll('[data-topup-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedTopUpAmount = Number(button.dataset.topupAmount);
      document.querySelectorAll('[data-topup-amount]').forEach((option) => option.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('topup-total').textContent = fmt(selectedTopUpAmount);
    });
  });

  const confirmButton = document.getElementById('confirm-topup');
  if (!confirmButton) return;

  confirmButton.addEventListener('click', () => {
    const reference = document.getElementById('payment-reference').value.trim();
    const status = document.getElementById('topup-status');

    if (!reference) {
      status.textContent = 'Enter your mobile number or card reference to continue.';
      status.className = 'topup-status error';
      return;
    }

    status.textContent = 'Open a book and choose Unlock page to pay securely with PayStack.';
    status.className = 'topup-status success';
  });
}

async function unlockChapter() {
  const status = document.getElementById('reader-status');
  const pageKey = getPageUnlockKey(readerPage);

  if (readerPage === 0 || isPageUnlocked(readerPage)) {
    unlockedPages[pageKey] = true;
    localStorage.setItem('nhl-unlocked-pages', JSON.stringify(unlockedPages));
    renderReaderState();
    if (status) {
      status.textContent = 'This page is already available in your current reading session.';
      status.className = 'reader-status success';
    }
    return;
  }

  if (!getSessionToken()) {
    openProfileScreen('login');
    if (status) status.textContent = 'Log in or create an account before paying for a page.';
    return;
  }
  const button = document.getElementById('unlock-chapter');
  button.disabled = true;
  try {
    const paymentMethod = document.getElementById('reader-payment-method')?.value || 'mobile_money';
    const scope = document.getElementById('reader-payment-scope')?.value || 'page';
    const momoNumber = document.getElementById('reader-momo-number')?.value.trim();
    const momoProvider = document.getElementById('reader-momo-provider')?.value;
    if (paymentMethod === 'mobile_money' && (!momoNumber || !momoProvider)) throw new Error('Enter your MoMo number and choose your network.');
    const result = await apiRequest('/api/payments/paystack/initialize', { method: 'POST', body: JSON.stringify({ bookId: activeBookId, pageIndex: readerPage, scope, paymentMethod, momoNumber, momoProvider }) });
    window.location.assign(result.authorizationUrl);
  } catch (error) {
    button.disabled = false;
    if (status) {
      status.textContent = error.message;
      status.className = 'reader-status error';
    }
  }
}

function bindReaderPaymentFields() {
  const method = document.getElementById('reader-payment-method');
  const momoFields = document.getElementById('momo-fields');
  const updateMomoFields = () => {
    if (momoFields) momoFields.hidden = method?.value !== 'mobile_money';
  };
  method?.addEventListener('change', updateMomoFields);
  updateMomoFields();
}

function renderReaderState() {
  const paywall = document.getElementById('reader-paywall');
  const unlockButton = document.getElementById('unlock-chapter');
  const status = document.getElementById('reader-status');
  const chapterNumber = getChapterNumberFromId(currentChapterId);
  const isFree = readerPage === 0 && isFreeChapterAccess(activeBookId, currentChapterId);
  const isUnlocked = isPageUnlocked(readerPage) || isFree;

  renderReaderPage();
  if (paywall) paywall.hidden = isUnlocked;
  if (unlockButton) unlockButton.disabled = isUnlocked;
  if (status && isUnlocked) {
    const message = isFree ? 'This page is part of the free preview for this title.' : 'This page is unlocked. Your access is saved for this reader.';
    status.textContent = message;
    status.className = 'reader-status success';
  } else if (status) {
    status.textContent = '';
    status.className = 'reader-status';
  }

  const readerBalance = document.getElementById('reader-balance-line');
  if (readerBalance) {
    const pageCost = isFree ? 'Free' : fmt(BUSINESS_RULES.pagePrice);
    readerBalance.textContent = isFree ? 'Free preview · This page: Free' : 'Secure PayStack payment · This page: ' + pageCost;
  }
}

function renderReaderPage() {
  const content = document.getElementById('reader-page-content');
  const indicator = document.getElementById('reader-page-indicator');
  const previous = document.getElementById('reader-prev');
  const next = document.getElementById('reader-next');
  if (!content) return;

  const isUnlocked = isPageUnlocked(readerPage);
  const isPreviewPage = readerPage === 0;
  content.innerHTML = isPreviewPage && !isUnlocked ? readerPages[readerPage] : isUnlocked ? readerPages[readerPage] : '<div class="locked-page"><span>Page locked</span><p>Unlock this page for GHS 1.00 through PayStack.</p></div>';
  if (indicator) indicator.textContent = 'Page ' + (readerPage + 1) + ' of ' + readerPages.length;
  if (previous) previous.disabled = readerPage === 0;
  if (next) next.disabled = readerPage === readerPages.length - 1 || (!isUnlocked && readerPage > 0);
}

function saveBook(id) {
  const card = document.querySelector('[data-book-id="' + id + '"]');
  if (!card) return;

  const title = card.dataset.bookTitle;
  if (savedBooks.some((book) => book.id === id)) {
    savedBooks = savedBooks.filter((book) => book.id !== id);
  } else {
    savedBooks.push({ id, title });
  }

  localStorage.setItem('nhl-saved-books', JSON.stringify(savedBooks));
  renderSavedBooks();
  updateSaveButtons();
}

function updateSaveButtons() {
  document.querySelectorAll('[data-save-book]').forEach((button) => {
    const isSaved = savedBooks.some((book) => book.id === button.dataset.saveBook);
    button.textContent = isSaved ? 'Remove from saved' : 'Save for later';
    button.classList.toggle('saved', isSaved);
  });
}

function updateLibraryProgress() {
  document.querySelectorAll('.book-card').forEach((card) => {
    const bookId = card.dataset.bookId;
    const totalChapters = Number(card.dataset.chapters);
    const savedProgress = bookProgress[bookId];
    const currentChapter = savedProgress?.currentChapter || 0;
    const progress = Math.min(100, Math.round((currentChapter / totalChapters) * 100));
    card.dataset.progress = String(progress);
    const bar = card.querySelector('.book-progress span');
    const label = card.querySelector('.progress-label');
    if (bar) bar.style.width = progress + '%';
    if (label) label.textContent = progress > 0 ? 'In progress · Chapter ' + currentChapter + ' of ' + totalChapters : 'Not started';
  });
}

function renderSavedBooks() {
  const container = document.getElementById('saved-books');
  const empty = document.getElementById('saved-empty');
  if (!container || !empty) return;

  container.innerHTML = '';
  empty.hidden = savedBooks.length > 0;

  savedBooks.forEach((book) => {
    const row = document.createElement('div');
    row.className = 'saved-book-row';
    row.innerHTML = '<span>' + book.title + '</span><button class="ghost" type="button" data-remove-saved="' + book.id + '">Remove</button>';
    container.appendChild(row);
  });

  container.querySelectorAll('[data-remove-saved]').forEach((button) => {
    button.addEventListener('click', () => saveBook(button.dataset.removeSaved));
  });
}

function filterBooks(query) {
  const normalized = query.trim().toLowerCase();
  let visible = 0;

  if (normalized && !document.getElementById('library')?.classList.contains('active')) {
    showScreen('library', null);
  }

  document.querySelectorAll('.book-card').forEach((card) => { if (!normalized || card.textContent.toLowerCase().includes(normalized)) visible += 1; });
  sortAndFilterLibrary();

  const empty = document.getElementById('search-empty');
  if (empty) empty.hidden = visible > 0;
}

function toggleSearchPanel(forceOpen) {
  const panel = document.getElementById('search-panel');
  const searchToggle = document.getElementById('search-toggle');
  if (!panel || !searchToggle) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.hidden;
  panel.hidden = !shouldOpen;
  searchToggle.setAttribute('aria-expanded', String(shouldOpen));

  if (shouldOpen) {
    document.getElementById('site-search')?.focus();
  }
}

function toggleProfileMenu(forceOpen) {
  const menu = document.getElementById('profile-menu');
  const button = document.getElementById('profile-trigger');
  if (!menu || !button) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.hidden;
  menu.hidden = !shouldOpen;
  button.setAttribute('aria-expanded', String(shouldOpen));
}

function openProfileScreen(id) {
  showScreen(id, null);
  toggleProfileMenu(false);
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('nhl-settings') || '{}');
  const reminders = document.getElementById('setting-reminders');
  const motion = document.getElementById('setting-motion');
  const textSize = document.getElementById('setting-text-size');

  if (reminders) reminders.checked = saved.reminders !== false;
  if (motion) motion.checked = saved.motion === true;
  if (textSize) textSize.value = saved.textSize || 'standard';
}

function bindSettings() {
  loadSettings();

  const form = document.getElementById('settings-form');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const settings = {
      reminders: document.getElementById('setting-reminders').checked,
      motion: document.getElementById('setting-motion').checked,
      textSize: document.getElementById('setting-text-size').value
    };

    localStorage.setItem('nhl-settings', JSON.stringify(settings));
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.reducedMotion = String(settings.motion);
    document.getElementById('settings-status').textContent = 'Settings saved';
  });
}

function updateProfileName() {
  const savedUser = JSON.parse(localStorage.getItem('nhl-user') || '{}');
  const name = document.querySelector('.profile-identity h1');
  if (name && savedUser.name) name.textContent = savedUser.name;
  document.querySelectorAll('[data-user-avatar]').forEach((image) => {
    image.src = savedUser.avatarUrl || 'images/profile.jpeg';
  });
}

async function uploadAvatar(file) {
  const status = document.getElementById('avatar-status');
  if (!file) return;
  const payload = new FormData();
  payload.append('avatar', file);
  if (status) {
    status.textContent = 'Uploading your photo...';
    status.className = 'auth-status';
  }
  try {
    const result = await apiRequest('/api/auth/avatar', { method: 'POST', body: payload });
    const user = { ...JSON.parse(localStorage.getItem('nhl-user') || '{}'), ...result.user };
    localStorage.setItem('nhl-user', JSON.stringify(user));
    updateProfileName();
    if (status) {
      status.textContent = 'Profile photo updated.';
      status.className = 'auth-status success';
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = 'auth-status error';
    }
  }
}

function updateProfileMenu() {
  const signedIn = Boolean(localStorage.getItem('nhl-session'));
  const session = JSON.parse(localStorage.getItem('nhl-session') || '{}');
  const user = JSON.parse(localStorage.getItem('nhl-user') || '{}');
  const admin = session.role === 'admin' || user.role === 'admin';
  document.querySelectorAll('[data-auth-only]').forEach((item) => {
    item.hidden = !signedIn;
  });
  document.querySelectorAll('[data-guest-only]').forEach((item) => {
    item.hidden = signedIn;
  });
  document.querySelectorAll('[data-admin-only]').forEach((item) => {
    item.hidden = !admin;
  });
}

function isAdmin() {
  const session = JSON.parse(localStorage.getItem('nhl-session') || '{}');
  const user = JSON.parse(localStorage.getItem('nhl-user') || '{}');
  return session.role === 'admin' || user.role === 'admin';
}

function updateContinueReading() {
  const continueReading = document.getElementById('continue-reading');
  if (continueReading) continueReading.hidden = !localStorage.getItem('nhl-last-chapter');
}

function bindAuth() {
  updateProfileName();
  document.getElementById('avatar-file')?.addEventListener('change', (event) => uploadAvatar(event.target.files[0]));

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? 'Show' : 'Hide';
    });
  });

  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('login-status');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('nhl-token', result.token);
      localStorage.setItem('nhl-user', JSON.stringify(result.user));
      localStorage.setItem('nhl-session', JSON.stringify(result.user));
      updateProfileName();
      updateProfileMenu();
      await loadPaymentState();
      status.textContent = 'You are logged in. Welcome back.';
      status.className = 'auth-status success';
      showScreen('library', null);
      syncNav('library');
    } catch (error) {
      status.textContent = error.message;
      status.className = 'auth-status error';
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('register-status');
    const user = {
      name: document.getElementById('register-name').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value
    };

    try {
      const result = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(user) });
      localStorage.removeItem('nhl-token');
      localStorage.removeItem('nhl-session');
      localStorage.setItem('nhl-user', JSON.stringify(result.user));
      openProfileScreen('login');
      const loginEmail = document.getElementById('login-email');
      if (loginEmail) loginEmail.value = user.email;
      const loginStatus = document.getElementById('login-status');
      if (loginStatus) {
        loginStatus.textContent = 'Account created. Your email is ready. Enter your password to continue.';
        loginStatus.className = 'auth-status success';
      }
    } catch (error) {
      status.textContent = error.message;
      status.className = 'auth-status error';
    }
  });
}

function bindActions() {
  document.getElementById('search-toggle')?.addEventListener('click', () => {
    toggleSearchPanel();
  });

  document.getElementById('search-close')?.addEventListener('click', () => {
    toggleSearchPanel(false);
    const input = document.getElementById('site-search');
    if (input) input.value = '';
    filterBooks('');
  });

  document.getElementById('site-search')?.addEventListener('input', (event) => {
    filterBooks(event.target.value);
  });

  document.getElementById('library-category')?.addEventListener('change', sortAndFilterLibrary);
  document.querySelectorAll('[data-library-category]').forEach((button) => {
    button.addEventListener('click', () => setLibraryCategory(button.dataset.libraryCategory));
  });
  document.getElementById('library-sort')?.addEventListener('change', sortAndFilterLibrary);
  document.querySelectorAll('[data-open-book]').forEach((button) => button.addEventListener('click', () => openBookDetails(button.dataset.openBook)));
  document.getElementById('details-open')?.addEventListener('click', () => {
    const book = bookDetails[activeBookId];
    if (book && book.chapters) openBook(book.readerTitle || book.title, String(book.chapters), String(book.freeChapter || 1));
  });
  document.getElementById('details-save')?.addEventListener('click', () => saveBook(activeBookId));
  document.querySelectorAll('[data-back-library]').forEach((button) => button.addEventListener('click', () => showScreen('library', null)));

  document.getElementById('profile-trigger')?.addEventListener('click', () => {
    toggleProfileMenu();
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      toggleProfileMenu(false);

      if (action === 'profile') {
        openProfileScreen('profile');
      } else if (action === 'reads') {
        openProfileScreen('reading-list');
      } else if (action === 'settings') {
        openProfileScreen('settings');
      } else if (action === 'admin') {
        openUpload();
      } else if (action === 'login') {
        openProfileScreen('login');
      } else if (action === 'register') {
        openProfileScreen('register');
      } else if (action === 'signout') {
        localStorage.removeItem('nhl-session');
        localStorage.removeItem('nhl-token');
        updateProfileMenu();
        openProfileScreen('login');
        const status = document.getElementById('login-status');
        if (status) {
          status.textContent = 'You have been signed out of this demo session.';
          status.className = 'auth-status success';
        }
      }
    });
  });

  document.querySelectorAll('[data-profile-screen]').forEach((button) => {
    button.addEventListener('click', () => openProfileScreen(button.dataset.profileScreen));
  });

  document.querySelector('[data-continue-reading]')?.addEventListener('click', () => {
    openBook('The Royal Line of Lawra', '9', '3');
  });

  document.querySelectorAll('[data-save-book]').forEach((button) => {
    button.addEventListener('click', () => saveBook(button.dataset.saveBook));
  });

  document.querySelectorAll('[data-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      topUp(Number(button.dataset.amount));
    });
  });

  document.addEventListener('contextmenu', (event) => {
    if (BUSINESS_RULES.antiCaptureEnabled) {
      event.preventDefault();
    }
  });

  document.addEventListener('keydown', (event) => {
    const captureHotkeys = ['PrintScreen', 'ScrollLock', 'Meta', 'Control'];
    if (BUSINESS_RULES.antiCaptureEnabled && (captureHotkeys.includes(event.key) || (event.key === 's' && (event.ctrlKey || event.metaKey)))) {
      event.preventDefault();
      const status = document.getElementById('reader-status');
      if (status) {
        status.textContent = 'Screen capture is blocked for paid pages in this reader.';
        status.className = 'reader-status error';
      }
    }
  });

  const topUpBtn = document.getElementById('topup-button');
  if (topUpBtn) {
    topUpBtn.addEventListener('click', () => {
      openTopUp();
    });
  }

  const unlockButton = document.getElementById('unlock-chapter');
  if (unlockButton) {
    unlockButton.addEventListener('click', unlockChapter);
  }

  document.getElementById('reader-prev')?.addEventListener('click', () => {
    if (readerPage > 0) {
      readerPage -= 1;
      renderReaderState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('reader-next')?.addEventListener('click', () => {
    if (readerPage < readerPages.length - 1 && isPageUnlocked(readerPage)) {
      readerPage += 1;
      renderReaderState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.addEventListener('click', (event) => {
    const profileWrap = document.querySelector('.profile-wrap');
    const searchPanel = document.getElementById('search-panel');

    if (profileWrap && !profileWrap.contains(event.target)) {
      toggleProfileMenu(false);
    }

    if (searchPanel && !searchPanel.contains(event.target) && !document.getElementById('search-toggle')?.contains(event.target)) {
      toggleSearchPanel(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleProfileMenu(false);
      toggleSearchPanel(false);
    }

    if (document.getElementById('reader')?.classList.contains('active')) {
      if (event.key === 'ArrowLeft' && readerPage > 0) {
        readerPage -= 1;
        renderReaderState();
      }
      if (event.key === 'ArrowRight' && readerPage < readerPages.length - 1 && isPageUnlocked(readerPage)) {
        readerPage += 1;
        renderReaderState();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshBalanceDisplays();
  bindActions();
  bindUpload();
  bindSettings();
  bindAuth();
  bindTopUp();
  bindReaderPaymentFields();
  updateProfileMenu();
  updateContinueReading();
  renderReaderState();
  loadPaymentState();
  const paymentParams = new URLSearchParams(window.location.search);
  const paymentReference = paymentParams.get('reference');
  const paymentBook = paymentParams.get('payment_book');
  const paymentPage = paymentParams.get('payment_page');
  if (paymentBook && paymentPage) restorePaymentReader(paymentBook, paymentPage);
  if (paymentReference && getSessionToken()) {
    apiRequest('/api/payments/paystack/verify', { method: 'POST', body: JSON.stringify({ reference: paymentReference }) })
      .then((result) => {
        if (result.status === 'success') {
          const verifiedBook = paymentBook || result.payment?.book_id;
          const verifiedPage = paymentPage || result.payment?.page_index;
          const status = document.getElementById('reader-status');
          if (status) {
            status.textContent = 'Payment successful. Your page is now available on your account.';
            status.className = 'reader-status success';
          }
          if (verifiedBook && verifiedPage !== undefined) restorePaymentReader(verifiedBook, verifiedPage);
          return loadPaymentState();
        }
        return null;
      })
      .catch(() => undefined);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  renderImportedBooks();
  loadPublishedBooks();
  renderSavedBooks();
  updateSaveButtons();
  updateLibraryProgress();
  sortAndFilterLibrary();
  toggleSearchPanel(false);
  toggleProfileMenu(false);

  const field = document.getElementById('dust-field');
  if (field && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < 14; i++) {
      const mote = document.createElement('div');
      mote.className = 'dust-mote';
      mote.style.left = Math.random() * 100 + '%';
      mote.style.animationDelay = Math.random() * 9 + 's';
      mote.style.animationDuration = (7 + Math.random() * 6) + 's';
      mote.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
      field.appendChild(mote);
    }
  }
});