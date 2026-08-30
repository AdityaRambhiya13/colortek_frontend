import React, { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import type { ChemicalRecord } from '../types';

interface EditTabModalProps {
  record: ChemicalRecord | null;
  onClose: () => void;
  onUpdateRecord: (updated: ChemicalRecord) => void;
}

export const EditTabModal: React.FC<EditTabModalProps> = ({
  record,
  onClose,
  onUpdateRecord,
}) => {
  const [formData, setFormData] = useState<ChemicalRecord | null>(record);
  const [saveStatus, setSaveStatus] = useState<string>('Saved');

  useEffect(() => {
    setFormData(record);
    setSaveStatus('Saved');
  }, [record]);

  if (!record || !formData) return null;

  const handleChange = (field: keyof ChemicalRecord, value: string) => {
    const updated = { ...formData, [field]: value };
    if (field === 'code') {
      updated.callNumber = value;
    }
    setFormData(updated);
    setSaveStatus('Auto-saving...');
    onUpdateRecord(updated);
    setTimeout(() => {
      setSaveStatus('Auto-saved');
    }, 300);
  };

  return (
    <div className="chem-lib-dossier-backdrop" onClick={onClose}>
      <div className="chem-lib-dossier-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chem-lib-dossier-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="chem-lib-card-code" style={{ fontSize: '16px', margin: 0, paddingBottom: 0 }}>
              {formData.code || formData.callNumber}
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#166534',
                background: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '2px',
                border: '1px solid #bbf7d0',
              }}
            >
              <CheckCircle2 size={12} /> {saveStatus}
            </div>
          </div>
          <button className="chem-lib-dossier-back-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="chem-lib-dossier-body">
          <div style={{ borderBottom: '1px solid var(--lib-border-subtle)', paddingBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--lib-ink-primary)', letterSpacing: '1px' }}>
              RECORD SPECIFICATION
            </h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '13px', color: 'var(--lib-olive-muted)' }}>
              Edit values below. Changes auto-save in real-time.
            </p>
          </div>

          {/* Product Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--lib-olive-muted)' }}>
              Product Code
            </label>
            <input
              type="text"
              value={formData.code || formData.callNumber}
              onChange={(e) => handleChange('code', e.target.value)}
              style={{
                background: 'var(--lib-paper-surface)',
                border: '1px solid var(--lib-border-subtle)',
                padding: '10px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--lib-ink-primary)',
                borderRadius: '2px',
                outline: 'none',
              }}
            />
          </div>

          {/* Product Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--lib-olive-muted)' }}>
              Product Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              style={{
                background: 'var(--lib-paper-surface)',
                border: '1px solid var(--lib-border-subtle)',
                padding: '10px 14px',
                fontFamily: 'var(--font-serif)',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--lib-ink-primary)',
                borderRadius: '2px',
                outline: 'none',
              }}
            />
          </div>

          {/* Product Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--lib-olive-muted)' }}>
              Product Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              style={{
                background: 'var(--lib-paper-surface)',
                border: '1px solid var(--lib-border-subtle)',
                padding: '10px 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--lib-ink-primary)',
                borderRadius: '2px',
                outline: 'none',
              }}
            />
          </div>

          {/* Product Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--lib-olive-muted)' }}>
              Product Description
            </label>
            <textarea
              rows={5}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              style={{
                background: 'var(--lib-paper-surface)',
                border: '1px solid var(--lib-border-subtle)',
                padding: '12px 14px',
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                lineHeight: '1.5',
                color: 'var(--lib-ink-primary)',
                borderRadius: '2px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--lib-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                background: 'var(--lib-ink-primary)',
                color: 'var(--lib-paper-primary)',
                border: 'none',
                padding: '10px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              DONE / CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
