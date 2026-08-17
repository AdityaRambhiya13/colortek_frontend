import React from 'react';
import {
  Search, RefreshCw, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight,
  Beaker, Wrench, Package, FileText, History, ChevronLeft, ChevronRight,
  ShieldAlert, X
} from 'lucide-react';

export const DARK_HEADER: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  padding: '0 24px',
  height: '72px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  borderTopLeftRadius: '12px',
  borderTopRightRadius: '12px'
};

export const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  pageInput: string;
  onPageInput: (v: string) => void;
  onGo: () => void;
  onPrev: () => void;
  onNext: () => void;
  light?: boolean;
}> = ({ currentPage, totalPages, pageInput, onPageInput, onGo, onPrev, onNext, light }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <button
      onClick={onPrev} disabled={currentPage <= 1}
      style={{ background: 'none', border: `1px solid ${light ? '#94a3b8' : 'rgba(255,255,255,0.3)'}`, borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', color: light ? '#1e293b' : '#f8fafc', opacity: currentPage <= 1 ? 0.4 : 1 }}
    >
      <ChevronLeft size={14} />
    </button>
    <input
      type="text" value={pageInput} onChange={e => onPageInput(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onGo(); }}
      style={{ width: '40px', textAlign: 'center', padding: '3px', borderRadius: '4px', border: `1px solid ${light ? '#cbd5e1' : 'rgba(255,255,255,0.3)'}`, backgroundColor: light ? '#fff' : 'rgba(255,255,255,0.1)', color: light ? '#1e293b' : '#f8fafc', fontSize: '0.8rem', fontWeight: 700 }}
    />
    <span style={{ fontSize: '0.8rem', color: light ? '#64748b' : '#94a3b8' }}>of {totalPages}</span>
    <button
      onClick={onNext} disabled={currentPage >= totalPages}
      style={{ background: 'none', border: `1px solid ${light ? '#94a3b8' : 'rgba(255,255,255,0.3)'}`, borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', color: light ? '#1e293b' : '#f8fafc', opacity: currentPage >= totalPages ? 0.4 : 1 }}
    >
      <ChevronRight size={14} />
    </button>
    <button
      onClick={onGo}
      style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
    >
      Go
    </button>
  </div>
);

export const BatchCard: React.FC<{
  batchNo: string;
  productName: string;
  onClick: () => void;
  icon: any;
  iconColor?: string;
  linkText?: string;
}> = ({ batchNo, productName, onClick, icon: Icon, iconColor, linkText }) => (
  <div
    onClick={onClick}
    style={{
      width: '200px', height: '130px', padding: '15px', backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0,
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.2s, transform 0.2s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon size={18} color={iconColor || '#f59e0b'} />
      <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>{batchNo}</strong>
    </div>
    <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />
    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
      {productName}
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
      {linkText || 'View Details'} <ArrowRight size={11} />
    </div>
  </div>
);

// ============================================================================
// SUBVIEW 2: LAB COMPLAINTS BOARD
// ============================================================================
export interface LabComplaintsBoardProps {
  labSearchTerm: string;
  setLabSearchTerm: (v: string) => void;
  labCurrentPage: number;
  setLabCurrentPage: (v: number) => void;
  labPageInput: string;
  setLabPageInput: (v: string) => void;
  labTotalPages: number;
  handleLabGoPage: () => void;
  loadLabComplaints: () => void;
  loadingLab: boolean;
  paginatedLabBatches: any[];
  handleOpenLabDetail: (batch: any) => void;
}

export const LabComplaintsBoard: React.FC<LabComplaintsBoardProps> = ({
  labSearchTerm,
  setLabSearchTerm,
  labCurrentPage,
  setLabCurrentPage,
  labPageInput,
  setLabPageInput,
  labTotalPages,
  handleLabGoPage,
  loadLabComplaints,
  loadingLab,
  paginatedLabBatches,
  handleOpenLabDetail
}) => {
  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
      {/* Dark fixed header */}
      <div style={DARK_HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Beaker size={26} color="#f8fafc" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>Lab Complaints</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Active Repair Batches</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text" placeholder="Search Batch No..." value={labSearchTerm}
              onChange={e => { setLabSearchTerm(e.target.value); setLabCurrentPage(1); setLabPageInput('1'); }}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
            />
          </div>
          <PaginationControls
            currentPage={labCurrentPage} totalPages={labTotalPages}
            pageInput={labPageInput} onPageInput={setLabPageInput}
            onGo={handleLabGoPage}
            onPrev={() => { const p = Math.max(1, labCurrentPage - 1); setLabCurrentPage(p); setLabPageInput(String(p)); }}
            onNext={() => { const p = Math.min(labTotalPages, labCurrentPage + 1); setLabCurrentPage(p); setLabPageInput(String(p)); }}
          />
          <button onClick={loadLabComplaints}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} className={loadingLab ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Card grid */}
      <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>
        {loadingLab ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
            <RefreshCw className="animate-spin" size={32} color="#3b82f6" />
          </div>
        ) : paginatedLabBatches.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
            <CheckCircle2 size={42} color="#10b981" />
            <span style={{ fontWeight: 'bold', color: '#64748b' }}>No active complaints in the lab queue!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {paginatedLabBatches.map((batch, idx) => (
              <BatchCard key={idx} batchNo={batch.batch_no} productName={batch.product_name}
                onClick={() => handleOpenLabDetail(batch)} icon={ShieldAlert} iconColor="#f59e0b" linkText="View Details" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUBVIEW 3: REPAIRED FORMULATIONS BOARD
// ============================================================================
export interface RepairedFormulationsBoardProps {
  repairedViewMode: 'list' | 'trials';
  selectedRepairedBatch: any;
  handleBackToRepairedList: () => void;
  repairedSearchTerm: string;
  setRepairedSearchTerm: (v: string) => void;
  repairedCurrentPage: number;
  setRepairedCurrentPage: (v: number) => void;
  repairedPageInput: string;
  setRepairedPageInput: (v: string) => void;
  repairedTotalPages: number;
  handleRepairedGoPage: () => void;
  loadRepairedFormulations: () => void;
  loadingRepaired: boolean;
  paginatedRepairedBatches: any[];
  handleSelectRepairedBatch: (b: any) => void;
  loadingTrials: boolean;
  trialsList: any[];
  activeTrialIdx: number;
  setActiveTrialIdx: React.Dispatch<React.SetStateAction<number>>;
  parseModificationDetails: (modDetails: string) => { repairedBatchNo: string; remarks: string };
}

export const RepairedFormulationsBoard: React.FC<RepairedFormulationsBoardProps> = ({
  repairedViewMode,
  selectedRepairedBatch,
  handleBackToRepairedList,
  repairedSearchTerm,
  setRepairedSearchTerm,
  repairedCurrentPage,
  setRepairedCurrentPage,
  repairedPageInput,
  setRepairedPageInput,
  repairedTotalPages,
  handleRepairedGoPage,
  loadRepairedFormulations,
  loadingRepaired,
  paginatedRepairedBatches,
  handleSelectRepairedBatch,
  loadingTrials,
  trialsList,
  activeTrialIdx,
  setActiveTrialIdx,
  parseModificationDetails
}) => {
  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
      {/* Dark header */}
      <div style={DARK_HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {repairedViewMode === 'trials' && (
            <button onClick={handleBackToRepairedList}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <Wrench size={26} color="#f8fafc" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
              {repairedViewMode === 'trials' && selectedRepairedBatch
                ? `Trials: ${selectedRepairedBatch.batch_no}`
                : 'Repaired Formulations'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Lab History & Modification Records</div>
          </div>
        </div>
        {repairedViewMode === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text" placeholder="Search Batch No..." value={repairedSearchTerm}
                onChange={e => { setRepairedSearchTerm(e.target.value); setRepairedCurrentPage(1); setRepairedPageInput('1'); }}
                style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
              />
            </div>
            <PaginationControls
              currentPage={repairedCurrentPage} totalPages={repairedTotalPages}
              pageInput={repairedPageInput} onPageInput={setRepairedPageInput}
              onGo={handleRepairedGoPage}
              onPrev={() => { const p = Math.max(1, repairedCurrentPage - 1); setRepairedCurrentPage(p); setRepairedPageInput(String(p)); }}
              onNext={() => { const p = Math.min(repairedTotalPages, repairedCurrentPage + 1); setRepairedCurrentPage(p); setRepairedPageInput(String(p)); }}
            />
            <button onClick={loadRepairedFormulations}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={15} className={loadingRepaired ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>
        {/* LIST MODE */}
        {repairedViewMode === 'list' && (
          loadingRepaired ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={32} color="#3b82f6" /></div>
          ) : paginatedRepairedBatches.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
              <AlertTriangle size={36} color="#f59e0b" />
              <span style={{ color: '#64748b', fontStyle: 'italic' }}>No repaired formulations archived.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {paginatedRepairedBatches.map((b, idx) => (
                <BatchCard key={idx} batchNo={b.batch_no} productName={b.product_name}
                  onClick={() => handleSelectRepairedBatch(b)} icon={Beaker} iconColor="#f59e0b" linkText="View Trials" />
              ))}
            </div>
          )
        )}

        {/* TRIALS MODE */}
        {repairedViewMode === 'trials' && (
          loadingTrials ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={32} color="#3b82f6" /></div>
          ) : trialsList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
              <AlertTriangle size={32} color="#f59e0b" />
              <span style={{ color: '#64748b' }}>No trial versions found for {selectedRepairedBatch?.batch_no}.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              {/* Navigation bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '12px 24px', backgroundColor: '#fff', borderRadius: '50px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <button disabled={activeTrialIdx <= 0} onClick={() => setActiveTrialIdx(p => p - 1)}
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeTrialIdx <= 0 ? 'not-allowed' : 'pointer', color: '#3b82f6', opacity: activeTrialIdx <= 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                  Trial {activeTrialIdx + 1} / {trialsList.length}
                </span>
                <button disabled={activeTrialIdx >= trialsList.length - 1} onClick={() => setActiveTrialIdx(p => p + 1)}
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeTrialIdx >= trialsList.length - 1 ? 'not-allowed' : 'pointer', color: '#3b82f6', opacity: activeTrialIdx >= trialsList.length - 1 ? 0.4 : 1 }}>
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Trial Card */}
              {(() => {
                const trial = trialsList[activeTrialIdx];
                const { repairedBatchNo, remarks } = parseModificationDetails(trial.modification_details || '');
                const rawList: any[] = trial.raw_materials || [];
                const testList: any[] = trial.test_results || [];
                let createdAtStr = 'N/A';
                try {
                  createdAtStr = new Date(trial.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch { }

                return (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '720px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Card header: TRIAL # badge + timestamp */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                        TRIAL #{trial.trial_number || (activeTrialIdx + 1)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{createdAtStr}</span>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#e2e8f0' }} />

                    {/* Details section */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                        <Package size={16} color="#64748b" />
                        <span style={{ fontWeight: 700, color: '#475569' }}>Repaired Batch:</span>
                        <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{repairedBatchNo}</span>
                      </div>
                      {remarks && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.88rem' }}>
                          <FileText size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontWeight: 700, color: '#475569' }}>Remarks:</span>
                          <span style={{ fontStyle: 'italic', color: '#1e293b' }}>{remarks}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                        <History size={14} />
                        <span>Original: <strong>{trial.original_batch_no || selectedRepairedBatch?.batch_no || 'N/A'}</strong></span>
                        <span>| By: <strong>{trial.created_by || 'Unknown'}</strong></span>
                      </div>
                    </div>

                    {/* Tables */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {/* Raw Materials */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: '#3b82f6', borderBottom: '1px solid #e2e8f0' }}>
                          Raw Materials Added
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Material</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rawList.length === 0
                              ? <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center' }}>No ingredients.</td></tr>
                              : rawList.map((item: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 10px', color: '#1e293b' }}>{item.raw_material || item.material || item.item || '-'}</td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{item.qty || '0'}</td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>

                      {/* Test Results */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: '#3b82f6', borderBottom: '1px solid #e2e8f0' }}>
                          Lab Test Results
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Method</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {testList.length === 0
                              ? <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center' }}>No tests recorded.</td></tr>
                              : testList.map((test: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 10px', color: '#1e293b' }}>{test.method || '-'}</td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{test.result || '-'}</td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUBVIEW 4: RESOLVED COMPLAINTS BOARD
// ============================================================================
export interface ResolvedComplaintsBoardProps {
  resolvedSearchTerm: string;
  setResolvedSearchTerm: (v: string) => void;
  resolvedCurrentPage: number;
  setResolvedCurrentPage: (v: number) => void;
  resolvedPageInput: string;
  setResolvedPageInput: (v: string) => void;
  resolvedTotalPages: number;
  handleResolvedGoPage: () => void;
  loadResolvedComplaints: (search?: string) => void;
  loadingResolved: boolean;
  paginatedResolvedBatches: string[];
  handleOpenResolvedDetail: (batchNo: string) => void;
}

export const ResolvedComplaintsBoard: React.FC<ResolvedComplaintsBoardProps> = ({
  resolvedSearchTerm,
  setResolvedSearchTerm,
  resolvedCurrentPage,
  setResolvedCurrentPage,
  resolvedPageInput,
  setResolvedPageInput,
  resolvedTotalPages,
  handleResolvedGoPage,
  loadResolvedComplaints,
  loadingResolved,
  paginatedResolvedBatches,
  handleOpenResolvedDetail
}) => {
  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
      {/* Dark header */}
      <div style={DARK_HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle2 size={26} color="#10b981" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>Resolved Complaints</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Archived resolution records</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text" placeholder="Search Batch Number..." value={resolvedSearchTerm}
              onChange={e => { setResolvedSearchTerm(e.target.value); setResolvedCurrentPage(1); setResolvedPageInput('1'); }}
              onKeyDown={e => { if (e.key === 'Enter') loadResolvedComplaints(resolvedSearchTerm); }}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
            />
            <button onClick={() => { setResolvedSearchTerm(''); loadResolvedComplaints(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={14} />
            </button>
          </div>
          <PaginationControls
            currentPage={resolvedCurrentPage} totalPages={resolvedTotalPages}
            pageInput={resolvedPageInput} onPageInput={setResolvedPageInput}
            onGo={handleResolvedGoPage}
            onPrev={() => { const p = Math.max(1, resolvedCurrentPage - 1); setResolvedCurrentPage(p); setResolvedPageInput(String(p)); }}
            onNext={() => { const p = Math.min(resolvedTotalPages, resolvedCurrentPage + 1); setResolvedCurrentPage(p); setResolvedPageInput(String(p)); }}
          />
          <button onClick={() => loadResolvedComplaints()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} className={loadingResolved ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Resolved batch buttons grid */}
      <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>
        {loadingResolved ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
            <RefreshCw className="animate-spin" size={32} color="#10b981" />
          </div>
        ) : paginatedResolvedBatches.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
            <CheckCircle2 size={42} color="#10b981" />
            <span style={{ color: '#64748b' }}>No resolved complaints found.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {paginatedResolvedBatches.map((batchNo, idx) => (
              <button
                key={idx}
                onClick={() => handleOpenResolvedDetail(batchNo)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 20px', borderRadius: '8px',
                  backgroundColor: '#10b981', color: '#fff', border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <CheckCircle2 size={16} />
                Batch {batchNo}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
