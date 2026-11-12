(function () {
  'use strict';

  const Lib = window.ColortekLibrary;
  if (!Lib) return;

  const PAGE_SIZE = 48;
  const DEFAULT_COLLECTIONS = [
    { id: 'D', label: 'Series D (1–300)', range: 'D-1 to D-300' },
    { id: 'R', label: 'Series R (1–1000)', range: 'R-1 to R-1000' },
    { id: 'Tc', label: 'Series Tc (1–1000)', range: 'Tc-1 to Tc-1000' },
    { id: 'W', label: 'Series W (1–300)', range: 'W-1 to W-300' },
    { id: 'B', label: 'Series B (1–300)', range: 'B-1 to B-300' },
    { id: 'G', label: 'Series G (1–200)', range: 'G-1 to G-200' },
    { id: 'Y', label: 'Series Y (1–200)', range: 'Y-1 to Y-200' },
    { id: 'MISC', label: 'Miscellaneous & Archive', range: 'MISC' },
  ];

  let allCollections = [];
  let allRecords = [];
  let activeCollection = 'ALL';
  let searchQuery = '';
  let sortMode = 'code_asc';
  let currentPage = 1;
  let activeEditRecordId = null;
  let saveDebounceTimer = null;
  let pendingPreAuthToken = '';
  let pendingMfaMethod = 'totp';
  let resendCooldownTimer = null;
  let searchLogTimer = null;

  function canEditRecords() {
    const role = Lib.getSessionRole();
    return role === 'curator' || role === 'admin';
  }

  function showAuthError(msg) {
    const box = document.getElementById('authErrorMsg');
    const txt = document.getElementById('authErrorText');
    if (box && txt) {
      txt.textContent = msg;
      box.style.display = 'flex';
    }
  }

  function hideAuthError() {
    const box = document.getElementById('authErrorMsg');
    if (box) box.style.display = 'none';
  }

  function resetToStep1() {
    pendingPreAuthToken = '';
    pendingMfaMethod = 'totp';
    if (resendCooldownTimer) {
      clearInterval(resendCooldownTimer);
      resendCooldownTimer = null;
    }
    const step1 = document.getElementById('credentialsForm');
    const step2 = document.getElementById('otpStepForm');
    const otpInput = document.getElementById('authOtpCode');
    if (step1) step1.style.display = 'flex';
    if (step2) step2.style.display = 'none';
    if (otpInput) otpInput.value = '';
    hideAuthError();
  }

  function startResendCooldown(seconds) {
    const btn = document.getElementById('resendOtpBtn');
    if (!btn) return;
    if (resendCooldownTimer) clearInterval(resendCooldownTimer);
    let rem = seconds || 30;
    btn.disabled = true;
    btn.textContent = `Resend SMS (${rem}s)`;
    resendCooldownTimer = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        clearInterval(resendCooldownTimer);
        resendCooldownTimer = null;
        btn.disabled = false;
        btn.textContent = 'Resend SMS OTP';
      } else {
        btn.textContent = `Resend SMS (${rem}s)`;
      }
    }, 1000);
  }

  function showOtpStep(resp) {
    pendingPreAuthToken = resp.pre_auth_token || '';
    pendingMfaMethod = resp.mfa_method || 'totp';
    const step1 = document.getElementById('credentialsForm');
    const step2 = document.getElementById('otpStepForm');
    const promptEl = document.getElementById('otpPromptText');
    const resendBtn = document.getElementById('resendOtpBtn');
    const otpInput = document.getElementById('authOtpCode');

    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'flex';

    if (promptEl) {
      if (pendingMfaMethod === 'sms') {
        promptEl.textContent = `Enter the 6-digit SMS verification code sent to ${resp.destination || 'your registered phone'}.`;
      } else {
        promptEl.textContent = 'Enter the 6-digit verification code from your Authenticator App (Google Authenticator / Authy).';
      }
    }

    if (resendBtn) {
      resendBtn.style.display = pendingMfaMethod === 'sms' ? 'inline-flex' : 'none';
      if (pendingMfaMethod === 'sms') startResendCooldown(30);
    }

    if (otpInput) {
      otpInput.value = '';
      setTimeout(() => otpInput.focus(), 50);
    }
    hideAuthError();
  }

  function showLoginGate() {
    resetToStep1();
    const gate = document.getElementById('authGateModal');
    if (gate) gate.style.display = 'flex';
  }

  function hideLoginGate() {
    const gate = document.getElementById('authGateModal');
    if (gate) gate.style.display = 'none';
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const uEl = document.getElementById('authUsername');
    const pEl = document.getElementById('authPassword');
    const submitBtn = document.getElementById('step1SubmitBtn');
    const username = (uEl && uEl.value ? uEl.value : '').trim();
    const password = (pEl && pEl.value) || '';
    if (!username || !password) {
      showAuthError('Enter your username and password.');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const resp = await Lib.loginStep1(username, password);
      if (resp && resp.status === '2FA_REQUIRED' && resp.pre_auth_token) {
        showOtpStep(resp);
      } else {
        showAuthError('Unexpected authentication response.');
      }
    } catch (err) {
      showAuthError(err.message || 'Authentication failed.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const codeEl = document.getElementById('authOtpCode');
    const submitBtn = document.getElementById('verifyOtpBtn');
    const code = (codeEl && codeEl.value ? codeEl.value : '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) {
      showAuthError('Enter the 6-digit verification code.');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const data = await Lib.verify2faStep2(pendingPreAuthToken, code);
      if (data && data.status === 'AUTHENTICATED') {
        const pEl = document.getElementById('authPassword');
        if (pEl) pEl.value = '';
        resetToStep1();
        hideLoginGate();
        updateSessionControls();
        await loadLibraryState();
        startAutoLogoutTimer();
      }
    } catch (err) {
      showAuthError(err.message || 'Invalid verification code.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function handleResendOtp() {
    if (!pendingPreAuthToken) return;
    hideAuthError();
    try {
      const resp = await Lib.resendSmsOtp(pendingPreAuthToken);
      const promptEl = document.getElementById('otpPromptText');
      if (promptEl && resp && resp.destination) {
        promptEl.textContent = `A fresh 6-digit SMS code was sent to ${resp.destination}.`;
      }
      startResendCooldown(30);
    } catch (err) {
      showAuthError(err.message || 'Could not resend OTP.');
    }
  }

  function updateSessionControls() {
    const adminBtn = document.getElementById('adminPortalLink');
    const userBadge = document.getElementById('sessionUserBadge');
    const role = Lib.getSessionRole();
    const uname = Lib.getSessionUsername();
    if (adminBtn) {
      adminBtn.style.display = role === 'admin' ? 'inline-flex' : 'none';
    }
    if (userBadge) {
      userBadge.textContent = uname ? `${uname} (${role})` : '';
      userBadge.style.display = uname ? 'inline-flex' : 'none';
    }
  }

  async function loadLibraryState() {
    Lib.setSyncBadge('SYNCING...', false);
    try {
      const data = await Lib.fetchState();
      if (data) {
        allCollections = Array.isArray(data.collections) && data.collections.length ? data.collections : DEFAULT_COLLECTIONS.slice();
        allRecords = Array.isArray(data.records) ? data.records : [];
        Lib.setSyncBadge('ENCRYPTED LIVE', false);
        renderAll();
      }
    } catch (err) {
      if (err && err.status === 401) {
        await logoutLibrary();
        return;
      }
      Lib.setSyncBadge('SYNC ERROR', true);
    }
  }

  async function logoutLibrary() {
    Lib.stopInactivityAutoLogout();
    await Lib.logoutSession();
    allCollections = [];
    allRecords = [];
    closeEditTab();
    renderAll();
    updateSessionControls();
    showLoginGate();
  }

  function startAutoLogoutTimer() {
    Lib.initInactivityAutoLogout({
      timeoutMs: 15 * 60 * 1000,
      isLoggedIn: function () {
        return !!Lib.getSessionUser();
      },
      onTimeout: function () {
        logoutLibrary();
      },
    });
  }

  function parseNaturalCode(rec) {
    const code = String((rec && (rec.code || rec.callNumber)) || '').trim();
    const m = code.match(/^([A-Za-z]+)-(\d+)/);
    if (!m) return { prefix: code.toLowerCase(), num: Number.MAX_SAFE_INTEGER, raw: code.toLowerCase() };
    return { prefix: m[1].toLowerCase(), num: parseInt(m[2], 10), raw: code.toLowerCase() };
  }

  function getFilteredRecords() {
    let list = allRecords;
    if (activeCollection && activeCollection !== 'ALL') {
      list = list.filter((r) => (r.prefix || 'MISC') === activeCollection);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const code = String(r.code || r.callNumber || '').toLowerCase();
        const name = String(r.name || '').toLowerCase();
        const cat = String(r.category || '').toLowerCase();
        const desc = String(r.description || '').toLowerCase();
        return code.includes(q) || name.includes(q) || cat.includes(q) || desc.includes(q);
      });
    }

    const sorted = list.slice();
    sorted.sort((a, b) => {
      if (sortMode === 'name_asc') {
        return String(a.name || 'zzz').localeCompare(String(b.name || 'zzz'));
      }
      if (sortMode === 'category_asc') {
        return String(a.category || 'zzz').localeCompare(String(b.category || 'zzz'));
      }
      const pa = parseNaturalCode(a);
      const pb = parseNaturalCode(b);
      if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
      if (pa.num !== pb.num) return pa.num - pb.num;
      return pa.raw.localeCompare(pb.raw);
    });
    return sorted;
  }

  function renderCollections() {
    const nav = document.getElementById('collectionNavList');
    const tabs = document.getElementById('libraryIndexTabs');
    const headerCount = document.getElementById('headerSpecimenCount');

    const counts = new Map();
    allRecords.forEach((r) => {
      const p = r.prefix || 'MISC';
      counts.set(p, (counts.get(p) || 0) + 1);
    });

    if (headerCount) headerCount.textContent = `${allRecords.length} Specimens Indexed`;

    if (nav) {
      let html = `<li><button type="button" class="collection-btn ${activeCollection === 'ALL' ? 'active' : ''}" data-collection="ALL">
        <div class="coll-info">
          <span class="coll-title">ALL RECORDS</span>
          <span class="coll-range">Entire Archive Index</span>
        </div>
        <span class="coll-count">${allRecords.length}</span>
      </button></li>`;
      allCollections.forEach((c) => {
        const cnt = counts.get(c.id) || 0;
        html += `<li><button type="button" class="collection-btn ${activeCollection === c.id ? 'active' : ''}" data-collection="${Lib.escapeAttr(c.id)}">
          <div class="coll-info">
            <span class="coll-title">${Lib.escapeHtml(c.label || c.id)}</span>
            <span class="coll-range">${Lib.escapeHtml(c.range || c.id)}</span>
          </div>
          <span class="coll-count">${cnt}</span>
        </button></li>`;
      });
      nav.innerHTML = html;
    }

    if (tabs) {
      let tabHtml = `<button type="button" class="index-tab-btn ${activeCollection === 'ALL' ? 'active' : ''}" data-collection="ALL">[ ALL ]</button>`;
      allCollections.forEach((c) => {
        tabHtml += `<button type="button" class="index-tab-btn ${activeCollection === c.id ? 'active' : ''}" data-collection="${Lib.escapeAttr(c.id)}">[ ${Lib.escapeHtml(c.id)} ]</button>`;
      });
      tabs.innerHTML = tabHtml;
    }
  }

  function renderCardsAndPagination() {
    const grid = document.getElementById('cardGrid');
    const titleEl = document.getElementById('currentCollectionTitle');
    const countEl = document.getElementById('recordCountLabel');
    const strip = document.getElementById('activeFilterStrip');
    const filterText = document.getElementById('searchFilterText');
    const pBar = document.getElementById('paginationBar');
    const pInfo = document.getElementById('paginationInfo');
    const pBtns = document.getElementById('paginationButtons');

    if (titleEl) {
      if (activeCollection === 'ALL') {
        titleEl.textContent = 'All Chemical Specimens';
      } else {
        const found = allCollections.find((c) => c.id === activeCollection);
        titleEl.textContent = (found && found.label) || `Collection ${activeCollection}`;
      }
    }

    if (strip && filterText) {
      strip.style.display = searchQuery ? 'inline-flex' : 'none';
      filterText.textContent = `Filter: "${searchQuery}"`;
    }

    const filtered = getFilteredRecords();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    if (countEl) countEl.textContent = `${total} specimen${total === 1 ? '' : 's'} shown`;

    if (!grid) return;
    if (!total) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--ink-secondary);font-family:var(--font-mono);font-size:13px;">No matching chemical records found.</div>';
      if (pBar) pBar.style.display = 'none';
      return;
    }

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const slice = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    grid.innerHTML = slice
      .map((rec) => {
        const code = rec.code || rec.callNumber || rec.id || '';
        const name = rec.name || '';
        const cat = rec.category || '';
        const safeUrl = Lib.normalizeProductUrl(rec.productLink || '');
        const linkBadge = safeUrl
          ? `<span class="card-archival-stamp" style="color:#1b4332;border-color:rgba(27,67,50,0.25);">LINKED</span>`
          : '';
        return `
          <div class="catalog-card" role="button" tabindex="0" data-record-id="${Lib.escapeAttr(rec.id)}" style="cursor:pointer;">
            <div class="card-top">
              <span class="card-call-number">${Lib.escapeHtml(code)}</span>
              ${linkBadge}
            </div>
            ${name ? `<div class="card-product-name">${Lib.escapeHtml(name)}</div>` : ''}
            ${cat ? `<div class="card-meta-section"><span class="card-category-label">Category</span><span class="card-category-value">${Lib.escapeHtml(cat)}</span></div>` : ''}
          </div>
        `;
      })
      .join('');

    if (pBar && pInfo && pBtns) {
      pBar.style.display = totalPages > 1 ? 'flex' : 'none';
      pInfo.textContent = `Showing ${startIdx + 1}–${Math.min(startIdx + slice.length, total)} of ${total}`;
      let btns = '';
      btns += `<button type="button" class="btn-page" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>PREV</button>`;
      const winStart = Math.max(1, currentPage - 2);
      const winEnd = Math.min(totalPages, currentPage + 2);
      for (let p = winStart; p <= winEnd; p++) {
        btns += `<button type="button" class="btn-page ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }
      btns += `<button type="button" class="btn-page" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>NEXT</button>`;
      pBtns.innerHTML = btns;
    }
  }

  function renderAll() {
    renderCollections();
    renderCardsAndPagination();
    Lib.createLocalIcons();
  }

  function selectCollection(collId) {
    activeCollection = collId || 'ALL';
    currentPage = 1;
    renderAll();
    if (Lib.getSessionUser()) {
      Lib.logActivity('VIEW_COLLECTION', 'library', `Selected collection ${activeCollection}`);
    }
  }

  function openEditTab(recordId) {
    const rec = allRecords.find((r) => r.id === recordId);
    if (!rec) return;
    activeEditRecordId = recordId;
    const overlay = document.getElementById('editTabOverlay');
    const badge = document.getElementById('editTabCodeBadge');
    const codeInput = document.getElementById('editCodeInput');
    const nameInput = document.getElementById('editNameInput');
    const catInput = document.getElementById('editCategoryInput');
    const linkInput = document.getElementById('editProductLinkInput');
    const descInput = document.getElementById('editDescInput');
    const statusText = document.getElementById('saveStatusText');

    const editable = canEditRecords();
    if (badge) badge.textContent = rec.code || rec.callNumber || rec.id;
    if (codeInput) {
      codeInput.value = rec.code || rec.callNumber || '';
      codeInput.readOnly = !editable;
    }
    if (nameInput) {
      nameInput.value = rec.name || '';
      nameInput.readOnly = !editable;
    }
    if (catInput) {
      catInput.value = rec.category || '';
      catInput.readOnly = !editable;
    }
    if (linkInput) {
      linkInput.value = rec.productLink || '';
      linkInput.readOnly = !editable;
    }
    if (descInput) {
      descInput.value = rec.description || '';
      descInput.readOnly = !editable;
    }
    if (statusText) {
      statusText.textContent = editable ? 'Synced' : 'Read-only (Viewer)';
    }

    updateProductLinkAnchor();
    if (overlay) overlay.classList.add('open');
  }

  function closeEditTab() {
    activeEditRecordId = null;
    const overlay = document.getElementById('editTabOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function updateProductLinkAnchor() {
    const linkInput = document.getElementById('editProductLinkInput');
    const anchor = document.getElementById('editProductLinkAnchor');
    if (!anchor || !linkInput) return;
    const safeUrl = Lib.normalizeProductUrl(linkInput.value);
    if (safeUrl) {
      anchor.href = safeUrl;
      anchor.style.display = 'inline-flex';
      anchor.setAttribute('rel', 'noopener noreferrer');
    } else {
      anchor.removeAttribute('href');
      anchor.style.display = 'none';
    }
  }

  function scheduleRecordSave() {
    if (!canEditRecords() || !activeEditRecordId) return;
    const rec = allRecords.find((r) => r.id === activeEditRecordId);
    if (!rec) return;

    const codeVal = (document.getElementById('editCodeInput')?.value || '').trim();
    const nameVal = (document.getElementById('editNameInput')?.value || '').trim();
    const catVal = (document.getElementById('editCategoryInput')?.value || '').trim();
    const linkRaw = (document.getElementById('editProductLinkInput')?.value || '').trim();
    const descVal = document.getElementById('editDescInput')?.value || '';

    const normalizedLink = linkRaw ? Lib.normalizeProductUrl(linkRaw) : '';
    updateProductLinkAnchor();

    rec.code = codeVal;
    rec.callNumber = codeVal;
    rec.name = nameVal;
    rec.category = catVal;
    rec.description = descVal;
    if (!linkRaw || normalizedLink) {
      rec.productLink = normalizedLink;
    }

    const statusText = document.getElementById('saveStatusText');
    if (statusText) statusText.textContent = 'Saving...';

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    const targetId = activeEditRecordId;
    saveDebounceTimer = setTimeout(async () => {
      try {
        await Lib.updateRecord(targetId, {
          code: rec.code,
          callNumber: rec.callNumber,
          name: rec.name,
          category: rec.category,
          description: rec.description,
          productLink: rec.productLink,
        });
        if (statusText) statusText.textContent = 'Saved';
        renderCardsAndPagination();
      } catch (err) {
        if (statusText) statusText.textContent = 'Save Error';
      }
    }, 450);
  }

  function bindEvents() {
    document.querySelector('.brand-group')?.addEventListener('click', () => selectCollection('ALL'));
    document.getElementById('logoutBtn')?.addEventListener('click', logoutLibrary);
    document.getElementById('credentialsForm')?.addEventListener('submit', handleCredentialsSubmit);
    document.getElementById('otpStepForm')?.addEventListener('submit', handleOtpSubmit);
    document.getElementById('resendOtpBtn')?.addEventListener('click', handleResendOtp);
    document.getElementById('backToStep1Btn')?.addEventListener('click', resetToStep1);

    document.getElementById('togglePwdVisBtn')?.addEventListener('click', () => {
      const inp = document.getElementById('authPassword');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        currentPage = 1;
        renderCardsAndPagination();
        if (searchLogTimer) clearTimeout(searchLogTimer);
        if (searchQuery && Lib.getSessionUser()) {
          searchLogTimer = setTimeout(() => {
            Lib.logActivity('SEARCH', 'library', `Query: ${searchQuery.slice(0, 80)}`);
          }, 800);
        }
      });
    }

    const clearFn = () => {
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      currentPage = 1;
      renderCardsAndPagination();
    };
    document.getElementById('searchClearBtn')?.addEventListener('click', clearFn);
    document.getElementById('clearSearchPillBtn')?.addEventListener('click', clearFn);

    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      sortMode = e.target.value || 'code_asc';
      currentPage = 1;
      renderCardsAndPagination();
    });

    document.getElementById('collectionNavList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-collection]');
      if (btn) selectCollection(btn.getAttribute('data-collection'));
    });

    document.getElementById('libraryIndexTabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-collection]');
      if (btn) selectCollection(btn.getAttribute('data-collection'));
    });

    document.getElementById('cardGrid')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-record-id]');
      if (card) openEditTab(card.getAttribute('data-record-id'));
    });

    document.getElementById('paginationButtons')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (Number.isFinite(p) && p >= 1) {
        currentPage = p;
        renderCardsAndPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    const editOverlay = document.getElementById('editTabOverlay');
    editOverlay?.addEventListener('click', closeEditTab);
    document.getElementById('editTabPanel')?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('closeEditTabBtn')?.addEventListener('click', closeEditTab);
    document.getElementById('doneEditTabBtn')?.addEventListener('click', closeEditTab);

    ['editCodeInput', 'editNameInput', 'editCategoryInput', 'editProductLinkInput', 'editDescInput'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', scheduleRecordSave);
    });

    Lib.attachCategoryAutocomplete({
      inputEl: document.getElementById('editCategoryInput'),
      listEl: document.getElementById('editCategoryAcList'),
      getRecords: () => allRecords,
      onSelect: () => scheduleRecordSave(),
    });
  }

  async function init() {
    Lib.clearLocalArchiveCaches();
    Lib.createLocalIcons();
    bindEvents();

    const session = await Lib.checkSession();
    if (!session) {
      updateSessionControls();
      showLoginGate();
      return;
    }
    updateSessionControls();
    hideLoginGate();
    await loadLibraryState();
    startAutoLogoutTimer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
