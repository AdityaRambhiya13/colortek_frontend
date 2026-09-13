import React, { useState, useEffect } from 'react';
import { X, Search, RotateCcw, Copy, Check, Clock, CheckCircle2, History, Package } from 'lucide-react';
import { MasterFormulationAPI } from '../../services/api';

export interface EntryLogRecord {
  batch_no: string;
  product_name: string;
  created_at: string;
  origin_workspace?: string;
  is_active_temporary?: boolean;
}

interface MyEntryLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBatch?: (batchNo: string, productName: string) => void;
}

export const MyEntryLogModal: React.FC<MyEntryLogModalProps> = ({ isOpen, onClose, onSelectBatch }) => {
  const [entries, setEntries] = useState<EntryLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedBatch, setCopiedBatch] = useState<string | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    const [success, res] = await MasterFormulationAPI.getMyEntries(100);
    setLoading(false);
    if (success && res && Array.isArray(res.entries)) {
      setEntries(res.entries);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (batchNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(batchNo);
    setCopiedBatch(batchNo);
    setTimeout(() => setCopiedBatch(null), 2000);
  };

  const filteredEntries = entries.filter((e) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (e.batch_no || '').toLowerCase().includes(q) ||
      (e.product_name || '').toLowerCase().includes(q) ||
      (e.origin_workspace || '').toLowerCase().includes(q)
    );
  });

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  const lastEntry = entries.length > 0 ? entries[0] : null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <History size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                My Data Entry Log (Paperwork Receipt Ledger)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Track your recent entries to verify physical paper files and avoid duplicate or skipped records.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchEntries}
              disabled={loading}
              title="Refresh Entries"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Highlight Banner: Last Entry Done */}
        {lastEntry && (
          <div style={{
            backgroundColor: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ 
                background: '#16a34a', 
                color: '#ffffff', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontWeight: 700, 
                fontSize: '0.7rem' 
              }}>
                LAST SAVED
              </span>
              <span style={{ color: '#166534', fontWeight: 600 }}>Batch Number:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                {lastEntry.batch_no}
              </span>
              <span style={{ color: '#86efac' }}>•</span>
              <span style={{ color: '#166534', fontWeight: 600 }}>Product:</span>
              <span style={{ fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                {lastEntry.product_name}
              </span>
              <span style={{ color: '#86efac' }}>•</span>
              <span style={{ color: '#65a30d', fontSize: '0.76rem' }}>
                <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                {formatDate(lastEntry.created_at)}
              </span>
            </div>
            <button
              onClick={(e) => handleCopy(lastEntry.batch_no, e)}
              style={{
                background: '#ffffff',
                border: '1px solid #86efac',
                color: '#166534',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copiedBatch === lastEntry.batch_no ? <Check size={12} /> : <Copy size={12} />}
              {copiedBatch === lastEntry.batch_no ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by Batch No or Product Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
            Showing {filteredEntries.length} of {entries.length} entries
          </span>
        </div>

        {/* Table Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: '260px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              <RotateCcw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block', color: '#3b82f6' }} />
              Loading your recent entries...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
              <History size={36} style={{ color: '#cbd5e1', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontWeight: 600, fontSize: '14px', margin: 0, color: '#334155' }}>No entries found</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>
                {searchTerm ? 'Try adjusting your search filter.' : 'Formulations you submit will appear here as your receipt log.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, width: '40px' }}>#</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>BATCH NUMBER</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>TARGET PRODUCT</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>ENTRY DATE & TIME</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>ORIGIN</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>STATUS</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item, idx) => {
                  return (
                    <tr 
                      key={`${item.product_name}-${item.batch_no}-${idx}`}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx === 0 ? '#fafafa' : '#ffffff',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx === 0 ? '#fafafa' : '#ffffff'}
                    >
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 800, 
                          color: '#0f172a',
                          fontSize: '13px'
                        }}>
                          {item.batch_no}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          border: '1px solid #bfdbfe'
                        }}>
                          <Package size={11} />
                          {item.product_name}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 500 }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                        {item.origin_workspace || 'Current'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {item.is_active_temporary ? (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde047'
                          }}>
                            ⏳ In 3h Buffer
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <CheckCircle2 size={11} />
                            Saved in {item.product_name.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => handleCopy(item.batch_no, e)}
                          title="Copy Batch No"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: copiedBatch === item.batch_no ? '#16a34a' : '#475569',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {copiedBatch === item.batch_no ? <Check size={12} /> : <Copy size={12} />}
                          {copiedBatch === item.batch_no ? 'Copied' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <span>
            💡 <strong>Tip for Data Entry:</strong> If you are unsure where you left off, match the batch number above with your paper files.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
