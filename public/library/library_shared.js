(function (global) {
  'use strict';

  const DEFAULT_PRODUCT_CATEGORIES = [
    'Resins',
    'Solvents',
    'Additives',
    'Dyes',
    'Rubber',
    'Water-Based',
    'UV',
    'Temporary'
  ];

  function resolveApiBase() {
    const injected = typeof global.COLORTEK_API_URL === 'string' ? global.COLORTEK_API_URL.trim() : '';
    if (injected) return injected.replace(/\/+$/, '');
    try {
      const stored = (global.localStorage && global.localStorage.getItem('colortek_api_base_url')) || '';
      if (stored.trim()) return stored.trim().replace(/\/+$/, '');
    } catch (e) {}
    try {
      const h = global.location && global.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000';
    } catch (e) {}
    return '';
  }

  function injectAutocompleteStyles() {
    const doc = global.document;
    if (!doc || !doc.head || doc.getElementById('chem-lib-shared-styles')) return;
    const style = doc.createElement('style');
    style.id = 'chem-lib-shared-styles';
    style.textContent = [
      '.cat-autocomplete-wrap { position: relative; width: 100%; }',
      '.cat-autocomplete-list { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: #ffffff; border: 1px solid rgba(0, 95, 115, 0.25); border-radius: 10px; box-shadow: 0 10px 28px rgba(0, 95, 115, 0.16); max-height: 210px; overflow-y: auto; z-index: 99999; display: none; padding: 4px; }',
      '.cat-autocomplete-list.open { display: block; }',
      '.cat-autocomplete-item { width: 100%; text-align: left; background: transparent; border: none; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 600; color: #1a1a1a; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }',
      '.cat-autocomplete-item:hover, .cat-autocomplete-item.active { background: rgba(0, 95, 115, 0.1); color: #005f73; }',
      '.cat-autocomplete-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.65; }',
      '.sync-status-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(0, 95, 115, 0.25); background: rgba(255, 255, 255, 0.65); color: #005f73; white-space: nowrap; }',
      '.sync-status-pill.offline { color: #92400e; background: #fef3c7; border-color: #f59e0b; }'
    ].join('\n');
    doc.head.appendChild(style);
  }

  function getCategorySuggestions(query, records) {
    const q = String(query || '').trim().toLowerCase();
    const seen = new Map();
    const presetLower = new Set();

    DEFAULT_PRODUCT_CATEGORIES.forEach(cat => {
      const k = cat.toLowerCase();
      presetLower.add(k);
      if (!seen.has(k)) seen.set(k, { label: cat, isPreset: true });
    });

    if (Array.isArray(records)) {
      records.forEach(r => {
        const c = (r && typeof r.category === 'string') ? r.category.trim() : '';
        if (!c) return;
        const k = c.toLowerCase();
        if (!seen.has(k)) seen.set(k, { label: c, isPreset: presetLower.has(k) });
      });
    }

    const items = Array.from(seen.values()).filter(item => {
      if (!q) return true;
      return item.label.toLowerCase().includes(q);
    });

    items.sort((a, b) => {
      const al = a.label.toLowerCase();
      const bl = b.label.toLowerCase();
      if (q) {
        const aStarts = al.startsWith(q) ? 0 : 1;
        const bStarts = bl.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
      }
      if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    return items;
  }

  function escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attachCategoryAutocomplete(opts) {
    const inputEl = opts && opts.inputEl;
    const listEl = opts && opts.listEl;
    if (!inputEl || !listEl || inputEl.dataset.catAcBound === '1') return;
    inputEl.dataset.catAcBound = '1';
    injectAutocompleteStyles();

    let activeIdx = -1;
    let currentMatches = [];

    function closeList() {
      listEl.classList.remove('open');
      listEl.innerHTML = '';
      activeIdx = -1;
      currentMatches = [];
    }

    function pickValue(val) {
      inputEl.value = val;
      closeList();
      if (typeof opts.onSelect === 'function') {
        opts.onSelect(val);
      }
    }

    function highlightItem(idx) {
      const children = listEl.querySelectorAll('.cat-autocomplete-item');
      children.forEach((btn, i) => {
        if (i === idx) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    function renderSuggestions() {
      const records = typeof opts.getRecords === 'function' ? opts.getRecords() : [];
      currentMatches = getCategorySuggestions(inputEl.value, records);
      if (currentMatches.length === 0) {
        closeList();
        return;
      }
      activeIdx = -1;
      listEl.innerHTML = currentMatches.map((item, idx) =>
        `<button type="button" class="cat-autocomplete-item" data-idx="${idx}" data-val="${escapeAttr(item.label)}"><span>${escapeAttr(item.label)}</span><span class="cat-autocomplete-tag">${item.isPreset ? 'Standard' : 'Custom'}</span></button>`
      ).join('');
      listEl.classList.add('open');

      listEl.querySelectorAll('.cat-autocomplete-item').forEach(btn => {
        btn.addEventListener('mousedown', e => {
          e.preventDefault();
          pickValue(btn.getAttribute('data-val') || '');
        });
      });
    }

    inputEl.addEventListener('focus', renderSuggestions);
    inputEl.addEventListener('input', renderSuggestions);
    inputEl.addEventListener('blur', () => {
      setTimeout(closeList, 120);
    });
    inputEl.addEventListener('keydown', e => {
      if (!listEl.classList.contains('open') || currentMatches.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % currentMatches.length;
        highlightItem(activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = activeIdx <= 0 ? currentMatches.length - 1 : activeIdx - 1;
        highlightItem(activeIdx);
      } else if (e.key === 'Enter' && activeIdx >= 0 && currentMatches[activeIdx]) {
        e.preventDefault();
        pickValue(currentMatches[activeIdx].label);
      } else if (e.key === 'Escape') {
        closeList();
      }
    });
  }

  function normalizeProductUrl(raw) {
    const val = String(raw == null ? '' : raw).trim();
    if (!val) return '';
    if (/^(javascript|data|vbscript):/i.test(val)) return '';
    if (/^https?:\/\//i.test(val)) return val;
    return 'https://' + val.replace(/^\/+/, '');
  }

  function compactRecord(r) {
    const code = String((r && (r.code || r.callNumber)) || '').trim();
    return {
      id: String((r && r.id) || ''),
      prefix: String((r && r.prefix) || ''),
      num: String((r && r.num !== undefined && r.num !== null) ? r.num : ''),
      code: code,
      callNumber: String((r && r.callNumber) || code),
      name: String((r && r.name) || ''),
      category: String((r && r.category) || ''),
      description: String((r && r.description) || ''),
      drawer: String((r && r.drawer) || ''),
      productLink: String((r && (r.productLink || r.product_link)) || '')
    };
  }

  function compactRecords(list) {
    return Array.isArray(list) ? list.map(compactRecord) : [];
  }

  let mutationEpoch = 0;
  let pendingMutations = 0;
  let mutationQueue = Promise.resolve();

  function setSyncBadge(text, isOffline) {
    const doc = global.document;
    if (!doc) return;
    const el = doc.getElementById('syncStatusBadge');
    if (!el) return;
    el.innerText = text;
    if (isOffline) el.classList.add('offline');
    else el.classList.remove('offline');
  }

  function getAuthHeaders() {
    let token = '';
    try {
      token = (global.sessionStorage && global.sessionStorage.getItem('chem_auth_token')) || 'library-sync';
    } catch (e) {
      token = 'library-sync';
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };
  }

  async function apiRequest(path, options) {
    const base = resolveApiBase();
    if (!base || typeof global.fetch !== 'function') {
      setSyncBadge('Local Only', true);
      return null;
    }
    try {
      const opts = Object.assign({ cache: 'no-store' }, options || {});
      opts.headers = Object.assign(getAuthHeaders(), opts.headers || {});
      const resp = await global.fetch(base + '/api/v1/library-archive' + path, opts);
      if (!resp || !resp.ok) {
        setSyncBadge('Sync Offline', true);
        return null;
      }
      if (pendingMutations === 0) {
        setSyncBadge('Cloud Synced', false);
      }
      return await resp.json();
    } catch (e) {
      setSyncBadge('Sync Offline', true);
      return null;
    }
  }

  function enqueueMutation(fn) {
    mutationEpoch += 1;
    pendingMutations += 1;
    setSyncBadge('Saving...', false);
    const task = mutationQueue
      .catch(() => null)
      .then(() => fn())
      .finally(() => {
        pendingMutations = Math.max(0, pendingMutations - 1);
      });
    mutationQueue = task;
    return task.then(res => {
      if (res && pendingMutations === 0) {
        setSyncBadge('Cloud Synced', false);
      }
      return res;
    });
  }

  function parseCollectionRange(prefix, rangeText) {
    const clean = String(rangeText || '').trim();
    const rangeMatch = clean.match(/^(?:[A-Za-z][A-Za-z0-9_-]*[\s-]+)?(\d+)\s*(?:to|–|—|-)\s*(?:[A-Za-z][A-Za-z0-9_-]*[\s-]+)?(\d+)$/i);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (end < start) [start, end] = [end, start];
      const maxEnd = Math.min(end, start + 1999);
      const padLen = Math.max(3, rangeMatch[1].length);
      return { start, end: maxEnd, padLen };
    }
    const singleMatch = clean.match(/^(?:[A-Za-z][A-Za-z0-9_-]*[\s-]+)?(\d+)\s*\+?$/i);
    if (singleMatch) {
      const start = parseInt(singleMatch[1], 10);
      const padLen = Math.max(3, singleMatch[1].length);
      return { start, end: start + 99, padLen };
    }
    return { start: 1, end: 100, padLen: 3 };
  }

  function relinkOrSeedCollection(coll, allCollections, existingRecords) {
    const collId = String((coll && coll.id) || '').trim();
    if (!collId) return { relinked: [], created: [] };
    const activeIds = new Set((allCollections || []).map(c => c.id));
    const codePrefixLower = collId.toLowerCase() + '-';
    const { start, end, padLen } = parseCollectionRange(collId, coll.range);

    const expectedCodes = new Set();
    for (let i = start; i <= end; i++) {
      expectedCodes.add((collId + '-' + String(i).padStart(padLen, '0')).toLowerCase());
    }

    const relinked = [];
    const existingCodes = new Set();
    (existingRecords || []).forEach(r => {
      const codeLower = String((r && (r.code || r.callNumber)) || '').trim().toLowerCase();
      if (codeLower) existingCodes.add(codeLower);
      const isOrphan = !r.prefix || !activeIds.has(r.prefix) || r.prefix.toLowerCase() === collId.toLowerCase();
      if (r.prefix !== collId && isOrphan && (codeLower.startsWith(codePrefixLower) || expectedCodes.has(codeLower))) {
        r.prefix = collId;
        relinked.push(r);
      }
    });

    const created = [];
    const stamp = Date.now();
    for (let i = start; i <= end; i++) {
      const numStr = String(i).padStart(padLen, '0');
      const code = collId + '-' + numStr;
      if (!existingCodes.has(code.toLowerCase())) {
        created.push({
          id: collId.toLowerCase() + '-' + numStr + '-' + stamp + '-' + i,
          prefix: collId,
          num: numStr,
          callNumber: code,
          code: code,
          name: '',
          category: '',
          productLink: '',
          description: '',
          drawer: ''
        });
      }
    }
    return { relinked, created };
  }

  global.LibraryShared = {
    DEFAULT_PRODUCT_CATEGORIES,
    resolveApiBase,
    normalizeProductUrl,
    parseCollectionRange,
    relinkOrSeedCollection,
    injectAutocompleteStyles,
    getCategorySuggestions,
    attachCategoryAutocomplete,
    compactRecord,
    compactRecords,
    setSyncBadge,
    hasPendingMutations: function () {
      return pendingMutations > 0;
    },
    getMutationEpoch: function () {
      return mutationEpoch;
    },
    waitForPendingMutations: function () {
      return mutationQueue.catch(() => null);
    },
    fetchState: async function () {
      if (pendingMutations > 0) return null;
      const startEpoch = mutationEpoch;
      const data = await apiRequest('/state?_t=' + Date.now(), { method: 'GET' });
      if (!data) return null;
      if (pendingMutations > 0 || startEpoch !== mutationEpoch) return null;
      return data;
    },
    bootstrapState: function (collections, records) {
      const payload = JSON.stringify({
        collections: collections || [],
        records: compactRecords(records)
      });
      return enqueueMutation(() => apiRequest('/bootstrap', { method: 'POST', body: payload }));
    },
    createCollection: function (collection, records) {
      const payload = JSON.stringify({
        collection: collection,
        records: compactRecords(records)
      });
      return enqueueMutation(() => apiRequest('/collections', { method: 'POST', body: payload }));
    },
    deleteCollection: function (collId, mode) {
      const m = mode === 'shift_misc' ? 'shift_misc' : 'delete_records';
      const path = '/collections/' + encodeURIComponent(collId) + '?mode=' + encodeURIComponent(m);
      return enqueueMutation(() => apiRequest(path, { method: 'DELETE' }));
    },
    createRecord: function (record) {
      const payload = JSON.stringify(compactRecord(record));
      return enqueueMutation(() => apiRequest('/records', { method: 'POST', body: payload }));
    },
    updateRecord: function (recordId, patch) {
      const path = '/records/' + encodeURIComponent(recordId);
      const payload = JSON.stringify(patch || {});
      return enqueueMutation(() => apiRequest(path, { method: 'PATCH', body: payload }));
    },
    deleteRecord: function (recordId) {
      const path = '/records/' + encodeURIComponent(recordId);
      return enqueueMutation(() => apiRequest(path, { method: 'DELETE' }));
    },
    restoreState: function (collections, records) {
      const payload = JSON.stringify({
        collections: collections || [],
        records: compactRecords(records)
      });
      return enqueueMutation(() => apiRequest('/restore', { method: 'PUT', body: payload }));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
