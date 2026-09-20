import React, { useState } from 'react';
import { Lock, AlertTriangle, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';

interface BatchModificationModalProps {
  isOpen: boolean;
  batchToModify: { batchNo: string; side: 'left' | 'right'; isLab: boolean } | null;
  loading: boolean;
  error: string;
  onVerify: (password: string) => void;
  onClose: () => void;
}

export const BatchModificationModal: React.FC<BatchModificationModalProps> = ({
  isOpen,
  batchToModify,
  loading,
  error,
  onVerify,
  onClose
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen || !batchToModify) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(passwordInput);
  };

  const handleClose = () => {
    setPasswordInput('');
    setShowPassword(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '12px', padding: '26px', width: '430px', maxWidth: '92vw',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25), 0 10px 10px -5px rgba(0,0,0,0.1)', border: '1px solid #cbd5e1'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Batch Modification Authorization
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Admin Authorization Gate for Past Batch Changes
            </span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', margin: '0 0 14px 0' }}>
          You are requesting to modify <strong>Batch #{batchToModify.batchNo}</strong> on the <strong>{batchToModify.side.toUpperCase()}</strong> panel ({batchToModify.isLab ? 'Lab Formulation' : 'RM Testing'}).
          <br />
          Please enter your <strong>Batch Modification Password</strong> (set by the administrator) to proceed.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px',
            color: '#b91c1c', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px'
          }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Enter Modification Password:
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'}
                className="field-input"
                style={{ width: '100%', padding: '9px 38px 9px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Enter assigned batch modify password..."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              className="flet-btn flet-btn-orange"
              style={{ padding: '8px 16px', borderRadius: '6px' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flet-btn flet-btn-green"
              style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="spin-loader" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck size={14} /> Unlock & Modify
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
