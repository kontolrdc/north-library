let balance = Number(localStorage.getItem('nhl-balance') || 12.50);
let selectedTopUpAmount = 10;
let savedBooks = JSON.parse(localStorage.getItem('nhl-saved-books') || '[]');
let chaptersRead = Number(localStorage.getItem('nhl-chapters-read') || 3);
let currentChapterId = 'kingship-of-yikpee-chapter-3';
let unlockedChapters = JSON.parse(localStorage.getItem('nhl-unlocked-chapters') || '[]');
let activeBookId = 'kingship-of-yikpee';
let bookProgress = JSON.parse(localStorage.getItem('nhl-book-progress') || '{}');
let readerPage = 0;
const readerPages = [
  '<p>When the elders of Yikpee sent word that the title would pass, few in the surrounding villages expected the choice they made. The kingship had, until that season, never left the founding compound.</p>',
  '<p>The drought of that year had already begun to move people, herds, and, in time, the seat of authority itself toward the rivers that still ran. The council had to decide whether tradition could move with the people.</p><p>The old tale says they met beneath a baobab so wide a dozen men could not circle it. They listened to the drums and weighed the memory of the dead.</p>',
  '<p>It was not simply succession; it was the proof that the land itself had accepted a new place for leadership. By sunset, the drums carried the decision across the valley.</p><p>The line would move south, but the memory of Yikpee would travel with it.</p>'
];

if (!bookProgress['kingship-of-yikpee'] && chaptersRead > 0) {
  bookProgress['kingship-of-yikpee'] = { currentChapter: Math.min(chaptersRead, 9), completedChapters: [] };
  localStorage.setItem('nhl-book-progress', JSON.stringify(bookProgress));
}
const bookDetails = {
  'root-of-kontol': { title: 'Root of Kontol', category: 'History', description: "How one founder's arrival gave Lawra its name, and its first claim to the land.", chapters: 6, readerTitle: 'Root of Kontol', freeChapter: 1 },
  'kingship-of-yikpee': { title: 'The Kingship of Yikpee', category: 'History · Leadership', description: 'The line of chiefs that began in Yikpee, and how the title moved through generations.', chapters: 9, readerTitle: 'The Kingship of Yikpee', freeChapter: 3 },
  'kobine-festival': { title: 'The Story behind Kobine Festival', category: 'Festivals', description: "Why Lawra dances every year, and what the festival remembers on the community's behalf.", chapters: 4, readerTitle: 'The story behind Kobine Festival', freeChapter: 2 },
  'dagbon-kingdom': { title: 'The Dagbon Kingdom', category: 'History · Leadership', description: 'Leadership, succession, and the structures that held the kingdom together.', chapters: 11, readerTitle: 'The Dagbon Kingdom', freeChapter: 1 },
  'nkrumah-lawra': { title: 'Nkrumah in Lawra', category: 'History', description: 'What one visit meant for a town far from the capital, and for the politics that followed.', chapters: 5, readerTitle: 'Nkrumah in Lawra', freeChapter: 1 },
  'education-north': { title: 'The Establishment of Education', category: 'Education', description: 'How schooling reached the north, and who built the first classrooms.', chapters: 7, readerTitle: 'The Establishment of Education', freeChapter: 1 }
};

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
  document.getElementById('details-chapters').textContent = book.chapters + ' chapters';
  const saved = savedBooks.some((item) => item.id === id);
  document.getElementById('details-save').textContent = saved ? 'Remove from saved' : 'Save for later';
  const progress = bookProgress[id]?.currentChapter || 0;
  document.getElementById('details-progress').textContent = progress ? 'In progress · Chapter ' + progress : 'Not started';
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
    const categories = card.dataset.category.split(' ');
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
}

