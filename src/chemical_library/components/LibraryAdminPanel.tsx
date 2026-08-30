import React, { useState, useEffect } from 'react';
import {
  Database, Download, Upload,
  Plus, Search, Trash2, Edit3, CheckCircle2, Users, Activity, Eye, EyeOff
} from 'lucide-react';
import type { ChemicalRecord } from '../types';
import {
  getLibraryUsers,
  createLibraryUser,
  updateLibraryUser,
  deleteLibraryUser,
  getAuditLogs,
  addAuditLog,
  clearAuditLogs,
  exportAuditLogsCSV,
} from '../security/cryptoEngine';
import type { LibraryUser, AuditLogEntry } from '../security/cryptoEngine';

interface LibraryAdminPanelProps {
  records: ChemicalRecord[];
  onUpdateRecords: (records: ChemicalRecord[]) => void;
  onClose: () => void;
}

export const LibraryAdminPanel: React.FC<LibraryAdminPanelProps> = ({
  records,
  onUpdateRecords,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'users' | 'audit' | 'backup'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Users State
  const [users, setUsers] = useState<LibraryUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'curator' | 'researcher'>('curator');
  const [showUserPassToggle, setShowUserPassToggle] = useState(false);

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserPass, setEditUserPass] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'curator' | 'researcher'>('curator');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [logSearch, setLogSearch] = useState('');

  // New Record Form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Inline editing
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecordName, setEditRecordName] = useState('');
  const [editRecordCategory, setEditRecordCategory] = useState('');
  const [editRecordDesc, setEditRecordDesc] = useState('');

  useEffect(() => {
    setUsers(getLibraryUsers());
    setAuditLogs(getAuditLogs());
  }, [activeTab]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.code || r.callNumber || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q)
    );
  }).slice(0, 100);

  // Add Single Record
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      showNotification('Product Code is required.', 'error');
      return;
    }

    const prefix = newCode.split('-')[0] || 'MISC';
    const newRec: ChemicalRecord = {
      id: `custom_${Date.now()}`,
      callNumber: newCode.trim(),
      code: newCode.trim(),
      name: newName.trim(),
      category: newCategory.trim(),
      description: newDesc.trim(),
      drawer: 'ADMIN-DRAWER',
      prefix,
      num: '9999',
    };

    const next = [newRec, ...records];
    onUpdateRecords(next);
    addAuditLog('RECORD_CREATE', 'Admin', `Created chemical record ${newRec.code} (${newRec.name || 'Untitled'})`);
    setNewCode('');
    setNewName('');
    setNewCategory('');
    setNewDesc('');
    setShowAddForm(false);
    showNotification(`Record ${newRec.code} successfully created!`);
  };

  // Inline Record Edit
  const handleStartEditRecord = (r: ChemicalRecord) => {
    setEditingRecordId(r.id);
    setEditRecordName(r.name || '');
    setEditRecordCategory(r.category || '');
    setEditRecordDesc(r.description || '');
  };

  const handleSaveRecordEdit = (id: string, code: string) => {
    const next = records.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        name: editRecordName.trim(),
        category: editRecordCategory.trim(),
        description: editRecordDesc.trim(),
      };
    });
    onUpdateRecords(next);
    addAuditLog('RECORD_EDIT', 'Admin', `Updated record details for ${code}`);
    setEditingRecordId(null);
    showNotification(`Record ${code} updated successfully.`);
  };

  // Delete Record
  const handleDeleteRecord = (id: string, code: string) => {
    if (confirm(`Are you sure you want to delete ${code}?`)) {
      const next = records.filter(r => r.id !== id);
      onUpdateRecords(next);
      addAuditLog('RECORD_DELETE', 'Admin', `Deleted chemical record ${code}`);
      showNotification(`Record ${code} deleted.`);
    }
  };

  // User Management Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPass.trim()) {
      showNotification('Username and password are required.', 'error');
      return;
    }
    if (newUserPass.length < 6) {
      showNotification('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      await createLibraryUser(newUsername, newUserPass, newUserRole, true);
      setUsers(getLibraryUsers());
      setAuditLogs(getAuditLogs());
      setNewUsername('');
      setNewUserPass('');
      setShowAddUserModal(false);
      showNotification(`User '${newUsername}' created successfully!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to create user', 'error');
    }
  };

  const handleUpdateUser = async (id: string) => {
    try {
      await updateLibraryUser(id, {
        password: editUserPass ? editUserPass : undefined,
        role: editUserRole,
      });
      setUsers(getLibraryUsers());
      setAuditLogs(getAuditLogs());
      setEditingUserId(null);
      setEditUserPass('');
      showNotification('User profile updated successfully.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update user', 'error');
    }
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (confirm(`Are you sure you want to delete user account '${username}'?`)) {
      try {
        deleteLibraryUser(id);
        setUsers(getLibraryUsers());
        setAuditLogs(getAuditLogs());
        showNotification(`User '${username}' deleted.`);
      } catch (err: any) {
        showNotification(err.message || 'Cannot delete user', 'error');
      }
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(l => {
    const q = logSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      l.eventType.toLowerCase().includes(q) ||
      l.user.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(56, 47, 21, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '1200px',
          maxWidth: '96vw',
          height: '92vh',
          backgroundColor: '#FAF0D7',
          border: '2px solid #574A24',
          boxShadow: '0 25px 60px rgba(56, 47, 21, 0.4)',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 28px',
            backgroundColor: '#FDF7E3',
            borderBottom: '2px solid #574A24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#F6E2A3',
                border: '1.5px solid #574A24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '15px',
                color: '#574A24',
              }}
            >
              CA
            </div>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                  color: '#574A24',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                Chemical Archive Administration
              </h1>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', margin: 0, letterSpacing: '1px' }}>
                🔒 256-BIT ENCRYPTION • USER ACCESS MANAGEMENT • AUDIT LOGGING
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {statusMsg && (
              <div
                style={{
                  padding: '6px 14px',
                  backgroundColor: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
                  border: `1px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#f87171'}`,
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                }}
              >
                {statusMsg.text}
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                background: '#574A24',
                color: '#FAE8B4',
                border: 'none',
                padding: '8px 18px',
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              CLOSE SUITE ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ backgroundColor: '#FAE8B4', borderBottom: '1px solid #CBBD93', padding: '0 28px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('records')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'records' ? '3px solid #574A24' : '3px solid transparent',
              backgroundColor: activeTab === 'records' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: activeTab === 'records' ? '#574A24' : '#80775C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Database size={14} /> RECORDS MANAGER
          </button>

          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #574A24' : '3px solid transparent',
              backgroundColor: activeTab === 'users' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: activeTab === 'users' ? '#574A24' : '#80775C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={14} /> USERS & ACCESS ({users.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'audit' ? '3px solid #574A24' : '3px solid transparent',
              backgroundColor: activeTab === 'audit' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: activeTab === 'audit' ? '#574A24' : '#80775C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} /> AUDIT LOGS & MONITORING
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'backup' ? '3px solid #574A24' : '3px solid transparent',
              backgroundColor: activeTab === 'backup' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: activeTab === 'backup' ? '#574A24' : '#80775C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} /> BACKUP & RESTORE
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', backgroundColor: '#FDF7E3' }}>
          
          {/* TAB 1: RECORDS */}
          {activeTab === 'records' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#80775C' }} />
                    <input
                      type="text"
                      placeholder="Filter product code or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: '8px 12px 8px 30px',
                        background: '#F6E2A3',
                        border: '1px solid #CBBD93',
                        borderRadius: '2px',
                        fontSize: '12px',
                        color: '#574A24',
                        outline: 'none',
                        width: '260px',
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                    Showing {filteredRecords.length} of {records.length.toLocaleString()} records
                  </span>
                </div>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  style={{
                    background: '#574A24',
                    color: '#FAE8B4',
                    border: 'none',
                    padding: '8px 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} /> {showAddForm ? 'CANCEL' : 'ADD NEW RECORD'}
                </button>
              </div>

              {/* Add Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddRecord}
                  style={{
                    background: '#F6E2A3',
                    border: '1px solid #574A24',
                    padding: '18px 20px',
                    borderRadius: '2px',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Product Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. D-501"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                      style={{ width: '100%', padding: '6px 10px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      placeholder="Compound name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="Category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Short description"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button type="submit" style={{ background: '#574A24', color: '#FAE8B4', border: 'none', padding: '8px 20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}>
                      SAVE RECORD
                    </button>
                  </div>
                </form>
              )}

              {/* Records Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#FAE8B4', borderBottom: '1px solid #CBBD93' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>CODE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>NAME</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>CATEGORY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>DESCRIPTION</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '100px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #CBBD93' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#574A24' }}>
                        {r.code || r.callNumber}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {editingRecordId === r.id ? (
                          <input
                            type="text"
                            value={editRecordName}
                            onChange={(e) => setEditRecordName(e.target.value)}
                            style={{ width: '100%', padding: '4px', background: '#FFFDF7', border: '1px solid #574A24', fontSize: '12px' }}
                          />
                        ) : (
                          r.name || '—'
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {editingRecordId === r.id ? (
                          <input
                            type="text"
                            value={editRecordCategory}
                            onChange={(e) => setEditRecordCategory(e.target.value)}
                            style={{ width: '100%', padding: '4px', background: '#FFFDF7', border: '1px solid #574A24', fontSize: '12px' }}
                          />
                        ) : (
                          r.category || '—'
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#80775C' }}>
                        {editingRecordId === r.id ? (
                          <input
                            type="text"
                            value={editRecordDesc}
                            onChange={(e) => setEditRecordDesc(e.target.value)}
                            style={{ width: '100%', padding: '4px', background: '#FFFDF7', border: '1px solid #574A24', fontSize: '12px' }}
                          />
                        ) : (
                          r.description || '—'
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {editingRecordId === r.id ? (
                          <button
                            onClick={() => handleSaveRecordEdit(r.id, r.code || r.callNumber)}
                            style={{ background: '#166534', color: '#fff', border: 'none', padding: '4px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}
                          >
                            SAVE
                          </button>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleStartEditRecord(r)}
                              style={{ background: 'none', border: '1px solid #CBBD93', padding: '3px 6px', cursor: 'pointer', color: '#574A24', borderRadius: '2px' }}
                              title="Edit Record"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(r.id, r.code || r.callNumber)}
                              style={{ background: 'none', border: '1px solid #CBBD93', padding: '3px 6px', cursor: 'pointer', color: '#991b1b', borderRadius: '2px' }}
                              title="Delete Record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, color: '#574A24', margin: 0 }}>
                    LIBRARY ACCESS USER ACCOUNTS
                  </h2>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#80775C', margin: '4px 0 0 0' }}>
                    Dedicated library credentials with SHA-256 password hashing and role-based permissions.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddUserModal(!showAddUserModal)}
                  style={{
                    background: '#574A24',
                    color: '#FAE8B4',
                    border: 'none',
                    padding: '8px 18px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} /> {showAddUserModal ? 'CANCEL' : 'CREATE USER'}
                </button>
              </div>

              {/* Create User Form */}
              {showAddUserModal && (
                <form
                  onSubmit={handleCreateUser}
                  style={{
                    background: '#F6E2A3',
                    border: '1.5px solid #574A24',
                    padding: '20px',
                    borderRadius: '4px',
                    marginBottom: '24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Username *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. curator_john"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px 12px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showUserPassToggle ? 'text' : 'password'}
                        placeholder="Min 6 characters"
                        value={newUserPass}
                        onChange={(e) => setNewUserPass(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 36px 8px 12px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '13px', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserPassToggle(!showUserPassToggle)}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#80775C' }}
                      >
                        {showUserPassToggle ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C', marginBottom: '4px' }}>
                      Role
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 12px', background: '#FDF7E3', border: '1px solid #CBBD93', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="admin">Administrator (Full Control)</option>
                      <option value="curator">Curator (Edit & Catalog)</option>
                      <option value="researcher">Researcher (Read-Only)</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="submit" style={{ background: '#574A24', color: '#FAE8B4', border: 'none', padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '2px' }}>
                      CREATE USER ACCOUNT
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#FAE8B4', borderBottom: '1px solid #CBBD93' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>USERNAME</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>ROLE</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>2FA STATUS</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>CREATED AT</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>LAST LOGIN</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '140px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #CBBD93' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#574A24' }}>
                        {u.username}
                        {u.username.toLowerCase() === 'adi' && (
                          <span style={{ marginLeft: '6px', fontSize: '9px', background: '#574A24', color: '#FAE8B4', padding: '1px 5px', borderRadius: '2px' }}>
                            MASTER
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {editingUserId === u.id ? (
                          <select
                            value={editUserRole}
                            onChange={(e) => setEditUserRole(e.target.value as any)}
                            style={{ padding: '4px', background: '#FFFDF7', border: '1px solid #574A24', fontSize: '12px' }}
                          >
                            <option value="admin">Admin</option>
                            <option value="curator">Curator</option>
                            <option value="researcher">Researcher</option>
                          </select>
                        ) : (
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#166534', fontSize: '11px', fontFamily: 'var(--font-mono)', background: '#dcfce7', padding: '2px 6px', borderRadius: '2px' }}>
                          <CheckCircle2 size={12} /> 2FA ENFORCED
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleTimeString() : 'Never'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {editingUserId === u.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                              type="password"
                              placeholder="New password (optional)"
                              value={editUserPass}
                              onChange={(e) => setEditUserPass(e.target.value)}
                              style={{ padding: '3px 6px', fontSize: '11px', background: '#FFFDF7', border: '1px solid #574A24' }}
                            />
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleUpdateUser(u.id)}
                                style={{ background: '#166534', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}
                              >
                                SAVE
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                style={{ background: '#CBBD93', color: '#574A24', border: 'none', padding: '3px 6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditUserRole(u.role);
                                setEditUserPass('');
                              }}
                              style={{ background: 'none', border: '1px solid #CBBD93', padding: '4px 8px', cursor: 'pointer', color: '#574A24', borderRadius: '2px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Edit User / Change Password"
                            >
                              <Edit3 size={12} /> EDIT
                            </button>
                            {u.username.toLowerCase() !== 'adi' && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                style={{ background: 'none', border: '1px solid #CBBD93', padding: '4px 8px', cursor: 'pointer', color: '#991b1b', borderRadius: '2px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Delete User"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS & MONITORING */}
          {activeTab === 'audit' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, color: '#574A24', margin: 0 }}>
                    CRYPTOGRAPHIC AUDIT TRAIL & ACTIVITY LOGS
                  </h2>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#80775C', margin: '4px 0 0 0' }}>
                    Immutable historical audit trail tracking logins, 2FA challenges, record edits, and security events.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Filter audit logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      background: '#F6E2A3',
                      border: '1px solid #CBBD93',
                      borderRadius: '2px',
                      fontSize: '12px',
                      color: '#574A24',
                      outline: 'none',
                      width: '200px',
                    }}
                  />
                  <button
                    onClick={exportAuditLogsCSV}
                    style={{
                      background: '#574A24',
                      color: '#FAE8B4',
                      border: 'none',
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={13} /> EXPORT CSV
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Clear audit logs history?')) {
                        clearAuditLogs();
                        setAuditLogs(getAuditLogs());
                        showNotification('Audit logs cleared.');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #991b1b',
                      color: '#991b1b',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '2px',
                    }}
                  >
                    CLEAR LOGS
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#FAE8B4', borderBottom: '1px solid #CBBD93' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '160px' }}>TIMESTAMP</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '130px' }}>EVENT TYPE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '110px' }}>USER</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>DETAILS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C', width: '110px' }}>INTEGRITY HASH</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => {
                    let badgeBg = '#dcfce7';
                    let badgeColor = '#166534';
                    if (log.eventType.includes('FAILED')) {
                      badgeBg = '#fee2e2';
                      badgeColor = '#991b1b';
                    } else if (log.eventType.includes('EDIT') || log.eventType.includes('DELETE')) {
                      badgeBg = '#fef3c7';
                      badgeColor = '#92400e';
                    }

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #CBBD93' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, background: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '2px' }}>
                            {log.eventType}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#574A24' }}>
                          {log.user}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#574A24' }}>
                          {log.details}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                          <code>{log.encryptionHash || 'SHA256'}</code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, color: '#574A24', marginBottom: '16px' }}>
                DATABASE BACKUP & RESTORATION
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#F6E2A3', padding: '20px', border: '1px solid #CBBD93', borderRadius: '4px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0' }}>
                    EXPORT COMPLETE ARCHIVE
                  </h3>
                  <p style={{ fontSize: '12px', color: '#80775C', margin: '0 0 14px 0' }}>
                    Download a full snapshot of all {records.length.toLocaleString()} chemical records in JSON format.
                  </p>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `chemical_archive_backup_${new Date().toISOString().slice(0,10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      addAuditLog('BACKUP_EXPORT', 'Admin', `Exported full database backup (${records.length} records)`);
                      showNotification('Backup exported successfully.');
                    }}
                    style={{
                      background: '#574A24',
                      color: '#FAE8B4',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={13} /> EXPORT JSON BACKUP
                  </button>
                </div>

                <div style={{ background: '#F6E2A3', padding: '20px', border: '1px solid #CBBD93', borderRadius: '4px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0' }}>
                    RESTORE FROM BACKUP
                  </h3>
                  <p style={{ fontSize: '12px', color: '#80775C', margin: '0 0 14px 0' }}>
                    Upload a previously exported JSON backup file to restore records.
                  </p>
                  <input
                    type="file"
                    id="adminImportFile"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        try {
                          const imported = JSON.parse(evt.target?.result as string);
                          if (Array.isArray(imported)) {
                            onUpdateRecords(imported);
                            addAuditLog('BACKUP_RESTORE', 'Admin', `Restored ${imported.length} records from JSON backup`);
                            showNotification(`Successfully restored ${imported.length} records!`);
                          }
                        } catch {
                          showNotification('Invalid JSON backup file.', 'error');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('adminImportFile')?.click()}
                    style={{
                      background: '#574A24',
                      color: '#FAE8B4',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Upload size={13} /> UPLOAD BACKUP FILE
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
