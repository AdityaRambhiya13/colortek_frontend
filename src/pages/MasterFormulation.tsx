import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, Calendar, RefreshCw, 
  Download, Edit3, CheckCircle, Scale, Eye, ChevronLeft, ChevronRight, Play, Info,
  Plus, Image as ImageIcon, ZoomIn, UploadCloud, Trash2, Layers
} from 'lucide-react';
import { MasterFormulationAPI, LabFormulationsAPI, API_BASE_URL } from '../services/api';
import { CreateMasterModal } from '../components/master_formulation/CreateMasterModal';
import { BulkMasterUploadModal } from '../components/master_formulation/BulkMasterUploadModal';
import { generateAndDownloadMasterFormulationExcel } from '../utils/masterFormulationExcel';

interface MasterFormulationProps {
  viewMode: string; // 'master_formulation' (view/edit) or 'mf_production' (production formula reference)
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onChangeView?: (view: string) => void;
}

export const MasterFormulation: React.FC<MasterFormulationProps> = ({ viewMode, onShowToast, onChangeView }) => {
  const productName = sessionStorage.getItem('product_name') || '';

  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination states matching mf.py local pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputVal, setPageInputVal] = useState('1');
  const batchesPerPage = 500;

  // Selected Batch Detail view
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Field states for standard and lab master formulation
  const [docNo, setDocNo] = useState('DOC-MF-01');
  const [reviewNo, setReviewNo] = useState('03');
  const [reviewDate, setReviewDate] = useState('01.04.2025');
  const [issueNo, setIssueNo] = useState('01');
  const [issueDate, setIssueDate] = useState('01.04.2025');
  const [customerName, setCustomerName] = useState('');
  const [refNo, setRefNo] = useState('');
  const [formulaDate, setFormulaDate] = useState('');
  const [formProductName, setFormProductName] = useState('');

  // Edit Field binds for all parameters in master formulation specification
  const [density, setDensity] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [refBookNo, setRefBookNo] = useState('');
  const [packaging, setPackaging] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [ratio, setRatio] = useState('');
  const [filtration, setFiltration] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sender, setSender] = useState('');
  const [approval, setApproval] = useState('');

  // Grams recalculation
  const [grams, setGrams] = useState('100');
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [localInventory, setLocalInventory] = useState<any[]>([]);
  const autosaveTimer = useRef<number | null>(null);

  // Attached Physical Sheet Images
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

  const roleString = sessionStorage.getItem('user_roles') || sessionStorage.getItem('role') || sessionStorage.getItem('user_role') || '';
  const username = (sessionStorage.getItem('username') || '').toLowerCase();
  const roles = roleString.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
  const isAdmin = roles.includes('admin') || roles.includes('all') || username === 'admin' || username === 'adi' || roles.length >= 5;
  const [approving, setApproving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Deletion states
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteFormulation = (targetBatchNo?: string | null, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const batchToDelete = typeof targetBatchNo === 'string' && targetBatchNo ? targetBatchNo : selectedBatch;
    if (!batchToDelete) return;
    setDeletingBatch(batchToDelete);
  };

  const confirmDeleteFormulation = async () => {
    if (!deletingBatch) return;
    setIsDeleting(true);
    // Try MasterFormulationAPI first (which handles all MF tables), fallback to LabFormulationsAPI
    let [success, resDataOrMsg] = await MasterFormulationAPI.deleteBatch(productName, deletingBatch);
    if (!success) {
      const [lmfSuccess, lmfMsg] = await LabFormulationsAPI.deleteLmfBatch(productName, deletingBatch);
      if (lmfSuccess) {
        success = true;
      } else {
        resDataOrMsg = lmfMsg;
      }
    }
    setIsDeleting(false);
    
    if (success) {
      onShowToast(`Master formulation '${deletingBatch}' deleted successfully.`, 'success');
      if (selectedBatch === deletingBatch) {
        setSelectedBatch(null);
        setDetailData(null);
      }
      setDeletingBatch(null);
      loadMasterList();
    } else {
      const msg = typeof resDataOrMsg === 'string' ? resDataOrMsg : 'Failed to delete master formulation.';
      onShowToast(msg, 'error');
    }
  };

  const handleAddInventoryRow = () => {
    const newRow = {
      sr: String(localInventory.length + 1),
      remarks: '',
      material: '',
      raw_material: '',
      qty: '0',
      rounded_qty: ''
    };
    const updated = [...localInventory, newRow];
    setLocalInventory(updated);
    triggerAutosave(updated);
  };

  const handleRemoveInventoryRow = (removeIdx: number) => {
    if (localInventory.length <= 1) {
      const reset = [{ sr: '1', remarks: '', material: '', raw_material: '', qty: '0', rounded_qty: '' }];
      setLocalInventory(reset);
      triggerAutosave(reset);
      return;
    }
    const updated = localInventory.filter((_, i) => i !== removeIdx).map((item, i) => ({
      ...item,
      sr: String(i + 1)
    }));
    setLocalInventory(updated);
    triggerAutosave(updated);
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number, col: 'remarks' | 'mat' | 'qty' | 'rounded') => {
    const len = localInventory.length;
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (col === 'rounded') {
          e.preventDefault();
          const target = isEditing ? `mf-qty-${idx}` : `mf-remarks-${idx}`;
          const prev = document.getElementById(target) as HTMLInputElement;
          if (prev) { prev.focus(); prev.select(); }
        } else if (col === 'qty') {
          e.preventDefault();
          const prev = document.getElementById(`mf-mat-${idx}`) as HTMLInputElement;
          if (prev) { prev.focus(); prev.select(); }
        } else if (col === 'mat') {
          e.preventDefault();
          const prev = document.getElementById(`mf-remarks-${idx}`) as HTMLInputElement;
          if (prev) { prev.focus(); prev.select(); }
        } else if (col === 'remarks' && idx > 0) {
          e.preventDefault();
          const prev = document.getElementById(`mf-rounded-${idx - 1}`) as HTMLInputElement;
          if (prev) { prev.focus(); prev.select(); }
        }
      } else {
        if (col === 'remarks') {
          e.preventDefault();
          const target = isEditing ? `mf-mat-${idx}` : `mf-rounded-${idx}`;
          const next = document.getElementById(target) as HTMLInputElement;
          if (next) { next.focus(); next.select(); }
        } else if (col === 'mat') {
          e.preventDefault();
          const next = document.getElementById(`mf-qty-${idx}`) as HTMLInputElement;
          if (next) { next.focus(); next.select(); }
        } else if (col === 'qty') {
          e.preventDefault();
          const next = document.getElementById(`mf-rounded-${idx}`) as HTMLInputElement;
          if (next) { next.focus(); next.select(); }
        } else if (col === 'rounded' && idx < len - 1) {
          e.preventDefault();
          const next = document.getElementById(`mf-remarks-${idx + 1}`) as HTMLInputElement;
          if (next) { next.focus(); next.select(); }
        }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (idx < len - 1) {
        const next = document.getElementById(`mf-${col}-${idx + 1}`) as HTMLInputElement;
        if (next) { next.focus(); next.select(); }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        const prev = document.getElementById(`mf-${col}-${idx - 1}`) as HTMLInputElement;
        if (prev) { prev.focus(); prev.select(); }
      }
    }
  };

  const handleApproveFormulation = async (targetBatchNo?: string, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const batchToApprove = typeof targetBatchNo === 'string' && targetBatchNo ? targetBatchNo : selectedBatch;
    if (!batchToApprove) return;
    setApproving(true);
    const [success, resDataOrMsg] = await MasterFormulationAPI.approveBatch(productName, batchToApprove);
    setApproving(false);
    if (success) {
      onShowToast(`Master formulation ${batchToApprove} successfully approved by Admin and released to Production!`, 'success');
      if (selectedBatch === batchToApprove) {
        loadBatchDetails(batchToApprove);
      }
      loadMasterList();
    } else {
      const msg = typeof resDataOrMsg === 'string' ? resDataOrMsg : 'Failed to approve master formulation.';
      onShowToast(msg, 'error');
    }
  };

  const getRecordValue = (key: string, defaultVal = '') => {
    if (!detailData) return defaultVal;
    const form = detailData.form || {};
    const variations = [
      key,
      key.toLowerCase(),
      key.toUpperCase(),
      key.replace(/_/g, ' ').toLowerCase(),
      key.replace(/_/g, ' ').toUpperCase(),
      key.replace(/\s+/g, '_').toLowerCase(),
      key.replace(/\s+/g, '_').toUpperCase()
    ];
    for (const k of variations) {
      if (form[k] !== undefined && form[k] !== null && String(form[k]).trim() !== '') {
        return String(form[k]);
      }
    }
    // Check top level
    const topVariations = [key, key.toLowerCase(), key.toUpperCase()];
    for (const k of topVariations) {
      if (detailData[k] !== undefined && detailData[k] !== null && String(detailData[k]).trim() !== '') {
        return String(detailData[k]);
      }
    }
    return defaultVal;
  };

  const loadMasterList = async () => {
    setLoading(true);
    const onlyApproved = viewMode === 'mf_production';
    const isLabMf = viewMode === 'lab_master_formulation';
    const [success, data] = await MasterFormulationAPI.getBatchList(productName, fromDate, toDate, searchTerm, onlyApproved, isLabMf);
    setLoading(false);

    if (success && typeof data !== 'string') {
      setBatches(data || []);
      setCurrentPage(1);
      setPageInputVal('1');
    } else {
      onShowToast('Failed to fetch Master Formulations.', 'error');
    }
  };

  useEffect(() => {
    loadMasterList();
  }, [fromDate, toDate, searchTerm, viewMode]);

  // Load detailed specifications
  const loadBatchDetails = async (batchNo: string) => {
    setLoading(true);
    const isLabMf = viewMode === 'lab_master_formulation';
    const [success, data] = await MasterFormulationAPI.getBatchDetail(productName, batchNo, isLabMf);
    setLoading(false);

    if (success && typeof data !== 'string') {
      setSelectedBatch(batchNo);
      setDetailData(data);
      setIsEditing(false);
      setAutosaveStatus('');

      const form = data.form || {};

      // Document Control
      setDocNo(data.doc_no || form.doc_no || form['DOC #'] || form['doc_no'] || 'DOC-MF-01');
      setReviewNo(data.review_no || form.review_no || form['REVIEW'] || form['review_no'] || '03');
      setReviewDate(data.review_date || form.review_date || form['REVIEW DATE'] || form['review_date'] || '01.04.2025');
      setIssueNo(data.issue_no || form.issue_no || form['ISSUE'] || form['issue_no'] || '01');
      setIssueDate(data.issue_date || form.issue_date || form['ISSUE DATE'] || form['issue_date'] || '01.04.2025');

      // Formulation Identification
      const initialProd = data.product_name || form.product_name || form['PRODUCT NAME'] || form.product || getRecordValue('product_name', productName);
      setFormProductName(initialProd);
      setCustomerName(data.customer_name || form.customer_name || form['CUSTOMER NAME'] || form.customer || '');
      setRefNo(data.ref_no || form.ref_no || form['REF NO'] || '');
      setFormulaDate(data.formula_date || form.formula_date || form['FORMULA DATE'] || data.date || form.date || '');

      // Load all parameter fields
      setDensity(data.density || form.density || form.DENSITY || '');
      setViscosity(data.viscosity || form.viscosity || form.VISCOSITY || '');
      setRefBookNo(data.ref_book_no || form.ref_book_no || form['REF BOOK NO'] || '');
      setPackaging(data.packaging || form.packaging || form.PACKAGING || '');
      setDate(data.date || form.date || form.DATE || '');
      setTime(data.time || form.time || form.TIME || '');
      setRatio(data.ratio || form.ratio || form.RATIO || '');
      setFiltration(data.filtration || form.filtration || form.FILTERATION || '');
      setRemarks(form.remarks || form.REMARK || data.remarks || '');
      setSender(form.sender || form.SENDER || data.sender || '');
      setApproval(form.approval || form.APPROVAL || data.approval || '');
      
      setGrams(String(data.grams || form['QUANTITY (Grams)'] || '100'));
      setLocalInventory(data.inventory || []);

      const imgs: string[] = data.image_references || form.image_references || [];
      setAttachedImages(imgs);
    } else {
      onShowToast('Could not load formulation details.', 'error');
    }
  };

  // Upload image handler for detail view
  const handleDetailImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const [success, res] = await MasterFormulationAPI.uploadImage(file);
    setUploadingImage(false);

    if (success && res?.filename) {
      const newImages = [...attachedImages, res.filename];
      setAttachedImages(newImages);

      if (selectedBatch && detailData) {
        const updatedPayload = {
          form: {
            ...(detailData.form || {}),
            image_references: newImages
          },
          inventory: localInventory.map(item => ({
            material: item.material || item.raw_material || '',
            qty: item.qty || 0,
            percent: item.percent || '',
            final_qty: item.final_qty || '',
            rounded_qty: item.rounded_qty || '',
            remarks: item.remarks || ''
          })),
          tests: detailData.tests || [],
          image_references: newImages,
          grams: parseFloat(grams) || 100.0,
          doc_no: docNo,
          review_no: reviewNo,
          review_date: reviewDate,
          issue_no: issueNo,
          issue_date: issueDate,
          customer_name: customerName,
          ref_no: refNo,
          formula_date: formulaDate,
          date,
          time,
          ref_book_no: refBookNo,
          packaging,
          viscosity,
          density,
          ratio,
          filtration,
          remarks,
          sender,
          approval
        };
        await MasterFormulationAPI.updateBatch(productName, selectedBatch, updatedPayload);
        setDetailData({ ...detailData, image_references: newImages, form: { ...(detailData.form || {}), image_references: newImages } });
      }
      onShowToast('Physical sheet photo uploaded and attached successfully!', 'success');
    } else {
      onShowToast(typeof res === 'string' ? res : 'Failed to upload sheet image.', 'error');
    }
    if (detailFileInputRef.current) detailFileInputRef.current.value = '';
  };

  // Remove image handler for detail view
  const handleRemoveDetailImage = async (imgIdx: number) => {
    const newImages = attachedImages.filter((_, idx) => idx !== imgIdx);
    setAttachedImages(newImages);
    if (selectedBatch && detailData) {
      const updatedPayload = {
        form: {
          ...(detailData.form || {}),
          image_references: newImages
        },
        inventory: localInventory.map(item => ({
          material: item.material || item.raw_material || '',
          qty: item.qty || 0,
          percent: item.percent || '',
          final_qty: item.final_qty || '',
          rounded_qty: item.rounded_qty || '',
          remarks: item.remarks || ''
        })),
        tests: detailData.tests || [],
        image_references: newImages,
        grams: parseFloat(grams) || 100.0,
        doc_no: docNo,
        review_no: reviewNo,
        review_date: reviewDate,
        issue_no: issueNo,
        issue_date: issueDate,
        customer_name: customerName,
        ref_no: refNo,
        formula_date: formulaDate,
        date,
        time,
        ref_book_no: refBookNo,
        packaging,
        viscosity,
        density,
        ratio,
        filtration,
        remarks,
        sender,
        approval
      };
      await MasterFormulationAPI.updateBatch(productName, selectedBatch, updatedPayload);
      setDetailData({ ...detailData, image_references: newImages, form: { ...(detailData.form || {}), image_references: newImages } });
      onShowToast('Image removed from formulation.', 'info');
    }
  };

  // Unified debounced autosave matching 1500ms debounce in mf.py
  const triggerAutosave = (
    currentInv = localInventory,
    currentParams = { 
      docNo, reviewNo, reviewDate, issueNo, issueDate, customerName, refNo, formulaDate, formProductName,
      density, viscosity, refBookNo, packaging, date, time, ratio, filtration, remarks, sender, approval, grams 
    }
  ) => {
    setAutosaveStatus('Saving recipe changes...');
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    
    autosaveTimer.current = window.setTimeout(async () => {
      if (!selectedBatch || !detailData) return;
      
      const cleanProdName = (viewMode === 'lab_master_formulation' && currentParams.formProductName ? currentParams.formProductName.trim() : '') || productName;

      const updatedForm = {
        ...(detailData.form || {}),
        product_name: cleanProdName,
        'PRODUCT NAME': cleanProdName,
        'product': cleanProdName,
        doc_no: currentParams.docNo,
        'DOC #': currentParams.docNo,
        review_no: currentParams.reviewNo,
        'REVIEW': currentParams.reviewNo,
        review_date: currentParams.reviewDate,
        'REVIEW DATE': currentParams.reviewDate,
        issue_no: currentParams.issueNo,
        'ISSUE': currentParams.issueNo,
        issue_date: currentParams.issueDate,
        'ISSUE DATE': currentParams.issueDate,
        customer_name: currentParams.customerName,
        'CUSTOMER NAME': currentParams.customerName,
        ref_no: currentParams.refNo,
        'REF NO': currentParams.refNo,
        formula_date: currentParams.formulaDate,
        'FORMULA DATE': currentParams.formulaDate,
        'REF BOOK NO': currentParams.refBookNo,
        'ref_book_no': currentParams.refBookNo,
        remarks: currentParams.remarks,
        sender: currentParams.sender,
        approval: currentParams.approval,
        packaging: currentParams.packaging,
        viscosity: currentParams.viscosity,
        density: currentParams.density,
        ratio: currentParams.ratio,
        filtration: currentParams.filtration,
        date: currentParams.date,
        time: currentParams.time,
        'QUANTITY (Grams)': currentParams.grams,
        image_references: attachedImages
      };

      const updatedPayload = {
        form: updatedForm,
        product_name: cleanProdName,
        new_product_name: cleanProdName,
        inventory: currentInv.map(item => ({
          material: item.material || item.raw_material || '',
          qty: item.qty || 0,
          percent: item.percent || '',
          final_qty: item.final_qty || '',
          rounded_qty: item.rounded_qty || '',
          remarks: item.remarks || ''
        })),
        tests: detailData.tests || [],
        image_references: attachedImages,
        grams: parseFloat(currentParams.grams) || 100.0,
        doc_no: currentParams.docNo,
        review_no: currentParams.reviewNo,
        review_date: currentParams.reviewDate,
        issue_no: currentParams.issueNo,
        issue_date: currentParams.issueDate,
        customer_name: currentParams.customerName,
        ref_no: currentParams.refNo,
        formula_date: currentParams.formulaDate,
        date: currentParams.date,
        time: currentParams.time,
        ref_book_no: currentParams.refBookNo,
        packaging: currentParams.packaging,
        viscosity: currentParams.viscosity,
        density: currentParams.density,
        ratio: currentParams.ratio,
        filtration: currentParams.filtration,
        remarks: currentParams.remarks,
        sender: currentParams.sender,
        approval: currentParams.approval
      };
      
      const isLabMf = viewMode === 'lab_master_formulation';
      const updateApi = isLabMf ? LabFormulationsAPI.updateLmfBatch : MasterFormulationAPI.updateBatch;
      const [success, resDataOrMsg] = await updateApi(productName, selectedBatch, updatedPayload);
      if (success) {
        setAutosaveStatus('✓ Recipe changes saved automatically');
        setTimeout(() => setAutosaveStatus(''), 3000);
      } else {
        const errorMsg = typeof resDataOrMsg === 'string' ? resDataOrMsg : 'Failed to autosave changes';
        console.error('Master formulation autosave error:', errorMsg);
        setAutosaveStatus(`✗ ${errorMsg}`);
      }
    }, 1500);
  };

  // State changes for params trigger autosave
  const handleParamChange = (field: string, val: string) => {
    const params = { 
      docNo, reviewNo, reviewDate, issueNo, issueDate, customerName, refNo, formulaDate, formProductName,
      density, viscosity, refBookNo, packaging, date, time, ratio, filtration, remarks, sender, approval, grams 
    };
    params[field as keyof typeof params] = val;
    
    if (field === 'formProductName') setFormProductName(val);
    else if (field === 'docNo') setDocNo(val);
    else if (field === 'reviewNo') setReviewNo(val);
    else if (field === 'reviewDate') setReviewDate(val);
    else if (field === 'issueNo') setIssueNo(val);
    else if (field === 'issueDate') setIssueDate(val);
    else if (field === 'customerName') setCustomerName(val);
    else if (field === 'refNo') setRefNo(val);
    else if (field === 'formulaDate') setFormulaDate(val);
    else if (field === 'density') setDensity(val);
    else if (field === 'viscosity') setViscosity(val);
    else if (field === 'refBookNo') setRefBookNo(val);
    else if (field === 'packaging') setPackaging(val);
    else if (field === 'date') setDate(val);
    else if (field === 'time') setTime(val);
    else if (field === 'ratio') setRatio(val);
    else if (field === 'filtration') setFiltration(val);
    else if (field === 'remarks') setRemarks(val);
    else if (field === 'sender') setSender(val);
    else if (field === 'approval') setApproval(val);
    else if (field === 'grams') setGrams(val);
    
    triggerAutosave(localInventory, params);
  };

  const handleInventoryChange = (idx: number, field: string, val: string) => {
    const updated = [...localInventory];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'material') {
      updated[idx].raw_material = val;
    }
    setLocalInventory(updated);
    triggerAutosave(updated);
  };

  // Immediate save on click
  const handleUpdateFormulation = async () => {
    if (!selectedBatch || !detailData) return;
    
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    
    const cleanProdName = (viewMode === 'lab_master_formulation' && formProductName ? formProductName.trim() : '') || productName;

    const updatedForm = {
      ...(detailData.form || {}),
      product_name: cleanProdName,
      'PRODUCT NAME': cleanProdName,
      'product': cleanProdName,
      doc_no: docNo,
      'DOC #': docNo,
      review_no: reviewNo,
      'REVIEW': reviewNo,
      review_date: reviewDate,
      'REVIEW DATE': reviewDate,
      issue_no: issueNo,
      'ISSUE': issueNo,
      issue_date: issueDate,
      'ISSUE DATE': issueDate,
      customer_name: customerName,
      'CUSTOMER NAME': customerName,
      ref_no: refNo,
      'REF NO': refNo,
      formula_date: formulaDate,
      'FORMULA DATE': formulaDate,
      'REF BOOK NO': refBookNo,
      'ref_book_no': refBookNo,
      remarks,
      sender,
      approval,
      packaging,
      viscosity,
      density,
      ratio,
      filtration,
      date,
      time,
      'QUANTITY (Grams)': grams,
      image_references: attachedImages
    };

    const updatedPayload = {
      form: updatedForm,
      product_name: cleanProdName,
      new_product_name: cleanProdName,
      inventory: localInventory.map(item => ({
        material: item.material || item.raw_material || '',
        qty: item.qty || 0,
        percent: item.percent || '',
        final_qty: item.final_qty || '',
        rounded_qty: item.rounded_qty || '',
        remarks: item.remarks || ''
      })),
      tests: detailData.tests || [],
      image_references: attachedImages,
      grams: parseFloat(grams) || 100.0,
      doc_no: docNo,
      review_no: reviewNo,
      review_date: reviewDate,
      issue_no: issueNo,
      issue_date: issueDate,
      customer_name: customerName,
      ref_no: refNo,
      formula_date: formulaDate,
      date,
      time,
      ref_book_no: refBookNo,
      packaging,
      viscosity,
      density,
      ratio,
      filtration,
      remarks,
      sender,
      approval
    };

    setLoading(true);
    const isLabMf = viewMode === 'lab_master_formulation';
    const updateApi = isLabMf ? LabFormulationsAPI.updateLmfBatch : MasterFormulationAPI.updateBatch;
    const [success, resDataOrMsg] = await updateApi(productName, selectedBatch, updatedPayload);
    setLoading(false);

    if (success) {
      onShowToast(`Master formulation ${selectedBatch} successfully updated.`, 'success');
      setIsEditing(false);
      loadBatchDetails(selectedBatch);
    } else {
      const errorMsg = typeof resDataOrMsg === 'string' ? resDataOrMsg : 'Failed to update formulation parameters.';
      onShowToast(errorMsg, 'error');
    }
  };

  // Fully formatted A4 Excel download matching the reference physical master sheet
  const exportMasterToExcel = (batchNo: string) => {
    if (!detailData) return;
    const isLab = viewMode === 'lab_master_formulation';

    generateAndDownloadMasterFormulationExcel({
      docNo,
      reviewNo,
      reviewDate,
      issueNo,
      issueDate,
      formulaDate: formulaDate || date,
      customerName,
      productName: (viewMode === 'lab_master_formulation' && formProductName ? formProductName : getRecordValue('product_name', productName)),
      batchNo,
      refNo,
      refBookNo,
      grams,
      packaging,
      viscosity,
      density,
      ratio,
      filtration,
      remarks,
      sender,
      approval,
      date,
      time,
      isLab,
      inventory: localInventory
    });

    onShowToast(`Master Excel recipe for batch ${batchNo} downloaded.`, 'success');
  };

  // Local client-side pagination matching Flet pagination
  const totalPages = Math.ceil(batches.length / batchesPerPage) || 1;
  const displayedBatches = batches.slice((currentPage - 1) * batchesPerPage, currentPage * batchesPerPage);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputVal(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(pageInputVal.trim());
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    } else {
      setPageInputVal(String(currentPage));
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
    setPageInputVal('1');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ----------------------------------------------------------------------
          MASTER FORMULATIONS LEDGER GRID TOOLBAR
          ---------------------------------------------------------------------- */}
      <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Logo / Header Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <BookOpen size={28} color="var(--primary-color)" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>
                {viewMode === 'mf_production' 
                  ? 'Production Formulations' 
                  : viewMode === 'lab_master_formulation' 
                    ? 'Lab Master Formulations' 
                    : 'Master Formulations'}
              </h3>
            </div>
            {viewMode === 'lab_master_formulation' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <Plus size={14} /> Create New Master
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.25)'
                  }}
                  title="Upload multiple physical sheet photos and review them sequentially"
                >
                  <Layers size={14} /> Bulk Upload Studio
                </button>
              </div>
            )}
          </div>

          {/* Filters Bar & Pagination */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {/* Date Filters */}
            <div className="form-input-container" style={{ width: '130px', marginBottom: 0 }}>
              <span className="form-label" style={{ fontSize: '10px' }}>From Date</span>
              <input type="date" className="field-input" style={{ height: '32px', fontSize: '12px' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            
            <div className="form-input-container" style={{ width: '130px', marginBottom: 0 }}>
              <span className="form-label" style={{ fontSize: '10px' }}>To Date</span>
              <input type="date" className="field-input" style={{ height: '32px', fontSize: '12px' }} value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

            {/* Batch Filter */}
            <div className="form-input-container" style={{ width: '150px', marginBottom: 0 }}>
              <span className="form-label" style={{ fontSize: '10px' }}>Filter Batch No</span>
              <input 
                type="text" 
                className="field-input" 
                style={{ height: '32px', fontSize: '12px' }}
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>

            {/* Actions */}
            <button onClick={handleClearFilters} className="flet-btn flet-btn-orange" style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}>
              Clear
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>

            {/* Pagination controls */}
            <button 
              disabled={currentPage === 1}
              onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); setPageInputVal(String(currentPage - 1)); }} 
              className="btn-secondary" 
              style={{ padding: '6px', border: 'none', background: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={18} />
            </button>

            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Page</span>
            
            <form onSubmit={handlePageInputSubmit} style={{ display: 'inline' }}>
              <input 
                type="text" 
                className="field-input" 
                style={{ width: '45px', height: '32px', textAlign: 'center', padding: '0 4px', fontSize: '12px' }} 
                value={pageInputVal} 
                onChange={handlePageInputChange} 
                onBlur={handlePageInputSubmit}
              />
            </form>
            
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>of {totalPages}</span>

            <button 
              onClick={handlePageInputSubmit}
              className="btn-secondary"
              style={{ padding: '6px', cursor: 'pointer', border: 'none', background: 'none' }}
              title="Go"
            >
              <Play size={10} style={{ fill: 'currentColor' }} />
            </button>

            <button 
              disabled={currentPage >= totalPages}
              onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); setPageInputVal(String(currentPage + 1)); }} 
              className="btn-secondary" 
              style={{ padding: '6px', border: 'none', background: 'none', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={18} />
            </button>

          </div>
        </div>

        {/* ----------------------------------------------------------------------
            RESPONSIVE GRID OF BATCH CARDS (exactly matching mf.py logic/UI)
            ---------------------------------------------------------------------- */}
        {loading && batches.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <RefreshCw size={28} className="spin-loader" color="var(--primary-color)" />
          </div>
        ) : batches.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', color: 'var(--text-secondary)', fontSize: '14px', flexDirection: 'column', gap: '8px' }}>
            <Info size={24} />
            <span>No master formulations found matching filters.</span>
          </div>
        ) : (
          <div className="mf-batch-grid">
            {displayedBatches.map((row) => {
              const isApproved = Boolean(row.is_approved || row.approval_status === 'approved');
              return (
                <div 
                  key={row.batch_no} 
                  onClick={() => {
                    if (viewMode === 'mf_production') {
                      sessionStorage.setItem('bpbs_preloaded_batch', row.batch_no);
                      if (onChangeView) {
                        onChangeView('formulation_sheet');
                      }
                    } else {
                      loadBatchDetails(row.batch_no);
                    }
                  }}
                  className="mf-batch-card"
                  style={{
                    borderLeft: viewMode === 'lab_master_formulation' ? '4px solid #3b82f6' : isApproved ? '4px solid #10b981' : '4px solid #f59e0b',
                    position: 'relative'
                  }}
                >
                  {/* Top Row: Label & Status Chip */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
                    <span className="batch-label" style={{ whiteSpace: 'nowrap' }}>BATCH NO</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      whiteSpace: 'nowrap',
                      background: viewMode === 'lab_master_formulation' ? '#eff6ff' : isApproved ? '#dcfce7' : '#fef9c3',
                      color: viewMode === 'lab_master_formulation' ? '#1d4ed8' : isApproved ? '#166534' : '#854d0e',
                      border: viewMode === 'lab_master_formulation' ? '1px solid #bfdbfe' : isApproved ? '1px solid #86efac' : '1px solid #fde047'
                    }}>
                      {viewMode === 'lab_master_formulation' ? '🟢 Active' : isApproved ? '🟢 Approved' : '🟡 Pending Approval'}
                    </span>
                  </div>

                  {/* Middle Row: Batch Number & Product Name */}
                  <div style={{ margin: '8px 0' }}>
                    <div className="batch-value" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      {row.batch_no}
                    </div>
                    {viewMode === 'lab_master_formulation' && row.product_name && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', marginTop: '2px', textTransform: 'capitalize' }}>
                        📦 {row.product_name}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: View Chip & Approve / Delete Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                    <span className="batch-view-chip">
                      {viewMode === 'mf_production' ? 'Load Sheet' : 'View Details'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {viewMode === 'lab_master_formulation' && (
                        <button
                          onClick={(e) => handleDeleteFormulation(row.batch_no, e)}
                          title="Delete Lab Master Formulation"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            border: '1px solid #fca5a5',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isAdmin && !isApproved && viewMode === 'master_formulation' && (
                        <button
                          onClick={(e) => handleApproveFormulation(row.batch_no, e)}
                          disabled={approving}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <CheckCircle size={13} />
                          {approving ? '...' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------------
          RECIPE PARAMETERS DETAIL MODAL OVERLAY (matching show_readonly_master)
          ---------------------------------------------------------------------- */}
      {selectedBatch && detailData && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '1400px', width: '95%', height: '92vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            
            {/* Dialog Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '16px 24px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Scale size={20} color="#3b82f6" /> {viewMode === 'lab_master_formulation' ? 'Lab Master Formulation Specification' : viewMode === 'mf_production' ? 'Production Formulation Specification' : 'Master Formulation Specification'}: {selectedBatch}
              </h3>
              <button 
                onClick={() => setSelectedBatch(null)} 
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>
 
            {/* Scrollable Content Area */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f8fafc' }}>
              
              {/* Approval Status Banner */}
              {viewMode === 'lab_master_formulation' ? (
                <div style={{ padding: '10px 18px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontWeight: 700, fontSize: '0.85rem' }}>
                    <CheckCircle size={18} color="#2563eb" />
                    <span>Lab Master Formulation &mdash; Active Specification</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>Permanent Storage</span>
                </div>
              ) : Boolean(detailData.is_approved || detailData.approval_status === 'approved') ? (
                <div style={{ padding: '12px 20px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>
                    <CheckCircle size={20} color="#16a34a" />
                    <span>Formulation Approved by Admin {detailData.approved_by ? `(${detailData.approved_by})` : ''}</span>
                  </div>
                  {detailData.approved_at && (
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 500 }}>Approved on {detailData.approved_at}</span>
                  )}
                </div>
              ) : (
                <div style={{ padding: '12px 20px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b45309', fontWeight: 700, fontSize: '0.9rem' }}>
                    <Info size={20} color="#d97706" />
                    <span>Waiting for Admin Approval (Pending Release to Production)</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleApproveFormulation()}
                      disabled={approving}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <CheckCircle size={16} />
                      {approving ? 'Approving...' : 'Approve Formulation'}
                    </button>
                  )}
                </div>
              )}

              {/* Attached Physical Lab Master Formulation Sheet Photo / Scans Card (Lab Master Formulation only) */}
              {viewMode === 'lab_master_formulation' && (
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ImageIcon size={16} color="#8b5cf6" />
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Physical Lab Master Formulation Sheet Photos / Scans ({attachedImages.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadingImage && (
                        <span style={{ fontSize: '11px', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <RefreshCw size={12} className="spin-loader" /> Uploading image...
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => detailFileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flet-btn flet-btn-blue"
                        style={{
                          padding: '4px 12px',
                          height: '30px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        <UploadCloud size={14} /> Upload / Attach Sheet Photo
                      </button>
                      <input
                        type="file"
                        ref={detailFileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleDetailImageUpload}
                      />
                    </div>
                  </div>

                  {attachedImages.length === 0 ? (
                    <div
                      onClick={() => detailFileInputRef.current?.click()}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '10px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#8b5cf6';
                        e.currentTarget.style.backgroundColor = '#faf5ff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                    >
                      <UploadCloud size={32} color="#8b5cf6" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        No physical sheet attached. Click here to upload a photo/scan of the lab master formulation sheet
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Supports JPG, PNG, WEBP, GIF, BMP</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                      {attachedImages.map((imgName, idx) => {
                        const imgUrl = imgName.startsWith('http') ? imgName : `${API_BASE_URL}/mf/images/${imgName}`;
                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: '180px',
                              height: '120px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                              backgroundColor: '#000000'
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Master Sheet ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '4px 6px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setZoomedImage(imgUrl)}
                                style={{
                                  background: 'rgba(255,255,255,0.9)',
                                  color: '#0f172a',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <ZoomIn size={12} /> Zoom
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDetailImage(idx)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.9)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Delete this image"
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Row 1: Document Control (Left) & Formulation Identification (Right) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '16px', flexShrink: 0 }}>
                
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <BookOpen size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document Control</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">DOC #</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={docNo} onChange={e => handleParamChange('docNo', e.target.value)} style={{ height: '28px', fontSize: '12px', fontWeight: 600 }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{docNo || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Review #</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={reviewNo} onChange={e => handleParamChange('reviewNo', e.target.value)} style={{ height: '28px', fontSize: '12px', fontWeight: 600 }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{reviewNo || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Review Date</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={reviewDate} onChange={e => handleParamChange('reviewDate', e.target.value)} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{reviewDate || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Issue #</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={issueNo} onChange={e => handleParamChange('issueNo', e.target.value)} style={{ height: '28px', fontSize: '12px', fontWeight: 600 }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{issueNo || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: 'span 2' }}>
                      <span className="premium-field-label">Issue Date</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={issueDate} onChange={e => handleParamChange('issueDate', e.target.value)} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{issueDate || '-'}</strong>
                      )}
                    </div>
                  </div>
                </div>

                {/* Formulation Details Summary Card */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <Info size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formulation Identification</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label" style={{ color: '#1d4ed8' }}>Batch No</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{selectedBatch}</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Ref No</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={refNo} onChange={e => handleParamChange('refNo', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{refNo || detailData.ref_no || detailData.form?.ref_no || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '8px 12px', borderRadius: '8px', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label" style={{ color: '#059669' }}>Product Name</span>
                      {viewMode === 'lab_master_formulation' && isEditing ? (
                        <input
                          type="text"
                          className="premium-field-input"
                          value={formProductName}
                          onChange={e => handleParamChange('formProductName', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="Enter product name..."
                          style={{ height: '28px', fontSize: '12px', fontWeight: 600, color: '#047857', borderColor: '#10b981' }}
                        />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                          {formProductName || detailData.product_name || getRecordValue('product_name', productName)}
                        </strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Customer Name</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={customerName} onChange={e => handleParamChange('customerName', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{customerName || getRecordValue('customer_name') || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Formula Date</span>
                      {isEditing ? (
                        <input type="date" className="premium-field-input" value={formulaDate} onChange={e => handleParamChange('formulaDate', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{formulaDate || date || detailData.form?.formula_date || '-'}</strong>
                      )}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Ref Book No</span>
                      {isEditing ? (
                        <input type="text" className="premium-field-input" value={refBookNo} onChange={e => handleParamChange('refBookNo', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} style={{ height: '28px', fontSize: '12px' }} />
                      ) : (
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{refBookNo || '-'}</strong>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Standard Recalculator & Additional Specifications */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '16px', flexShrink: 0 }}>
                {/* Live Recalculator Targets Card */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(to right bottom, #ffffff, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <RefreshCw size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standard Recalculator</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Target Quantity (Grams)</span>
                      <input 
                        type="number" 
                        className="premium-field-input" 
                        value={grams} 
                        onChange={e => handleParamChange('grams', e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                        style={{ fontWeight: 'bold', fontSize: '15px' }}
                      />
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => triggerAutosave(localInventory)} 
                      className="flet-btn flet-btn-blue" 
                      style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '6px', fontSize: '12px' }} 
                      title="Recalculate & Save"
                    >
                      <RefreshCw size={14} /> Recalculate Recipe
                    </button>
                  </div>
                </div>

                {/* Additional Parameters Card */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <Edit3 size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parameters & Footer Specifications</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Packaging</span>
                      <input type="text" className="premium-field-input" value={packaging} onChange={e => handleParamChange('packaging', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Viscosity</span>
                      <input type="text" className="premium-field-input" value={viscosity} onChange={e => handleParamChange('viscosity', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Density</span>
                      <input type="text" className="premium-field-input" value={density} onChange={e => handleParamChange('density', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Ratio</span>
                      <input type="text" className="premium-field-input" value={ratio} onChange={e => handleParamChange('ratio', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Filtration</span>
                      <input type="text" className="premium-field-input" value={filtration} onChange={e => handleParamChange('filtration', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Remarks & Instructions</span>
                      <textarea 
                        className="premium-field-input" 
                        value={remarks} 
                        onChange={e => handleParamChange('remarks', e.target.value)} 
                        disabled={!isEditing} 
                        style={{ height: '34px', resize: 'none', fontFamily: 'inherit', fontSize: '12px' }} 
                      />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Sender</span>
                      <input type="text" className="premium-field-input" value={sender} onChange={e => handleParamChange('sender', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Approval</span>
                      <input type="text" className="premium-field-input" value={approval} onChange={e => handleParamChange('approval', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Date</span>
                      <input type="text" className="premium-field-input" value={date} onChange={e => handleParamChange('date', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Time</span>
                      <input type="text" className="premium-field-input" value={time} onChange={e => handleParamChange('time', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} disabled={!isEditing} />
                    </div>
                  </div>
                </div>
              </div>
 
              {/* Composition Table Card */}
              <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scale size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Composition</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={handleAddInventoryRow}
                        className="flet-btn flet-btn-blue"
                        style={{ padding: '0 12px', height: '28px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <Plus size={13} /> Add Row
                      </button>
                    )}
                    {autosaveStatus && (
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {autosaveStatus.includes('Saving') && (
                          <span className="badge-status badge-status-saving">
                            <RefreshCw size={10} className="spin-loader" style={{ marginRight: '6px' }} /> Saving recipe changes...
                          </span>
                        )}
                        {autosaveStatus.includes('✓') && (
                          <span className="badge-status badge-status-success">
                            ✓ Recipe changes saved automatically
                          </span>
                        )}
                        {autosaveStatus.includes('✗') && (
                          <span className="badge-status badge-status-error">
                            ✗ Failed to autosave changes
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {(() => {
                  const totalQty = localInventory.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
                  const totalRounded = localInventory.reduce((sum, item) => {
                    const valStr = item.rounded_qty !== undefined && item.rounded_qty !== null ? item.rounded_qty : '';
                    const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                    return sum + valNum;
                  }, 0);
 
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="table-scroll-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                        <table className="table-locked-header" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                              <th style={{ width: '45px', textAlign: 'center', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Sr</th>
                              <th style={{ width: '220px', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Steps / Remarks</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Raw Material</th>
                              <th style={{ width: '110px', textAlign: 'right', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Original Qty</th>
                              <th style={{ width: '100px', textAlign: 'right', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>% Form</th>
                              <th style={{ width: '110px', textAlign: 'right', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Final Qty</th>
                              <th style={{ width: '110px', textAlign: 'center', padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Rounded Qty</th>
                              {isEditing && (
                                <th style={{ width: '45px', textAlign: 'center', padding: '8px 4px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155' }}>Act</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {localInventory.map((item, idx) => {
                              const qty = parseFloat(item.qty) || 0;
                              const percent = totalQty > 0 ? ((qty / totalQty) * 100).toFixed(2) : '0.00';
                              const finalQty = totalQty > 0 ? ((qty / totalQty) * parseFloat(grams || '100')).toFixed(2) : '0.00';
                              const roundedQty = item.rounded_qty !== undefined && item.rounded_qty !== null ? item.rounded_qty : '';

                              return (
                                <tr key={idx}>
                                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, padding: '4px 8px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                                    <input 
                                      id={`mf-remarks-${idx}`}
                                      type="text" 
                                      className="table-cell-input" 
                                      style={{ width: '100%', padding: '4px 8px', fontSize: '12px', height: '30px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff' }}
                                      value={item.remarks || ''} 
                                      onChange={e => handleInventoryChange(idx, 'remarks', e.target.value)}
                                      onKeyDown={e => handleTableKeyDown(e, idx, 'remarks')}
                                      onFocus={e => e.target.select()}
                                    />
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#1e293b', padding: isEditing ? '4px' : '6px 10px', border: '1px solid #cbd5e1' }}>
                                    {isEditing ? (
                                      <input 
                                        id={`mf-mat-${idx}`}
                                        type="text" 
                                        className="table-cell-input" 
                                        style={{ width: '100%', padding: '4px 8px', fontSize: '12px', height: '30px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff', fontWeight: 600 }}
                                        value={item.material || item.raw_material || ''} 
                                        onChange={e => handleInventoryChange(idx, 'material', e.target.value)}
                                        onKeyDown={e => handleTableKeyDown(e, idx, 'mat')}
                                        onFocus={e => e.target.select()}
                                      />
                                    ) : (
                                      item.material || item.raw_material || '-'
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#475569', padding: isEditing ? '4px' : '6px 10px', border: '1px solid #cbd5e1' }}>
                                    {isEditing ? (
                                      <input 
                                        id={`mf-qty-${idx}`}
                                        type="number" 
                                        step="any"
                                        className="table-cell-input" 
                                        style={{ textAlign: 'right', width: '100%', padding: '4px 8px', fontSize: '12px', height: '30px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff' }}
                                        value={item.qty !== undefined && item.qty !== null ? item.qty : ''} 
                                        onChange={e => handleInventoryChange(idx, 'qty', e.target.value)}
                                        onKeyDown={e => handleTableKeyDown(e, idx, 'qty')}
                                        onFocus={e => e.target.select()}
                                      />
                                    ) : (
                                      qty.toFixed(2)
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 10px', border: '1px solid #cbd5e1' }}>{percent}%</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#f8fafc', padding: '6px 10px', border: '1px solid #cbd5e1' }}>{finalQty}</td>
                                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                                    <input 
                                      id={`mf-rounded-${idx}`}
                                      type="text" 
                                      className="table-cell-input" 
                                      style={{ textAlign: 'center', width: '100%', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', height: '30px', color: '#1d4ed8', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff' }}
                                      value={roundedQty} 
                                      onChange={e => handleInventoryChange(idx, 'rounded_qty', e.target.value)}
                                      onKeyDown={e => handleTableKeyDown(e, idx, 'rounded')}
                                      onFocus={e => e.target.select()}
                                    />
                                  </td>
                                  {isEditing && (
                                    <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>
                                      <button 
                                        type="button" 
                                        onClick={() => handleRemoveInventoryRow(idx)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Delete Row"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                              <td colSpan={3} style={{ padding: '8px 10px', color: '#0f172a', border: '1px solid #cbd5e1' }}>TOTALS</td>
                              <td style={{ textAlign: 'right', padding: '8px 10px', color: '#475569', border: '1px solid #cbd5e1' }}>{totalQty.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', padding: '8px 10px', color: '#475569', border: '1px solid #cbd5e1' }}>100.00%</td>
                              <td style={{ textAlign: 'right', color: '#1d4ed8', padding: '8px 10px', border: '1px solid #cbd5e1' }}>{parseFloat(grams).toFixed(2)}</td>
                              <td style={{ textAlign: 'center', color: '#1d4ed8', padding: '8px 10px', border: '1px solid #cbd5e1' }}>{totalRounded.toFixed(2)}</td>
                              {isEditing && <td style={{ border: '1px solid #cbd5e1' }}></td>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}
 
              </div>
 
            </div>
 
            {/* Dialog Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', flexShrink: 0, boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)' }}>
              
              <button 
                type="button"
                onClick={() => exportMasterToExcel(selectedBatch)}
                className="flet-btn flet-btn-green"
                style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }}
              >
                <Download size={14} /> Download Excel
              </button>
 
              {isAdmin && viewMode === 'master_formulation' && !Boolean(detailData.is_approved || detailData.approval_status === 'approved') && (
                <button 
                  type="button"
                  onClick={() => handleApproveFormulation()}
                  disabled={approving}
                  className="flet-btn flet-btn-green"
                  style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }}
                >
                  <CheckCircle size={14} /> {approving ? 'Approving...' : 'Approve Formulation'}
                </button>
              )}

              {(viewMode === 'master_formulation' || viewMode === 'lab_master_formulation') && (
                isEditing ? (
                  <>
                    <button type="button" onClick={() => setIsEditing(false)} className="flet-btn flet-btn-orange" style={{ padding: '0 20px', height: '38px', borderRadius: '8px', fontWeight: 600 }} disabled={loading}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleUpdateFormulation} className="flet-btn flet-btn-blue" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }} disabled={loading}>
                      <CheckCircle size={14} /> Save Changes
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsEditing(true)} className="flet-btn flet-btn-blue" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }}>
                    <Edit3 size={14} /> Edit Parameters
                  </button>
                )
              )}
 
              {!isEditing && (
                <>
                  {viewMode === 'lab_master_formulation' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFormulation(selectedBatch)}
                      disabled={isDeleting}
                      className="flet-btn flet-btn-red"
                      style={{ padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 size={14} /> Delete Lab Formulation
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedBatch(null)} className="flet-btn flet-btn-orange" style={{ padding: '0 20px', height: '38px', borderRadius: '8px', fontWeight: 600 }}>
                    Close
                  </button>
                </>
              )}
            </div>
 
          </div>
        </div>
      )}

      {/* Delete Lab Master Formulation Confirmation Dialog */}
      {deletingBatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '90%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Delete Lab Master Formulation
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete Lab Master Formulation batch <strong>{deletingBatch}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeletingBatch(null)}
                disabled={isDeleting}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFormulation}
                disabled={isDeleting}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isDeleting ? <RefreshCw size={14} className="spin-loader" /> : <Trash2 size={14} />}
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          CUSTOM CSS INJECT FOR BATCH CARDS GRID (Aesthetics Wow factor)
          ---------------------------------------------------------------------- */}
      <style>{`
        .spin-loader {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .mf-batch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
          width: 100%;
          padding: 8px 4px;
        }

        .mf-batch-card {
          min-height: 115px;
          height: auto;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mf-batch-card:hover {
          transform: translateY(-3px);
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
          background-color: rgba(15, 23, 42, 0.01);
        }

        .batch-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .batch-value {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }

        .batch-view-chip {
          font-size: 9px;
          font-weight: 500;
          color: var(--primary-color);
          padding: 2px 8px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          border-radius: 12px;
          text-align: center;
          transition: all 0.2s;
        }

        .mf-batch-card:hover .batch-view-chip {
          background-color: var(--primary-color);
          color: #ffffff;
          border-color: var(--primary-color);
        }

        /* Modal Backdrop Overlay & Container */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(12px) saturate(180%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: all 0.3s ease;
          padding: 20px;
        }

        .modal-content {
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3), 
                      0 0 0 1px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          animation: modal-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes modal-appear {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .modal-close-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #ffffff;
          cursor: pointer;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
          background-color: #ef4444;
          color: #ffffff;
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        /* Premium Card Layouts */
        .premium-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.03), 
                      0 2px 4px -2px rgba(15, 23, 42, 0.03);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 20px -3px rgba(15, 23, 42, 0.08), 
                      0 4px 6px -2px rgba(15, 23, 42, 0.03);
          border-color: #cbd5e1;
        }

        /* Inputs & Parameter Editors */
        .premium-field-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .premium-field-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .premium-field-input {
          width: 100%;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #0f172a;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          transition: all 0.2s ease-in-out;
        }

        .premium-field-input:hover:not(:disabled) {
          border-color: #94a3b8;
        }

        .premium-field-input:focus:not(:disabled) {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .premium-field-input:disabled {
          background-color: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
        }

        /* Standard Recalculator Custom Elements */
        .refresh-btn {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          color: #2563eb;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          background-color: #dbeafe;
          color: #1d4ed8;
          transform: rotate(45deg);
        }

        /* Table Inputs */
        .table-locked-header th {
          position: sticky;
          top: 0;
          background-color: #f8fafc;
          z-index: 10;
          box-shadow: 0 1px 0 #e2e8f0;
        }

        .table-cell-input {
          width: 100%;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          transition: all 0.15s ease-in-out;
        }

        .table-cell-input:hover {
          background-color: #f1f5f9;
          border-color: #cbd5e1;
        }

        .table-cell-input:focus {
          background-color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
          outline: none;
        }

        /* Autosave Pulse Badges */
        .badge-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-status-saving {
          background-color: #fef3c7;
          color: #d97706;
          border: 1px solid #fde68a;
          animation: pulse-bg 1.5s infinite ease-in-out;
        }

        .badge-status-success {
          background-color: #d1fae5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .badge-status-error {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        @keyframes pulse-bg {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }

        .flet-btn {
          transition: all 0.2s ease-in-out;
        }
        .flet-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .flet-btn:active {
          transform: translateY(1px);
      `}</style>

      {/* Create Master Formulation Modal */}
      <CreateMasterModal
        isOpen={createModalOpen}
        productName={productName}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(createdBatch, createdProduct) => {
          if (createdProduct && createdProduct.trim().toLowerCase() !== productName.trim().toLowerCase()) {
            onShowToast(`✓ Master formulation '${createdBatch}' created under product '${createdProduct.toUpperCase()}'! Switch to that product from top bar to view.`, 'success');
          } else {
            loadMasterList();
            loadBatchDetails(createdBatch);
          }
        }}
        onShowToast={onShowToast}
      />

      {/* Bulk Master Formulation Upload Studio Modal */}
      {bulkModalOpen && (
        <BulkMasterUploadModal
          isOpen={bulkModalOpen}
          productName={productName}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={() => {
            setBulkModalOpen(false);
            loadMasterList();
          }}
          onOpenBatch={(batchNo) => {
            setBulkModalOpen(false);
            loadMasterList();
            loadBatchDetails(batchNo);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Zoom Modal for Attached Physical Sheet Images */}
      {zoomedImage && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 1400, background: 'rgba(0,0,0,0.85)' }} 
          onClick={() => setZoomedImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img 
              src={zoomedImage} 
              alt="Enlarged Sheet" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} 
            />
            <button 
              type="button"
              onClick={() => setZoomedImage(null)}
              style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: '#ffffff', fontSize: '28px', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
