import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface StarRatingModalProps {
  isOpen: boolean;
  batchNo: string;
  isStarred: boolean;
  initialOkRating: string;
  loading: boolean;
  onSave: (starredStatus: boolean, okRating: string) => void;
  onClose: () => void;
}

export const StarRatingModal: React.FC<StarRatingModalProps> = ({
  isOpen,
  batchNo,
  isStarred,
  initialOkRating,
  loading,
  onSave,
  onClose
}) => {
  const [okRatingInput, setOkRatingInput] = useState(initialOkRating);

  // Sync state if initial value changes when modal opens
  useEffect(() => {
    if (isOpen) {
      setOkRatingInput(initialOkRating);
    }
  }, [isOpen, initialOkRating]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', width: '380px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Star size={24} fill="#f59e0b" color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
            Bookmark Formulation
          </h3>
        </div>
        
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
          Formulation Batch: <strong>{batchNo}</strong>
        </p>

        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
          How much OK is this formulation? (e.g. 95% OK, 100% OK, Very Good)
        </label>
        <input 
          type="text" 
          className="field-input" 
          style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '20px' }}
          value={okRatingInput} 
          onChange={e => setOkRatingInput(e.target.value)} 
          placeholder="e.g. 95% OK"
          autoFocus
          onFocus={e => e.target.select()}
        />

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {isStarred && (
            <button 
              onClick={() => onSave(false, okRatingInput)} 
              className="flet-btn flet-btn-red"
              style={{ padding: '8px 14px' }}
              disabled={loading}
            >
              Unstar
            </button>
          )}
          <button 
            onClick={onClose} 
            className="flet-btn flet-btn-orange"
            style={{ padding: '8px 14px' }}
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(true, okRatingInput)} 
            className="flet-btn flet-btn-green"
            style={{ padding: '8px 18px', fontWeight: 'bold' }}
            disabled={loading}
          >
            Save Star
          </button>
        </div>
      </div>
    </div>
  );
};
