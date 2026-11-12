(function () {
  'use strict';

  const Lib = window.ColortekLibrary;
  if (!Lib) return;

  let allCollections = [];
  let allRecords = [];
  let allActivityLogs = [];
  let libraryUsers = [];
  let editingRecordId = null;
  let pendingDeleteCollId = null;
  let pendingPreAuthToken = '';
  let pendingMfaMethod = 'totp';
  let resendCooldownTimer = null;

  function showAuthError(msg) {
    const box = document.getElementById('authErr');
    const txt = document.getElementById('authErrText');
    if (box && txt) {
      txt.textContent = msg;
      box.style.display = 'flex';
    }
  }

  function hideAuthError() {
    const box = document.getElementById('authErr');
    if (box) box.style.display = 'none';
  }

  function resetToStep1() {
    pendingPreAuthToken = '';
    pendingMfaMethod = 'totp';
    if (resendCooldownTimer) {
      clearInterval(resendCooldownTimer);
      resendCooldownTimer = null;
    }
    const f1 = document.getElementById('adminLoginForm');
    const f2 = document.getElementById('adminOtpForm');
    const otpInp = document.getElementById('adminOtpCode');
    if (f1) f1.style.display = 'flex';
    if (f2) f2.style.display = 'none';
    if (otpInp) otpInp.value = '';
    hideAuthError();
  }

  function startResendCooldown(seconds) {
    const btn = document.getElementById('adminResendOtpBtn');
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
    const f1 = document.getElementById('adminLoginForm');
    const f2 = document.getElementById('adminOtpForm');
    const prompt = document.getElementById('adminOtpPrompt');
    const resendBtn = document.getElementById('adminResendOtpBtn');
    const otpInp = document.getElementById('adminOtpCode');

    if (f1) f1.style.display = 'none';
    if (f2) f2.style.display = 'flex';
    if (prompt) {
      prompt.textContent =
        pendingMfaMethod === 'sms'
          ? `Enter the 6-digit SMS code sent to ${resp.destination || 'your registered phone'}.`
          : 'Enter the 6-digit code from your Authenticator App.';
    }
    if (resendBtn) {
      resendBtn.style.display = pendingMfaMethod === 'sms' ? 'inline-flex' : 'none';
      if (pendingMfaMethod === 'sms') startResendCooldown(30);
    }
    if (otpInp) {
      otpInp.value = '';
      setTimeout(() => otpInp.focus(), 50);
    }
    hideAuthError();
  }

  function showAuthGate() {
    resetToStep1();
    const gate = document.getElementById('adminAuthGate');
    if (gate) gate.style.display = 'flex';
  }

  function hideAuthGate() {
    const gate = document.getElementById('adminAuthGate');
    if (gate) gate.style.display = 'none';
  }

  async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const uEl = document.getElementById('adminUser');
    const pEl = document.getElementById('adminPass');
    const btn = document.getElementById('adminStep1SubmitBtn');
    const username = (uEl?.value || '').trim();
    const password = pEl?.value || '';
    if (!username || !password) {
      showAuthError('Enter administrator username and password.');
      return;
    }
    if (btn) btn.disabled = true;
    try {
      const resp = await Lib.loginStep1(username, password);
      if (resp && resp.status === '2FA_REQUIRED' && resp.pre_auth_token) {
        showOtpStep(resp);
      } else {
        showAuthError('Unexpected login response.');
      }
    } catch (err) {
      showAuthError(err.message || 'Authentication failed.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleAdminOtpSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const codeEl = document.getElementById('adminOtpCode');
    const btn = document.getElementById('adminVerifyOtpBtn');
    const code = (codeEl?.value || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) {
      showAuthError('Enter a valid 6-digit verification code.');
      return;
    }
    if (btn) btn.disabled = true;
    try {
      const data = await Lib.verify2faStep2(pendingPreAuthToken, code);
      if (data && data.user && data.user.role !== 'admin') {
        await Lib.logoutSession();
        resetToStep1();
        showAuthError('Administrator role required for Admin Portal.');
        return;
      }
      const pEl = document.getElementById('adminPass');
      if (pEl) pEl.value = '';
      resetToStep1();
      hideAuthGate();
      await loadAdminDashboardData();
      startInactivityTimer();
    } catch (err) {
      showAuthError(err.message || 'Verification failed.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleAdminResendOtp() {
    if (!pendingPreAuthToken) return;
    hideAuthError();
    try {
      const resp = await Lib.resendSmsOtp(pendingPreAuthToken);
      const prompt = document.getElementById('adminOtpPrompt');
      if (prompt && resp?.destination) {
        prompt.textContent = `Fresh 6-digit SMS code sent to ${resp.destination}.`;
      }
      startResendCooldown(30);
    } catch (err) {
      showAuthError(err.message || 'Failed to resend OTP.');
    }
  }

  async function logoutAdmin() {
    Lib.stopInactivityAutoLogout();
    await Lib.logoutSession();
    allCollections = [];
    allRecords = [];
    allActivityLogs = [];
    libraryUsers = [];
    closeRecordModal();
    closeDeleteCollModal();
    showAuthGate();
  }

  function startInactivityTimer() {
    Lib.initInactivityAutoLogout({
      timeoutMs: 15 * 60 * 1000,
      isLoggedIn: () => !!Lib.getSessionUser(),
      onTimeout: logoutAdmin,
    });
  }

  async function loadAdminDashboardData() {
    Lib.setSyncBadge('SYNCING...', false);
    try {
      const state = await Lib.fetchState();
      allCollections = Array.isArray(state?.collections) ? state.collections : [];
      allRecords = Array.isArray(state?.records) ? state.records : [];
      Lib.setSyncBadge('CONNECTED (DB)', false);
      renderRecordFilterOptions();
      applyRecordFilters();
      renderCollectionsTable();
      renderUnlinkedSummary();
    } catch (err) {
      if (err && err.status === 401) {
        await logoutAdmin();
        return;
      }
      Lib.setSyncBadge('SYNC ERROR', true);
    }
  }

  function switchTab(tab) {
    const tabs = ['records', 'categories', 'security', 'backup', 'activity'];
    tabs.forEach((t) => {
      const cap = t.charAt(0).toUpperCase() + t.slice(1);
      const panel = document.getElementById('tab' + cap);
      const btn = document.getElementById('tabBtn' + cap);
      if (panel) panel.style.display = t === tab ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'activity') loadAdminActivityLogs();
    if (tab === 'security') loadLibraryUsers();
  }

  function renderRecordFilterOptions() {
    const sel = document.getElementById('recordCollectionFilter');
    if (!sel) return;
    const prev = sel.value || 'ALL';
    let html = '<option value="ALL">All Collections</option><option value="UNLINKED">Unlinked / Orphaned</option>';
    allCollections.forEach((c) => {
      html += `<option value="${Lib.escapeAttr(c.id)}">${Lib.escapeHtml(c.label || c.id)}</option>`;
    });
    sel.innerHTML = html;
    sel.value = prev;
  }

  function applyRecordFilters() {
    const tbody = document.getElementById('recordsTableBody');
    const countEl = document.getElementById('totalRecCount');
    const collFilter = document.getElementById('recordCollectionFilter')?.value || 'ALL';
    const q = (document.getElementById('recordSearchInput')?.value || '').trim().toLowerCase();

    const activeIds = new Set(allCollections.map((c) => c.id));
    let filtered = allRecords.filter((r) => {
      if (collFilter === 'UNLINKED') {
        if (r.prefix && activeIds.has(r.prefix)) return false;
      } else if (collFilter !== 'ALL') {
        if (r.prefix !== collFilter) return false;
      }
      if (q) {
        const hay = `${r.code || ''} ${r.callNumber || ''} ${r.name || ''} ${r.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = `${filtered.length} shown / ${allRecords.length} total`;
    if (!tbody) return;

    const slice = filtered.slice(0, 500);
    if (!slice.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--olive-muted);">No matching chemical records.</td></tr>';
      return;
    }

    tbody.innerHTML = slice
      .map((r) => {
        const safeUrl = Lib.normalizeProductUrl(r.productLink || '');
        const linkHtml = safeUrl
          ? `<a href="${Lib.escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#1b4332;text-decoration:underline;margin-left:6px;">link</a>`
          : '';
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:700;">${Lib.escapeHtml(r.code || r.callNumber || r.id)}</td>
            <td>${Lib.escapeHtml(r.name || '—')}${linkHtml}</td>
            <td><span class="badge-pill">${Lib.escapeHtml(r.category || 'Uncategorized')}</span></td>
            <td>${Lib.escapeHtml(r.prefix || 'UNLINKED')}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button type="button" class="action-btn" data-edit-rec="${Lib.escapeAttr(r.id)}" style="margin-right:6px;">Edit</button>
              <button type="button" class="action-btn" data-del-rec="${Lib.escapeAttr(r.id)}" style="color:#991b1b;border-color:#fca5a5;">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
    Lib.createLocalIcons();
  }

  function renderUnlinkedSummary() {
    const unlinked = Lib.getUnlinkedRecords(allCollections, allRecords);
    const banners = document.querySelectorAll('#unlinkedRecordsBanner');
    banners.forEach((b) => {
      b.style.display = unlinked.length ? 'flex' : 'none';
    });
    document.querySelectorAll('#unlinkedRecordsBannerTitle').forEach((el) => {
      el.textContent = `${unlinked.length} Unlinked / Orphaned Record${unlinked.length === 1 ? '' : 's'}`;
    });
    document.querySelectorAll('#unlinkedRecordsBannerPreview').forEach((el) => {
      el.textContent = unlinked.slice(0, 4).map((r) => r.code || r.id).join(', ');
    });
    document.querySelectorAll('#unlinkedBannerDelCount').forEach((el) => {
      el.textContent = String(unlinked.length);
    });
  }

  function viewUnlinkedRecordsInTable() {
    const sel = document.getElementById('recordCollectionFilter');
    if (sel) sel.value = 'UNLINKED';
    switchTab('records');
    applyRecordFilters();
  }

  async function deleteAllUnlinkedRecords() {
    const unlinked = Lib.getUnlinkedRecords(allCollections, allRecords);
    if (!unlinked.length) return;
    if (!window.confirm(`Permanently delete ${unlinked.length} unlinked record(s)?`)) return;
    try {
      await Lib.deleteUnlinkedRecords();
      await loadAdminDashboardData();
    } catch (err) {
      window.alert(err.message || 'Failed to purge unlinked records.');
    }
  }

  // --- Record Modal ---
  function showNewRecordModal() {
    editingRecordId = null;
    const title = document.getElementById('recordModalTitle');
    if (title) title.textContent = 'Add Chemical Record';
    populateModalPrefixes();
    document.getElementById('recModalPrefix').value = allCollections[0]?.id || 'MISC';
    document.getElementById('recModalCode').value = '';
    document.getElementById('recModalName').value = '';
    document.getElementById('recModalCategory').value = '';
    document.getElementById('recModalProductLink').value = '';
    document.getElementById('recModalDesc').value = '';
    updateAdminModalLinkPreview();
    document.getElementById('recordModalBackdrop')?.classList.add('open');
  }

  function showEditRecordModal(recId) {
    const rec = allRecords.find((r) => r.id === recId);
    if (!rec) return;
    editingRecordId = recId;
    const title = document.getElementById('recordModalTitle');
    if (title) title.textContent = `Edit Record (${rec.code || rec.id})`;
    populateModalPrefixes();
    document.getElementById('recModalPrefix').value = rec.prefix || 'MISC';
    document.getElementById('recModalCode').value = rec.code || rec.callNumber || '';
    document.getElementById('recModalName').value = rec.name || '';
    document.getElementById('recModalCategory').value = rec.category || '';
    document.getElementById('recModalProductLink').value = rec.productLink || '';
    document.getElementById('recModalDesc').value = rec.description || '';
    updateAdminModalLinkPreview();
    document.getElementById('recordModalBackdrop')?.classList.add('open');
  }

  function populateModalPrefixes() {
    const sel = document.getElementById('recModalPrefix');
    if (!sel) return;
    sel.innerHTML = allCollections
      .map((c) => `<option value="${Lib.escapeAttr(c.id)}">${Lib.escapeHtml(c.id)} — ${Lib.escapeHtml(c.label)}</option>`)
      .join('') + '<option value="MISC">MISC — Uncategorized</option>';
  }

  function closeRecordModal() {
    editingRecordId = null;
    document.getElementById('recordModalBackdrop')?.classList.remove('open');
  }

  function updateAdminModalLinkPreview() {
    const input = document.getElementById('recModalProductLink');
    const anchor = document.getElementById('recModalLinkAnchor');
    if (!input || !anchor) return;
    const safeUrl = Lib.normalizeProductUrl(input.value);
    if (safeUrl) {
      anchor.href = safeUrl;
      anchor.style.display = 'inline-flex';
      anchor.setAttribute('rel', 'noopener noreferrer');
    } else {
      anchor.removeAttribute('href');
      anchor.style.display = 'none';
    }
  }

  async function saveRecordFromModal(e) {
    e.preventDefault();
    const prefix = (document.getElementById('recModalPrefix')?.value || '').trim();
    const code = (document.getElementById('recModalCode')?.value || '').trim();
    const name = (document.getElementById('recModalName')?.value || '').trim();
    const category = (document.getElementById('recModalCategory')?.value || '').trim();
    const rawLink = (document.getElementById('recModalProductLink')?.value || '').trim();
    const desc = document.getElementById('recModalDesc')?.value || '';

    const normalizedLink = rawLink ? Lib.normalizeProductUrl(rawLink) : '';
    if (rawLink && !normalizedLink) {
      window.alert('Product URL must start with http:// or https://');
      return;
    }
    if (!code) {
      window.alert('Specimen code is required.');
      return;
    }

    try {
      if (editingRecordId) {
        await Lib.updateRecord(editingRecordId, {
          prefix,
          code,
          callNumber: code,
          name,
          category,
          productLink: normalizedLink,
          description: desc,
        });
      } else {
        const recId = `${prefix.toLowerCase() || 'rec'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await Lib.createRecord({
          id: recId,
          prefix,
          num: '',
          code,
          callNumber: code,
          name,
          category,
          productLink: normalizedLink,
          description: desc,
          drawer: '',
        });
      }
      closeRecordModal();
      await loadAdminDashboardData();
    } catch (err) {
      window.alert(err.message || 'Failed to save record.');
    }
  }

  async function deleteSingleRecord(recId) {
    const rec = allRecords.find((r) => r.id === recId);
    if (!rec) return;
    if (!window.confirm(`Delete chemical record "${rec.code || recId}"?`)) return;
    try {
      await Lib.deleteRecord(recId);
      await loadAdminDashboardData();
    } catch (err) {
      window.alert(err.message || 'Failed to delete record.');
    }
  }

  // --- Collections Management ---
  function renderCollectionsTable() {
    const badge = document.getElementById('collCountBadge');
    const tbody = document.getElementById('collectionsTableBody');
    if (badge) badge.textContent = String(allCollections.length);
    if (!tbody) return;

    const counts = new Map();
    allRecords.forEach((r) => counts.set(r.prefix, (counts.get(r.prefix) || 0) + 1));

    if (!allCollections.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;">No collections created.</td></tr>';
      return;
    }

    tbody.innerHTML = allCollections
      .map((c) => {
        const cnt = counts.get(c.id) || 0;
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:700;">${Lib.escapeHtml(c.id)}</td>
            <td>${Lib.escapeHtml(c.label)}</td>
            <td>${Lib.escapeHtml(c.range || '—')} (${cnt} items)</td>
            <td style="text-align:right;">
              <button type="button" class="action-btn" data-del-coll="${Lib.escapeAttr(c.id)}" style="color:#991b1b;border-color:#fca5a5;">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  async function handleCreateCollection(e) {
    e.preventDefault();
    const idEl = document.getElementById('newCollId');
    const lblEl = document.getElementById('newCollLabel');
    const rngEl = document.getElementById('newCollRange');
    const fbEl = document.getElementById('collFeedback');

    const id = (idEl?.value || '').trim();
    const label = (lblEl?.value || '').trim();
    const range = (rngEl?.value || '').trim();
    if (!id || !label) return;

    const coll = { id, label, range };
    const syncRes = Lib.syncCollectionRecords(coll, allRecords, allCollections);
    try {
      await Lib.createCollection(coll, syncRes.allToPersist);
      if (idEl) idEl.value = '';
      if (lblEl) lblEl.value = '';
      if (rngEl) rngEl.value = '';
      if (fbEl) {
        fbEl.textContent = `Saved collection ${id} (${syncRes.allToPersist.length} synced cards).`;
        fbEl.style.display = 'block';
      }
      await loadAdminDashboardData();
    } catch (err) {
      window.alert(err.message || 'Failed to create collection.');
    }
  }

  function openDeleteCollModal(collId) {
    pendingDeleteCollId = collId;
    const textEl = document.getElementById('deleteCollWarningText');
    if (textEl) textEl.textContent = `Choose how to handle chemical records inside collection "${collId}".`;
    document.getElementById('deleteCollModalBackdrop')?.classList.add('open');
  }

  function closeDeleteCollModal() {
    pendingDeleteCollId = null;
    document.getElementById('deleteCollModalBackdrop')?.classList.remove('open');
  }

  async function confirmDeleteCollectionAction(mode) {
    if (!pendingDeleteCollId) return;
    try {
      await Lib.deleteCollection(pendingDeleteCollId, mode);
      closeDeleteCollModal();
      await loadAdminDashboardData();
    } catch (err) {
      window.alert(err.message || 'Failed to delete collection.');
    }
  }

  // --- Security Tab (Users, TOTP/SMS Enrollment, Lockouts) ---
  async function loadLibraryUsers() {
    const tbody = document.getElementById('libraryUsersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;">Loading users...</td></tr>';
    try {
      const data = await Lib.fetchLibraryUsers();
      libraryUsers = Array.isArray(data?.users) ? data.users : [];
      renderLibraryUsersTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#991b1b;padding:18px;">${Lib.escapeHtml(err.message || 'Failed to load users')}</td></tr>`;
    }
  }

  function renderLibraryUsersTable() {
    const tbody = document.getElementById('libraryUsersTableBody');
    if (!tbody) return;
    if (!libraryUsers.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;">No users provisioned.</td></tr>';
      return;
    }
    tbody.innerHTML = libraryUsers
      .map((u) => {
        const mfaLabel = u.mfa_method === 'sms' ? `SMS (${u.phone_masked || '—'})` : 'Authenticator App (TOTP)';
        return `
          <tr>
            <td style="font-weight:700;">${Lib.escapeHtml(u.username)}</td>
            <td><span class="badge-pill">${Lib.escapeHtml(u.role)}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;">${Lib.escapeHtml(mfaLabel)}</td>
            <td>${u.is_active ? 'Active' : 'Disabled'}</td>
            <td style="text-align:right;white-space:nowrap;">
              ${u.mfa_method === 'totp' ? `<button type="button" class="action-btn" data-reset-2fa="${Lib.escapeAttr(u.id)}" style="margin-right:6px;">Reset 2FA</button>` : ''}
              <button type="button" class="action-btn" data-del-user="${Lib.escapeAttr(u.id)}" style="color:#991b1b;border-color:#fca5a5;">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function showProvisioningUri(username, resp) {
    const box = document.getElementById('userProvisioningBox');
    const txt = document.getElementById('userProvisioningUri');
    const secEl = document.getElementById('userProvisioningSecret');
    const qrImg = document.getElementById('userProvisioningQr');
    const lbl = document.getElementById('userProvisioningLabel');
    const uri = (resp && resp.provisioning_uri) || '';
    const secret = (resp && resp.provisioning_secret) || '';
    const qrDataUri = (resp && resp.provisioning_qr_data_uri) || '';

    if (box && txt) {
      if (lbl) lbl.textContent = `Scan QR or enter Setup Key in Google Authenticator / Authy for "${username}" (shown ONCE):`;
      txt.value = uri;
      if (secEl) secEl.textContent = secret || '—';
      if (qrImg) {
        if (qrDataUri && qrDataUri.startsWith('data:image/svg+xml;base64,')) {
          qrImg.src = qrDataUri;
          qrImg.style.display = 'block';
        } else {
          qrImg.removeAttribute('src');
          qrImg.style.display = 'none';
        }
      }
      box.style.display = 'block';
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    const uEl = document.getElementById('newLibUsername');
    const pEl = document.getElementById('newLibPassword');
    const rEl = document.getElementById('newLibRole');
    const mEl = document.getElementById('newLibMfaMethod');
    const phEl = document.getElementById('newLibPhone');

    const payload = {
      username: (uEl?.value || '').trim(),
      password: pEl?.value || '',
      role: rEl?.value || 'viewer',
      mfa_method: mEl?.value || 'totp',
      phone_number: (phEl?.value || '').trim() || null,
    };

    try {
      const resp = await Lib.createLibraryUser(payload);
      if (uEl) uEl.value = '';
      if (pEl) pEl.value = '';
      if (phEl) phEl.value = '';
      if (resp && resp.provisioning_uri) {
        showProvisioningUri(payload.username, resp);
      } else {
        window.alert(`User "${payload.username}" created with ${payload.mfa_method.toUpperCase()} 2FA.`);
      }
      await loadLibraryUsers();
    } catch (err) {
      window.alert(err.message || 'Failed to create user.');
    }
  }

  async function handleClearAllLockouts() {
    if (!window.confirm('Clear all Chemical Library brute-force IP and account lockouts?')) return;
    try {
      await Lib.clearLibraryLockouts();
      window.alert('Server lockouts cleared successfully.');
    } catch (err) {
      window.alert(err.message || 'Failed to clear lockouts.');
    }
  }

  // --- Backup & Restore ---
  function exportArchiveJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      collections: allCollections,
      records: Lib.compactRecords(allRecords),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colortek-chemical-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Lib.logActivity('EXPORT', 'admin', `Exported ${allRecords.length} chemical records`);
  }

  async function importArchiveJSON(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      window.alert('Backup JSON file exceeds 15 MB limit.');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const colls = Array.isArray(parsed) ? allCollections : parsed.collections;
      const recs = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(colls) || !Array.isArray(recs)) {
        throw new Error('JSON must contain "collections" and "records" arrays.');
      }
      if (colls.length > 200 || recs.length > 5000) {
        throw new Error('Snapshot exceeds maximum collection (200) or record (5000) bounds.');
      }
      if (!window.confirm(`Replace archive with ${colls.length} collections and ${recs.length} records?`)) return;
      await Lib.restoreState(colls, recs);
      await loadAdminDashboardData();
      window.alert('Archive snapshot restored successfully.');
    } catch (err) {
      window.alert('Invalid backup file: ' + (err.message || err));
    }
  }

  async function factoryResetArchive() {
    if (!window.confirm('RESET ENTIRE CHEMICAL ARCHIVE to factory seed data from server? Current changes will be replaced.')) return;
    try {
      const resp = await Lib.factoryResetArchive();
      await loadAdminDashboardData();
      window.alert(`Factory reset complete (${resp?.recordsCount || 0} records restored).`);
    } catch (err) {
      window.alert(err.message || 'Factory reset failed.');
    }
  }

  // --- Activity Audit Logs ---
  async function loadAdminActivityLogs() {
    const tbody = document.getElementById('activityLogsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;">Loading logs...</td></tr>';
    try {
      allActivityLogs = await Lib.fetchActivityLogs(250);
      renderActivityLogsTable();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#991b1b;padding:18px;">${Lib.escapeHtml(err.message || 'Error')}</td></tr>`;
    }
  }

  function renderActivityLogsTable() {
    const tbody = document.getElementById('activityLogsTableBody');
    const totalBadge = document.getElementById('activityTotalCount');
    const actionFilter = (document.getElementById('activityActionFilter')?.value || 'ALL').toUpperCase();
    const q = (document.getElementById('activitySearchInput')?.value || '').trim().toLowerCase();

    const loginLog = allActivityLogs.find((l) => l.action === 'LOGIN_SUCCESS' || l.action === 'LOGIN');
    const logoutLog = allActivityLogs.find((l) => l.action === 'LOGOUT');
    const lastLoginEl = document.getElementById('lastLoginSummary');
    const lastLogoutEl = document.getElementById('lastLogoutSummary');
    const totalEl = document.getElementById('totalActivitySummary');
    if (lastLoginEl) lastLoginEl.textContent = loginLog ? `${loginLog.username} (${new Date(loginLog.timestamp).toLocaleString()})` : '—';
    if (lastLogoutEl) lastLogoutEl.textContent = logoutLog ? `${logoutLog.username} (${new Date(logoutLog.timestamp).toLocaleString()})` : '—';
    if (totalEl) totalEl.textContent = String(allActivityLogs.length);

    const filtered = allActivityLogs.filter((l) => {
      if (actionFilter !== 'ALL' && (l.action || '').toUpperCase() !== actionFilter) return false;
      if (q) {
        const hay = `${l.username || ''} ${l.action || ''} ${l.details || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (totalBadge) totalBadge.textContent = String(filtered.length);
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;">No activity logs recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((l) => {
        const ts = l.timestamp ? new Date(l.timestamp).toLocaleString() : '—';
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-size:11px;">${Lib.escapeHtml(ts)}</td>
            <td style="font-weight:700;">${Lib.escapeHtml(l.username)}</td>
            <td><span class="badge-pill">${Lib.escapeHtml(l.action)}</span></td>
            <td>${Lib.escapeHtml(l.details || '')}</td>
          </tr>
        `;
      })
      .join('');
  }

  function bindEvents() {
    document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLoginSubmit);
    document.getElementById('adminOtpForm')?.addEventListener('submit', handleAdminOtpSubmit);
    document.getElementById('adminResendOtpBtn')?.addEventListener('click', handleAdminResendOtp);
    document.getElementById('adminBackToStep1Btn')?.addEventListener('click', resetToStep1);
    document.getElementById('adminLogoutBtn')?.addEventListener('click', logoutAdmin);

    document.getElementById('tabBtnRecords')?.addEventListener('click', () => switchTab('records'));
    document.getElementById('tabBtnCategories')?.addEventListener('click', () => switchTab('categories'));
    document.getElementById('tabBtnSecurity')?.addEventListener('click', () => switchTab('security'));
    document.getElementById('tabBtnBackup')?.addEventListener('click', () => switchTab('backup'));
    document.getElementById('tabBtnActivity')?.addEventListener('click', () => switchTab('activity'));

    document.getElementById('recordCollectionFilter')?.addEventListener('change', applyRecordFilters);
    document.getElementById('recordSearchInput')?.addEventListener('input', applyRecordFilters);
    document.getElementById('newRecordBtn')?.addEventListener('click', showNewRecordModal);

    document.getElementById('recordsTableBody')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-rec]');
      if (editBtn) return showEditRecordModal(editBtn.getAttribute('data-edit-rec'));
      const delBtn = e.target.closest('[data-del-rec]');
      if (delBtn) return deleteSingleRecord(delBtn.getAttribute('data-del-rec'));
    });

    document.querySelectorAll('.btn-view-unlinked').forEach((b) => b.addEventListener('click', viewUnlinkedRecordsInTable));
    document.querySelectorAll('.btn-del-unlinked').forEach((b) => b.addEventListener('click', deleteAllUnlinkedRecords));

    document.getElementById('createCollectionForm')?.addEventListener('submit', handleCreateCollection);
    document.getElementById('collectionsTableBody')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-coll]');
      if (delBtn) openDeleteCollModal(delBtn.getAttribute('data-del-coll'));
    });

    document.getElementById('recordModalBackdrop')?.addEventListener('click', closeRecordModal);
    document.getElementById('recordModalCard')?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('closeRecordModalBtn')?.addEventListener('click', closeRecordModal);
    document.getElementById('cancelRecordModalBtn')?.addEventListener('click', closeRecordModal);
    document.getElementById('recordModalForm')?.addEventListener('submit', saveRecordFromModal);
    document.getElementById('recModalProductLink')?.addEventListener('input', updateAdminModalLinkPreview);

    document.getElementById('deleteCollModalBackdrop')?.addEventListener('click', closeDeleteCollModal);
    document.getElementById('deleteCollModalCard')?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('closeDeleteCollModalBtn')?.addEventListener('click', closeDeleteCollModal);
    document.getElementById('cancelDeleteCollBtn')?.addEventListener('click', closeDeleteCollModal);
    document.getElementById('btnConfirmDeleteAllRecs')?.addEventListener('click', () => confirmDeleteCollectionAction('delete_records'));
    document.getElementById('btnConfirmShiftMisc')?.addEventListener('click', () => confirmDeleteCollectionAction('shift_misc'));

    // Security tab bindings
    document.getElementById('clearLockoutsBtn')?.addEventListener('click', handleClearAllLockouts);
    document.getElementById('createUserForm')?.addEventListener('submit', handleCreateUser);
    document.getElementById('newLibMfaMethod')?.addEventListener('change', (e) => {
      const phoneGrp = document.getElementById('newLibPhoneGroup');
      if (phoneGrp) phoneGrp.style.display = e.target.value === 'sms' ? 'block' : 'none';
    });
    document.getElementById('copyProvUriBtn')?.addEventListener('click', async () => {
      const uriEl = document.getElementById('userProvisioningUri');
      if (uriEl && navigator.clipboard) {
        await navigator.clipboard.writeText(uriEl.value);
      }
    });
    document.getElementById('libraryUsersTableBody')?.addEventListener('click', async (e) => {
      const resetBtn = e.target.closest('[data-reset-2fa]');
      if (resetBtn) {
        const uid = resetBtn.getAttribute('data-reset-2fa');
        if (!window.confirm('Rotate this user’s Authenticator App (TOTP) secret?')) return;
        try {
          const resp = await Lib.resetLibraryUser2fa(uid);
          if (resp?.provisioning_uri) showProvisioningUri(resp.username, resp);
        } catch (err) {
          window.alert(err.message || 'Failed to reset 2FA.');
        }
        return;
      }
      const delBtn = e.target.closest('[data-del-user]');
      if (delBtn) {
        const uid = delBtn.getAttribute('data-del-user');
        if (!window.confirm('Delete this Chemical Library user account?')) return;
        try {
          await Lib.deleteLibraryUser(uid);
          await loadLibraryUsers();
        } catch (err) {
          window.alert(err.message || 'Failed to delete user.');
        }
      }
    });

    // Backup tab bindings
    document.getElementById('exportJsonBtn')?.addEventListener('click', exportArchiveJSON);
    document.getElementById('importFileBtn')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
    document.getElementById('importFileInput')?.addEventListener('change', importArchiveJSON);
    document.getElementById('factoryResetBtn')?.addEventListener('click', factoryResetArchive);

    // Activity tab bindings
    document.getElementById('activityActionFilter')?.addEventListener('change', renderActivityLogsTable);
    document.getElementById('activitySearchInput')?.addEventListener('input', renderActivityLogsTable);
    document.getElementById('refreshActivityBtn')?.addEventListener('click', loadAdminActivityLogs);

    Lib.attachCategoryAutocomplete({
      inputEl: document.getElementById('recModalCategory'),
      listEl: document.getElementById('recModalCategoryAcList'),
      getRecords: () => allRecords,
    });
  }

  async function init() {
    Lib.clearLocalArchiveCaches();
    Lib.createLocalIcons();
    bindEvents();

    const session = await Lib.checkSession();
    if (!session || session.role !== 'admin') {
      if (session && session.role !== 'admin') {
        await Lib.logoutSession();
        showAuthError('Administrator role required for Admin Portal.');
      }
      showAuthGate();
      return;
    }

    hideAuthGate();
    await loadAdminDashboardData();
    startInactivityTimer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
