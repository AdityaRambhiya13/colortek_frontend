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
    if (customerFormulation.length <= 1) {
      // Keep at least one empty row instead of a completely blank table
      setCustomerFormulation([{ rm: '', batchNo: '', qty: '' }]);
      return;
    }
    setCustomerFormulation(prev => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (index: number, field: keyof CustomerFormulationRow, value: string) => {
    setCustomerFormulation(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '6px 8px',
    fontSize: '0.78rem',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const cellStyle: React.CSSProperties = {
    padding: 0,
    borderRight: '1px solid var(--border-medium, #cbd5e1)',
    borderBottom: '1px solid var(--border-medium, #cbd5e1)',
    backgroundColor: 'var(--bg-card, #ffffff)'
  };

  const headerCellStyle: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: 'var(--text-primary, #1e293b)',
    backgroundColor: 'var(--bg-light, #f8fafc)',
    borderRight: '1px solid var(--border-medium, #cbd5e1)',
    borderBottom: '2px solid var(--border-medium, #94a3b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Customer Formulation
        </label>
        <button 
          type="button"
          onClick={handleAddRow} 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '4px',
            backgroundColor: '#059669', 
            color: '#ffffff', 
            border: 'none', 
            borderRadius: '4px', 
            padding: '2px 8px', 
            fontSize: '0.72rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            transition: 'background-color 0.15s ease'
          }} 
          title="Add new raw material row"
        >
          <Plus size={12} /> Add Row
        </button>
      </div>

      <div style={{ 
        border: '1px solid var(--border-medium, #94a3b8)', 
        borderRadius: '6px', 
        overflow: 'hidden', 
        backgroundColor: 'var(--bg-card, #ffffff)', 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '235px',
        maxHeight: '280px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...headerCellStyle, width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ ...headerCellStyle, width: '44%' }}>Raw Material</th>
                <th style={{ ...headerCellStyle, width: '28%' }}>Batch No.</th>
                <th style={{ ...headerCellStyle, width: '20%' }}>Qty</th>
                <th style={{ ...headerCellStyle, width: '38px', textAlign: 'center', borderRight: 'none', padding: '6px' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {customerFormulation.map((row, idx) => (
                <tr 
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 1 ? 'var(--bg-light, #f8fafc)' : 'transparent',
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  {/* Row Number */}
                  <td style={{ 
                    ...cellStyle, 
                    textAlign: 'center', 
                    fontSize: '0.72rem', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary, #64748b)',
                    backgroundColor: 'var(--bg-light, #f8fafc)',
                    userSelect: 'none'
                  }}>
                    {idx + 1}
                  </td>

                  {/* Raw Material Input */}
                  <td style={cellStyle}>
                    <input 
                      type="text" 
                      value={row.rm} 
                      onChange={e => handleCellChange(idx, 'rm', e.target.value)} 
                      style={cellInputStyle} 
                      placeholder="e.g. Titanium Dioxide" 
                    />
                  </td>

                  {/* Batch No Input */}
                  <td style={cellStyle}>
                    <input 
                      type="text" 
                      value={row.batchNo} 
                      onChange={e => handleCellChange(idx, 'batchNo', e.target.value)} 
                      style={cellInputStyle} 
                      placeholder="e.g. B-1049" 
                    />
                  </td>

                  {/* Qty Input */}
                  <td style={cellStyle}>
                    <input 
                      type="text" 
                      value={row.qty} 
                      onChange={e => handleCellChange(idx, 'qty', e.target.value)} 
                      style={cellInputStyle} 
                      placeholder="e.g. 25.0 kg" 
                    />
                  </td>

                  {/* Delete Button */}
                  <td style={{ ...cellStyle, borderRight: 'none', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button 
                      type="button"
                      onClick={() => handleRemoveRow(idx)} 
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: '#ef4444', 
                        padding: '4px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s ease'
                      }} 
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title="Delete row"
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
