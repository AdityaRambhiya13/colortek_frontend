(function (global) {
  'use strict';

  const DEFAULT_PRODUCT_CATEGORIES = [
    { code: 'A', label: 'A — Additives & Surfactants' },
    { code: 'B', label: 'B — Binders, Resins & Emulsions' },
    { code: 'C', label: 'C — Colorants, Dyes & Pigments' },
    { code: 'D', label: 'D — Dispersants & Defoamers' },
    { code: 'E', label: 'E — Extenders & Fillers' },
    { code: 'M', label: 'M — Monomers & Crosslinkers' },
    { code: 'P', label: 'P — Preservatives & Biocides' },
    { code: 'R', label: 'R — Rheology Modifiers & Thickeners' },
    { code: 'S', label: 'S — Solvents & Co-solvents' },
    { code: 'W', label: 'W — Waxes & Matting Agents' },
    { code: 'MISC', label: 'MISC — Miscellaneous / General' },
  ];

  // Local SVG Lucide icon definitions (eliminates unpinned unpkg CDN dependency)
  const LUCIDE_ICON_PATHS = {
    'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'archive': '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    'check-circle-2': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'edit-3': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'folder-kanban': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>',
    'key-round': '<path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    'tags': '<path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/><path d="M6 9.01V9"/><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  function createLocalIcons() {
    const doc = global.document;
    if (!doc) return;
    const nodes = doc.querySelectorAll('i[data-lucide], svg[data-lucide]');
    nodes.forEach((node) => {
      const name = (node.getAttribute('data-lucide') || '').trim();
      const inner = LUCIDE_ICON_PATHS[name];
      if (!inner) return;
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      const existingClass = node.getAttribute('class') || '';
      const existingStyle = node.getAttribute('style') || '';
      if (existingClass) svg.setAttribute('class', existingClass);
      if (existingStyle) svg.setAttribute('style', existingStyle);
      svg.innerHTML = inner;
      if (node.parentNode) {
        node.parentNode.replaceChild(svg, node);
      }
    });
  }

  global.lucide = { createIcons: createLocalIcons };

  // Strict origin allowlist prevents token/credential exfiltration via localStorage tampering
  function isTrustedApiOrigin(candidateUrl) {
    if (!candidateUrl || typeof candidateUrl !== 'string') return false;
    try {
      const parsed = new URL(candidateUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      const origin = parsed.origin;
      if (global.location && origin === global.location.origin) return true;
      if (origin === 'http://localhost:8000' || origin === 'http://127.0.0.1:8000') return true;
      if (origin === 'https://colortek-backend.onrender.com') return true;
      if (/^https:\/\/colortek-[a-z0-9-]+\.onrender\.com$/.test(origin)) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function resolveApiBase() {
    try {
      const stored = (global.localStorage && global.localStorage.getItem('colortek_api_base_url')) || '';
      if (stored && isTrustedApiOrigin(stored)) {
        return stored.replace(/\/+$/, '');
      }
    } catch (_) {}
    const h = global.location && global.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    return 'https://colortek-backend.onrender.com';
  }

  function escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(str) {
    return escapeAttr(str);
  }

  function normalizeProductUrl(raw) {
    const val = String(raw == null ? '' : raw).trim();
    if (!val) return '';
    try {
      const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(val) ? val : 'https://' + val.replace(/^\/+/, '');
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      if (!parsed.hostname) return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function injectAutocompleteStyles() {
    const doc = global.document;
    if (!doc || doc.getElementById('colortek-cat-ac-styles')) return;
    const style = doc.createElement('style');
    style.id = 'colortek-cat-ac-styles';
    style.textContent = `
      .cat-autocomplete-list { position:absolute; top:100%; left:0; right:0; z-index:9999; background:#f7f4eb; border:1px solid #8c8265; border-radius:4px; box-shadow:0 8px 24px rgba(0,0,0,0.16); max-height:220px; overflow-y:auto; margin-top:2px; display:none; }
      .cat-autocomplete-list.open { display:block; }
      .cat-autocomplete-item { padding:8px 12px; font-family:monospace; font-size:12px; color:#2c291e; cursor:pointer; border-bottom:1px solid rgba(140,130,101,0.2); display:flex; align-items:center; justify-content:space-between; }
      .cat-autocomplete-item:last-child { border-bottom:none; }
      .cat-autocomplete-item:hover, .cat-autocomplete-item.active { background:#eae4d3; }
      .cat-autocomplete-badge { font-size:10px; opacity:0.65; text-transform:uppercase; letter-spacing:0.06em; }
    `;
    doc.head.appendChild(style);
  }

  function getCategorySuggestions(query, records) {
    const q = String(query || '').trim().toLowerCase();
    const seen = new Map();
    const presetLower = new Set();

    DEFAULT_PRODUCT_CATEGORIES.forEach((cat) => {
      const k = cat.label.toLowerCase();
      presetLower.add(k);
      seen.set(k, { value: cat.label, label: cat.label, kind: 'preset' });
    });

    if (Array.isArray(records)) {
      records.forEach((r) => {
        const c = r && typeof r.category === 'string' ? r.category.trim() : '';
        if (!c) return;
        const k = c.toLowerCase();
        if (!seen.has(k)) {
          seen.set(k, { value: c, label: c, kind: presetLower.has(k) ? 'preset' : 'existing' });
        }
      });
    }

    return Array.from(seen.values())
      .filter((item) => !q || item.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const al = a.label.toLowerCase();
        const bl = b.label.toLowerCase();
        if (q) {
          const aStarts = al.startsWith(q) ? 0 : 1;
          const bStarts = bl.startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
        }
        if (a.kind !== b.kind) return a.kind === 'preset' ? -1 : 1;
        return al.localeCompare(bl);
      })
      .slice(0, 12);
  }

  function attachCategoryAutocomplete(opts) {
    const inputEl = opts && opts.inputEl;
    const listEl = opts && opts.listEl;
    if (!inputEl || !listEl) return;

    injectAutocompleteStyles();
    let activeIdx = -1;
    let currentItems = [];

    function closeList() {
      listEl.classList.remove('open');
      listEl.innerHTML = '';
      activeIdx = -1;
      currentItems = [];
    }

    function pickValue(val) {
      inputEl.value = val;
      closeList();
      if (typeof opts.onSelect === 'function') opts.onSelect(val);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function highlightItem(idx) {
      const children = listEl.querySelectorAll('.cat-autocomplete-item');
      children.forEach((c, i) => c.classList.toggle('active', i === idx));
      activeIdx = idx;
    }

    function renderSuggestions() {
      const records = typeof opts.getRecords === 'function' ? opts.getRecords() : [];
      currentItems = getCategorySuggestions(inputEl.value, records);
      if (!currentItems.length) {
        closeList();
        return;
      }
      listEl.innerHTML = currentItems
        .map(
          (it, idx) =>
            '<div class="cat-autocomplete-item" data-ac-idx="' +
            idx +
            '"><span>' +
            escapeHtml(it.label) +
            '</span><span class="cat-autocomplete-badge">' +
            escapeHtml(it.kind) +
            '</span></div>'
        )
        .join('');
      activeIdx = -1;
      listEl.classList.add('open');
    }

    listEl.addEventListener('mousedown', (e) => {
      const target = e.target.closest('[data-ac-idx]');
      if (!target) return;
      e.preventDefault();
      const idx = parseInt(target.getAttribute('data-ac-idx'), 10);
      if (currentItems[idx]) pickValue(currentItems[idx].value);
    });

    inputEl.addEventListener('focus', renderSuggestions);
    inputEl.addEventListener('input', renderSuggestions);
    inputEl.addEventListener('keydown', (e) => {
      if (!listEl.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightItem((activeIdx + 1) % currentItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightItem((activeIdx - 1 + currentItems.length) % currentItems.length);
      } else if (e.key === 'Enter' && activeIdx >= 0 && currentItems[activeIdx]) {
        e.preventDefault();
        pickValue(currentItems[activeIdx].value);
      } else if (e.key === 'Escape') {
        closeList();
      }
    });
    inputEl.addEventListener('blur', () => setTimeout(closeList, 150));
  }

  function compactRecord(r) {
    const code = String((r && (r.code || r.callNumber)) || '').trim();
    const callNumber = String((r && (r.callNumber || r.code)) || '').trim();
    return {
      id: String((r && r.id) || '').trim(),
      prefix: String((r && r.prefix) || '').trim(),
      num: r && r.num != null ? r.num : '',
      code,
      callNumber,
      name: String((r && r.name) || '').trim(),
      category: String((r && r.category) || '').trim(),
      description: String((r && r.description) || ''),
      drawer: String((r && r.drawer) || '').trim(),
      productLink: normalizeProductUrl((r && r.productLink) || ''),
    };
  }

  function compactRecords(list) {
    return Array.isArray(list) ? list.map(compactRecord) : [];
  }

  function setSyncBadge(text, isOffline) {
    const doc = global.document;
    if (!doc) return;
    const el = doc.getElementById('syncStatusBadge');
    if (!el) return;
    el.textContent = text;
    el.style.color = isOffline ? '#991b1b' : '#2d4a22';
    el.style.borderColor = isOffline ? '#fca5a5' : '#86efac';
  }

  // --- CSRF & Cookie Session State ---
  let _csrfTokenMemory = '';
  let _sessionUser = null; // { username, role, roles }

  function getCookie(name) {
    const doc = global.document;
    if (!doc || !doc.cookie) return '';
    const prefix = name + '=';
    const parts = doc.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
    return '';
  }

  function getCsrfToken() {
    if (_csrfTokenMemory) return _csrfTokenMemory;
    const fromCookie = getCookie('csrf_token');
    if (fromCookie) {
      _csrfTokenMemory = fromCookie;
      return fromCookie;
    }
    return '';
  }

  function setCsrfToken(token) {
    if (token && typeof token === 'string') {
      _csrfTokenMemory = token;
    }
  }

  function clearLocalArchiveCaches() {
    _csrfTokenMemory = '';
    _sessionUser = null;
    const keys = [
      'chem_archive_data',
      'chem_collections',
      'chem_auth_token',
      'chem_admin_auth',
      'chem_csrf_token',
      'colortek_library_cache',
    ];
    keys.forEach((k) => {
      try {
        if (global.localStorage) global.localStorage.removeItem(k);
      } catch (_) {}
      try {
        if (global.sessionStorage) global.sessionStorage.removeItem(k);
      } catch (_) {}
    });
  }

  function getSessionUsername() {
    return (_sessionUser && _sessionUser.username) || '';
  }

  function getSessionRole() {
    return (_sessionUser && _sessionUser.role) || 'viewer';
  }

  function getSessionUser() {
    return _sessionUser;
  }

  function setSessionUser(user) {
    _sessionUser = user ? { ...user } : null;
  }

  // --- Network Layer with Credentials + CSRF + Mutation Queue ---
  let pendingMutations = 0;
  let mutationEpoch = 0;
  const idleWaiters = [];

  function notifyIdleIfReady() {
    if (pendingMutations === 0) {
      while (idleWaiters.length) {
        const resolve = idleWaiters.shift();
        try {
          resolve();
        } catch (_) {}
      }
    }
  }

  async function apiFetch(endpointPath, options, basePrefix) {
    const opts = options || {};
    const method = (opts.method || 'GET').toUpperCase();
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const base = resolveApiBase();
    const url = base + basePrefix + endpointPath;
    const headers = { ...(opts.headers || {}) };

    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (isMutation) {
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      pendingMutations += 1;
      mutationEpoch += 1;
    }

    try {
      const resp = await global.fetch(url, {
        ...opts,
        method,
        headers,
        credentials: 'include',
      });
      if (!resp.ok) {
        let msg = 'HTTP ' + resp.status;
        try {
          const errJson = await resp.json();
          if (errJson && errJson.detail) {
            msg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) {}
        const err = new Error(msg);
        err.status = resp.status;
        throw err;
      }
      if (resp.status === 204) return null;
      return await resp.json();
    } finally {
      if (isMutation) {
        pendingMutations = Math.max(0, pendingMutations - 1);
        notifyIdleIfReady();
      }
    }
  }

  function archiveRequest(path, opts) {
    return apiFetch(path, opts, '/api/v1/library-archive');
  }

  function authRequest(path, opts) {
    return apiFetch(path, opts, '/api/v1/library-auth');
  }

  // --- Auth Flow Helpers ---
  async function loginStep1(username, password) {
    return await authRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async function verify2faStep2(preAuthToken, code) {
    const data = await authRequest('/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ pre_auth_token: preAuthToken, code }),
    });
    if (data && data.csrf_token) setCsrfToken(data.csrf_token);
    if (data && data.user) setSessionUser(data.user);
    return data;
  }

  async function resendSmsOtp(preAuthToken) {
    return await authRequest('/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ pre_auth_token: preAuthToken }),
    });
  }

  async function checkSession() {
    try {
      const data = await authRequest('/me', { method: 'GET' });
      if (data && data.csrf_token) setCsrfToken(data.csrf_token);
      if (data && data.username) {
        setSessionUser(data);
        return data;
      }
      return null;
    } catch (err) {
      if (err && err.status === 401) {
        try {
          const refreshed = await authRequest('/refresh', { method: 'POST' });
          if (refreshed && refreshed.csrf_token) setCsrfToken(refreshed.csrf_token);
          if (refreshed && refreshed.user) {
            setSessionUser(refreshed.user);
            return refreshed.user;
          }
        } catch (_) {}
      }
      setSessionUser(null);
      return null;
    }
  }

  async function logoutSession() {
    try {
      await authRequest('/logout', { method: 'POST' });
    } catch (_) {}
    clearLocalArchiveCaches();
  }

  // --- Record / Collection Sync Helpers ---
  function parseRangeBounds(rangeStr) {
    const m = String(rangeStr || '').match(/(\d+)\s*[-–to]+\s*(\d+)/i);
    if (!m) return null;
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    if (end - start > 1000) return null;
    return { start, end, padLen: Math.max(m[1].length, 3) };
  }

  function syncCollectionRecords(newColl, existingRecords, allCollections) {
    const collId = String(newColl && newColl.id ? newColl.id : '').trim();
    const bounds = parseRangeBounds(newColl && newColl.range);
    const activeIds = new Set((allCollections || []).map((c) => c.id));
    const codePrefixLower = collId.toLowerCase() + '-';

    const relinked = [];
    const existingCodes = new Set();

    (existingRecords || []).forEach((r) => {
      const code = String((r && (r.code || r.callNumber)) || '').trim();
      const codeLower = code.toLowerCase();
      if (codeLower.startsWith(codePrefixLower)) {
        const isOrphan = !r.prefix || !activeIds.has(r.prefix) || r.prefix.toLowerCase() === collId.toLowerCase();
        if (isOrphan) {
          relinked.push({ ...r, prefix: collId });
        }
        existingCodes.add(codeLower);
      }
    });

    const created = [];
    if (bounds) {
      for (let n = bounds.start; n <= bounds.end; n++) {
        const numStr = String(n).padStart(bounds.padLen, '0');
        const code = collId + '-' + numStr;
        if (!existingCodes.has(code.toLowerCase())) {
          created.push({
            id: collId.toLowerCase() + '-' + numStr + '-' + Math.random().toString(36).slice(2, 6),
            prefix: collId,
            num: n,
            code,
            callNumber: code,
            name: '',
            category: '',
            description: '',
            drawer: '',
            productLink: '',
          });
        }
      }
    }

    return { relinked, created, allToPersist: relinked.concat(created) };
  }

  function getUnlinkedRecords(collections, records) {
    const activeIds = new Set((collections || []).map((c) => c && c.id).filter(Boolean));
    return (records || []).filter((r) => !r.prefix || !activeIds.has(r.prefix));
  }

  // --- Inactivity Auto-Logout ---
  let inactivityTimer = null;
  let inactivityStarted = false;
  let inactivityOpts = null;

  function resetInactivityTimer() {
    if (!inactivityOpts) return;
    if (inactivityTimer) global.clearTimeout(inactivityTimer);
    const timeoutMs = typeof inactivityOpts.timeoutMs === 'number' && inactivityOpts.timeoutMs > 0 ? inactivityOpts.timeoutMs : 900000;
    inactivityTimer = global.setTimeout(() => {
      if (typeof inactivityOpts.isLoggedIn === 'function' && inactivityOpts.isLoggedIn()) {
        if (typeof inactivityOpts.onTimeout === 'function') inactivityOpts.onTimeout();
      }
    }, timeoutMs);
  }

  function initInactivityAutoLogout(opts) {
    const doc = global.document;
    inactivityOpts = opts;
    if (!doc) return;
    if (!inactivityStarted) {
      inactivityStarted = true;
      ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => {
        doc.addEventListener(ev, resetInactivityTimer, { passive: true });
      });
    }
    resetInactivityTimer();
  }

  function stopInactivityAutoLogout() {
    if (inactivityTimer) {
      global.clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }

  global.ColortekLibrary = {
    DEFAULT_PRODUCT_CATEGORIES,
    resolveApiBase,
    isTrustedApiOrigin,
    escapeAttr,
    escapeHtml,
    normalizeProductUrl,
    getCategorySuggestions,
    attachCategoryAutocomplete,
    compactRecord,
    compactRecords,
    setSyncBadge,
    getCookie,
    getCsrfToken,
    setCsrfToken,
    clearLocalArchiveCaches,
    getSessionUsername,
    getSessionRole,
    getSessionUser,
    setSessionUser,
    syncCollectionRecords,
    getUnlinkedRecords,
    createLocalIcons,
    initInactivityAutoLogout,
    resetInactivityTimer,
    stopInactivityAutoLogout,

    // Auth endpoints
    loginStep1,
    verify2faStep2,
    resendSmsOtp,
    checkSession,
    logoutSession,

    // Admin User / Lockout / Audit endpoints
    fetchLibraryUsers: function () {
      return authRequest('/users?_t=' + Date.now(), { method: 'GET' });
    },
    createLibraryUser: function (payload) {
      return authRequest('/users', { method: 'POST', body: JSON.stringify(payload) });
    },
    resetLibraryUser2fa: function (userId) {
      return authRequest('/users/' + encodeURIComponent(userId) + '/reset-2fa', { method: 'POST' });
    },
    deleteLibraryUser: function (userId) {
      return authRequest('/users/' + encodeURIComponent(userId), { method: 'DELETE' });
    },
    clearLibraryLockouts: function (username) {
      return authRequest('/clear-lockouts', {
        method: 'POST',
        body: JSON.stringify(username ? { username } : {}),
      });
    },
    fetchAuthAuditLogs: function (limit) {
      const q = typeof limit === 'number' && limit > 0 ? limit : 150;
      return authRequest('/audit-logs?limit=' + q + '&_t=' + Date.now(), { method: 'GET' });
    },

    // Archive endpoints
    hasPendingMutations: function () {
      return pendingMutations > 0;
    },
    getMutationEpoch: function () {
      return mutationEpoch;
    },
    waitForPendingMutations: function () {
      if (pendingMutations === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
    fetchState: async function () {
      const data = await archiveRequest('/state?limit=5000&_t=' + Date.now(), { method: 'GET' });
      return data;
    },
    bootstrapState: function (collections, records, replace) {
      return archiveRequest('/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          collections: collections || [],
          records: compactRecords(records),
          replace: !!replace,
        }),
      });
    },
    createCollection: function (collection, records) {
      return archiveRequest('/collections', {
        method: 'POST',
        body: JSON.stringify({
          collection,
          records: compactRecords(records),
        }),
      });
    },
    deleteCollection: function (collId, mode) {
      const m = mode === 'shift_misc' ? 'shift_misc' : 'delete_records';
      return archiveRequest('/collections/' + encodeURIComponent(collId) + '?mode=' + encodeURIComponent(m), {
        method: 'DELETE',
      });
    },
    createRecord: function (record) {
      return archiveRequest('/records', {
        method: 'POST',
        body: JSON.stringify(compactRecord(record)),
      });
    },
    updateRecord: function (recordId, patch) {
      return archiveRequest('/records/' + encodeURIComponent(recordId), {
        method: 'PATCH',
        body: JSON.stringify(patch || {}),
      });
    },
    deleteRecord: function (recordId) {
      return archiveRequest('/records/' + encodeURIComponent(recordId), { method: 'DELETE' });
    },
    deleteUnlinkedRecords: function () {
      return archiveRequest('/records/unlinked', { method: 'DELETE' });
    },
    restoreState: function (collections, records) {
      return archiveRequest('/restore', {
        method: 'PUT',
        body: JSON.stringify({
          collections: collections || [],
          records: compactRecords(records),
          replace: true,
        }),
      });
    },
    factoryResetArchive: function () {
      return archiveRequest('/factory-reset', { method: 'POST' });
    },
    logActivity: function (action, page, details) {
      return archiveRequest('/activity', {
        method: 'POST',
        body: JSON.stringify({
          action: action || 'ADMIN_ACTION',
          page: page || 'library',
          details: details || '',
        }),
      }).catch(() => null);
    },
    fetchActivityLogs: async function (limit) {
      const q = typeof limit === 'number' && limit > 0 ? limit : 300;
      const data = await archiveRequest('/activity?limit=' + q + '&_t=' + Date.now(), { method: 'GET' });
      return data && Array.isArray(data.logs) ? data.logs : [];
    },
  };
})(window);
