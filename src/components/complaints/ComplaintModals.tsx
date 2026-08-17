import React from 'react';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ResolvedComplaintModalProps {
  selectedResolvedBatch: string | null;
  resolvedDetails: any;
  loadingResolvedDetail: boolean;
  onClose: () => void;
}

export const ResolvedComplaintModal: React.FC<ResolvedComplaintModalProps> = ({
  selectedResolvedBatch,
  resolvedDetails,
  loadingResolvedDetail,
  onClose
}) => {
  if (!selectedResolvedBatch) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', minHeight: '300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <CheckCircle2 size={22} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>✓ Resolved: {selectedResolvedBatch}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {loadingResolvedDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={28} color="#10b981" /></div>
        ) : !resolvedDetails ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Failed to load resolved complaint details.</div>
        ) : (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Customer:</strong> {resolvedDetails.customer_name}</div>
              <div><strong>Product:</strong> {resolvedDetails.product_name}</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--color-error)', display: 'block', marginBottom: '6px' }}>Complaint:</strong>
              <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{resolvedDetails.complaint}</p>
            </div>
            {resolvedDetails.observation && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--primary-color)', display: 'block', marginBottom: '6px' }}>Observation:</strong>
                <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{resolvedDetails.observation}</p>
              </div>
            )}
            {resolvedDetails.raw_materials?.length > 0 && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Raw Materials:</strong>
                {resolvedDetails.raw_materials.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>
                    – {item.material || item.raw_material || item.item}: {item.qty}
                  </div>
                ))}
              </div>
            )}
            {resolvedDetails.test_results?.length > 0 && (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Test Results:</strong>
                {resolvedDetails.test_results.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>
                    – {item.method}: {item.result}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
              <button onClick={onClose} style={{ padding: '8px 20px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ImageLightboxModalProps {
  lightboxImage: string | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  lightboxImage,
  onClose
}) => {
  if (!lightboxImage) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '-44px', right: '-8px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={32} />
        </button>
        <img src={lightboxImage} alt="lightbox" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '10px' }} />
      </div>
    </div>
  );
};
