import React from 'react';
import { Upload, X, Save, Beaker, History } from 'lucide-react';
import { CustomerFormulationTable } from './CustomerFormulationTable';

export interface ComplaintRegistrationFormProps {
  productNameUi: string;
  setProductNameUi: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  batchNo: string;
  setBatchNo: (v: string) => void;
  initialObservation: string;
  setInitialObservation: (v: string) => void;
  complaintDetails: string;
  setComplaintDetails: (v: string) => void;
  customerFormulation: { rm: string; batchNo: string; qty: string }[];
  setCustomerFormulation: React.Dispatch<React.SetStateAction<{ rm: string; batchNo: string; qty: string }[]>>;
  imagePreviews: string[];
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  onViewImage: (url: string) => void;
  saving: boolean;
  handleSaveComplaint: () => void;
  clearRegistrationForm: () => void;
  moving: boolean;
  handleMoveToLab: () => void;
  openLogsModal: () => void;
  foundProductDb: string;
  batchRefData: any;
  handleBatchSearch: () => void;
}

export const ComplaintRegistrationForm: React.FC<ComplaintRegistrationFormProps> = ({
  productNameUi,
  setProductNameUi,
  customerName,
  setCustomerName,
  batchNo,
  setBatchNo,
  initialObservation,
  setInitialObservation,
  complaintDetails,
  setComplaintDetails,
  customerFormulation,
  setCustomerFormulation,
  imagePreviews,
  handleImageChange,
  removeImage,
  onViewImage,
  saving,
  handleSaveComplaint,
  clearRegistrationForm,
  moving,
  handleMoveToLab,
  openLogsModal,
  foundProductDb,
  batchRefData,
  handleBatchSearch
}) => {
  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Complaint Registration</h3>

        {/* Three Column Grid for inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '4fr 4fr 5fr', gap: '20px' }}>
          
          {/* Left Column: Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product Name</label>
              <input 
                type="text" 
                value={productNameUi} 
                onChange={e => setProductNameUi(e.target.value)}
                placeholder="Enter Product Name"
                style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none' }} 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Name</label>
              <input 
                type="text" 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Enter Customer Name"
                style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none' }} 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Batch Number</label>
              <input 
                type="text" 
                value={batchNo} 
                onChange={e => setBatchNo(e.target.value)}
                placeholder="Enter Batch Number"
                onKeyDown={e => { if (e.key === 'Enter') handleBatchSearch(); }}
                style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none' }} 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Initial Observation</label>
              <input 
                type="text" 
                value={initialObservation} 
                onChange={e => setInitialObservation(e.target.value)}
                placeholder="Enter Initial Observation"
                style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none' }} 
              />
            </div>
          </div>

          {/* Middle Column: Complaint Details TextArea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Complaint Details</label>
            <textarea 
              value={complaintDetails} 
              onChange={e => setComplaintDetails(e.target.value)}
              placeholder="Enter Complaint Details"
              style={{ width: '100%', padding: '12px 14px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', flex: 1, boxSizing: 'border-box', minHeight: '235px', outline: 'none' }}
            />
          </div>

          {/* Right Column: Customer Formulation */}
          <CustomerFormulationTable 
            customerFormulation={customerFormulation} 
            setCustomerFormulation={setCustomerFormulation} 
          />
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid var(--border-light)', margin: '4px 0' }} />

        {/* Upload Images Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label className="flet-btn" style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px' }}>
              <Upload size={14} /> Upload Images
              <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
          </div>

          {imagePreviews.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
              {imagePreviews.map((preview, idx) => (
                <div key={idx} style={{ width: '80px', height: '80px', borderRadius: '6px', border: '1px solid var(--border-light)', overflow: 'hidden', position: 'relative' }}>
                  <img src={preview} alt="preview" onClick={() => onViewImage(preview)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                  <button onClick={() => removeImage(idx)}
                    style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid var(--border-light)', margin: '4px 0' }} />

        {/* Bottom Row: Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleSaveComplaint} disabled={saving} className="flet-btn flet-btn-green"
            style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
          
          <button onClick={clearRegistrationForm} className="flet-btn"
            style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#374151', color: '#fff' }}>
            <X size={14} /> Clear
          </button>
          
          <button onClick={handleMoveToLab} disabled={moving} className="flet-btn flet-btn-blue"
            style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb' }}>
            <Beaker size={14} /> {moving ? 'Moving...' : 'MOVE TO LAB'}
          </button>
          
          <button onClick={openLogsModal} className="flet-btn"
            style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a', color: '#fff' }}>
            <History size={14} /> View Logs
          </button>
        </div>

        {/* Batch summary details / badge if any */}
        {foundProductDb && (
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--primary-color)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              ✓ DB: {foundProductDb}
            </span>
            {batchRefData && (
              <>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                  | Raw Materials: {batchRefData.production_sheet_data?.raw_materials?.length || 0}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                  | QC Parameters: {batchRefData.master_test_results?.length || 0}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Batch Reference Panels */}
      {batchRefData && (
        <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '20px' }}>

          {/* Left — BPBS */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '6px' }}>
              Original Production Batch Sheet (BPBS)
            </strong>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '6px' }}>
              {/* Header Rows */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div><strong>Batch Size:</strong> {batchRefData.production_sheet_data?.batch_size || 'N/A'}</div>
                <div><strong>Date:</strong> {batchRefData.production_sheet_data?.date || 'N/A'}</div>
                <div><strong>Batch No:</strong> {batchRefData.production_sheet_data?.batch_no || 'N/A'}</div>
                <div><strong>Product:</strong> {batchRefData.production_sheet_data?.product || 'N/A'}</div>
                <div><strong>Customer:</strong> {batchRefData.production_sheet_data?.customer || 'N/A'}</div>
                <div><strong>Ref. No:</strong> {batchRefData.production_sheet_data?.ref_no || 'N/A'}</div>
                <div><strong>Batch Started:</strong> {batchRefData.production_sheet_data?.batch_started || batchRefData.production_sheet_data?.batch_started_at || 'N/A'}</div>
                <div><strong>Batch Ended:</strong> {batchRefData.production_sheet_data?.batch_completed || batchRefData.production_sheet_data?.batch_completed_on || 'N/A'}</div>
              </div>

              {/* Main Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Raw Materials Recipe List</span>
                {(() => {
                  const rawMaterials = batchRefData.production_sheet_data?.raw_materials || [];
                  const displayRecipe = Array.from({ length: 30 }, (_, i) => {
                    const item = rawMaterials[i] || {};
                    return {
                      sr_no: String(i + 1),
                      item: item.item || item.raw_material || item.material || '',
                      qty1: item.qty1 || item.qty || '',
                      qty2: item.qty2 || '',
                      mrno: item.mrno || item.mr_no || item.mr || '',
                      inputtime: item.inputtime || '',
                      chargedby: item.chargedby || ''
                    };
                  });
                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-medium)' }}>
                            <th style={{ padding: '6px 8px', width: '50px', textAlign: 'center' }}>Sr. No.</th>
                            <th style={{ padding: '6px 8px' }}>Item Description</th>
                            <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>Qty. Used I</th>
                            <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>Qty. Used II</th>
                            <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>M.R. No.</th>
                            <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>Input Time</th>
                            <th style={{ padding: '6px 8px', width: '100px' }}>Charged By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRecipe.map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', height: '28px' }}>
                              <td style={{ padding: '4px 8px', textAlign: 'center', backgroundColor: 'var(--bg-light)', fontWeight: 500 }}>{r.sr_no}</td>
                              <td style={{ padding: '4px 8px', fontWeight: r.item ? 600 : 'normal' }}>{r.item || '-'}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.qty1 || '-'}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.qty2 || '-'}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.mrno || '-'}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.inputtime || '-'}</td>
                              <td style={{ padding: '4px 8px', textTransform: 'uppercase' }}>{r.chargedby || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* QC & Testing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Quality Control & Testing</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                    <div><strong>Material:</strong> {batchRefData.production_sheet_data?.qa_material || batchRefData.production_sheet_data?.material || 'N/A'}</div>
                    <div><strong>Q.A. Status:</strong> {batchRefData.production_sheet_data?.qa_status || 'N/A'}</div>
                    <div><strong>Filtered By:</strong> {batchRefData.production_sheet_data?.filtered_by || 'N/A'}</div>
                    <div><strong>Weighted By:</strong> {batchRefData.production_sheet_data?.weighted_by || 'N/A'}</div>
                    <div><strong>Sample Given:</strong> {batchRefData.production_sheet_data?.sample_given || 'N/A'}</div>
                    <div><strong>Machine No.:</strong> {batchRefData.production_sheet_data?.machine_no || 'N/A'}</div>
                    <div><strong>Checked By:</strong> {batchRefData.production_sheet_data?.checked_by || 'N/A'}</div>
                    <div><strong>Final Status:</strong> {batchRefData.production_sheet_data?.qa_final_status || batchRefData.production_sheet_data?.status || 'N/A'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>Filter No.:</strong> {batchRefData.production_sheet_data?.filter_no || 'N/A'}</div>
                  </div>
                </div>

                {/* Testing & Spec */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Testing & Specifications</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                    <div style={{ gridColumn: 'span 2' }}><strong>Packing Material:</strong> {batchRefData.production_sheet_data?.packing_material || 'N/A'}</div>
                    <div><strong>Density:</strong> {batchRefData.production_sheet_data?.density || 'N/A'}</div>
                    <div><strong>Viscosity:</strong> {batchRefData.production_sheet_data?.viscosity || 'N/A'} Sec/CPS</div>
                    <div><strong>Tested By:</strong> {batchRefData.production_sheet_data?.tested_by || 'N/A'}</div>
                    <div><strong>Solid Content:</strong> {batchRefData.production_sheet_data?.solid || 'N/A'}%</div>
                  </div>
                </div>
              </div>

              {/* Production Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Production Details</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                  <div><strong>Qty Packed:</strong> {batchRefData.production_sheet_data?.qty_packed || batchRefData.production_sheet_data?.['qty._packed'] || 'N/A'} kg/ltr</div>
                  <div><strong>Tank Cleaning:</strong> {batchRefData.production_sheet_data?.tank_cleaning || batchRefData.production_sheet_data?.tank_cleaning_check || 'N/A'}</div>
                  <div><strong>Formulation:</strong> {batchRefData.production_sheet_data?.formulation || 'N/A'}</div>
                  <div><strong>Tare Weight:</strong> {batchRefData.production_sheet_data?.tare_weight || 'N/A'}</div>
                  <div><strong>Gross Weight:</strong> {batchRefData.production_sheet_data?.gross_weight || 'N/A'}</div>
                  <div><strong>Net Weight:</strong> {batchRefData.production_sheet_data?.net_weight || 'N/A'}</div>
                  <div style={{ gridColumn: 'span 3' }}><strong>Packed By:</strong> {batchRefData.production_sheet_data?.packed_by || 'N/A'}</div>
                </div>
              </div>

              {/* Approvals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                  <strong>Formula Approval Remarks:</strong>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-light)', borderRadius: '4px', fontStyle: 'italic', minHeight: '32px' }}>
                    {batchRefData.production_sheet_data?.signature_approval || batchRefData.production_sheet_data?.signature_of_formula_approval || 'None'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                  <strong>Formula Check Remarks:</strong>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-light)', borderRadius: '4px', fontStyle: 'italic', minHeight: '32px' }}>
                    {batchRefData.production_sheet_data?.signature_check || batchRefData.production_sheet_data?.signature_of_formula_check || 'None'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — QC Tests */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '6px' }}>
              Original QC Lab Test Specifications
            </strong>
            <div style={{ overflowY: 'auto', maxHeight: '400px', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-medium)' }}>
                    <th style={{ padding: '8px 10px' }}>Test Parameter</th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>Standard</th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>Batch Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchRefData.master_test_results || []).map((test: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{test.method || '-'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{test.standard || '-'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--success-color)', fontWeight: 'bold' }}>{test.result || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
