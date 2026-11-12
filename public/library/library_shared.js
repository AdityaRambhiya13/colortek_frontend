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
      drawer: String((r && r.drawer) || '')
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
      setSyncBadge('Cloud Synced', false);
      return await resp.json();
    } catch (e) {
      setSyncBadge('Sync Offline', true);
      return null;
    }
  }

  global.LibraryShared = {
    DEFAULT_PRODUCT_CATEGORIES,
    resolveApiBase,
    injectAutocompleteStyles,
    getCategorySuggestions,
    attachCategoryAutocomplete,
    compactRecord,
    compactRecords,
    setSyncBadge,
    fetchState: function () {
      return apiRequest('/state', { method: 'GET' });
    },
    bootstrapState: function (collections, records) {
      return apiRequest('/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          collections: collections || [],
          records: compactRecords(records)
        })
      });
    },
    createCollection: function (collection, records) {
      return apiRequest('/collections', {
        method: 'POST',
        body: JSON.stringify({
          collection: collection,
          records: compactRecords(records)
        })
      });
    },
    deleteCollection: function (collId) {
      return apiRequest('/collections/' + encodeURIComponent(collId), {
        method: 'DELETE'
      });
    },
    createRecord: function (record) {
      return apiRequest('/records', {
        method: 'POST',
        body: JSON.stringify(compactRecord(record))
      });
    },
    updateRecord: function (recordId, patch) {
      return apiRequest('/records/' + encodeURIComponent(recordId), {
        method: 'PATCH',
        body: JSON.stringify(patch || {})
      });
    },
    deleteRecord: function (recordId) {
      return apiRequest('/records/' + encodeURIComponent(recordId), {
        method: 'DELETE'
      });
    },
    restoreState: function (collections, records) {
      return apiRequest('/restore', {
        method: 'PUT',
        body: JSON.stringify({
          collections: collections || [],
          records: compactRecords(records)
        })
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
