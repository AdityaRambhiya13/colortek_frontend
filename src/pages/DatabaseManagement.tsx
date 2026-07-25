import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, Database, FolderPlus, RefreshCw, Trash2, 
  Copy, Terminal, Layers, Search, X, Pencil, Check
} from 'lucide-react';
import { DatabaseAPI } from '../services/api';

interface DatabaseManagementProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DatabaseManagement: React.FC<DatabaseManagementProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [existingProducts, setExistingProducts] = useState<string[]>([]);
  const [customProductName, setCustomProductName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Inline Rename State
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Terminal activity logs
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const logMessage = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadExistingProducts = async () => {
    setLoading(true);
    const [success, data] = await DatabaseAPI.getProducts();
    setLoading(false);

    if (success && typeof data !== 'string') {
      setExistingProducts(data.products || []);
    } else {
      logMessage(`[ERROR] Failed to load existing databases: ${data}`);
      onShowToast('Could not sync existing database partitions.', 'error');
    }
  };

  useEffect(() => {
    logMessage('System database console interface active.');
    loadExistingProducts();
  }, []);

  const handleCreateProduct = async (productName: string) => {
    const stdName = productName.trim().toLowerCase();
    if (!stdName) {
      onShowToast('Product name cannot be empty.', 'warning');
      return;
    }

    logMessage(`[START] Creating product partition database record: "${stdName}"`);
    setLoading(true);
    const [success, data] = await DatabaseAPI.createProduct(stdName);
    setLoading(false);

    if (success) {
      logMessage(`[SUCCESS] ${data?.message || `Product "${stdName}" created successfully.`}`);
      logMessage(`📂 Folders initialized locally under AppData exports/CMS/${stdName}`);
      onShowToast(`Database partition created: ${stdName}`, 'success');
      loadExistingProducts();
    } else {
      logMessage(`[ERROR] Creation failed: ${data}`);
      onShowToast(typeof data === 'string' ? data : 'Creation failed.', 'error');
    }
  };

  const handleCreateCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customProductName.trim();
    if (!name) return;
    handleCreateProduct(name);
    setCustomProductName('');
  };

  const handleStartRename = (productName: string) => {
    setEditingProduct(productName);
    setRenameValue(productName);
  };

  const handleCancelRename = () => {
    setEditingProduct(null);
    setRenameValue('');
  };

  const handleSaveRename = async (oldName: string) => {
    const newName = renameValue.trim().toLowerCase();
    if (!newName) {
      onShowToast('New product name cannot be empty.', 'warning');
      return;
    }

    if (newName === oldName.toLowerCase()) {
      handleCancelRename();
      return;
    }

    logMessage(`[RENAME] Renaming database partition "${oldName}" -> "${newName}"`);
    setLoading(true);
    const [success, data] = await DatabaseAPI.renameProduct(oldName, newName);
    setLoading(false);

    if (success) {
      logMessage(`[SUCCESS] Partition "${oldName}" renamed to "${newName}".`);
      onShowToast(`Product scope renamed: ${oldName} -> ${newName}`, 'success');
      handleCancelRename();
      loadExistingProducts();
    } else {
      logMessage(`[ERROR] Rename failed: ${data}`);
      onShowToast(typeof data === 'string' ? data : 'Rename failed.', 'error');
    }
  };

  const handleDeleteProduct = async (productName: string) => {
    if (!window.confirm(`🔥 CRITICAL ACTION REQUIRED 🔥\n\nAre you absolutely sure you want to delete the product scope "${productName}"?\nThis will PERMANENTLY ERASE all formulation records, QC approvals, dispatch ledgers, and local filesystem folders for this product!\n\nTHIS ACTION CANNOT BE UNDONE.`)) {
      return;
    }

    logMessage(`[DELETE] Starting total deletion for: "${productName}"`);
    setLoading(true);
    const [success, data] = await DatabaseAPI.deleteProduct(productName);
    setLoading(false);

    if (success) {
      logMessage(`[SUCCESS] Product "${productName}" wiped. Deleted files and local folders.`);
      onShowToast(`Database scope deleted: ${productName}`, 'warning');
      loadExistingProducts();
    } else {
      logMessage(`[ERROR] Deletion failed: ${data}`);
      onShowToast(typeof data === 'string' ? data : 'Deletion failed.', 'error');
    }
  };

  const handleOpenProductFolder = async (productName: string) => {
    logMessage(`📂 Querying local server to launch Windows Explorer: "${productName}"`);
    const [success, data] = await DatabaseAPI.openProductFolder(productName);
    if (success) {
      logMessage(`[SUCCESS] Launched directory view for "${productName}" on host system.`);
    } else {
      logMessage(`[ERROR] Launch failed: ${data}`);
      onShowToast('Could not open folder on host. Make sure path exists.', 'error');
    }
  };

  const filteredProducts = existingProducts.filter(product =>
    product.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Panel */}
      <div className="glass-card animated-fade" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary-color)' }}>
            <Database size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Central Database Management Console</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Initialize isolated product database scopes, rename partitions, and manage active storage.
            </p>
          </div>
        </div>
        <button onClick={loadExistingProducts} className="btn-secondary" style={{ padding: '10px 16px', gap: '8px' }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          <span>Refresh Database Registry</span>
        </button>
      </div>

      {/* Main grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* NEW PRODUCT SETUP */}
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <FolderPlus size={18} />
            <span>Create New Product Database</span>
          </h3>

          <form onSubmit={handleCreateCustomProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-input-container">
              <span className="form-label">Database Scope Name</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="field-input" 
                  value={customProductName} 
                  onChange={e => setCustomProductName(e.target.value)} 
                  placeholder="e.g. PU_CRYSTAL_COAT"
                  disabled={loading}
                />
                <button type="submit" className="btn-primary" style={{ padding: '0 20px', backgroundColor: '#9333ea', flexShrink: 0 }} disabled={loading || !customProductName.trim()}>
                  <span>Create Scope</span>
                </button>
              </div>
            </div>
          </form>

          <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Note:</span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>
              Creating a product scope initializes isolated table partitions and folder structures for formulation ledgers, QC data, and stock records.
            </p>
          </div>
        </div>

        {/* MANAGE EXISTING PRODUCTS */}
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layers size={18} color="var(--primary-color)" />
              <span>Active Database Partitions ({filteredProducts.length})</span>
            </h3>
          </div>

          {/* SEARCH BAR */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="field-input" 
              style={{ paddingLeft: '36px', paddingRight: searchTerm ? '36px' : '12px' }} 
              placeholder="Search product databases..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', minHeight: '220px', maxHeight: '350px', overflowY: 'auto', backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                {existingProducts.length === 0 ? 'No active partitions initialized.' : 'No database partitions match your search.'}
              </div>
            ) : (
              filteredProducts.map(product => {
                const isEditing = editingProduct === product;
                return (
                  <div key={product} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginRight: '10px' }}>
                        <Database size={16} color="var(--primary-color)" />
                        <input 
                          type="text"
                          className="field-input"
                          style={{ padding: '4px 8px', fontSize: '0.85rem', flex: 1 }}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(product);
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          autoFocus
                          disabled={loading}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={16} color="var(--primary-color)" />
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{product.toUpperCase()}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isEditing ? (
                        <>
                          <button 
                            onClick={() => handleSaveRename(product)}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', padding: '6px' }}
                            title="Save Rename"
                            disabled={loading || !renameValue.trim()}
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={handleCancelRename}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--border-light)', padding: '6px' }}
                            title="Cancel"
                            disabled={loading}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleStartRename(product)}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '6px' }}
                            title="Rename Partition"
                            disabled={loading}
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={() => handleOpenProductFolder(product)}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)', padding: '6px' }}
                            title="Open Product Directory"
                          >
                            <FolderOpen size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(product);
                              onShowToast(`Copied "${product}" to clipboard.`, 'info');
                            }}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--border-light)', padding: '6px' }}
                            title="Copy Partition Name"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product)}
                            className="btn-secondary"
                            style={{ border: 'none', backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', padding: '6px' }}
                            title="Wipe Partition Data"
                            disabled={loading}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ACTIVITY LOGS MONOSPACE TERMINAL CONSOLE */}
      <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <Terminal size={18} color="var(--color-success)" />
          <span>Database Server Activity Log Console</span>
        </h3>

        <div style={{
          backgroundColor: '#090d16',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          padding: '16px',
          height: '240px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: '#38bdf8',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {logs.map((log, index) => (
            <div key={index} style={{
              color: log.includes('[ERROR]') 
                ? '#f87171' 
                : log.includes('[SUCCESS]') 
                  ? '#34d399' 
                  : log.includes('[WARNING]') 
                    ? '#fbbf24' 
                    : '#38bdf8'
            }}>
              {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>

    </div>
  );
};