function refreshBalanceDisplays() {
  const navBalance = document.getElementById('nav-balance');
  const walletBalance = document.getElementById('wallet-balance');
  const libraryBalance = document.getElementById('library-balance');
  const readerBalance = document.getElementById('reader-balance-line');

  if (navBalance) navBalance.textContent = fmt(balance);
  if (walletBalance) walletBalance.textContent = fmt(balance);
  if (libraryBalance) libraryBalance.textContent = fmt(balance);

  if (readerBalance) {
    const chaptersLeft = Math.floor(balance / 0.5);
    readerBalance.textContent = 'Wallet balance: ' + fmt(balance) + ' · ' + chaptersLeft + ' chapters left at this balance';
  }

  const profileBalance = document.querySelector('.profile-stats strong[data-profile-balance]');
  const profileChapters = document.querySelector('[data-profile-chapters]');
  if (profileBalance) profileBalance.textContent = fmt(balance);
  if (profileChapters) profileChapters.textContent = chaptersRead;
}

function topUp(amount) {
  balance += amount;
  localStorage.setItem('nhl-balance', String(balance));
  refreshBalanceDisplays();

  const list = document.getElementById('activity-list');
  if (list) {
    const row = document.createElement('div');
    row.className = 'activity-row';
    row.innerHTML = '<span>Top up via Mobile Money</span><span class="pos">+' + fmt(amount) + '</span>';
    list.prepend(row);
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

    topUp(selectedTopUpAmount);
    status.textContent = fmt(selectedTopUpAmount) + ' added to your wallet. Your balance is now ' + fmt(balance) + '.';
    status.className = 'topup-status success';
    confirmButton.disabled = true;
    confirmButton.textContent = 'Top up complete';
  });
}

function unlockChapter() {
  const status = document.getElementById('reader-status');
  if (unlockedChapters.includes(currentChapterId)) {
    renderReaderState();
    if (status) status.textContent = 'This chapter is already unlocked.';
    return;
  }

  if (balance < 0.5) {
    if (status) {
      status.textContent = 'Your balance is too low. Open Wallet to add credits.';
      status.className = 'reader-status error';
    }
    return;
  }

  balance -= 0.5;
  chaptersRead += 1;
  unlockedChapters.push(currentChapterId);
  const progress = bookProgress[activeBookId] || { currentChapter: 0, completedChapters: [] };
  if (!progress.completedChapters.includes(Number(currentChapterId.match(/chapter-(\d+)$/)?.[1] || 0))) {
    progress.completedChapters.push(Number(currentChapterId.match(/chapter-(\d+)$/)?.[1] || 0));
  }
  progress.currentChapter = Math.max(progress.currentChapter, Number(currentChapterId.match(/chapter-(\d+)$/)?.[1] || 0));
  bookProgress[activeBookId] = progress;
  localStorage.setItem('nhl-balance', String(balance));
  localStorage.setItem('nhl-chapters-read', String(chaptersRead));
  localStorage.setItem('nhl-unlocked-chapters', JSON.stringify(unlockedChapters));
  localStorage.setItem('nhl-book-progress', JSON.stringify(bookProgress));
  refreshBalanceDisplays();
  updateLibraryProgress();
  renderReaderState();
  if (status) {
    status.textContent = 'Chapter unlocked. Enjoy the rest of the story.';
    status.className = 'reader-status success';
  }

  const activityList = document.getElementById('activity-list');
  if (activityList) {
    const row = document.createElement('div');
    row.className = 'activity-row';
    row.innerHTML = '<span>The Kingship of Yikpee — Ch. 3</span><span class="neg">−' + fmt(0.50) + '</span>';
    activityList.prepend(row);
  }
}

function renderReaderState() {
  const paywall = document.getElementById('reader-paywall');
  const unlockButton = document.getElementById('unlock-chapter');
  const status = document.getElementById('reader-status');
  const isUnlocked = unlockedChapters.includes(currentChapterId);

  renderReaderPage();
  if (paywall) paywall.hidden = isUnlocked;
  if (unlockButton) unlockButton.disabled = isUnlocked;
  if (status && isUnlocked) {
    status.textContent = 'Chapter unlocked. Your access is saved for this reader.';
    status.className = 'reader-status success';
  } else if (status) {
    status.textContent = '';
    status.className = 'reader-status';
  }
}

