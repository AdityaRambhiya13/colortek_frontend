import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FolderOpen, Database, FolderPlus, RefreshCw, Trash2, 
  Copy, Play, Settings, AlertOctagon, Terminal, Layers
} from 'lucide-react';
import { DatabaseAPI } from '../services/api';

interface DatabaseManagementProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DatabaseManagement: React.FC<DatabaseManagementProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number, total: number, product: string, status: string } | null>(null);
  
  // Lists
  const [existingProducts, setExistingProducts] = useState<string[]>([]);
  const [customProductName, setCustomProductName] = useState('');
  
  // Terminal activity logs
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const PREDEFINED_PRODUCTS = [
    "METACOAT_CLEAR_GLOSS", "METACOAT_CLEAR_MATT", "METACOAT_WHITE_GLOSS",
    "METACOAT_WHITE_MATT", "METACOAT_BLACK_GLOSS", "METACOAT_BLACK_MATT",
    "SILKAN_ULTRA_S1K", "SILKAN_ULTRA_S2K_ML", "ACRO_WHITE_GLOSS",
    "ACRO_BLACK_GLOSS", "ACRO_CLEAR_GLOSS", "PU_CRYSTAL_WHITE_GLOSS",
    "PU_CRYSTAL_BLACK_GLOSS", "PU_CRYSTAL_CLEAR_GLOSS", "PU_CRYSTAL_WHITE_MATT",
    "PU_CRYSTAL_BLACK_MATT", "PU_CRYSTAL_CLEAR_MATT", "EPOCOAT_WHITE_GLOSS",
    "EPOCOAT_CLEAR_GLOSS", "EPOCOAT_WHITE_MATT", "EPOCOAT_CLEAR_MATT",
    "EPOCOAT_RAL", "EPOCOAT_R1U", "ACRO_R1U", "THERMOLAT_R1U",
    "PU_CRYSTAL_R1U", "METACOAT_R1U", "ISOTRAP_R1U", "SB_PASTE",
    "ACRO_BLACK_PASTE", "ACRO_WHITE_PASTE", "FLOURESCENT_PASTE",
    "FLOURESCENT_DYE", "PU_DYE", "TMK_WHITE_PASTE", "POLY_WHITE_PASTE",
    "8620_WHITE_PASTE", "AQUATRAP_XL_3", "AQUATRAP_XL_4_BASE",
    "AQUATRAP_XL_4_TOP", "AQUATRAP_XL_8", "AQUAMATTE_9", "OPIG_XTR_PASTE",
    "AQUATRAP_XL_7", "AQUATRAP_XL_3_UV_PRO", "INK_2K",
    "ISOFIX_UV_PRO_BLACK_GLOSS", "ISOFIX_UV_PRO_BLACK_MATT",
    "OPIG_66_BLUE_PASTE", "TMK_44L_PINK_PASTE", "TMK__38_ORANGE_PASTE",
    "BRC_ALL_PASTE", "SILKAN_ULTRA_S2k", "HYDRO_RIPING",
    "PRODUCTION_HYDRO_DIP_TESTING", "PRODUCTION_TPIG_XTP_TESTING", "Test"
  ];

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

  const handleCreateAllBulk = async () => {
    if (!window.confirm(`Are you sure you want to trigger bulk partition creation?\nThis will initialize database entries and storage structures for all ${PREDEFINED_PRODUCTS.length} predefined brands in the background.`)) {
      return;
    }

    logMessage(`[BULK] Initiating bulk predefined database setup in background...`);
    setLoading(true);
    setBulkProgress({ current: 0, total: PREDEFINED_PRODUCTS.length, product: 'Starting...', status: 'queued' });

    // 1. Trigger backend task
    const [success, data] = await DatabaseAPI.bulkPredefined(PREDEFINED_PRODUCTS);
    if (!success) {
      logMessage(`[ERROR] Failed to start bulk setup: ${data}`);
      setLoading(false);
      setBulkProgress(null);
      return;
    }

    // 2. Open WebSocket to track progress
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // derive backend host dynamically
    const backendHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${backendHost}/ws/db-progress`;
    
    logMessage(`[SOCKET] Connecting to websocket log server: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      logMessage(`[SOCKET] Connected. Monitoring background progress...`);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'progress') {
          setBulkProgress({
            current: payload.current,
            total: payload.total,
            product: payload.product,
            status: payload.status
          });
          logMessage(`[PROGRESS] (${payload.current}/${payload.total}) ${payload.product}: ${payload.status}`);
        } else if (payload.event === 'finished') {
          logMessage(`[FINISHED] Bulk generation finished. Created ${payload.total_created} scopes.`);
          setLoading(false);
          setBulkProgress(null);
          onShowToast(`Bulk database setups completed!`, 'success');
          loadExistingProducts();
          socket.close();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onerror = (err) => {
      logMessage(`[ERROR] WebSocket connection encountered an error.`);
      console.error(err);
    };

    socket.onclose = () => {
      logMessage(`[SOCKET] Connection closed.`);
      setLoading(false);
    };
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
              Initialize isolated product database scopes, manage physical folder assets, and run bulk installations.
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
              <span className="form-label">Custom Database Name</span>
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
                  <span>Create Custom</span>
                </button>
              </div>
            </div>
          </form>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-light)' }} />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Bulk Standard Predefined Generation</span>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Bulk Actions</span>
            </div>
            
            <button 
              onClick={handleCreateAllBulk} 
              className="btn-primary" 
              style={{ width: '100%', height: '42px', backgroundColor: '#ea580c', gap: '8px' }} 
              disabled={loading}
            >
              <Terminal size={16} />
              <span>Bulk Create Predefined Products ({PREDEFINED_PRODUCTS.length})</span>
            </button>

            {bulkProgress && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span>Creating: <strong style={{ color: '#fb923c' }}>{bulkProgress.product}</strong></span>
                  <span>{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ 
                    width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, 
                    height: '100%', 
                    backgroundColor: '#ea580c', 
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-light)' }} />

          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Create Predefined Brands Individually:</span>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', height: '220px', overflowY: 'auto', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PREDEFINED_PRODUCTS.map(product => (
                <div key={product} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{product}</span>
                  <button 
                    onClick={() => handleCreateProduct(product)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.7rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                    disabled={loading}
                  >
                    <span>Create</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MANAGE EXISTING PRODUCTS */}
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <Layers size={18} color="var(--primary-color)" />
            <span>Manage Active Database Partitions</span>
          </h3>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', height: '425px', overflowY: 'auto', backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {existingProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                No active partitions initialized.
              </div>
            ) : (
              existingProducts.map(product => (
                <div key={product} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color="var(--primary-color)" />
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{product}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
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
                  </div>
                </div>
              ))
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
