import React, { useState, useEffect } from 'react';
import { 
  UserPlus, UserMinus, Shield, Eye, EyeOff, Building, 
  RefreshCw, CheckCircle, Trash2, AlertTriangle, Settings, Users
} from 'lucide-react';
import { AdminAPI, DatabaseAPI } from '../services/api';
import type { UserResponse, AuditLogResponse, LockoutResponse } from '../services/api';
import { TableSkeleton } from '../components/TableSkeleton';

interface UserManagementProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ConsolidatedUser {
  username: string;
  products: string[];
  roles: string[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);

  // Lists from DB
  const [productsList, setProductsList] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<UserResponse[]>([]);
  const [consolidatedUsers, setConsolidatedUsers] = useState<ConsolidatedUser[]>([]);

  // Audit Logs & Lockouts States
  const [auditLogs, setAuditLogs] = useState<AuditLogResponse[]>([]);
  const [lockouts, setLockouts] = useState<LockoutResponse[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingLockouts, setLoadingLockouts] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [subView, setSubView] = useState<'registry' | 'lockouts' | 'audit'>('registry');

  // Create User State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createProducts, setCreateProducts] = useState<Record<string, boolean>>({});
  const [createRoles, setCreateRoles] = useState<Record<string, boolean>>({});

  // Update User State
  const [selectedUser, setSelectedUser] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [updateProducts, setUpdateProducts] = useState<Record<string, boolean>>({});
  const [updateRoles, setUpdateRoles] = useState<Record<string, boolean>>({});

