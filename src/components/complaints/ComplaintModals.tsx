import React from 'react';
import {
  X, RefreshCw, CheckCircle2, AlertTriangle, Image, Edit3, ZoomIn,
  ShieldAlert, ChevronLeft, Trash2, Check, Search
} from 'lucide-react';

// ============================================================================
// 1. RESOLVED COMPLAINT MODAL
// ============================================================================
interface ResolvedComplaintModalProps {
  selectedResolvedBatch: string | null;
  resolvedDetails: any;
  loadingResolvedDetail: boolean;
  onClose: () => void;
}

export const ResolvedComplaintModal: React.FC<ResolvedComplaintModalProps> = ({
  selectedResolvedBatch,
  resolvedDetails,
  loadingResolvedDetail,
  onClose
}) => {
  if (!selectedResolvedBatch) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', minHeight: '300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <CheckCircle2 size={22} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>✓ Resolved: {selectedResolvedBatch}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {loadingResolvedDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={28} color="#10b981" /></div>
        ) : !resolvedDetails ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Failed to load resolved complaint details.</div>
        ) : (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Customer:</strong> {resolvedDetails.customer_name}</div>
              <div><strong>Product:</strong> {resolvedDetails.product_name}</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--color-error)', display: 'block', marginBottom: '6px' }}>Complaint:</strong>
              <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{resolvedDetails.complaint}</p>
            </div>
            {resolvedDetails.observation && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--primary-color)', display: 'block', marginBottom: '6px' }}>Observation:</strong>
                <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{resolvedDetails.observation}</p>
              </div>
            )}
            {resolvedDetails.raw_materials?.length > 0 && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Raw Materials:</strong>
                {resolvedDetails.raw_materials.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>
                    – {item.material || item.raw_material || item.item}: {item.qty}
                  </div>
                ))}
              </div>
            )}
            {resolvedDetails.test_results?.length > 0 && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Test Results:</strong>
                {resolvedDetails.test_results.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>
                    – {item.method}: {item.result}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
              <button onClick={onClose} style={{ padding: '8px 20px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. IMAGE LIGHTBOX MODAL
// ============================================================================
interface ImageLightboxModalProps {
  lightboxImage: string | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  lightboxImage,
  onClose
}) => {
  if (!lightboxImage) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '-44px', right: '-8px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={32} />
        </button>
        <img src={lightboxImage} alt="lightbox" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '10px' }} />
      </div>
    </div>
  );
};

// ============================================================================
// 3. LAB COMPLAINT DETAILS MODAL
// ============================================================================
interface LabComplaintDetailsModalProps {
  selectedLabComplaint: any;
  labComplaintDetails: any;
  loadingLabDetail: boolean;
  showModalImages: boolean;
  setShowModalImages: React.Dispatch<React.SetStateAction<boolean>>;
  solving: boolean;
  onClose: () => void;
  onViewImage: (url: string) => void;
  onModify: () => void;
  onSolve: () => void;
}

