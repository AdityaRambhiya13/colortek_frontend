import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, ZoomIn, ZoomOut, RotateCw, Maximize2, 
  ChevronLeft, ChevronRight, CheckCircle, AlertCircle, 
  Trash2, FastForward, Sparkles, RefreshCw, X, Layers, Check, ExternalLink, Save
} from 'lucide-react';
import { MasterFormulationAPI, LabFormulationsAPI } from '../../services/api';

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  batchNo: string;
  formulaDate: string;
  customerName: string;
  refNo: string;
  status: 'pending' | 'saving' | 'saved' | 'skipped' | 'error';
  errorMsg?: string;
  uploadedFilename?: string;
  detectedBatch?: string;
  detectedMaterials?: any[];
  detectingAi?: boolean;
}

interface BulkMasterUploadModalProps {
  isOpen: boolean;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenBatch?: (batchNo: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BulkMasterUploadModal: React.FC<BulkMasterUploadModalProps> = ({
  isOpen,
  productName,
  onClose,
  onSuccess,
  onOpenBatch,
  onShowToast
}) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [targetProductName, setTargetProductName] = useState<string>(productName || '');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Viewer controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const batchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation callback
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowRight' && (e.ctrlKey || e.altKey)) {
      e.preventDefault();
      if (currentIndex < queue.length - 1) setCurrentIndex(currentIndex + 1);
    } else if (e.key === 'ArrowLeft' && (e.ctrlKey || e.altKey)) {
      e.preventDefault();
      if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    }
  }, [isOpen, currentIndex, queue.length]);

  // Initialize or update product name
  useEffect(() => {
    if (productName && !targetProductName) {
      setTargetProductName(productName);
    }
  }, [productName, targetProductName]);

  // Focus batch number input when moving between images
  useEffect(() => {
    if (isOpen && queue.length > 0 && !isFinished) {
      const timer = setTimeout(() => {
        batchInputRef.current?.focus();
        batchInputRef.current?.select();
      }, 100);
      setZoomLevel(1);
      setRotation(0);
      setPanOffset({ x: 0, y: 0 });
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isOpen, queue.length, isFinished]);

  // Keyboard event listener
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const currentItem = queue[currentIndex] || null;

  // Add files to queue
  const handleFilesAdded = (files: FileList | File[]) => {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const newItems: QueueItem[] = [];
    const today = new Date().toISOString().split('T')[0];

    Array.from(files).forEach((file, idx) => {
      if (validImageTypes.includes(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `${Date.now()}_${idx}_${file.name}`,
          file,
          previewUrl,
          batchNo: '',
          formulaDate: today,
          customerName: '',
          refNo: '',
          status: 'pending'
        });
      }
    });

    if (newItems.length === 0) {
      onShowToast('Please select valid image files (JPG, PNG, WEBP, BMP).', 'warning');
      return;
    }

    setQueue(prev => [...prev, ...newItems]);
    setIsFinished(false);
    onShowToast(`Added ${newItems.length} image(s) to the studio queue.`, 'info');
  };

  // AI Auto-Detect Batch Number from sheet
  const handleRunAiDetection = async (itemIndex: number) => {
    const item = queue[itemIndex];
    if (!item || item.detectingAi) return;

    setQueue(prev => prev.map((q, idx) => idx === itemIndex ? { ...q, detectingAi: true } : q));

    try {
      const [success, res] = await LabFormulationsAPI.uploadOCRImage(item.file);
      if (success && res?.data) {
        const detectedBNo = res.data.batch_no || '';
        const detectedMats = res.data.materials || [];
        setQueue(prev => prev.map((q, idx) => {
          if (idx === itemIndex) {
            return {
              ...q,
              detectingAi: false,
              detectedBatch: detectedBNo,
              detectedMaterials: detectedMats,
              batchNo: q.batchNo || detectedBNo
            };
          }
          return q;
        }));
        if (detectedBNo) {
          onShowToast(`AI detected Batch No: ${detectedBNo}`, 'success');
        } else {
          onShowToast('AI scanned the sheet, but could not detect a clear batch number.', 'info');
        }
      } else {
        setQueue(prev => prev.map((q, idx) => idx === itemIndex ? { ...q, detectingAi: false } : q));
        onShowToast('AI detection failed or could not parse image text.', 'warning');
      }
    } catch {
      setQueue(prev => prev.map((q, idx) => idx === itemIndex ? { ...q, detectingAi: false } : q));
    }
  };

  // Advance to next image in queue
  const advanceNext = () => {
    const nextIdx = queue.findIndex((q, i) => i > currentIndex && q.status === 'pending');
    if (nextIdx !== -1) {
      setCurrentIndex(nextIdx);
    } else if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const anyPending = queue.some(q => q.status === 'pending');
      if (!anyPending) {
        setIsFinished(true);
      }
    }
  };

  // Save current batch
  const handleSaveBatch = async (andAdvance: boolean = true, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentItem) return;

    const cleanBatchNo = currentItem.batchNo.trim();
    if (!cleanBatchNo) {
      onShowToast('Please enter a Batch Number for this sheet before saving.', 'error');
      batchInputRef.current?.focus();
      return;
    }

    setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, status: 'saving' } : q));

    try {
      // 1. Upload image file to permanent store
      const [imgSuccess, imgRes] = await MasterFormulationAPI.uploadImage(currentItem.file);
      if (!imgSuccess || !imgRes?.filename) {
        const errorMsg = typeof imgRes === 'string' ? imgRes : 'Image upload failed.';
        setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, status: 'error', errorMsg } : q));
        onShowToast(`Failed to upload sheet for batch ${cleanBatchNo}: ${errorMsg}`, 'error');
        return;
      }

      const storedFilename = imgRes.filename;

      // 2. Prepare master formulation payload
      const prodName = targetProductName.trim() || productName.trim();
      const payload = {
        batch_no: cleanBatchNo,
        product_name: prodName,
        doc_no: 'DOC-MF-01',
        review_no: '03',
        review_date: '01.04.2025',
        issue_no: '01',
        issue_date: '01.04.2025',
        formula_date: currentItem.formulaDate,
        date: currentItem.formulaDate,
        customer_name: currentItem.customerName.trim(),
        ref_no: currentItem.refNo.trim(),
        grams: 100.0,
        inventory: (currentItem.detectedMaterials && currentItem.detectedMaterials.length > 0)
          ? currentItem.detectedMaterials.map((m: any, i: number) => ({
              sr: String(i + 1),
              material: m.material || '',
              raw_material: m.material || '',
              qty: String(m.qty || ''),
              rounded_qty: String(m.qty || ''),
              remarks: ''
            }))
          : [
              { sr: '1', material: '', raw_material: '', qty: '', rounded_qty: '', remarks: '' }
            ],
        tests: [
          { method: 'Viscosity', standard: '', result: '' },
          { method: 'Density', standard: '', result: '' },
          { method: 'Solid Content', standard: '', result: '' }
        ],
        image_references: [storedFilename]
      };

      // 3. Create master formulation record
      const [saveSuccess, saveRes] = await MasterFormulationAPI.createBatch(prodName, payload);

      if (saveSuccess) {
        setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { 
          ...q, 
          status: 'saved', 
          uploadedFilename: storedFilename,
          errorMsg: undefined 
        } : q));
        
        onShowToast(`✓ Master formulation '${cleanBatchNo}' created with sheet attached!`, 'success');

        if (andAdvance) {
          advanceNext();
        }
      } else {
        const errorMsg = typeof saveRes === 'string' ? saveRes : 'Failed to save master formulation.';
        setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, status: 'error', errorMsg } : q));
        onShowToast(`Error saving ${cleanBatchNo}: ${errorMsg}`, 'error');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unexpected error occurred';
      setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, status: 'error', errorMsg } : q));
      onShowToast(`Error: ${errorMsg}`, 'error');
    }
  };

  // Skip current image
  const handleSkip = () => {
    setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, status: 'skipped' } : q));
    onShowToast(`Skipped sheet #${currentIndex + 1}.`, 'info');
    advanceNext();
  };

  // Go to previous image
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Remove specific item from queue
  const handleRemoveFromQueue = (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = queue[idxToRemove];
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    const updated = queue.filter((_, i) => i !== idxToRemove);
    setQueue(updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
  };

  // Pan and Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoomLevel(prev => Math.min(Math.max(0.5, prev + delta), 4.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const savedItems = queue.filter(q => q.status === 'saved');
  const savedCount = savedItems.length;
  const skippedCount = queue.filter(q => q.status === 'skipped').length;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFilesAdded(e.dataTransfer.files);
        }
      }}
    >
      <div 
        style={{
          width: '98%',
          maxWidth: '1480px',
          height: '94vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
            }}>
              <Layers size={20} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Bulk Master Sheet Processing Studio
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#3b82f6', color: '#ffffff' }}>
                  LAB MASTER
                </span>
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Quickly inspect physical scans, enter batch numbers, and build master formulations in sequence
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {queue.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.08)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span>Saved: <strong style={{ color: '#10b981' }}>{savedCount}</strong> / {queue.length}</span>
                {skippedCount > 0 && <span style={{ color: '#94a3b8' }}>({skippedCount} skipped)</span>}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <UploadCloud size={15} /> Add More Files
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdded(e.target.files);
                }
              }} 
            />

            <button
              onClick={() => {
                if (savedCount > 0) onSuccess();
                onClose();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px'
              }}
              title="Close Studio"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Main Body */}
        {queue.length === 0 ? (
          /* Empty Initial Dropzone */
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              backgroundColor: isDragging ? '#f0fdf4' : '#f8fafc',
              border: isDragging ? '3px dashed #10b981' : '2px dashed #cbd5e1',
              margin: '24px',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center',
              gap: '16px'
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7'
            }}>
              <UploadCloud size={44} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                Drop all transferred batch sheet photos here
              </h3>
              <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '8px 0 0' }}>
                or click to browse and select 1 to 50+ photos from your laptop folder
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '16px',
              marginTop: '12px',
              fontSize: '0.82rem',
              color: '#475569',
              background: '#ffffff',
              padding: '8px 20px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <span>✓ Supports JPG, PNG, WEBP, BMP</span>
              <span>✓ Bulk multi-file upload</span>
              <span>✓ Built-in High-Def Zoom & AI Auto-Read</span>
            </div>
          </div>
        ) : isFinished ? (
          /* Finished Summary Screen with Direct Batch List & View Links */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            backgroundColor: '#f8fafc',
            textAlign: 'center',
            gap: '16px',
            overflowY: 'auto'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a'
            }}>
              <Check size={40} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                Master Formulation Processing Complete!
              </h2>
              <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '6px 0 0' }}>
                Successfully created <strong>{savedCount}</strong> master formulation records with attached physical sheet photos.
              </p>
            </div>

            {/* List of Saved Batches */}
            {savedItems.length > 0 && (
              <div style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '260px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                padding: '12px'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textAlign: 'left', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Saved Formulations:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedItems.map((item, i) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>#{i + 1}</span>
                        <div style={{ textAlign: 'left' }}>
                          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.batchNo}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>({targetProductName || productName})</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                          ✓ Saved in DB
                        </span>
                        {onOpenBatch && (
                          <button
                            type="button"
                            onClick={() => onOpenBatch(item.batchNo)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#3b82f6',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <ExternalLink size={12} /> Open Batch
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setIsFinished(false);
                  setCurrentIndex(0);
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Review Items
              </button>
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                Return to Lab Master Formulations
              </button>
            </div>
          </div>
        ) : (
          /* Active Split Studio: Image Viewer (Left) + Batch Info Form (Right) */
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 400px', minHeight: 0, backgroundColor: '#f1f5f9' }}>
            
            {/* Left: High-Res Interactive Pan & Zoom Viewer */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', borderRight: '1px solid #e2e8f0', backgroundColor: '#0f172a' }}>
              
              {/* Viewer Floating Controls Bar */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                padding: '6px 14px',
                borderRadius: '30px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)'
              }}>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 4.5))}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Zoom In"
                >
                  <ZoomIn size={18} />
                </button>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, minWidth: '45px', textAlign: 'center' }}>
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={18} />
                </button>
                <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <button
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Rotate 90°"
                >
                  <RotateCw size={18} />
                </button>
                <button
                  onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); setRotation(0); }}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Reset View"
                >
                  <Maximize2 size={18} />
                </button>
              </div>

              {/* View Canvas */}
              <div 
                ref={viewerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: isPanning ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
              >
                {currentItem && (
                  <img
                    src={currentItem.previewUrl}
                    alt="Physical Sheet Preview"
                    draggable={false}
                    style={{
                      maxWidth: '92%',
                      maxHeight: '92%',
                      objectFit: 'contain',
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      borderRadius: '4px'
                    }}
                  />
                )}
              </div>

              {/* Top-Left Image Label */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '20px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#e2e8f0',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                📄 File: <strong>{currentItem?.file.name}</strong> ({(currentItem?.file.size ? (currentItem.file.size / 1024).toFixed(1) : 0)} KB)
              </div>
            </div>

            {/* Right: Formulation Quick Entry Panel */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              height: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Form Scroll Container */}
              <form onSubmit={(e) => handleSaveBatch(true, e)} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Progress Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sheet {currentIndex + 1} of {queue.length}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    backgroundColor: currentItem?.status === 'saved' ? '#dcfce7' : currentItem?.status === 'skipped' ? '#f1f5f9' : '#eff6ff',
                    color: currentItem?.status === 'saved' ? '#166534' : currentItem?.status === 'skipped' ? '#64748b' : '#1d4ed8'
                  }}>
                    {currentItem?.status === 'saved' ? '✓ Saved' : currentItem?.status === 'skipped' ? 'Skipped' : 'Active'}
                  </span>
                </div>

                {/* Saved Confirmation Banner if already saved */}
                {currentItem?.status === 'saved' && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '0.88rem' }}>
                      <CheckCircle size={18} color="#16a34a" />
                      <span>✓ Saved in Database: {currentItem.batchNo}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#15803d' }}>
                      This master formulation is permanently stored with its physical sheet photo attached.
                    </p>
                    {onOpenBatch && (
                      <button
                        type="button"
                        onClick={() => onOpenBatch(currentItem.batchNo)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <ExternalLink size={13} /> Open & View Specification
                      </button>
                    )}
                  </div>
                )}

                {/* AI Detection Card */}
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}>
                      <Sparkles size={16} color="#059669" />
                      <span>AI Sheet Assistant</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRunAiDetection(currentIndex)}
                      disabled={currentItem?.detectingAi}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {currentItem?.detectingAi ? <RefreshCw size={12} className="spin-loader" /> : <Sparkles size={12} />}
                      {currentItem?.detectingAi ? 'Scanning...' : 'Auto-Read Batch #'}
                    </button>
                  </div>
                  {currentItem?.detectedBatch && (
                    <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                      Detected Batch: <strong>{currentItem.detectedBatch}</strong>
                    </div>
                  )}
                </div>

                {/* Primary Input: Batch Number */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                    <span>BATCH NUMBER *</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>(Read from image)</span>
                  </label>
                  <input
                    ref={batchInputRef}
                    type="text"
                    required
                    placeholder="e.g. A-5863 or 24-B102"
                    value={currentItem?.batchNo || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, batchNo: val } : q));
                    }}
                    style={{
                      height: '42px',
                      padding: '8px 14px',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: '2px solid #3b82f6',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)'
                    }}
                  />
                </div>

                {/* Product Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    PRODUCT WORKSPACE
                  </label>
                  <input
                    type="text"
                    value={targetProductName}
                    onChange={(e) => setTargetProductName(e.target.value)}
                    style={{
                      height: '34px',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155'
                    }}
                  />
                </div>

                {/* Formula Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    FORMULA / TEST DATE
                  </label>
                  <input
                    type="date"
                    value={currentItem?.formulaDate || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, formulaDate: val } : q));
                    }}
                    style={{
                      height: '34px',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>

                {/* Optional Customer Name & Ref No */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Customer (Opt.)</label>
                    <input
                      type="text"
                      placeholder="e.g. Asian Paints"
                      value={currentItem?.customerName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, customerName: val } : q));
                      }}
                      style={{ height: '32px', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Ref No (Opt.)</label>
                    <input
                      type="text"
                      placeholder="e.g. R-102"
                      value={currentItem?.refNo || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQueue(prev => prev.map((q, idx) => idx === currentIndex ? { ...q, refNo: val } : q));
                      }}
                      style={{ height: '32px', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                {/* Detected Materials indicator if present */}
                {currentItem?.detectedMaterials && currentItem.detectedMaterials.length > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
                    ✓ {currentItem.detectedMaterials.length} raw materials detected by AI and will be pre-populated.
                  </div>
                )}

                {/* Error Banner if any */}
                {currentItem?.errorMsg && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} />
                    <span>{currentItem.errorMsg}</span>
                  </div>
                )}

                {/* Actions Block */}
                <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Primary Save & Next Button */}
                  <button
                    type="submit"
                    disabled={currentItem?.status === 'saving'}
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {currentItem?.status === 'saving' ? (
                      <>
                        <RefreshCw size={18} className="spin-loader" /> Saving Master Formulation...
                      </>
                    ) : (
                      <>
                        <Save size={18} /> Save Batch & Next ➔ (Enter ↵)
                      </>
                    )}
                  </button>

                  {/* Secondary Save Only Button */}
                  <button
                    type="button"
                    onClick={(e) => handleSaveBatch(false, e)}
                    disabled={currentItem?.status === 'saving'}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={15} /> Save This Batch (Stay on Page)
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleSkip}
                      style={{
                        height: '34px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        color: '#64748b',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <FastForward size={14} /> Skip Sheet
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFromQueue(currentIndex, e)}
                      style={{
                        height: '34px',
                        borderRadius: '8px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fff5f5',
                        color: '#ef4444',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={14} /> Remove File
                    </button>
                  </div>
                </div>

              </form>

              {/* Navigation Controls Bar */}
              <div style={{
                padding: '12px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePrevious}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: currentIndex === 0 ? '#94a3b8' : '#334155',
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Image {currentIndex + 1} / {queue.length}
                </span>

                <button
                  type="button"
                  disabled={currentIndex === queue.length - 1}
                  onClick={advanceNext}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: currentIndex === queue.length - 1 ? '#94a3b8' : '#334155',
                    cursor: currentIndex === queue.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* Bottom Thumbnail Strip */}
        {queue.length > 0 && !isFinished && (
          <div style={{
            height: '84px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 16px',
            overflowX: 'auto',
            flexShrink: 0
          }}>
            {queue.map((item, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    position: 'relative',
                    width: '90px',
                    height: '62px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: isActive ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none',
                    opacity: item.status === 'skipped' ? 0.4 : 1,
                    transition: 'all 0.15s ease',
                    backgroundColor: '#1e293b'
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt={`Thumb ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '2px 4px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                    fontSize: '9px',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>#{idx + 1}</span>
                    {item.status === 'saved' ? (
                      <span style={{ color: '#4ade80' }}>✓ {item.batchNo || 'Saved'}</span>
                    ) : item.status === 'skipped' ? (
                      <span style={{ color: '#94a3b8' }}>Skip</span>
                    ) : (
                      <span style={{ color: '#60a5fa' }}>{item.batchNo ? item.batchNo : 'New'}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
