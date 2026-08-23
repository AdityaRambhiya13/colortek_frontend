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

const FIELDS: (keyof CustomerFormulationRow)[] = ['rm', 'batchNo', 'qty'];

export const CustomerFormulationTable: React.FC<CustomerFormulationTableProps> = ({
  customerFormulation,
  setCustomerFormulation
}) => {
  const handleAddRow = () => {
    setCustomerFormulation(prev => [...prev, { rm: '', batchNo: '', qty: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (customerFormulation.length <= 1) {
      // Keep at least one empty row
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

  const focusCell = (rowIndex: number, field: keyof CustomerFormulationRow) => {
    const el = document.getElementById(`cust-form-${rowIndex}-${field}`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: keyof CustomerFormulationRow
  ) => {
    const colIndex = FIELDS.indexOf(field);

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab (Backward)
        if (colIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex, FIELDS[colIndex - 1]);
        } else if (rowIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex - 1, FIELDS[FIELDS.length - 1]);
        }
      } else {
        // Tab (Forward)
        if (colIndex < FIELDS.length - 1) {
          e.preventDefault();
          focusCell(rowIndex, FIELDS[colIndex + 1]);
        } else {
          e.preventDefault();
          if (rowIndex < customerFormulation.length - 1) {
            focusCell(rowIndex + 1, FIELDS[0]);
          } else {
            // Last cell of the last row: automatically append a new row and focus it
            setCustomerFormulation(prev => [...prev, { rm: '', batchNo: '', qty: '' }]);
            setTimeout(() => {
              focusCell(rowIndex + 1, FIELDS[0]);
            }, 30);
          }
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Enter (Backward)
        if (colIndex > 0) {
          focusCell(rowIndex, FIELDS[colIndex - 1]);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, FIELDS[FIELDS.length - 1]);
        }
      } else {
        // Enter (Forward: rm -> batchNo -> qty -> next row rm)
        if (colIndex < FIELDS.length - 1) {
          focusCell(rowIndex, FIELDS[colIndex + 1]);
        } else {
          if (rowIndex < customerFormulation.length - 1) {
            focusCell(rowIndex + 1, FIELDS[0]);
          } else {
            // Last cell of the last row: automatically append a new row and focus it
            setCustomerFormulation(prev => [...prev, { rm: '', batchNo: '', qty: '' }]);
            setTimeout(() => {
              focusCell(rowIndex + 1, FIELDS[0]);
            }, 30);
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (rowIndex < customerFormulation.length - 1) {
        e.preventDefault();
        focusCell(rowIndex + 1, field);
      }
    } else if (e.key === 'ArrowUp') {
      if (rowIndex > 0) {
        e.preventDefault();
        focusCell(rowIndex - 1, field);
      }
    }
  };

  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '4px 6px',
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
    backgroundColor: 'var(--bg-card, #ffffff)',
    height: '28px'
  };

  const headerCellStyle: React.CSSProperties = {
    padding: '6px 8px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '0.74rem',
    color: 'var(--text-primary, #1e293b)',
    backgroundColor: 'var(--bg-light, #f8fafc)',
    borderRight: '1px solid var(--border-medium, #cbd5e1)',
    borderBottom: '2px solid var(--border-medium, #94a3b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, width: '34px', textAlign: 'center' }}>#</th>
              <th style={{ ...headerCellStyle, width: '45%' }}>Raw Material</th>
              <th style={{ ...headerCellStyle, width: '28%' }}>Batch No.</th>
              <th style={{ ...headerCellStyle, width: '20%' }}>Qty</th>
              <th style={{ ...headerCellStyle, width: '34px', textAlign: 'center', borderRight: 'none', padding: '4px' }}>
                
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
                    id={`cust-form-${idx}-rm`}
                    type="text" 
                    value={row.rm} 
                    onChange={e => handleCellChange(idx, 'rm', e.target.value)} 
                    onKeyDown={e => handleKeyDown(e, idx, 'rm')}
                    onFocus={e => e.target.select()}
                    style={cellInputStyle} 
                  />
                </td>

                {/* Batch No Input */}
                <td style={cellStyle}>
                  <input 
                    id={`cust-form-${idx}-batchNo`}
                    type="text" 
                    value={row.batchNo} 
                    onChange={e => handleCellChange(idx, 'batchNo', e.target.value)} 
                    onKeyDown={e => handleKeyDown(e, idx, 'batchNo')}
                    onFocus={e => e.target.select()}
                    style={cellInputStyle} 
                  />
                </td>

                {/* Qty Input */}
                <td style={cellStyle}>
                  <input 
                    id={`cust-form-${idx}-qty`}
                    type="text" 
                    value={row.qty} 
                    onChange={e => handleCellChange(idx, 'qty', e.target.value)} 
                    onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                    onFocus={e => e.target.select()}
                    style={cellInputStyle} 
                  />
                </td>

                {/* Delete Button */}
                <td style={{ ...cellStyle, borderRight: 'none', textAlign: 'center', verticalAlign: 'middle', padding: '2px' }}>
                  <button 
                    type="button"
                    onClick={() => handleRemoveRow(idx)} 
                    tabIndex={-1}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#ef4444', 
                      padding: '2px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '4px',
                      width: '100%',
                      height: '100%',
                      transition: 'background-color 0.15s ease'
                    }} 
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title="Delete row"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
