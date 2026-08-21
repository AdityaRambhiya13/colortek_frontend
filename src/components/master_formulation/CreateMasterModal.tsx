import React, { useState, useRef } from 'react';
import { 
  Scale, Image as ImageIcon, Trash2, Plus, RefreshCw, CheckCircle2, 
  UploadCloud, ZoomIn, FileText
} from 'lucide-react';
import { MasterFormulationAPI } from '../../services/api';

interface InventoryItem {
  sr: string;
  remarks: string;
  material: string;
  qty: string;
  rounded_qty: string;
}

interface TestItem {
  method: string;
  standard: string;
  result: string;
}

interface CreateMasterModalProps {
  isOpen: boolean;
  productName: string;
  onClose: () => void;
  onSuccess: (batchNo: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CreateMasterModal: React.FC<CreateMasterModalProps> = ({
  isOpen,
  productName,
  onClose,
  onSuccess,
  onShowToast
}) => {
  // Document Control Fields (Matching Master Formulation Specification)
  const [docNo, setDocNo] = useState('DOC-MF-01');
  const [reviewNo, setReviewNo] = useState('03');
  const [reviewDate, setReviewDate] = useState('01.04.2025');
  const [issueNo, setIssueNo] = useState('01');
  const [issueDate, setIssueDate] = useState('01.04.2025');

  // Form Header Fields
  const [batchNo, setBatchNo] = useState('');
  const [refNo, setRefNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [formulaDate, setFormulaDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [refBookNo, setRefBookNo] = useState('');

  // Target Quantity (Grams) Recalculator (Matching OG Master Formulation)
  const [grams, setGrams] = useState('100');

  // Standard Parameters
  const [packaging, setPackaging] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [density, setDensity] = useState('');
  const [ratio, setRatio] = useState('');
  const [filtration, setFiltration] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sender, setSender] = useState('');
  const [approval, setApproval] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // Attached Sheet Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string | null>(null);
  const [previewZoomOpen, setPreviewZoomOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Composition Inventory Rows (starts with 5 clean rows)
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { sr: '1', remarks: '', material: '', qty: '', rounded_qty: '' },
    { sr: '2', remarks: '', material: '', qty: '', rounded_qty: '' },
    { sr: '3', remarks: '', material: '', qty: '', rounded_qty: '' },
    { sr: '4', remarks: '', material: '', qty: '', rounded_qty: '' },
    { sr: '5', remarks: '', material: '', qty: '', rounded_qty: '' },
  ]);

  // QC Test Rows
  const [tests, setTests] = useState<TestItem[]>([
    { method: 'Viscosity', standard: '', result: '' },
    { method: 'Density', standard: '', result: '' },
    { method: 'Solid Content', standard: '', result: '' },
  ]);

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  // Handle Image Selection and Auto-Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localUrl);

    // Upload to server permanently
    setUploadingImage(true);
    const [success, res] = await MasterFormulationAPI.uploadImage(file);
    setUploadingImage(false);

    if (success && res?.filename) {
      setUploadedImageFilename(res.filename);
      onShowToast('Sheet image successfully uploaded & stored.', 'success');
    } else {
      onShowToast(typeof res === 'string' ? res : 'Failed to upload sheet image.', 'error');
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setUploadedImageFilename(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Inventory Table helpers
  const handleInventoryChange = (index: number, field: keyof InventoryItem, value: string) => {
    const updated = [...inventory];
    updated[index] = { ...updated[index], [field]: value };
    setInventory(updated);
  };

  const addInventoryRow = () => {
    setInventory(prev => [
      ...prev,
      { sr: String(prev.length + 1), remarks: '', material: '', qty: '', rounded_qty: '' }
    ]);
  };

  const removeInventoryRow = (index: number) => {
    if (inventory.length <= 1) {
      setInventory([{ sr: '1', remarks: '', material: '', qty: '', rounded_qty: '' }]);
      return;
    }
    const updated = inventory.filter((_, i) => i !== index).map((row, i) => ({
      ...row,
      sr: String(i + 1)
    }));
    setInventory(updated);
  };

  // Test Table helpers
  const handleTestChange = (index: number, field: keyof TestItem, value: string) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], [field]: value };
    setTests(updated);
  };

  const addTestRow = () => {
    setTests(prev => [...prev, { method: '', standard: '', result: '' }]);
  };

  const removeTestRow = (index: number) => {
    if (tests.length <= 1) {
      setTests([{ method: '', standard: '', result: '' }]);
      return;
    }
    setTests(tests.filter((_, i) => i !== index));
  };

  // Total Calculations
  const totalQty = inventory.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const targetGramsNum = parseFloat(grams) || 100;
  const totalRounded = inventory.reduce((sum, item) => {
    const rowQty = parseFloat(item.qty) || 0;
    const finalQty = totalQty > 0 ? (rowQty / totalQty) * targetGramsNum : 0;
    const defaultR = Math.round(finalQty);
    return sum + (parseFloat(item.rounded_qty) || defaultR);
  }, 0);

  // Form Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBatchNo = batchNo.trim();
    if (!cleanBatchNo) {
      onShowToast('Batch No is required to create a Master Formulation.', 'error');
      return;
    }

    setSaving(true);

    const payload = {
      batch_no: cleanBatchNo,
      doc_no: docNo.trim(),
      review_no: reviewNo.trim(),
      review_date: reviewDate.trim(),
      issue_no: issueNo.trim(),
      issue_date: issueDate.trim(),
      ref_no: refNo.trim(),
      customer_name: customerName.trim(),
      formula_date: formulaDate,
      ref_book_no: refBookNo.trim(),
      grams: parseFloat(grams) || 100.0,
      packaging: packaging.trim(),
      viscosity: viscosity.trim(),
      density: density.trim(),
      ratio: ratio.trim(),
      filtration: filtration.trim(),
      remarks: remarks.trim(),
      sender: sender.trim(),
      approval: approval.trim(),
      date: date || formulaDate,
      time: time.trim(),
      inventory: inventory
        .filter(item => item.material.trim() !== '' || item.qty.trim() !== '')
        .map((item, idx) => {
          const rowQty = parseFloat(item.qty) || 0;
          const finalQty = totalQty > 0 ? ((rowQty / totalQty) * targetGramsNum).toFixed(2) : '0.00';
          const defaultRounded = Math.round(parseFloat(finalQty));
          return {
            sr: String(idx + 1),
            remarks: item.remarks || '',
            material: item.material || '',
            raw_material: item.material || '',
            qty: item.qty || '',
            rounded_qty: item.rounded_qty || String(defaultRounded)
          };
        }),
      tests: tests
        .filter(t => t.method.trim() !== '' || t.result.trim() !== '')
        .map(t => ({
          method: t.method || '',
          standard: t.standard || '',
          result: t.result || ''
        })),
      image_references: uploadedImageFilename ? [uploadedImageFilename] : []
    };

    const [success, res] = await MasterFormulationAPI.createBatch(productName, payload);
    setSaving(false);

    if (success) {
      onShowToast(`Master formulation ${cleanBatchNo} created successfully!`, 'success');
      onSuccess(cleanBatchNo);
      onClose();
    } else {
      const errMsg = typeof res === 'string' ? res : 'Failed to create master formulation.';
      onShowToast(errMsg, 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '34px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const tableInputStyle: React.CSSProperties = {
    width: '100%',
    height: '30px',
    padding: '4px 8px',
    fontSize: '12px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  };

  const tableHeaderStyle: React.CSSProperties = {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155'
  };

  const tableCellStyle: React.CSSProperties = {
    border: '1px solid #cbd5e1',
    padding: '4px 6px',
    verticalAlign: 'middle'
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content animated-scale" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '1350px', 
          width: '95%', 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          padding: '16px 24px',
          color: '#ffffff',
          flexShrink: 0,
          borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scale size={22} color="#38bdf8" />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Create New Lab Master Formulation
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Product Scope: <strong style={{ color: '#38bdf8' }}>{productName.replace(/_/g, ' ').toUpperCase()}</strong>
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="modal-close-btn"
            style={{ color: '#94a3b8', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} style={{ flexGrow: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f8fafc' }}>
          
          {/* Top Section: Form Header, Target Quantity Recalculator, and Image Upload Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr', gap: '16px' }}>
            
            {/* Header Fields Card */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                <FileText size={16} color="#3b82f6" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Formulation Identification & Control
                </span>
              </div>

              {/* Document Control Header Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>DOC #</label>
                  <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)} style={{ ...inputStyle, height: '26px', fontSize: '11px', padding: '2px 6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>REVIEW #</label>
                  <input type="text" value={reviewNo} onChange={e => setReviewNo(e.target.value)} style={{ ...inputStyle, height: '26px', fontSize: '11px', padding: '2px 6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>REV DATE</label>
                  <input type="text" value={reviewDate} onChange={e => setReviewDate(e.target.value)} style={{ ...inputStyle, height: '26px', fontSize: '11px', padding: '2px 6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>ISSUE #</label>
                  <input type="text" value={issueNo} onChange={e => setIssueNo(e.target.value)} style={{ ...inputStyle, height: '26px', fontSize: '11px', padding: '2px 6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>ISSUE DATE</label>
                  <input type="text" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={{ ...inputStyle, height: '26px', fontSize: '11px', padding: '2px 6px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Batch No *</label>
                  <input 
                    type="text" 
                    required 
                    value={batchNo} 
                    onChange={e => setBatchNo(e.target.value)} 
                    style={{ ...inputStyle, fontWeight: 700, borderColor: '#3b82f6' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Ref No</label>
                  <input 
                    type="text" 
                    value={refNo} 
                    onChange={e => setRefNo(e.target.value)} 
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Customer Name</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Formula Date</label>
                  <input 
                    type="date" 
                    value={formulaDate} 
                    onChange={e => setFormulaDate(e.target.value)} 
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Ref Book No</label>
                  <input 
                    type="text" 
                    value={refBookNo} 
                    onChange={e => setRefBookNo(e.target.value)} 
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Standard Recalculator / Target Qty (Grams) Section (Matching OG Master Formulation) */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(to right bottom, #ffffff, #f8fafc)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                <RefreshCw size={16} color="#3b82f6" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Standard Recalculator
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                    Target Quantity (Grams)
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    value={grams} 
                    onChange={e => setGrams(e.target.value)} 
                    style={{ ...inputStyle, fontWeight: 'bold', fontSize: '14px', borderColor: '#3b82f6' }}
                  />
                </div>

                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Calculated Total Output:</span>
                  <strong style={{ fontSize: '14px', color: '#1d4ed8' }}>{targetGramsNum.toFixed(2)} Grams</strong>
                </div>
              </div>
            </div>

            {/* Permanent Sheet Image Upload Card */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={16} color="#8b5cf6" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    MF Sheet Photo / Scan
                  </span>
                </div>
                {uploadingImage && (
                  <span style={{ fontSize: '11px', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={12} className="spin-loader" /> Saving...
                  </span>
                )}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleFileSelect} 
              />

              {!imagePreviewUrl ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flexGrow: 1,
                    minHeight: '130px',
                    border: '2px dashed #94a3b8',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s ease',
                    padding: '16px',
                    textAlign: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#94a3b8'}
                >
                  <UploadCloud size={30} color="#8b5cf6" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Upload Master Formulation Sheet Photo
                  </span>
                </div>
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '130px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <img 
                    src={imagePreviewUrl} 
                    alt="Master sheet" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    opacity: 0.9
                  }}>
                    <button 
                      type="button" 
                      onClick={() => setPreviewZoomOpen(true)}
                      style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ZoomIn size={14} /> Preview
                    </button>
                    <button 
                      type="button" 
                      onClick={handleRemoveImage}
                      style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Standard Parameters Grid */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
              <Scale size={16} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Standard Parameters & Specifications
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Packaging</label>
                <input type="text" value={packaging} onChange={e => setPackaging(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Viscosity</label>
                <input type="text" value={viscosity} onChange={e => setViscosity(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Density</label>
                <input type="text" value={density} onChange={e => setDensity(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Ratio</label>
                <input type="text" value={ratio} onChange={e => setRatio(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Filtration</label>
                <input type="text" value={filtration} onChange={e => setFiltration(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Remarks & Instructions</label>
                <textarea 
                  rows={2} 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  style={{ ...inputStyle, height: '60px', resize: 'none', fontFamily: 'inherit' }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Sender</label>
                <input type="text" value={sender} onChange={e => setSender(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Approval</label>
                <input type="text" value={approval} onChange={e => setApproval(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Time</label>
                <input type="text" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Interactive Composition Table Matching OG Master Formulation Columns */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={16} color="#3b82f6" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Inventory Composition ({inventory.filter(i => i.material.trim()).length} Items)
                </span>
              </div>
              <button 
                type="button" 
                onClick={addInventoryRow}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} color="#10b981" /> Add Row
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, width: '45px', textAlign: 'center' }}>Sr</th>
                    <th style={{ ...tableHeaderStyle, width: '220px', textAlign: 'left' }}>Steps / Remarks</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Raw Material</th>
                    <th style={{ ...tableHeaderStyle, width: '110px', textAlign: 'right' }}>Original Qty</th>
                    <th style={{ ...tableHeaderStyle, width: '90px', textAlign: 'right' }}>% Form</th>
                    <th style={{ ...tableHeaderStyle, width: '110px', textAlign: 'right' }}>Final Qty</th>
                    <th style={{ ...tableHeaderStyle, width: '110px', textAlign: 'center' }}>Rounded Qty</th>
                    <th style={{ ...tableHeaderStyle, width: '45px', textAlign: 'center' }}>Act</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row, idx) => {
                    const rowQty = parseFloat(row.qty) || 0;
                    const pct = totalQty > 0 ? ((rowQty / totalQty) * 100).toFixed(2) : '0.00';
                    const finalQty = totalQty > 0 ? ((rowQty / totalQty) * targetGramsNum).toFixed(2) : '0.00';
                    const defaultRounded = Math.round(parseFloat(finalQty));
                    const currentRounded = row.rounded_qty || (rowQty > 0 ? String(defaultRounded) : '');

                    return (
                      <tr key={idx}>
                        <td style={{ ...tableCellStyle, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td style={tableCellStyle}>
                          <input 
                            type="text" 
                            style={tableInputStyle}
                            value={row.remarks} 
                            onChange={e => handleInventoryChange(idx, 'remarks', e.target.value)} 
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <input 
                            type="text" 
                            style={{ ...tableInputStyle, fontWeight: 600 }}
                            value={row.material} 
                            onChange={e => handleInventoryChange(idx, 'material', e.target.value)} 
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <input 
                            type="number" 
                            step="any"
                            style={{ ...tableInputStyle, textAlign: 'right' }}
                            value={row.qty} 
                            onChange={e => handleInventoryChange(idx, 'qty', e.target.value)} 
                          />
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'right', color: '#64748b', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                          {pct}%
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#f8fafc' }}>
                          {finalQty}
                        </td>
                        <td style={tableCellStyle}>
                          <input 
                            type="text" 
                            style={{ ...tableInputStyle, textAlign: 'center', color: '#2563eb', fontWeight: 700 }}
                            value={currentRounded} 
                            onChange={e => handleInventoryChange(idx, 'rounded_qty', e.target.value)} 
                          />
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                          <button 
                            type="button" 
                            onClick={() => removeInventoryRow(idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={3} style={{ ...tableCellStyle, textAlign: 'right', color: '#0f172a', padding: '8px 10px' }}>
                      TOTALS:
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', color: '#475569', padding: '8px 10px' }}>
                      {totalQty.toFixed(2)}
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', color: '#475569', padding: '8px 10px' }}>
                      {totalQty > 0 ? '100.00%' : '0.00%'}
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', color: '#1d4ed8', padding: '8px 10px' }}>
                      {targetGramsNum.toFixed(2)}
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'center', color: '#1d4ed8', padding: '8px 10px' }}>
                      {totalRounded.toFixed(2)}
                    </td>
                    <td style={tableCellStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* QC / Quality Check Tests Table with Clean Borders */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quality Control Test Specifications
                </span>
              </div>
              <button 
                type="button" 
                onClick={addTestRow}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} color="#10b981" /> Add Test
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Test Parameter / Method</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Standard Specification Range</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Observed Result</th>
                    <th style={{ ...tableHeaderStyle, width: '50px', textAlign: 'center' }}>Act</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((testRow, idx) => (
                    <tr key={idx}>
                      <td style={tableCellStyle}>
                        <input 
                          type="text" 
                          style={{ ...tableInputStyle, fontWeight: 600 }}
                          value={testRow.method} 
                          onChange={e => handleTestChange(idx, 'method', e.target.value)} 
                        />
                      </td>
                      <td style={tableCellStyle}>
                        <input 
                          type="text" 
                          style={tableInputStyle}
                          value={testRow.standard} 
                          onChange={e => handleTestChange(idx, 'standard', e.target.value)} 
                        />
                      </td>
                      <td style={tableCellStyle}>
                        <input 
                          type="text" 
                          style={tableInputStyle}
                          value={testRow.result} 
                          onChange={e => handleTestChange(idx, 'result', e.target.value)} 
                        />
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeTestRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Remove test"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            borderTop: '1px solid #cbd5e1',
            paddingTop: '16px',
            marginTop: '8px'
          }}>
            <button 
              type="button" 
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #cbd5e1' }}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              style={{
                padding: '10px 28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
              }}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="spin-loader" /> Saving Master Formulation...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Save Master Formulation
                </>
              )}
            </button>
          </div>

        </form>

        {/* Zoom Modal for Attached Image Preview */}
        {previewZoomOpen && imagePreviewUrl && (
          <div 
            className="modal-overlay" 
            style={{ zIndex: 1200, background: 'rgba(0,0,0,0.85)' }} 
            onClick={() => setPreviewZoomOpen(false)}
          >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img 
                src={imagePreviewUrl} 
                alt="Enlarged Sheet" 
                style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} 
              />
              <button 
                type="button"
                onClick={() => setPreviewZoomOpen(false)}
                style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: '#ffffff', fontSize: '28px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
