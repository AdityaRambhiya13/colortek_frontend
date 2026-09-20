import React from 'react';
import { AlertTriangle, Building } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseDuplicateDetails = (data: any) => {
  if (!data) return null;
  const isLab = data.product_name_field !== undefined || data.type === 'lab';
  
  const metadata = {
    refNo: data.ref_no || data.form_data?.[0] || '',
    batchNo: data.batch_no || data.form_data?.[1] || '',
    product: data.product_name_field || data.product || data.form_data?.[2] || '',
    rmLot: isLab ? '' : (data.rm_lot || data.form_data?.[4] || ''),
    testDate: data.test_date || (isLab ? data.form_data?.[3] : data.form_data?.[5]) || '',
    reportDate: data.report_date || (isLab ? data.form_data?.[4] : data.form_data?.[6]) || '',
    formulaDate: data.formula_date || (isLab ? data.form_data?.[5] : data.form_data?.[7]) || ''
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventory = (data.inventory || []).map((i: any) => {
    if (Array.isArray(i)) {
      return {
        sr: i[0] || '',
        mr: isLab ? '' : (i[1] || ''),
        material: isLab ? (i[1] || '') : (i[2] || ''),
        qty: isLab ? (i[2] || '') : (i[3] || '')
      };
    }
    return {
      sr: i.sr_no || i.sr || '',
      mr: isLab ? '' : (i.mr_no || i.mr || ''),
      material: i.material || i.raw_material || i.item || '',
      qty: i.qty || i.qty1 || ''
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tests = (data.tests || []).map((t: any) => {
    if (Array.isArray(t)) {
      return {
        method: t[0] || '',
        standard: t[1] || '',
        result: t[2] || ''
      };
    }
    return {
      method: t.test_method || t.method || '',
      standard: t.standard || t.spec || '',
      result: t.result || t.observed || ''
    };
  });

  const remarks = data.remarks || data.remarks_field || '';

  return { metadata, inventory, tests, remarks };
};

export interface DuplicateOverlayProps {
  overlaySide: 'left' | 'right';
  activeSubView: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicateMatches: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicateDetails: any;
  selectedBatchNo: string | null;
  fetchDuplicateDetails: (batchNo: string, side: 'left' | 'right') => void;
  handleDismiss: () => void;
  handleLoadToSide: (targetSide: 'left' | 'right') => void;
}

export const DuplicateOverlay: React.FC<DuplicateOverlayProps> = (props) => {
  const { overlaySide, activeSubView, duplicateMatches, duplicateDetails, selectedBatchNo, fetchDuplicateDetails, handleDismiss, handleLoadToSide } = props;
  const sourceSide = overlaySide === 'left' ? 'right' : 'left'; 
  const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';

  if (duplicateMatches.length === 0) return null;

  const parsed = parseDuplicateDetails(duplicateDetails);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      boxSizing: 'border-box',
      border: '2px solid var(--color-warning)',
      borderRadius: '4px',
      overflowY: 'auto',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '10px',
        marginBottom: '10px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)', fontWeight: 'bold', fontSize: '14px' }}>
            <AlertTriangle size={18} />
            <span style={{ letterSpacing: '0.05em' }}>DUPLICATE DETECTED ({sourceSide.toUpperCase()} SIDE)</span>
          </div>
          <button 
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '18px',
              cursor: 'pointer',
              fontWeight: 'bold',
              padding: '4px'
            }}
            title="Dismiss Duplicate Alert"
          >
            ✕
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Select a matching duplicate batch to inspect:</span>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {duplicateMatches.map((m: any, idx: number) => {
              const isSelected = selectedBatchNo === m.batch_no;
              return (
                <button
                  key={idx}
                  onClick={() => fetchDuplicateDetails(m.batch_no, sourceSide)}
                  style={{
                    backgroundColor: isSelected ? 'var(--primary-color)' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: isSelected ? '1px solid var(--primary-color)' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Batch {m.batch_no}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!selectedBatchNo ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          gap: '12px',
          border: '2px dashed #cbd5e1',
          borderRadius: '6px',
          marginTop: '8px',
          padding: '24px',
          backgroundColor: 'var(--bg-app)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-app)'
          }}>
            <Building size={32} color="#94a3b8" />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, textAlign: 'center' }}>
            Select a batch number button from the options above to check and load its details.
          </span>
          <button 
            onClick={handleDismiss} 
            className="flet-btn flet-btn-orange"
            style={{ fontSize: '11px', height: '24px', padding: '0 12px', marginTop: '4px' }}
          >
            Dismiss / Close Overlay
          </button>
        </div>
      ) : !parsed ? (
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
          Loading duplicate details...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button 
              onClick={() => handleLoadToSide(sourceSide)} 
              className="flet-btn flet-btn-blue"
              style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
            >
              Overwrite {sourceSide.toUpperCase()}
            </button>
            <button 
              onClick={() => handleLoadToSide(overlaySide)} 
              className="flet-btn flet-btn-green"
              style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
            >
              Load to {overlaySide.toUpperCase()} (Compare)
            </button>
            <button 
              onClick={handleDismiss} 
              className="flet-btn flet-btn-orange"
              style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
            >
              Dismiss
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            backgroundColor: 'var(--bg-app)',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: '#334155'
          }}>
            <div><strong>Ref No:</strong> {parsed.metadata.refNo || '-'}</div>
            <div><strong>Batch No:</strong> {parsed.metadata.batchNo || '-'}</div>
            <div><strong>Product:</strong> {parsed.metadata.product || '-'}</div>
            {!isLab && <div><strong>RM Lot:</strong> {parsed.metadata.rmLot || '-'}</div>}
            <div><strong>Test Date:</strong> {parsed.metadata.testDate || '-'}</div>
            <div><strong>Report Date:</strong> {parsed.metadata.reportDate || '-'}</div>
            <div style={{ gridColumn: isLab ? undefined : 'span 3' }}><strong>Formula Date:</strong> {parsed.metadata.formulaDate || '-'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>INGREDIENTS:</span>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <table className="desktop-data-grid" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ width: '40px', padding: '6px' }}>Sr</th>
                    {!isLab && <th style={{ width: '80px', padding: '6px' }}>MR No</th>}
                    <th style={{ padding: '6px' }}>Raw Material</th>
                    <th style={{ width: '95px', textAlign: 'right', padding: '6px' }}>Qty (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {parsed.inventory.map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px' }}>{row.sr}</td>
                      {!isLab && <td style={{ padding: '6px' }}>{row.mr}</td>}
                      <td style={{ fontWeight: 'bold', padding: '6px' }}>{row.material}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '6px' }}>{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parsed.tests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>TEST SPECIFICATIONS:</span>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <table className="desktop-data-grid" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '6px' }}>Test Method / Parameter</th>
                      <th style={{ padding: '6px' }}>Standard Specification</th>
                      <th style={{ padding: '6px' }}>Observed Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {parsed.tests.map((row: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px' }}>{row.method}</td>
                        <td style={{ padding: '6px' }}>{row.standard}</td>
                        <td style={{ fontWeight: 'bold', padding: '6px' }}>{row.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsed.remarks && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>REMARKS:</span>
              <textarea 
                value={parsed.remarks} 
                readOnly 
                style={{
                  width: '100%',
                  height: '60px',
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  resize: 'none',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-secondary)'
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
