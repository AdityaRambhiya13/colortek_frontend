import React from 'react';
import { Settings, ShieldCheck, Trash2, Camera, Upload, RefreshCw, Star } from 'lucide-react';
import { DuplicateOverlay } from './DuplicateOverlay';
import { ComplaintRepairBpbsPanel } from './ComplaintRepairBpbsPanel';

export interface FormulationPanelProps {
  side: 'left' | 'right';
  activeSubView: string;
  isLab: boolean;
  loading: boolean;
  isComplaintMode?: boolean;
  bpbsData?: any;

  form: any;
  setForm: (form: any) => void;
  rows: any[];
  setRows: (rows: any[]) => void;
  testRows: any[];
  setTestRows: (rows: any[]) => void;
  remarks: string;
  setRemarks: (r: string) => void;

  status?: string;
  setStatus?: (s: string) => void;
  approvedBy?: string;
  setApprovedBy?: (s: string) => void;

  duplicateMatches: any[];
  duplicateDetails: any;
  selectedDuplicateBatchNo: string | null;

  filterType: string;
  setFilterType: (v: string) => void;

  onCopy: () => void;
  handleSaveFull: (side: 'left' | 'right') => void;
  handleClearAllFields: (side: 'left' | 'right') => void;
  handleAddRow: (side: 'left' | 'right') => void;
  handleDeleteSelectedRows: (side: 'left' | 'right') => void;
  handleOCRUpload: (side: 'left' | 'right', useCamera: boolean) => void;
  handleFilterMatches: (side: 'left' | 'right', filterType: string) => void;
  openStarModal: (batchNo: string, isStarred: boolean, currentOkRating: string) => void;
  calculateTotalSolidQty: (rows: any[]) => string;
  calculateFormulationSolidity: (rows: any[], totalWeight: number) => string;
  calculateTotalWeight: (rows: any[]) => string;
  handleHeaderFieldKeyDown: (e: any, side: 'left' | 'right', field: string) => void;
  handleCellKeyDown: (e: any, side: 'left' | 'right', rIdx: number, field: any) => void;
  handleAddTestRow: (side: 'left' | 'right') => void;
  handleDeleteSelectedTests: (side: 'left' | 'right') => void;
  handleTestCellKeyDown: (e: any, side: 'left' | 'right', tIdx: number, field: any) => void;
  handleSaveMaster: (side: 'left' | 'right') => void;
  handleRmApproval: (side: 'left' | 'right', status: 'OK' | 'Not OK') => void;
  handleExitComplaintMode?: () => void;
  fetchDuplicateDetails: (batchNo: string, side: 'left' | 'right') => void;
  handleDismissDuplicateOverlay: (side: 'left' | 'right') => void;
  handleLoadDuplicateToSide: (target: 'left' | 'right', source: 'left' | 'right', batchNo: string | null) => void;
}

