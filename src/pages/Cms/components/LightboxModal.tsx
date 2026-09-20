import React from 'react';

interface LightboxModalProps {
  imageSrc: string | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ imageSrc, onClose }) => {
  if (!imageSrc) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, cursor: 'zoom-out'
    }} onClick={onClose}>
      <img src={imageSrc} alt="Enlarged view" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
    </div>
  );
};
