import React from 'react';

interface ComplaintRepairBpbsPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bpbsData: any;
  onExit: () => void;
}

export const ComplaintRepairBpbsPanel: React.FC<ComplaintRepairBpbsPanelProps> = ({ bpbsData, onExit }) => {
  if (!bpbsData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', flexShrink: 0 }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>ORIGINAL PRODUCTION BATCH SHEET (BPBS)</span>
        <button onClick={onExit} className="flet-btn flet-btn-orange" style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>
          Exit Repair Mode
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
        {/* Header fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', backgroundColor: 'var(--primary-light)', padding: '8px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-color)' }}>
          <div><strong>Batch No:</strong> {bpbsData.batch_no || bpbsData.batch_no_field || 'N/A'}</div>
          <div><strong>Product:</strong> {bpbsData.product || bpbsData.product_name || 'N/A'}</div>
          <div><strong>Ref. No:</strong> {bpbsData.ref_no || 'N/A'}</div>
          <div><strong>Customer:</strong> {bpbsData.customer || 'N/A'}</div>
          <div><strong>Date:</strong> {bpbsData.date || 'N/A'}</div>
          <div><strong>Batch Size:</strong> {bpbsData.batch_size || 'N/A'}</div>
          <div><strong>Started:</strong> {bpbsData.batch_started || bpbsData.batch_started_at || 'N/A'}</div>
          <div><strong>Ended:</strong> {bpbsData.batch_completed || bpbsData.batch_completed_on || 'N/A'}</div>
        </div>
        
        {/* Recipe Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>RAW MATERIALS RECIPE LIST</span>
          {(() => {
            const rawMaterials = bpbsData.raw_materials || [];
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
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)', height: '24px' }}>
                      <th style={{ padding: '4px 6px', width: '40px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Sr.</th>
                      <th style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color)' }}>Item Description</th>
                      <th style={{ padding: '4px 6px', width: '70px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>Qty I</th>
                      <th style={{ padding: '4px 6px', width: '70px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>Qty II</th>
                      <th style={{ padding: '4px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>M.R. No.</th>
                      <th style={{ padding: '4px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Input Time</th>
                      <th style={{ padding: '4px 6px', width: '80px' }}>Charged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRecipe.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', height: '22px', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)', fontWeight: 500 }}>{r.sr_no}</td>
                        <td style={{ padding: '3px 6px', borderRight: '1px solid var(--border-color)', fontWeight: r.item ? 600 : 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.item || '-'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>{r.qty1 || '-'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>{r.qty2 || '-'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.mrno || '-'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.inputtime || '-'}</td>
                        <td style={{ padding: '3px 6px', textTransform: 'uppercase', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.chargedby || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
        
        {/* QC & Specifications */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>QUALITY CONTROL & TESTING</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
              <div><strong>Material:</strong> {bpbsData.qa_material || bpbsData.material || 'N/A'}</div>
              <div><strong>Q.A. Status:</strong> {bpbsData.qa_status || 'N/A'}</div>
              <div><strong>Filtered By:</strong> {bpbsData.filtered_by || 'N/A'}</div>
              <div><strong>Weighted By:</strong> {bpbsData.weighted_by || 'N/A'}</div>
              <div><strong>Sample Given:</strong> {bpbsData.sample_given || 'N/A'}</div>
              <div><strong>Machine No.:</strong> {bpbsData.machine_no || 'N/A'}</div>
              <div><strong>Checked By:</strong> {bpbsData.checked_by || 'N/A'}</div>
              <div><strong>Final Status:</strong> {bpbsData.qa_final_status || bpbsData.status || 'N/A'}</div>
              <div style={{ gridColumn: 'span 2' }}><strong>Filter No.:</strong> {bpbsData.filter_no || 'N/A'}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>TESTING & SPECIFICATIONS</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
              <div style={{ gridColumn: 'span 2' }}><strong>Packing Material:</strong> {bpbsData.packing_material || 'N/A'}</div>
              <div><strong>Density:</strong> {bpbsData.density || 'N/A'}</div>
              <div><strong>Viscosity:</strong> {bpbsData.viscosity || 'N/A'} CPS</div>
              <div style={{ gridColumn: 'span 2' }}><strong>Tested By:</strong> {bpbsData.tested_by || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