export const FormulationPanel: React.FC<FormulationPanelProps> = ({
  side, activeSubView, isLab, loading, isComplaintMode, bpbsData,
  form, setForm, rows, setRows, testRows, setTestRows, remarks, setRemarks,
  status, setStatus, approvedBy, setApprovedBy,
  duplicateMatches, duplicateDetails, selectedDuplicateBatchNo,
  filterType, setFilterType,
  onCopy, handleSaveFull, handleClearAllFields, handleAddRow, handleDeleteSelectedRows,
  handleOCRUpload, handleFilterMatches, calculateTotalWeight, handleHeaderFieldKeyDown, handleCellKeyDown,
  handleAddTestRow, handleDeleteSelectedTests, handleTestCellKeyDown,
  handleSaveMaster, handleRmApproval, handleExitComplaintMode, openStarModal, calculateTotalSolidQty, calculateFormulationSolidity,
  fetchDuplicateDetails, handleDismissDuplicateOverlay, handleLoadDuplicateToSide
}) => {
  return (
            <div className="pane-section" style={{ position: 'relative' }}>
              <DuplicateOverlay
                overlaySide={side}
                activeSubView={activeSubView}
                duplicateMatches={duplicateMatches}
                duplicateDetails={duplicateDetails}
                selectedBatchNo={selectedDuplicateBatchNo}
                fetchDuplicateDetails={fetchDuplicateDetails}
                handleDismiss={() => handleDismissDuplicateOverlay(side)}
                handleLoadToSide={(target) => handleLoadDuplicateToSide(target, 'right', selectedDuplicateBatchNo)}
              />
              {isComplaintMode && bpbsData ? (
                <ComplaintRepairBpbsPanel bpbsData={bpbsData} onExit={handleExitComplaintMode!} />
              ) : (
                <>
                  {/* Sticky Header for RM Testing / Lab Formulations Material Details */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '8px', flexShrink: 0 }}>
                      <span style={{ fontWeight: "bold", fontSize: "13px", color: "var(--primary-color)" }}>{`MATERIAL DETAILS (${side.toUpperCase()})`}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={onCopy} className="flet-btn flet-btn-blue" disabled={loading}>Copy ➡️</button>
                        <button onClick={() => handleSaveFull(side)} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                        <button onClick={() => handleClearAllFields(side)} className="flet-btn flet-btn-orange" disabled={loading}>Clear</button>
                        <button onClick={() => handleAddRow(side)} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                        <button onClick={() => handleDeleteSelectedRows(side)} className="flet-btn flet-btn-red" disabled={loading}>Del Row</button>
                      </div>
                    </div>
                  ) : null}

                  {/* Form Metadata fields — matching Python field labels exactly */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', flexShrink: 0 }}>
                    <div className="form-input-container">
                      <span className="form-label">Ref No</span>
                      <input id={`${side}-refNo`} type="text" className="field-input" value={form.refNo} onChange={e => setForm({...form, refNo: e.target.value})} onFocus={e => e.target.select()} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Batch No</span>
                      <input id={`${side}-batchNo`} type="text" className="field-input" value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value})} onFocus={e => e.target.select()} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Product Name</span>
                      <input id={`${side}-product`} type="text" className="field-input" value={form.product} readOnly style={{ backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', opacity: 0.85 }} onChange={e => setForm({...form, product: e.target.value})} onFocus={e => e.target.select()} />
                    </div>
                    {activeSubView === 'rm_testing' && (
                      <>
                        <div className="form-input-container">
                          <span className="form-label">RM Name</span>
                          <input id={`${side}-rmName`} type="text" className="field-input" value={form.rmName} onChange={e => setForm({...form, rmName: e.target.value})} onFocus={e => e.target.select()} />
                        </div>
                        <div className="form-input-container">
                          <span className="form-label">RM Lot No</span>
                          <input id={`${side}-rmLot`} type="text" className="field-input" value={form.rmLot} onChange={e => setForm({...form, rmLot: e.target.value})} onFocus={e => e.target.select()} />
                        </div>
                      </>
                    )}
                    <div className="form-input-container">
                      <span className="form-label">Formula Date</span>
                      <input id={`${side}-formulaDate`} type="text" className="field-input" value={form.formulaDate} onChange={e => setForm({...form, formulaDate: e.target.value})} onFocus={e => e.target.select()} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Test Date</span>
                      <input id={`${side}-testDate`} type="text" className="field-input" value={form.testDate} onChange={e => setForm({...form, testDate: e.target.value})} onFocus={e => e.target.select()} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Report Date</span>
                      <input id={`${side}-reportDate`} type="text" className="field-input" value={form.reportDate} onChange={e => setForm({...form, reportDate: e.target.value})} onKeyDown={e => handleHeaderFieldKeyDown(e, side, 'reportDate')} onFocus={e => e.target.select()} />
                    </div>
                    {activeSubView === 'lab_formulations' && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button 
                          type="button" 
                          onClick={() => openStarModal(form.batchNo, false, '')} 
                          title="Bookmark / Star Rating"
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', 
                            backgroundColor: '#fffbe6', border: '1px solid #fde047', borderRadius: '4px', 
                            cursor: 'pointer', height: '28px', fontWeight: 'bold', fontSize: '11px', color: '#b45309', width: 'fit-content'
                          }}
                        >
                          <Star size={15} color="#f59e0b" fill="#f59e0b" />
                          <span>Bookmark</span>
                        </button>
                      </div>
                    )}
                    <div style={{ gridColumn: activeSubView === 'rm_testing' ? 'span 1' : 'span 1' }}></div>
                  </div>

                  {/* Filter controls row below form fields */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Database Filter:</span>
                      <select 
                        className="field-input" 
                        value={filterType} 
                        onChange={e => setFilterType(e.target.value)}
                        style={{ flexGrow: 1, height: '28px', maxWidth: '240px' }}
                      >
                        <option value="material_diff_qty">Same Material, Diff Qty</option>
                        <option value="resin_same_qty">Same Resin, Same Qty</option>
                        <option value="solvent_same_qty">Same Solvent, Same Qty</option>
                      </select>
                      <button 
                        onClick={() => handleFilterMatches(side, filterType)} 
                        className="flet-btn flet-btn-blue" 
                        style={{ height: '28px', padding: '0 12px' }}
                        disabled={loading}
                      >
                        Filter
                      </button>
                    </div>
                  )}

                  {/* Formulations Grid Table */}
                  <div id="left-material-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={rows.length > 0 && rows.every(r => r.selected)}
                              onChange={e => {
                                setRows(rows.map(r => ({ ...r, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th style={{ width: '40px', textAlign: 'center' }}>SR NO</th>
                          {activeSubView === 'rm_testing' && <th style={{ width: '80px' }}>MR NO</th>}
                          <th>RAW MATERIAL</th>
                          <th style={{ width: '70px', textAlign: 'center' }}>QTY</th>
                          {activeSubView === 'lab_formulations' && <th style={{ width: '65px', textAlign: 'center' }}>SOLID %</th>}
                          {activeSubView === 'lab_formulations' && <th style={{ width: '75px', textAlign: 'center' }}>SOLID QTY</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => {
                          const isRowEmpty = (!row.material || row.material.trim() === '') && (!row.qty || row.qty.trim() === '');
                          const qVal = parseFloat(row.qty) || 0;
                          const rawS = row.solid !== undefined && row.solid !== null ? row.solid.toString().trim().toLowerCase() : '';
                          const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
                          const sVal = isNA ? 0 : parseFloat(rawS);
                          const solidPct = isNaN(sVal) ? 0 : sVal;
                          const solidQtyCalc = isRowEmpty ? '' : (qVal * (solidPct / 100)).toFixed(2);

                          return (
                            <tr key={row.sr} style={{ backgroundColor: row.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-app)' : 'var(--bg-card)') }}>
                              <td style={{ textAlign: 'center', width: '30px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={!!row.selected} 
                                  onChange={e => {
                                    const updated = [...rows];
                                    updated[idx].selected = e.target.checked;
                                    setRows(updated);
                                  }} 
                                />
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{row.sr}</td>
                              {activeSubView === 'rm_testing' && (
                                <td>
                                  <input 
                                    id={`${side}-mr-${idx}`}
                                    type="text" 
                                    className="cell-input" 
                                    style={{ textAlign: 'center' }}
                                    value={row.mr} 
                                    onChange={e => {
                                      const updated = [...rows];
                                      updated[idx].mr = e.target.value;
                                      setRows(updated);
                                    }}
                                    onFocus={e => e.target.select()}
                                    onKeyDown={e => handleCellKeyDown(e, side, idx, 'mr')}
                                  />
                                </td>
                              )}
                              <td>
                                <input 
                                  id={`${side}-mat-${idx}`}
                                  type="text" 
                                  className="cell-input" 
                                  list={['lab_formulations', 'rm_testing'].includes(activeSubView) ? undefined : "common-raw-materials"}
                                  value={row.material} 
                                  onChange={e => {
                                    const updated = [...rows];
                                    updated[idx].material = e.target.value;
                                    setRows(updated);
                                  }}
                                  onFocus={e => e.target.select()}
                                  onKeyDown={e => handleCellKeyDown(e, side, idx, 'mat')}
                                />
                              </td>
                              <td>
                                <input 
                                  id={`${side}-qty-${idx}`}
                                  type="text" 
                                  className="cell-input" 
                                  style={{ 
                                    textAlign: 'center',
                                    borderColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'var(--color-error)' : '#cbd5e1',
                                    backgroundColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'rgba(239, 68, 68, 0.05)' : '#ffffff'
                                  }}
                                  title={(row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'Quantity must be a positive number' : undefined}
                                  value={row.qty} 
                                  onChange={e => {
                                    const updated = [...rows];
                                    updated[idx].qty = e.target.value;
                                    setRows(updated);
                                  }}
                                  onFocus={e => e.target.select()}
                                  onKeyDown={e => handleCellKeyDown(e, side, idx, 'qty')}
                                />
                              </td>
                              {activeSubView === 'lab_formulations' && (
                                <>
                                  <td>
                                    <input 
                                      id={`left-solid-${idx}`}
                                      type="text" 
                                      className="cell-input" 
                                      style={{ textAlign: 'center' }}
                                      value={isRowEmpty ? '' : (row.solid !== undefined ? row.solid : '')} 
                                      onChange={e => {
                                        const updated = [...rows];
                                        updated[idx].solid = e.target.value;
                                        setRows(updated);
                                      }}
                                      onFocus={e => e.target.select()}
                                      onKeyDown={e => handleCellKeyDown(e, side, idx, 'solid')}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', color: '#16a34a' }}>
                                    {solidQtyCalc}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ position: 'sticky', bottom: 0, backgroundColor: '#e2e8f0', fontWeight: 'bold', fontSize: '11px', borderTop: '2px solid #cbd5e1' }}>
                        <tr>
                          <td colSpan={activeSubView === 'rm_testing' ? 4 : 3} style={{ textAlign: 'right', padding: '4px 6px', color: '#475569' }}>
                            TOTAL:
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--primary-color)', padding: '4px 2px' }}>
                            {calculateTotalWeight(rows)}
                          </td>
                          {activeSubView === 'lab_formulations' && (
                            <>
                              <td></td>
                              <td style={{ textAlign: 'center', color: '#16a34a', padding: '4px 2px' }}>
                                {calculateTotalSolidQty(rows)}
                              </td>
                            </>
                          )}
                        </tr>
                        {activeSubView === 'lab_formulations' && (
                          <tr style={{ borderTop: '1px solid #cbd5e1' }}>
                            <td colSpan={3} style={{ textAlign: 'right', padding: '4px 6px', color: '#0f172a', fontWeight: 'bold' }}>
                              FORMULATION SOLID(100%)
                            </td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 'bold', padding: '4px 2px' }}>
                              {calculateFormulationSolidity(rows, Number(calculateTotalWeight(rows)))}%
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>

                  {/* Material control buttons inline below table (Only for Lab Formulations) */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', flexShrink: 0 }}>
                      <button onClick={() => handleOCRUpload(side, false)} className="flet-btn flet-btn-green" disabled={loading}>Batch Scanner (Upload)</button>
                      <button onClick={() => handleOCRUpload(side, true)} className="flet-btn flet-btn-green" disabled={loading}>Batch Scanner (Camera)</button>
                      <button onClick={() => handleAddRow(side)} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                      <button onClick={() => handleDeleteSelectedRows(side)} className="flet-btn flet-btn-red" disabled={loading}>Delete Selected</button>
                      <button onClick={() => handleClearAllFields(side)} className="flet-btn flet-btn-orange" disabled={loading}>Clear All</button>
                      <button onClick={onCopy} className="flet-btn flet-btn-blue" disabled={loading}>Copy ➡️</button>
                      <button onClick={() => handleSaveFull(side)} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                      <button onClick={() => handleSaveMaster(side)} className="flet-btn flet-btn-green" disabled={loading}>Save Master</button>
                    </div>
                  )}

                  {/* Test Specifications Header / Sync Panel */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: "bold", fontSize: "13px", color: "var(--primary-color)" }}>{`TEST METHODS (${side.toUpperCase()})`}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow(side)} className="flet-btn flet-btn-blue" disabled={loading}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests(side)} className="flet-btn flet-btn-red" disabled={loading}>Del Test</button>
                        <button onClick={() => handleRmApproval(side, 'OK')} className="flet-btn flet-btn-green" disabled={loading}>OK</button>
                        <button onClick={() => handleRmApproval(side, 'Not OK')} className="flet-btn flet-btn-red" disabled={loading}>NOT OK</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Test Specifications</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow(side)} className="flet-btn" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests(side)} className="flet-btn flet-btn-red" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Delete Selected</button>
                      </div>
                    </div>
                  )}

                  <div id="left-test-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={testRows.length > 0 && testRows.every(t => t.selected)}
                              onChange={e => {
                                setTestRows(testRows.map(t => ({ ...t, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th>TEST METHOD</th>
                          <th style={{ width: '130px' }}>STANDARD</th>
                          <th style={{ width: '120px' }}>RESULT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((t, idx) => (
                          <tr key={idx} style={{ backgroundColor: t.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)') }}>
                            <td style={{ textAlign: 'center', width: '30px' }}>
                              <input 
                                type="checkbox" 
                                checked={!!t.selected} 
                                onChange={e => {
                                  const updated = [...testRows];
                                  updated[idx].selected = e.target.checked;
                                  setTestRows(updated);
                                }} 
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-method-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.method} 
                                readOnly={!!t.isDefault}
                                style={!!t.isDefault ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', opacity: 0.85 } : {}}
                                onChange={e => {
                                  const updated = [...testRows];
                                  updated[idx].method = e.target.value;
                                  setTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, side, idx, 'method')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-standard-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.standard} 
                                readOnly={!!t.isDefault}
                                style={!!t.isDefault ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', opacity: 0.85 } : {}}
                                onChange={e => {
                                  const updated = [...testRows];
                                  updated[idx].standard = e.target.value;
                                  setTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, side, idx, 'standard')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-result-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.result} 
                                onChange={e => {
                                  const updated = [...testRows];
                                  updated[idx].result = e.target.value;
                                  setTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, side, idx, 'result')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', flexShrink: 0 }}>
                    <div className="form-input-container" style={{ width: '100%' }}>
                      <span className="form-label">Remarks</span>
                      <textarea 
                        id="left-remarks"
                        className="field-input" 
                        value={remarks} 
                        onChange={e => setRemarks(e.target.value)} 
                        style={{ height: '48px', width: '100%', resize: 'vertical', padding: '4px 8px', fontSize: '12px' }} 
                      />
                    </div>

                    {/* Report status & Approved by for RM Testing */}
                    {activeSubView === 'rm_testing' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div className="form-input-container">
                          <span className="form-label">Report Status</span>
                          <select 
                            className="field-input" 
                            value={status} 
                            onChange={e => setStatus && setStatus(e.target.value)}
                            style={{ padding: '0 4px', height: '28px' }}
                          >
                            <option value="Select">Select</option>
                            <option value="OK">OK</option>
                            <option value="Not OK">Not OK</option>
                          </select>
                        </div>
                        <div className="form-input-container">
                          <span className="form-label">Approved By</span>
                          <input 
                            type="text" 
                            className="field-input" 
                            value={approvedBy} 
                            onChange={e => setApprovedBy && setApprovedBy(e.target.value)} 
                            style={{ height: '28px' }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

  );
};
