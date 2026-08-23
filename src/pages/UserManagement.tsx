import React, { useState, useEffect } from 'react';
import { 
  UserPlus, UserMinus, Shield, Eye, EyeOff, Building, 
  RefreshCw, CheckCircle, Trash2, AlertTriangle, Settings, Users,
  Key, Lock, History, Search, ArrowUpDown, Clock, CheckCircle2, ShieldCheck, AlertCircle, FileText, X
} from 'lucide-react';
import { AdminAPI, DatabaseAPI } from '../services/api';
import type { UserResponse, AuditLogResponse, LockoutResponse, UserModifyPasswordStatus, ModifiedBatchLogResponse } from '../services/api';
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
  const [subView, setSubView] = useState<'registry' | 'batch_passwords' | 'modified_batches' | 'lockouts' | 'audit'>('registry');

  // Batch Modification Passwords State
  const [batchModifyStatuses, setBatchModifyStatuses] = useState<UserModifyPasswordStatus[]>([]);
  const [loadingBatchModifyStatuses, setLoadingBatchModifyStatuses] = useState(false);
  const [selectedUserForModifyPwd, setSelectedUserForModifyPwd] = useState('');
  const [setModifyPwdInput, setSetModifyPwdInput] = useState('');
  const [showSetModifyPwd, setShowSetModifyPwd] = useState(false);
  const [modifyPwdModalOpen, setModifyPwdModalOpen] = useState(false);
  const [savingModifyPwd, setSavingModifyPwd] = useState(false);

  // Modified Batches Tracking State
  const [modifiedBatchesList, setModifiedBatchesList] = useState<ModifiedBatchLogResponse[]>([]);
  const [loadingModifiedBatches, setLoadingModifiedBatches] = useState(false);
  const [modBatchesSearch, setModBatchesSearch] = useState('');
  const [modBatchesTypeFilter, setModBatchesTypeFilter] = useState<'all' | 'lab_formulation' | 'rm_testing'>('all');
  const [selectedModBatchDetail, setSelectedModBatchDetail] = useState<ModifiedBatchLogResponse | null>(null);
  const [modBatchDetailModalOpen, setModBatchDetailModalOpen] = useState(false);

  // Create User State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newBatchModifyPassword, setNewBatchModifyPassword] = useState('');
  const [showNewBatchModifyPassword, setShowNewBatchModifyPassword] = useState(false);
  const [createProducts, setCreateProducts] = useState<Record<string, boolean>>({});
  const [createRoles, setCreateRoles] = useState<Record<string, boolean>>({});

  // Update User State
  const [selectedUser, setSelectedUser] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [updateBatchModifyPassword, setUpdateBatchModifyPassword] = useState('');
  const [showUpdateBatchModifyPassword, setShowUpdateBatchModifyPassword] = useState(false);
  const [updateProducts, setUpdateProducts] = useState<Record<string, boolean>>({});
  const [updateRoles, setUpdateRoles] = useState<Record<string, boolean>>({});

  // Delete User State
  const [deleteUsername, setDeleteUsername] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const MODULES = ['admin', 'cms', 'mf', 'lab_mf', 'qc', 'complaints', 'production', 'lab', 'rd'];

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

  const fetchBatchModifyStatuses = async () => {
    setLoadingBatchModifyStatuses(true);
    const [success, data] = await AdminAPI.getBatchModifyPasswordStatuses();
    if (success && Array.isArray(data)) {
      setBatchModifyStatuses(data);
    }
    setLoadingBatchModifyStatuses(false);
  };

  const fetchModifiedBatches = async () => {
    setLoadingModifiedBatches(true);
    const [success, data] = await AdminAPI.getModifiedBatches(
      undefined, 
      modBatchesSearch.trim() || undefined, 
      modBatchesTypeFilter !== 'all' ? modBatchesTypeFilter : undefined
    );
    if (success && Array.isArray(data)) {
      setModifiedBatchesList(data);
    }
    setLoadingModifiedBatches(false);
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
    
    // Fetch all management streams
    fetchAuditLogs();
    fetchLockouts();
    fetchBatchModifyStatuses();
    fetchModifiedBatches();
    
    setLoading(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handleSaveBatchModifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForModifyPwd || !setModifyPwdInput.trim()) {
      onShowToast('User and modification password are required.', 'warning');
      return;
    }

    setSavingModifyPwd(true);
    const [success, res] = await AdminAPI.setBatchModifyPassword(selectedUserForModifyPwd, setModifyPwdInput.trim());
    setSavingModifyPwd(false);

    if (success) {
      onShowToast(`Batch modification password set for '${selectedUserForModifyPwd}' successfully!`, 'success');
      setModifyPwdModalOpen(false);
      setSetModifyPwdInput('');
      fetchBatchModifyStatuses();
    } else {
      onShowToast(typeof res === 'string' ? res : 'Failed to update modification password.', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsername.trim();
    const password = newPassword.trim();
    const batchModifyPassword = newBatchModifyPassword.trim();

    if (!username || !password) {
      onShowToast('Username and Login Password are required.', 'warning');
      return;
    }

    if (!batchModifyPassword) {
      onShowToast('Batch Modification Password is required for the new user profile.', 'warning');
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
      batch_modify_password: batchModifyPassword,
      access_control: accessControl
    });
    setLoading(false);

    if (success) {
      onShowToast(typeof data === 'string' ? data : ((data as Record<string, any>)?.message || 'User created successfully!'), 'success');
      setNewUsername('');
      setNewPassword('');
      setNewBatchModifyPassword('');
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

    // Reset update password fields
    setUpdatePassword('');
    setUpdateBatchModifyPassword('');

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      access_control: accessControl
    };
    if (updatePassword.trim()) {
      payload.password = updatePassword.trim();
    }
    if (updateBatchModifyPassword.trim()) {
      payload.batch_modify_password = updateBatchModifyPassword.trim();
    }

    setLoading(true);
    const [success, data] = await AdminAPI.updateUser(selectedUser, payload);
    setLoading(false);

    if (success) {
      onShowToast(typeof data === 'string' ? data : ((data as Record<string, any>)?.message || 'User credentials modified successfully!'), 'success');
      setUpdatePassword('');
      setUpdateBatchModifyPassword('');
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
        flexWrap: 'wrap',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '6px',
        gap: '6px',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setSubView('registry')}
          style={{
            flex: '1 1 180px',
            padding: '10px 14px',
            backgroundColor: subView === 'registry' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'registry' ? 1 : 0.6,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          👤 User Credentials Registry
        </button>
        <button
          onClick={() => {
            setSubView('batch_passwords');
            fetchBatchModifyStatuses();
          }}
          style={{
            flex: '1 1 180px',
            padding: '10px 14px',
            backgroundColor: subView === 'batch_passwords' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'batch_passwords' ? 1 : 0.6,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🔑 Batch Modification Passwords
        </button>
        <button
          onClick={() => {
            setSubView('modified_batches');
            fetchModifiedBatches();
          }}
          style={{
            flex: '1 1 180px',
            padding: '10px 14px',
            backgroundColor: subView === 'modified_batches' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'modified_batches' ? 1 : 0.6,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🔄 Modified Batches ({modifiedBatchesList.length})
        </button>
        <button
          onClick={() => {
            setSubView('lockouts');
            fetchLockouts();
          }}
          style={{
            flex: '1 1 160px',
            padding: '10px 14px',
            backgroundColor: subView === 'lockouts' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'lockouts' ? 1 : 0.6,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🔒 Active Lockouts ({lockouts.length})
        </button>
        <button
          onClick={() => {
            setSubView('audit');
            fetchAuditLogs();
          }}
          style={{
            flex: '1 1 180px',
            padding: '10px 14px',
            backgroundColor: subView === 'audit' ? '#7c3aed' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: subView === 'audit' ? 1 : 0.6,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          📋 Audit Logs & Feed
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
              <span className="form-label">Login Password</span>
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
              <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} color="#7c3aed" /> Batch Modification Password <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>(Required)</span>
              </span>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewBatchModifyPassword ? 'text' : 'password'} 
                  className="field-input" 
                  value={newBatchModifyPassword} 
                  onChange={e => setNewBatchModifyPassword(e.target.value)} 
                  placeholder="Set authorization password for modifying batches"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewBatchModifyPassword(!showNewBatchModifyPassword)}
                  style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                >
                  {showNewBatchModifyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Admin-mandated password required when this user modifies existing batches in Lab Formulations & RM Testing.
              </span>
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
                      <span>{p.toUpperCase()}</span>
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
                    <span>{role === 'lab_mf' ? 'LAB MF' : role.toUpperCase()}</span>
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
              <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} color="#7c3aed" /> New Batch Modification Password (leave blank to keep current)
              </span>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showUpdateBatchModifyPassword ? 'text' : 'password'} 
                  className="field-input" 
                  value={updateBatchModifyPassword} 
                  onChange={e => setUpdateBatchModifyPassword(e.target.value)} 
                  placeholder="Enter new modify password overwrite"
                  disabled={!selectedUser}
                />
                <button 
                  type="button" 
                  onClick={() => setShowUpdateBatchModifyPassword(!showUpdateBatchModifyPassword)}
                  style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                  disabled={!selectedUser}
                >
                  {showUpdateBatchModifyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    <span>{p.toUpperCase()}</span>
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
                    <span>{role === 'lab_mf' ? 'LAB MF' : role.toUpperCase()}</span>
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
                            {p.toUpperCase()}
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

      {subView === 'batch_passwords' && (
        <>
          <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', margin: 0 }}>
                  <Key size={20} />
                  <span>Batch Modification Authorization Passwords</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Assign and manage dedicated authorization passwords required when users modify existing batches in Past Formulations (Lab Formulations & RM Testing).
                </p>
              </div>
              <button 
                onClick={fetchBatchModifyStatuses} 
                className="btn-secondary" 
                style={{ padding: '8px 14px', gap: '6px', fontSize: '0.8rem' }}
                disabled={loadingBatchModifyStatuses}
              >
                <RefreshCw size={13} className={loadingBatchModifyStatuses ? 'spin-loader' : ''} />
                <span>Refresh Statuses</span>
              </button>
            </div>

            {loadingBatchModifyStatuses ? (
              <TableSkeleton rows={4} cols={4} />
            ) : batchModifyStatuses.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)', fontStyle: 'italic' }}>
                No registered users found.
              </div>
            ) : (
              <div className="table-scroll-container" style={{ maxHeight: '500px' }}>
                <table className="table-locked-header">
                  <thead>
                    <tr>
                      <th style={{ width: '200px' }}>User Account</th>
                      <th>Assigned Product Workspace(s)</th>
                      <th style={{ width: '240px' }}>Modification Password Status</th>
                      <th style={{ width: '180px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchModifyStatuses.map(status => (
                      <tr key={status.username}>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                          👤 {status.username}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {status.accessible_products.map(p => (
                              <span key={p} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                {p.toUpperCase()}
                              </span>
                            ))}
                            {status.accessible_products.length === 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontStyle: 'italic' }}>All products</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {status.has_modify_password ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}>
                              <ShieldCheck size={14} /> Password Configured
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}>
                              <AlertCircle size={14} /> Not Configured
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedUserForModifyPwd(status.username);
                              setSetModifyPwdInput('');
                              setShowSetModifyPwd(false);
                              setModifyPwdModalOpen(true);
                            }}
                            className="btn-primary"
                            style={{
                              backgroundColor: '#7c3aed',
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              gap: '6px'
                            }}
                          >
                            <Key size={13} />
                            <span>{status.has_modify_password ? 'Update Password' : 'Set Password'}</span>
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

      {subView === 'modified_batches' && (
        <>
          <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', margin: 0 }}>
                  <History size={20} />
                  <span>Modified Batches Audit Ledger</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Real-time centralized ledger of all formulation batch modifications across all product databases with permanent static timestamps.
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}>
                  <Search size={14} color="var(--text-light)" />
                  <input
                    type="text"
                    placeholder="Search batch, user, product..."
                    value={modBatchesSearch}
                    onChange={e => setModBatchesSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', padding: '8px 8px', fontSize: '0.85rem', color: 'var(--text-primary)', outline: 'none', width: '190px' }}
                  />
                </div>

                <select
                  value={modBatchesTypeFilter}
                  onChange={e => setModBatchesTypeFilter(e.target.value as any)}
                  className="field-input"
                  style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <option value="all">All Formulations</option>
                  <option value="lab_formulation">Lab Formulations</option>
                  <option value="rm_testing">RM Testing</option>
                </select>

                <button 
                  onClick={fetchModifiedBatches} 
                  className="btn-secondary" 
                  style={{ padding: '8px 14px', gap: '6px', fontSize: '0.8rem' }}
                  disabled={loadingModifiedBatches}
                >
                  <RefreshCw size={13} className={loadingModifiedBatches ? 'spin-loader' : ''} />
                  <span>Refresh Log</span>
                </button>
              </div>
            </div>

            {loadingModifiedBatches ? (
              <TableSkeleton rows={5} cols={6} />
            ) : modifiedBatchesList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <History size={36} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Batch Modifications Recorded Yet</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  When any user modifies an existing batch in Lab Formulations or RM Testing, it will automatically appear here in real-time.
                </p>
              </div>
            ) : (
              <div className="table-scroll-container" style={{ maxHeight: '550px' }}>
                <table className="table-locked-header">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Modified At (Static)</th>
                      <th style={{ width: '120px' }}>Product</th>
                      <th style={{ width: '140px' }}>Batch No</th>
                      <th style={{ width: '140px' }}>Module</th>
                      <th style={{ width: '130px' }}>Modified By</th>
                      <th>Summary of Changes</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modifiedBatchesList
                      .filter(b => {
                        const q = modBatchesSearch.toLowerCase();
                        if (!q) return true;
                        return (
                          b.batch_no.toLowerCase().includes(q) ||
                          b.modified_by.toLowerCase().includes(q) ||
                          b.product_name.toLowerCase().includes(q) ||
                          (b.changes_summary || '').toLowerCase().includes(q)
                        );
                      })
                      .map(item => (
                        <tr key={item.id} style={{ backgroundColor: 'rgba(239, 68, 68, 0.03)' }}>
                          <td style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={13} color="#f87171" />
                              <span>{item.formatted_timestamp}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              {item.product_name.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fca5a5',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.8rem'
                            }}>
                              <AlertTriangle size={12} /> {item.batch_no}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: item.formulation_type === 'lab_formulation' ? '#7c3aed' : '#2563eb',
                              backgroundColor: item.formulation_type === 'lab_formulation' ? '#f5f3ff' : '#eff6ff',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}>
                              {item.formulation_type === 'lab_formulation' ? 'Lab Formulation' : 'RM Testing'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#dc2626' }}>
                            👤 {item.modified_by}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {item.changes_summary || 'Batch details updated'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedModBatchDetail(item);
                                setModBatchDetailModalOpen(true);
                              }}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                              title="View full modification payload snapshot"
                            >
                              <FileText size={13} />
                              <span>View</span>
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
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '28px',
            color: 'var(--text-primary)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', marginBottom: '16px' }}>
              <AlertTriangle size={28} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Account Revocation</h3>
            </div>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
              This action is <strong>irreversible</strong>. This will permanently delete the user profile for <strong style={{ color: '#ef4444' }}>"{deleteUsername}"</strong> and revoke all associated access rule permissions across all product workspaces.
            </p>

            <div className="form-input-container" style={{ marginBottom: '24px' }}>
              <span className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
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

      {/* Set Batch Modification Password Modal */}
      {modifyPwdModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card animated-scale" style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: '16px',
            padding: '26px',
            color: 'var(--text-primary)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(124, 58, 237, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#a78bfa', marginBottom: '14px' }}>
              <div style={{ backgroundColor: 'rgba(124, 58, 237, 0.2)', padding: '10px', borderRadius: '10px', color: '#a78bfa' }}>
                <Key size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Configure Batch Modify Password</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target User: <strong>{selectedUserForModifyPwd}</strong></span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '18px' }}>
              This authorization password will be required whenever <strong>{selectedUserForModifyPwd}</strong> attempts to modify an existing batch in Past Formulations.
            </p>

            <form onSubmit={handleSaveBatchModifyPassword}>
              <div className="form-input-container" style={{ marginBottom: '20px' }}>
                <span className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  New Batch Modification Password:
                </span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSetModifyPwd ? 'text' : 'password'}
                    className="field-input"
                    value={setModifyPwdInput}
                    onChange={e => setSetModifyPwdInput(e.target.value)}
                    placeholder="Enter new modify password..."
                    autoFocus
                    required
                    style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetModifyPwd(!showSetModifyPwd)}
                    style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                  >
                    {showSetModifyPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModifyPwdModalOpen(false);
                    setSetModifyPwdInput('');
                  }}
                  className="btn-secondary"
                  style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem' }}
                  disabled={savingModifyPwd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ height: '38px', padding: '0 18px', fontSize: '0.85rem', backgroundColor: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={savingModifyPwd}
                >
                  {savingModifyPwd ? <RefreshCw size={14} className="spin-loader" /> : <ShieldCheck size={14} />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modified Batch Full Details Modal */}
      {modBatchDetailModalOpen && selectedModBatchDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card animated-scale" style={{
            width: '100%',
            maxWidth: '560px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            color: 'var(--text-primary)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '8px', color: '#dc2626' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Batch #{selectedModBatchDetail.batch_no} Modification Detail
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Product: {selectedModBatchDetail.product_name.toUpperCase()} | Module: {selectedModBatchDetail.formulation_type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModBatchDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', backgroundColor: 'var(--input-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Modified By:</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>👤 {selectedModBatchDetail.modified_by}</span>
                
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Timestamp:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🕒 {selectedModBatchDetail.formatted_timestamp}</span>

                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Summary:</span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>{selectedModBatchDetail.changes_summary || 'N/A'}</span>
              </div>

              {(() => {
                let parsedDiff: any = null;
                try {
                  parsedDiff = typeof selectedModBatchDetail.full_details === 'string' 
                    ? JSON.parse(selectedModBatchDetail.full_details) 
                    : selectedModBatchDetail.full_details;
                } catch {
                  parsedDiff = null;
                }

                if (!parsedDiff) return null;

                const hasFieldDiffs = parsedDiff.field_diffs && Object.keys(parsedDiff.field_diffs).length > 0;
                const hasMatDiffs = parsedDiff.materials_diff && parsedDiff.materials_diff.some((m: any) => m.is_new || m.qty_changed || m.material_changed || m.solid_changed);
                const hasTestDiffs = parsedDiff.tests_diff && parsedDiff.tests_diff.some((t: any) => t.is_new || t.result_changed || t.standard_changed);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {hasFieldDiffs && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', display: 'block', marginBottom: '6px' }}>
                          🏷️ Changed Header Fields
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {Object.entries(parsedDiff.field_diffs).map(([fKey, fVal]: [string, any]) => (
                            <div key={fKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)', minWidth: '110px' }}>{fKey.replace(/_/g, ' ')}:</span>
                              <span style={{ color: '#64748b', textDecoration: 'line-through', fontSize: '0.75rem' }}>{fVal.old || '(empty)'}</span>
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>➔ {fVal.new || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasMatDiffs && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', display: 'block', marginBottom: '6px' }}>
                          🧪 Raw Material Modifications
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {parsedDiff.materials_diff.filter((m: any) => m.is_new || m.qty_changed || m.material_changed || m.solid_changed).map((m: any, mIdx: number) => (
                            <div key={mIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fee2e2', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fca5a5' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#dc2626' }}>{m.raw_material}</span>
                                {m.is_new && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                                    NEW MATERIAL ADDED
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {m.qty_changed && (
                                  <span style={{ fontWeight: 700, color: '#dc2626' }}>
                                    Qty: {m.old_qty !== null ? `${m.old_qty} ➔ ` : ''}{m.new_qty}
                                  </span>
                                )}
                                {m.solid_changed && (
                                  <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                                    Solid%: {m.old_solid ?? '-'}% ➔ {m.new_solid ?? '-'}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasTestDiffs && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', display: 'block', marginBottom: '6px' }}>
                          📋 Test Specification Modifications
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {parsedDiff.tests_diff.filter((t: any) => t.is_new || t.result_changed || t.standard_changed).map((t: any, tIdx: number) => (
                            <div key={tIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fee2e2', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fca5a5' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#dc2626' }}>{t.method}</span>
                                {t.is_new && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                                    NEW TEST
                                  </span>
                                )}
                              </div>
                              <div>
                                {t.result_changed && (
                                  <span style={{ fontWeight: 700, color: '#dc2626' }}>
                                    Result: {t.old_result ? `"${t.old_result}" ➔ ` : ''}"{t.new_result}"
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedModBatchDetail.full_details && (
                <div>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '0.8rem' }}>
                    Full JSON Payload:
                  </span>
                  <pre style={{
                    backgroundColor: '#090d16',
                    color: '#38bdf8',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0
                  }}>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedModBatchDetail.full_details), null, 2);
                      } catch {
                        return selectedModBatchDetail.full_details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                onClick={() => setModBatchDetailModalOpen(false)}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 16px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