export const LabComplaintDetailsModal: React.FC<LabComplaintDetailsModalProps> = ({
  selectedLabComplaint,
  labComplaintDetails,
  loadingLabDetail,
  showModalImages,
  setShowModalImages,
  solving,
  onClose,
  onViewImage,
  onModify,
  onSolve
}) => {
  if (!selectedLabComplaint) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', borderRadius: '24px', padding: '32px', backgroundColor: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', minHeight: '320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <AlertTriangle size={26} color="#fff" fill="#f59e0b" style={{ marginRight: '10px' }} />
          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Batch {selectedLabComplaint.batch_no}
          </h3>
        </div>

        {loadingLabDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={28} /></div>
        ) : !labComplaintDetails ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Failed to load complaint repair metadata.</div>
        ) : (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#f0f4f8', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>PRODUCT</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{labComplaintDetails.product_name || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>CUSTOMER</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{labComplaintDetails.customer_name || 'N/A'}</div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 20px 0' }} />

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '6px' }}>Complaint</strong>
              <p style={{ fontSize: '0.9rem', margin: 0, color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{labComplaintDetails.complaint || 'No details.'}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '6px' }}>Observation</strong>
              <p style={{ fontSize: '0.9rem', margin: 0, color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{labComplaintDetails.observation || 'No remarks.'}</p>
            </div>

            {labComplaintDetails.customer_formulation && labComplaintDetails.customer_formulation.length > 0 && labComplaintDetails.customer_formulation.some((r: any) => r.rm || r.batchNo || r.qty) && (
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '6px' }}>Customer Formulation</strong>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '36px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>#</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>RAW MATERIAL</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', width: '30%', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>BATCH NO.</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', width: '22%', borderBottom: '2px solid #94a3b8', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labComplaintDetails.customer_formulation.map((row: any, idx: number) => {
                        if (!row.rm && !row.batchNo && !row.qty) return null;
                        return (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                            <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 500 }}>{row.rm || '-'}</td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#0f172a' }}>{row.batchNo || '-'}</td>
                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1', color: '#0f172a' }}>{row.qty || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showModalImages && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', backgroundColor: '#f8fafc', marginBottom: '20px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', color: '#475569' }}>
                  Attached Images ({labComplaintDetails.image_references?.length || 0})
                </strong>
                {labComplaintDetails.image_references && labComplaintDetails.image_references.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {labComplaintDetails.image_references.map((filename: string, idx: number) => {
                      const fileUrl = filename.startsWith('http') ? filename : `https://clrwxqngtwshynvsbjac.supabase.co/storage/v1/object/public/complaint-images/${filename}`;
                      return (
                        <div key={idx} onClick={() => onViewImage(fileUrl)}
                          style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer', position: 'relative' }}>
                          <img src={fileUrl} alt="defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '4px', color: '#fff' }}><ZoomIn size={10} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>No images attached to this complaint.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => setShowModalImages(!showModalImages)} 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '38px', padding: '0 20px',
                  fontSize: '0.85rem', fontWeight: 600, borderRadius: '20px', border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff', color: '#334155', cursor: 'pointer', outline: 'none'
                }}>
                <Image size={14} style={{ marginRight: '6px' }} /> View Images
              </button>

              <button onClick={onModify} 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '38px', padding: '0 20px',
                  fontSize: '0.85rem', fontWeight: 600, borderRadius: '20px', border: 'none',
                  backgroundColor: '#2563eb', color: '#ffffff', cursor: 'pointer', outline: 'none'
                }}>
                <Edit3 size={14} style={{ marginRight: '6px' }} /> Modify
              </button>

              <button onClick={onSolve} disabled={solving} 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '38px', padding: '0 20px',
                  fontSize: '0.85rem', fontWeight: 600, borderRadius: '20px', border: 'none',
                  backgroundColor: '#10b981', color: '#ffffff', cursor: 'pointer', outline: 'none',
                  opacity: solving ? 0.7 : 1
                }}>
                <CheckCircle2 size={14} style={{ marginRight: '6px' }} /> {solving ? 'Solving...' : 'Mark Solved'}
              </button>

              <button onClick={onClose} 
                style={{ 
                  background: 'none', border: 'none', padding: '0 12px', fontSize: '0.85rem',
                  fontWeight: 600, color: '#2563eb', cursor: 'pointer', outline: 'none'
                }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. COMPLAINT LOGS MODAL
// ============================================================================
interface ComplaintLogsModalProps {
  showLogsModal: boolean;
  selectedLogDetail: any;
  setSelectedLogDetail: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  isEditingLog: boolean;
  setIsEditingLog: React.Dispatch<React.SetStateAction<boolean>>;
  editCustomerName: string;
  setEditCustomerName: (v: string) => void;
  editProductName: string;
  editBatchNo: string;
  setEditBatchNo: (v: string) => void;
  editStatus: string;
  setEditStatus: (v: string) => void;
  editComplaintText: string;
  setEditComplaintText: (v: string) => void;
  editObservationText: string;
  setEditObservationText: (v: string) => void;
  updatingLog: boolean;
  onUpdateLog: () => void;
  startEditLog: (log: any) => void;
  handleDeleteLog: (log: any) => void;
  logsSearchTerm: string;
  setLogsSearchTerm: (v: string) => void;
  logsDateFilter: string;
  setLogsDateFilter: (v: string) => void;
  onSearchLogs: () => void;
  onClearLogsFilters: () => void;
  loadingLogs: boolean;
  logsList: any[];
  parseJsonField: (val: any, type: 'rm' | 'tests') => string;
}

export const ComplaintLogsModal: React.FC<ComplaintLogsModalProps> = ({
  showLogsModal,
  selectedLogDetail,
  setSelectedLogDetail,
  onClose,
  isEditingLog,
  setIsEditingLog,
  editCustomerName,
  setEditCustomerName,
  editProductName,
  editBatchNo,
  setEditBatchNo,
  editStatus,
  setEditStatus,
  editComplaintText,
  setEditComplaintText,
  editObservationText,
  setEditObservationText,
  updatingLog,
  onUpdateLog,
  startEditLog,
  handleDeleteLog,
  logsSearchTerm,
  setLogsSearchTerm,
  logsDateFilter,
  setLogsDateFilter,
  onSearchLogs,
  onClearLogsFilters,
  loadingLogs,
  logsList,
  parseJsonField
}) => {
  if (!showLogsModal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={22} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {selectedLogDetail ? `Details: ${selectedLogDetail.batch_no}` : 'Registered Complaint Logs'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {selectedLogDetail ? (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => { setSelectedLogDetail(null); setIsEditingLog(false); }}
                style={{ width: 'max-content', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--border-medium)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <ChevronLeft size={14} /> Back to logs
              </button>
              {!isEditingLog && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => startEditLog(selectedLogDetail)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--primary-color)', borderRadius: '6px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button onClick={() => handleDeleteLog(selectedLogDetail)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: '6px', backgroundColor: 'var(--color-error)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>

            {isEditingLog ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Customer Name:</label>
                      <input type="text" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Batch Number:</label>
                      <input type="text" value={editBatchNo} onChange={e => setEditBatchNo(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Product Database:</label>
                      <input type="text" value={editProductName} disabled
                        style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: 'var(--bg-light)', color: 'var(--text-secondary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Status:</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', height: '30px' }}>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Defect Details Narrative:</label>
                  <textarea rows={4} value={editComplaintText} onChange={e => setEditComplaintText(e.target.value)}
                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Initial Observation Remarks:</label>
                  <textarea rows={3} value={editObservationText} onChange={e => setEditObservationText(e.target.value)}
                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button onClick={onUpdateLog} disabled={updatingLog} className="flet-btn flet-btn-green"
                    style={{ height: '30px', padding: '0 16px', fontSize: '13px', fontWeight: 600 }}>
                    <Check size={14} /> {updatingLog ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setIsEditingLog(false)} className="flet-btn"
                    style={{ height: '30px', padding: '0 16px', fontSize: '13px', fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                    <div><strong>Batch No:</strong> {selectedLogDetail.batch_no}</div>
                    <div><strong>Customer:</strong> {selectedLogDetail.customer_name}</div>
                    <div><strong>Product Context:</strong> {selectedLogDetail.product_name}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                    <div><strong>Registered At:</strong> {selectedLogDetail.created_at ? new Date(selectedLogDetail.created_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Status:</strong> <span style={{ color: selectedLogDetail.status === 'Open' ? 'var(--color-error)' : selectedLogDetail.status === 'In Progress' ? 'var(--color-warning)' : 'var(--success-color)', fontWeight: 'bold' }}>{selectedLogDetail.status}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Defect Details Narrative:</strong>
                  <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedLogDetail.complaint_text}</p>
                </div>
                {selectedLogDetail.observation_text && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>Initial Observation Remarks:</strong>
                    <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedLogDetail.observation_text}</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '4px' }}>Audited Formulation Materials</strong>
                    <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto', margin: 0 }}>
                      {parseJsonField(selectedLogDetail.raw_materials, 'rm')}
                    </pre>
                  </div>
                  <div style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '4px' }}>Audited Lab Test Parameters</strong>
                    <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto', margin: 0 }}>
                      {parseJsonField(selectedLogDetail.test_results, 'tests')}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Batch Filter</span>
                <input type="text" placeholder="Search Batch No..." value={logsSearchTerm}
                  onChange={e => setLogsSearchTerm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSearchLogs(); }}
                  style={{ width: '140px', padding: '5px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Filter</span>
                <input type="date" value={logsDateFilter} onChange={e => setLogsDateFilter(e.target.value)}
                  style={{ width: '140px', padding: '5px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                <button onClick={onSearchLogs} className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Search size={12} /> Apply Filters
                </button>
                <button onClick={onClearLogsFilters}
                  style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><RefreshCw className="animate-spin" size={24} /></div>
            ) : logsList.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '30px 0', textAlign: 'center', fontStyle: 'italic' }}>No registered complaints found.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                {logsList.map((log, idx) => (
                  <div key={idx} onClick={() => setSelectedLogDetail(log)} className="interactive"
                    style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.85rem' }}>Batch: {log.batch_no}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer: {log.customer_name} | Product: {log.product_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{log.created_at ? new Date(log.created_at).toLocaleDateString() : ''}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px', color: '#fff', backgroundColor: log.status === 'Open' ? 'var(--color-error)' : log.status === 'In Progress' ? '#f59e0b' : 'var(--success-color)' }}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}>
            {selectedLogDetail ? 'Back to Logs' : 'Close Logs'}
          </button>
        </div>
      </div>
    </div>
  );
};
