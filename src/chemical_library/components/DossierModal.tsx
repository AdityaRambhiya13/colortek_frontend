import React from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import type { ChemicalRecord } from '../types';

interface DossierModalProps {
  record: ChemicalRecord | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const DossierModal: React.FC<DossierModalProps> = ({
  record,
  onClose,
  onPrev,
  onNext,
}) => {
  if (!record) return null;

  return (
    <div className="chem-lib-dossier-backdrop" onClick={onClose}>
      <div className="chem-lib-dossier-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chem-lib-dossier-header">
          <button className="chem-lib-dossier-back-btn" onClick={onClose}>
            <ArrowLeft size={16} /> BACK TO COLLECTION
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="chem-lib-btn-page"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={onPrev}
            >
              <ChevronLeft size={14} /> PREV
            </button>
            <button
              className="chem-lib-btn-page"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={onNext}
            >
              NEXT <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="chem-lib-dossier-body">
          <div>
            <span className="chem-lib-dossier-code">{record.prefix} ? {record.num}</span>
            <h2 className="chem-lib-dossier-title">{record.name}</h2>
          </div>

          <div className="chem-lib-chem-vector-box">
            <div dangerouslySetInnerHTML={{ __html: record.structureSvg }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--lib-olive-muted)', marginTop: '8px' }}>
              2D COORDINATION / VECTOR RENDERING
            </span>
          </div>

          <div className="chem-lib-dossier-grid">
            <div className="chem-lib-meta-item">
              <label>Product Category</label>
              <span>{record.category}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>CAS Registry Number</label>
              <span>{record.cas}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Molecular Formula</label>
              <span>{record.formula}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Molecular Weight</label>
              <span>{record.mw}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Storage Location</label>
              <span>{record.storage}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Assay Purity Standard</label>
              <span>{record.grade}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Hazard Classification</label>
              <span>{record.hazard}</span>
            </div>
            <div className="chem-lib-meta-item">
              <label>Archived Date</label>
              <span>{record.dateArchived}</span>
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--lib-olive-muted)',
                marginBottom: '8px',
              }}
            >
              DETAILED ARCHIVAL SPECIFICATION
            </div>
            <div className="chem-lib-dossier-desc">{record.description}</div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--lib-border-subtle)',
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '12px',
            }}
          >
            <button className="chem-lib-btn-print" onClick={() => window.print()}>
              <Printer size={14} /> PRINT CALL SLIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
