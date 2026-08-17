import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface CustomerFormulationRow {
  rm: string;
  batchNo: string;
  qty: string;
}

interface CustomerFormulationTableProps {
  customerFormulation: CustomerFormulationRow[];
  setCustomerFormulation: React.Dispatch<React.SetStateAction<CustomerFormulationRow[]>>;
}

export const CustomerFormulationTable: React.FC<CustomerFormulationTableProps> = ({
  customerFormulation,
  setCustomerFormulation
}) => {
  const handleAddRow = () => {
    setCustomerFormulation(prev => [...prev, { rm: '', batchNo: '', qty: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    setCustomerFormulation(prev => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (index: number, field: keyof CustomerFormulationRow, value: string) => {
    setCustomerFormulation(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Formulation</label>
      <div style={{ border: '1px solid #94a3b8', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-light)', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>Raw Material</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-light)', width: '25%' }}>Batch No.</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-light)', width: '20%' }}>Qty</th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-light)', width: '30px' }}>
                  <button 
                    type="button"
                    onClick={handleAddRow} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    title="Add Row"
                  >
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {customerFormulation.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '4px' }}>
                    <input 
                      type="text" 
                      value={row.rm} 
                      onChange={e => handleCellChange(idx, 'rm', e.target.value)} 
                      style={{ width: '100%', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '6px', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }} 
                      placeholder="RM Name" 
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input 
                      type="text" 
                      value={row.batchNo} 
                      onChange={e => handleCellChange(idx, 'batchNo', e.target.value)} 
                      style={{ width: '100%', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '6px', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }} 
                      placeholder="Batch" 
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input 
                      type="text" 
                      value={row.qty} 
                      onChange={e => handleCellChange(idx, 'qty', e.target.value)} 
                      style={{ width: '100%', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '6px', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }} 
                      placeholder="Qty" 
                    />
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => handleRemoveRow(idx)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }} 
                      title="Remove Row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