  // Delete User State
  const [deleteUsername, setDeleteUsername] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const MODULES = ['cms', 'mf', 'qc', 'complaints', 'production', 'lab', 'rd'];

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    const [success, data] = await AdminAPI.getAuditLogs();
    if (success && Array.isArray(data)) {
      setAuditLogs(data);
    }
    setLoadingAudit(false);
  };

  const fetchLockouts = async () => {
    setLoadingLockouts(true);
    const [success, data] = await AdminAPI.getLockouts();
    if (success && Array.isArray(data)) {
      setLockouts(data);
    }
    setLoadingLockouts(false);
  };

  const handleUnlock = async (identifier: string) => {
    const [success, data] = await AdminAPI.unlockIdentifier(identifier);
    if (success) {
      onShowToast(typeof data === 'string' ? data : 'Manually unlocked successfully.', 'success');
      fetchLockouts();
      fetchAuditLogs();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to release lockout.', 'error');
    }
  };

  const loadData = async () => {
    setLoading(true);
    // Fetch products list
    const [prodSuccess, prodData] = await DatabaseAPI.getProducts();
    if (prodSuccess && typeof prodData !== 'string') {
      const products = prodData.products || [];
      setProductsList(products);
      
      // Initialize checkboxes
      const createProdMap: Record<string, boolean> = {};
      const updateProdMap: Record<string, boolean> = {};
      products.forEach((p: string) => {
        createProdMap[p] = false;
        updateProdMap[p] = false;
      });
      setCreateProducts(createProdMap);
      setUpdateProducts(updateProdMap);
    }

    // Fetch users list
    const [userSuccess, userData] = await AdminAPI.getUsers();
    if (userSuccess && Array.isArray(userData)) {
      setUsersList(userData);
      consolidateUsersList(userData);
    } else {
      onShowToast('Failed to retrieve user database list.', 'error');
    }
    
    // Fetch Audit Logs and Lockouts
    fetchAuditLogs();
    fetchLockouts();
    
    setLoading(false);
  };

  const consolidateUsersList = (users: any[]) => {
    const map: Record<string, { products: Set<string>; roles: Set<string> }> = {};
    users.forEach(u => {
      const username = u.username || 'N/A';
      const product = u.product || 'N/A';
      const roles = (u.role || '').split(',').map((r: string) => r.trim()).filter(Boolean);

      if (!map[username]) {
        map[username] = { products: new Set(), roles: new Set() };
      }
      map[username].products.add(product);
      roles.forEach((role: string) => map[username].roles.add(role));
    });

    const consolidated: ConsolidatedUser[] = Object.keys(map).map(username => ({
      username,
      products: Array.from(map[username].products),
      roles: Array.from(map[username].roles)
    })).sort((a, b) => a.username.localeCompare(b.username));

    setConsolidatedUsers(consolidated);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsername.trim();
    const password = newPassword.trim();

    if (!username || !password) {
      onShowToast('Username and password are required.', 'warning');
      return;
    }

    const selectedProducts = Object.keys(createProducts).filter(p => createProducts[p]);
    if (selectedProducts.length === 0) {
      onShowToast('Please select at least one product partition workspace.', 'warning');
      return;
    }

    const selectedRoles = Object.keys(createRoles).filter(r => createRoles[r]);
    if (selectedRoles.length === 0) {
      onShowToast('Please select at least one module role access.', 'warning');
      return;
    }

    const accessControl: Record<string, string[]> = {};
    selectedProducts.forEach(p => {
      accessControl[p] = selectedRoles;
    });

    setLoading(true);
    const [success, data] = await AdminAPI.createUser({
      username,
      password,
      access_control: accessControl
    });
    setLoading(false);

    if (success) {
      onShowToast(typeof data === 'string' ? data : ((data as Record<string, any>)?.message || 'User created successfully!'), 'success');
      setNewUsername('');
      setNewPassword('');
      // Reset checklists
      const clearedProds = { ...createProducts };
      Object.keys(clearedProds).forEach(k => clearedProds[k] = false);
      setCreateProducts(clearedProds);
      
      const clearedRoles = { ...createRoles };
      MODULES.forEach(r => clearedRoles[r] = false);
      setCreateRoles(clearedRoles);
      
      loadData();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to create user.', 'error');
    }
  };

  const handleUpdateUserSelected = (username: string) => {
    setSelectedUser(username);
    const user = consolidatedUsers.find(u => u.username === username);
    if (!user) return;

    // Reset update password field
    setUpdatePassword('');

    // Pre-fill checkboxes
    const prodMap: Record<string, boolean> = {};
    productsList.forEach(p => {
      prodMap[p] = user.products.includes(p);
    });
    setUpdateProducts(prodMap);

    const roleMap: Record<string, boolean> = {};
    MODULES.forEach(r => {
      roleMap[r] = user.roles.includes(r);
    });
    setUpdateRoles(roleMap);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      onShowToast('Please select a user profile to modify.', 'warning');
      return;
    }

    const selectedProducts = Object.keys(updateProducts).filter(p => updateProducts[p]);
    if (selectedProducts.length === 0) {
      onShowToast('User must have access to at least one product workspace.', 'warning');
      return;
    }

    const selectedRoles = Object.keys(updateRoles).filter(r => updateRoles[r]);
    if (selectedRoles.length === 0) {
      onShowToast('User must have at least one active module role.', 'warning');
      return;
    }

    const accessControl: Record<string, string[]> = {};
    selectedProducts.forEach(p => {
      accessControl[p] = selectedRoles;
    });

    const payload: any = {
      access_control: accessControl
    };
    if (updatePassword.trim()) {
      payload.password = updatePassword.trim();
    }

    setLoading(true);
    const [success, data] = await AdminAPI.updateUser(selectedUser, payload);
    setLoading(false);

    if (success) {
      onShowToast(typeof data === 'string' ? data : ((data as Record<string, any>)?.message || 'User credentials modified successfully!'), 'success');
      setUpdatePassword('');
      loadData();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to update user profile.', 'error');
    }
  };

  const executeDeleteUser = async () => {
    if (confirmInput !== deleteUsername) return;

    setShowDeleteModal(false);
    setLoading(true);
    const [success, data] = await AdminAPI.deleteUser(deleteUsername);
    setLoading(false);

    if (success) {
      onShowToast(typeof data === 'string' ? data : ((data as Record<string, any>)?.message || `User "${deleteUsername}" successfully deleted.`), 'success');
      if (selectedUser === deleteUsername) {
        setSelectedUser('');
      }
      setDeleteUsername('');
      setConfirmInput('');
      loadData();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to delete user profile.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Header */}
      <div className="glass-card animated-fade" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary-color)' }}>
            <Users size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>User Management Dashboard</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Configure master credentials, define role access grids, and assign product workspaces.
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn-secondary" style={{ padding: '10px 16px', gap: '8px' }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          <span>Refresh Database</span>
        </button>
      </div>

      {/* Sub-Section Navigation Tabs */}
      <div style={{
        display: 'flex',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '6px',
        gap: '8px',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setSubView('registry')}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: subView === 'registry' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'registry' ? 1 : 0.6,
            outline: 'none'
          }}
        >
          👤 User Credentials Registry
        </button>
        <button
          onClick={() => setSubView('lockouts')}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: subView === 'lockouts' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'lockouts' ? 1 : 0.6,
            outline: 'none'
          }}
        >
          🔒 Active Security Lockouts ({lockouts.length})
        </button>
        <button
          onClick={() => setSubView('audit')}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: subView === 'audit' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'audit' ? 1 : 0.6,
            outline: 'none'
          }}
        >
          📋 System Audit Logs & Feed
        </button>
      </div>

      {subView === 'registry' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* CREATE NEW USER */}
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <UserPlus size={18} />
            <span>Create New User Profile</span>
          </h3>

          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-input-container">
              <span className="form-label">Username</span>
              <input 
                type="text" 
                className="field-input" 
                value={newUsername} 
                onChange={e => setNewUsername(e.target.value)} 
                placeholder="Enter new username"
                required
              />
            </div>

            <div className="form-input-container">
              <span className="form-label">Password</span>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewPassword ? 'text' : 'password'} 
                  className="field-input" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Enter secure password"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-input-container">
              <span className="form-label" style={{ fontWeight: 600 }}>Assign Product Scope(s)</span>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', maxHeight: '120px', overflowY: 'auto', backgroundColor: 'var(--input-bg)' }}>
                {productsList.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No active product databases created.</span>
                ) : (
                  productsList.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={createProducts[p] || false} 
                        onChange={e => setCreateProducts({ ...createProducts, [p]: e.target.checked })}
                      />
                      <span>{p}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-input-container">
              <span className="form-label" style={{ fontWeight: 600 }}>Define Module Role Access</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--input-bg)' }}>
                {MODULES.map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      checked={createRoles[role] || false} 
                      onChange={e => setCreateRoles({ ...createRoles, [role]: e.target.checked })}
                    />
                    <span>{role.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', height: '42px', marginTop: '8px', backgroundColor: 'var(--color-success)' }} disabled={loading}>
              <UserPlus size={16} />
              <span>Create User Credentials</span>
            </button>
          </form>
        </div>

        {/* UPDATE EXISTING USER */}
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <Settings size={18} />
            <span>Update User Credentials</span>
          </h3>

          <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-input-container">
              <span className="form-label">Select User Account</span>
              <select 
                className="field-input" 
                value={selectedUser} 
                onChange={e => handleUpdateUserSelected(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">-- Choose a user --</option>
                {consolidatedUsers.map(u => (
                  <option key={u.username} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>

            <div className="form-input-container">
              <span className="form-label">New Password (leave blank to keep current)</span>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showUpdatePassword ? 'text' : 'password'} 
                  className="field-input" 
                  value={updatePassword} 
                  onChange={e => setUpdatePassword(e.target.value)} 
                  placeholder="Enter password overwrite"
                  disabled={!selectedUser}
                />
                <button 
                  type="button" 
                  onClick={() => setShowUpdatePassword(!showUpdatePassword)}
                  style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                  disabled={!selectedUser}
                >
                  {showUpdatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-input-container">
              <span className="form-label" style={{ fontWeight: 600 }}>Update Product Scope(s)</span>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', maxHeight: '120px', overflowY: 'auto', backgroundColor: 'var(--input-bg)' }}>
                {productsList.map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.85rem', cursor: selectedUser ? 'pointer' : 'not-allowed', opacity: selectedUser ? 1 : 0.6 }}>
                    <input 
                      type="checkbox" 
                      checked={updateProducts[p] || false} 
                      onChange={e => setUpdateProducts({ ...updateProducts, [p]: e.target.checked })}
                      disabled={!selectedUser}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-input-container">
              <span className="form-label" style={{ fontWeight: 600 }}>Update Module Role Access</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--input-bg)' }}>
                {MODULES.map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: selectedUser ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: selectedUser ? 1 : 0.6 }}>
                    <input 
                      type="checkbox" 
                      checked={updateRoles[role] || false} 
                      onChange={e => setUpdateRoles({ ...updateRoles, [role]: e.target.checked })}
                      disabled={!selectedUser}
                    />
                    <span>{role.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', height: '42px', marginTop: '8px', backgroundColor: '#7c3aed' }} disabled={loading || !selectedUser}>
              <CheckCircle size={16} />
              <span>Save Profile Changes</span>
            </button>
          </form>
        </div>

      </div>

      {/* MASTER ACTIVE USERS LEDGER */}
      <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <Shield size={18} color="var(--primary-color)" />
          <span>Active User Credentials Registry</span>
        </h3>

        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : consolidatedUsers.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-light, #94a3b8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(0,0,0,0.01)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color, #E2E8F0)'
          }}>
            <Users size={36} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Registered Users Found</span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', margin: 0 }}>
              Use the forms above to register new user credentials and product scope access.
            </p>
          </div>
        ) : (
          <div className="table-scroll-container" style={{ maxHeight: '400px' }}>
            <table className="table-locked-header">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Username</th>
                  <th>Assigned Workspace Scopes</th>
                  <th>Active Module Roles</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Revoke</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedUsers.map(user => (
                  <tr key={user.username}>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                      👤 {user.username}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {user.products.map(p => (
                          <span key={p} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {user.roles.map(r => (
                          <span key={r} style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                            {r.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => {
                          setDeleteUsername(user.username);
                          setConfirmInput('');
                          setShowDeleteModal(true);
                        }}
                        className="btn-secondary"
                        style={{ border: 'none', backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', padding: '6px 10px' }}
                        title={`Revoke access for ${user.username}`}
                        disabled={loading}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {subView === 'lockouts' && (
        <>
          {/* Lockouts Manager Card */}
          <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <AlertTriangle size={18} color="#f59e0b" />
          <span>Active Security Lockouts & Unlock Manager</span>
        </h3>

        {loadingLockouts ? (
          <TableSkeleton rows={3} cols={4} />
        ) : lockouts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#10b981', fontStyle: 'italic', fontWeight: 500 }}>
            ✓ No locked out accounts or IP addresses currently recorded.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Target User / IP</th>
                  <th>Failed Attempts</th>
                  <th>Lockout Until</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Release</th>
                </tr>
              </thead>
              <tbody>
                {lockouts.map(lock => (
                  <tr key={lock.identifier}>
                    <td style={{ fontWeight: 600 }}>{lock.identifier}</td>
                    <td>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>{lock.attempt_count}</span>
                    </td>
                    <td style={{ color: '#f59e0b', fontWeight: 500 }}>
                      {lock.lockout_until ? new Date(lock.lockout_until).toLocaleString() : 'Permanent / N/A'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleUnlock(lock.identifier)}
                        className="btn-primary"
                        style={{
                          backgroundColor: '#10b981',
                          border: 'none',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Unlock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {subView === 'audit' && (
        <>
          {/* System Audit Logs Card */}
          <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Settings size={18} color="var(--primary-color)" />
            <span>System Audit Logs & Activity Feed</span>
          </h3>
          
          <input
            type="text"
            className="field-input"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Search by User or Action..."
            style={{
              maxWidth: '240px',
              height: '34px',
              fontSize: '0.8rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0 10px'
            }}
          />
        </div>

        {loadingAudit ? (
          <TableSkeleton rows={5} cols={6} />
        ) : auditLogs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontStyle: 'italic' }}>
            No audit logs recorded in system.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Username</th>
                  <th>Product Scope</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs
                  .filter(log => {
                    const term = auditSearch.toLowerCase();
                    return (
                      (log.username || '').toLowerCase().includes(term) ||
                      (log.action || '').toLowerCase().includes(term) ||
                      (log.description || '').toLowerCase().includes(term)
                    );
                  })
                  .map((log, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.username}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '2px 6px', borderRadius: '10px' }}>
                          {log.product_name}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.module}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{log.action}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.description}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Premium Glassmorphic Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card animated-scale" style={{
            width: '100%',
            maxWidth: '480px',
            background: 'rgba(30, 27, 75, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '28px',
            color: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', marginBottom: '16px' }}>
              <AlertTriangle size={28} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Account Revocation</h3>
            </div>
            
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '20px' }}>
              This action is <strong>irreversible</strong>. This will permanently delete the user profile for <strong style={{ color: '#fca5a5' }}>"{deleteUsername}"</strong> and revoke all associated access rule permissions across all product workspaces.
            </p>

            <div className="form-input-container" style={{ marginBottom: '24px' }}>
              <span className="form-label" style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                To confirm deletion, type the username below:
              </span>
              <input
                type="text"
                className="field-input"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder={deleteUsername}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  borderRadius: '8px',
                  height: '40px',
                  padding: '0 12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteUsername('');
                  setConfirmInput('');
                }}
                className="btn-secondary"
                style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteUser}
                disabled={confirmInput !== deleteUsername}
                style={{ 
                  height: '38px', 
                  padding: '0 16px', 
                  fontSize: '0.85rem',
                  backgroundColor: confirmInput === deleteUsername ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: confirmInput === deleteUsername ? 'pointer' : 'not-allowed',
                  opacity: confirmInput === deleteUsername ? 1 : 0.5
                }}
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