function renderReaderPage() {
  const content = document.getElementById('reader-page-content');
  const indicator = document.getElementById('reader-page-indicator');
  const previous = document.getElementById('reader-prev');
  const next = document.getElementById('reader-next');
  if (!content) return;

  const isUnlocked = unlockedChapters.includes(currentChapterId);
  const isPreviewPage = !isUnlocked && readerPage === 0;
  content.innerHTML = isPreviewPage ? readerPages[readerPage] : isUnlocked ? readerPages[readerPage] : '<div class="locked-page"><span>Page locked</span><p>Unlock this chapter to continue reading.</p></div>';
  if (indicator) indicator.textContent = 'Page ' + (readerPage + 1) + ' of ' + readerPages.length;
  if (previous) previous.disabled = readerPage === 0;
  if (next) next.disabled = readerPage === readerPages.length - 1 || (!isUnlocked && readerPage === 0);
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
}

function updateProfileMenu() {
  const signedIn = Boolean(localStorage.getItem('nhl-session'));
  document.querySelectorAll('[data-auth-only]').forEach((item) => {
    item.hidden = !signedIn;
  });
  document.querySelectorAll('[data-guest-only]').forEach((item) => {
    item.hidden = signedIn;
  });
}

function updateContinueReading() {
  const continueReading = document.getElementById('continue-reading');
  if (continueReading) continueReading.hidden = !localStorage.getItem('nhl-last-chapter');
}

function bindAuth() {
  updateProfileName();

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
  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.getElementById('login-status');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const savedUser = JSON.parse(localStorage.getItem('nhl-user') || '{}');

    if (!savedUser.email || savedUser.email !== email || savedUser.password !== password) {
      status.textContent = 'The email or password is incorrect.';
      status.className = 'auth-status error';
      return;
    }

    localStorage.setItem('nhl-session', JSON.stringify({ email }));
    updateProfileMenu();
    status.textContent = 'You are logged in. Welcome back.';
    status.className = 'auth-status success';
  });

  const registerForm = document.getElementById('register-form');
  registerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.getElementById('register-status');
    const user = {
      name: document.getElementById('register-name').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value
    };

    localStorage.setItem('nhl-user', JSON.stringify(user));
    localStorage.setItem('nhl-session', JSON.stringify({ email: user.email }));
    updateProfileName();
    updateProfileMenu();
    status.textContent = 'Account created. You are now logged in.';
    status.className = 'auth-status success';
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
  document.getElementById('library-sort')?.addEventListener('change', sortAndFilterLibrary);
  document.querySelectorAll('[data-open-book]').forEach((button) => button.addEventListener('click', () => openBookDetails(button.dataset.openBook)));
  document.getElementById('details-open')?.addEventListener('click', () => {
    const book = bookDetails[activeBookId];
    openBook(book.readerTitle, String(book.chapters), String(book.freeChapter));
  });
  document.getElementById('details-save')?.addEventListener('click', () => saveBook(activeBookId));
  document.querySelector('[data-back-library]')?.addEventListener('click', () => showScreen('library', null));

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
      } else if (action === 'login') {
        openProfileScreen('login');
      } else if (action === 'register') {
        openProfileScreen('register');
      } else if (action === 'signout') {
        localStorage.removeItem('nhl-session');
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
    openBook('The Kingship of Yikpee', '9', '3');
  });

  document.querySelectorAll('[data-save-book]').forEach((button) => {
    button.addEventListener('click', () => saveBook(button.dataset.saveBook));
  });

  document.querySelectorAll('[data-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      topUp(Number(button.dataset.amount));
    });
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
      renderReaderPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('reader-next')?.addEventListener('click', () => {
    if (readerPage < readerPages.length - 1 && unlockedChapters.includes(currentChapterId)) {
      readerPage += 1;
      renderReaderPage();
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
        renderReaderPage();
      }
      if (event.key === 'ArrowRight' && readerPage < readerPages.length - 1 && unlockedChapters.includes(currentChapterId)) {
        readerPage += 1;
        renderReaderPage();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshBalanceDisplays();
  bindActions();
  bindSettings();
  bindAuth();
  bindTopUp();
  updateProfileMenu();
  updateContinueReading();
  renderReaderState();
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