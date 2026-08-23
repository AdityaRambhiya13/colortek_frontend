import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Search, RefreshCw, AlertTriangle, Plus, Trash2, CheckCircle2,
  Image, Upload, History, FileText, ChevronLeft, ChevronRight, Check, Play,
  ArrowRight, X, ZoomIn, ArrowLeft, Beaker, Wrench, Package, Edit3, Save
} from 'lucide-react';
import {
  ComplaintsAPI, ComplaintRegistrationAPI, ComplaintLabAPI, RepairedFormulationsAPI,
  ComplaintResolutionAPI, API_BASE_URL, NotificationsAPI
} from '../services/api';
import { CustomerFormulationTable } from '../components/complaints/CustomerFormulationTable';
import { ComplaintRegistrationForm } from '../components/complaints/ComplaintRegistrationForm';
import {
  ResolvedComplaintModal,
  ImageLightboxModal,
  LabComplaintDetailsModal,
  ComplaintLogsModal
} from '../components/complaints/ComplaintModals';
import {
  LabComplaintsBoard,
  RepairedFormulationsBoard,
  ResolvedComplaintsBoard
} from '../components/complaints/ComplaintSubviews';

interface ComplaintsMainProps {
  activeSubView: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onChangeView: (view: string) => void;
}

const DARK_HEADER: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  padding: '0 24px',
  height: '72px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  borderTopLeftRadius: '12px',
  borderTopRightRadius: '12px'
};

const PAGE_SIZE = 20;

const normalizeBatchNo = (val: string): string => {
  if (!val) return '';
  return val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

export const ComplaintsMain: React.FC<ComplaintsMainProps> = ({ activeSubView, onShowToast, onChangeView }) => {
  const currentProduct = sessionStorage.getItem('product_name') || '';

  // --------------------------------------------------------------------------
  // STATE — COMPLAINT REGISTRATION
  // --------------------------------------------------------------------------
  const [productNameUi, setProductNameUi] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [initialObservation, setInitialObservation] = useState('');
  const [complaintDetails, setComplaintDetails] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [batchRefData, setBatchRefData] = useState<any | null>(null);
  const [foundProductDb, setFoundProductDb] = useState('');
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [customerFormulation, setCustomerFormulation] = useState<{rm: string, batchNo: string, qty: string}[]>(
    Array(10).fill({ rm: '', batchNo: '', qty: '' })
  );
  const [bypassMasterCheck, setBypassMasterCheck] = useState(false);

  // Logs modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [logsDateFilter, setLogsDateFilter] = useState('');
  const [logsList, setLogsList] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);

  // Edit log mode states
  const [isEditingLog, setIsEditingLog] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editBatchNo, setEditBatchNo] = useState('');
  const [editStatus, setEditStatus] = useState('Open');
  const [editComplaintText, setEditComplaintText] = useState('');
  const [editObservationText, setEditObservationText] = useState('');
  const [updatingLog, setUpdatingLog] = useState(false);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // STATE — LAB COMPLAINTS BOARD
  // --------------------------------------------------------------------------
  const [labBatches, setLabBatches] = useState<any[]>([]);
  const [loadingLab, setLoadingLab] = useState(false);
  const [labSearchTerm, setLabSearchTerm] = useState('');
  const [selectedLabComplaint, setSelectedLabComplaint] = useState<any | null>(null);
  const [labComplaintDetails, setLabComplaintDetails] = useState<any | null>(null);
  const [loadingLabDetail, setLoadingLabDetail] = useState(false);
  const [solving, setSolving] = useState(false);
  const [showModalImages, setShowModalImages] = useState(false);
  const [labCurrentPage, setLabCurrentPage] = useState(1);
  const [labPageInput, setLabPageInput] = useState('1');

  // --------------------------------------------------------------------------
  // STATE — REPAIRED FORMULATIONS
  // --------------------------------------------------------------------------
  const [repairedBatches, setRepairedBatches] = useState<any[]>([]);
  const [loadingRepaired, setLoadingRepaired] = useState(false);
  const [repairedSearchTerm, setRepairedSearchTerm] = useState('');
  const [repairedCurrentPage, setRepairedCurrentPage] = useState(1);
  const [repairedPageInput, setRepairedPageInput] = useState('1');
  const [selectedRepairedBatch, setSelectedRepairedBatch] = useState<any | null>(null);
  const [trialsList, setTrialsList] = useState<any[]>([]);
  const [loadingTrials, setLoadingTrials] = useState(false);
  const [activeTrialIdx, setActiveTrialIdx] = useState(0);
  const [repairedViewMode, setRepairedViewMode] = useState<'list' | 'trials'>('list');

  // --------------------------------------------------------------------------
  // STATE — RESOLVED COMPLAINTS
  // --------------------------------------------------------------------------
  const [resolvedBatches, setResolvedBatches] = useState<string[]>([]);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolvedSearchTerm, setResolvedSearchTerm] = useState('');
  const [resolvedCurrentPage, setResolvedCurrentPage] = useState(1);
  const [resolvedPageInput, setResolvedPageInput] = useState('1');
  const [selectedResolvedBatch, setSelectedResolvedBatch] = useState<string | null>(null);
  const [resolvedDetails, setResolvedDetails] = useState<any | null>(null);
  const [loadingResolvedDetail, setLoadingResolvedDetail] = useState(false);

  // --------------------------------------------------------------------------
  // ON MOUNT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeSubView === 'complaints_lab') loadLabComplaints();
    else if (activeSubView === 'repaired_formulations') loadRepairedFormulations();
    else if (activeSubView === 'resolved_complaints') loadResolvedComplaints();
  }, [activeSubView]);

  // Debounced Batch Search for Complaint Registration
  const lastSearchedBatchNo = useRef('');
  useEffect(() => {
    if (bypassMasterCheck) return;
    const trimmed = batchNo.trim();
    if (!trimmed) {
      setBatchRefData(null);
      setFoundProductDb('');
      lastSearchedBatchNo.current = '';
      return;
    }
    if (trimmed === lastSearchedBatchNo.current) return;

    const timer = setTimeout(() => {
      lastSearchedBatchNo.current = trimmed;
      handleBatchSearch();
    }, 800); // 800ms debounce
    return () => clearTimeout(timer);
  }, [batchNo, bypassMasterCheck]);

  // --------------------------------------------------------------------------
  // REGISTRATION FUNCTIONS
  // --------------------------------------------------------------------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...filesArray]);
      setImagePreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBatchSearch = async () => {
    if (!batchNo.trim()) { setBatchRefData(null); setFoundProductDb(''); return; }
    setLoadingBatch(true); setBatchRefData(null); setFoundProductDb('');
    onShowToast(`Searching globally for batch '${batchNo}'...`, 'info');
    const [success, data] = await ComplaintRegistrationAPI.getBatchDetailsGlobal(batchNo.trim());
    setLoadingBatch(false);
    if (success && typeof data !== 'string') {
      setBatchRefData(data);
      setFoundProductDb(data.found_product_name || '');
      setProductNameUi(data.production_sheet_data?.product || '');
      setCustomerName(data.production_sheet_data?.customer || '');
      onShowToast(`Batch loaded from '${data.found_product_name}'!`, 'success');
    } else {
      if (!bypassMasterCheck) {
        onShowToast(`No database record found for batch '${batchNo}'.`, 'warning');
      } else {
        onShowToast(`No database record found for batch '${batchNo}' (Bypass mode active).`, 'info');
      }
    }
  };

  const clearRegistrationForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProductNameUi(''); setCustomerName(''); setBatchNo('');
      setInitialObservation(''); setComplaintDetails('');
      setImageFiles([]); setImagePreviews([]);
      setBatchRefData(null); setFoundProductDb('');
      setCustomerFormulation(Array(10).fill({ rm: '', batchNo: '', qty: '' }));
      setBypassMasterCheck(false);
    }
  };

  const handleSaveComplaint = async () => {
    if (!batchNo.trim() || !customerName.trim() || !complaintDetails.trim()) {
      onShowToast('Required: Batch No, Customer Name, Complaint Details.', 'warning'); return;
    }
    
    const targetProduct = foundProductDb || (productNameUi.trim() ? productNameUi.trim().toLowerCase().replace(/\s+/g, '_') : '') || currentProduct;
    if (!targetProduct) {
      if (bypassMasterCheck) {
        onShowToast('Please enter a Product Name.', 'warning');
      } else {
        onShowToast('Please load a valid batch first or enable bypass.', 'warning');
      }
      return;
    }

    setSaving(true);
    try {
      const payload = {
        batch_no: batchNo.trim(), customer_name: customerName.trim(),
        product_name_ui: productNameUi.trim() || targetProduct, complaint_text: complaintDetails.trim(),
        observation_text: initialObservation.trim(),
        raw_materials: batchRefData?.production_sheet_data || {},
        test_results: batchRefData?.master_test_results || [],
        customer_formulation: customerFormulation
      };
      const [success, data] = await ComplaintRegistrationAPI.registerComplaintWithImage(targetProduct, payload, imageFiles);
      if (success) {
        onShowToast(`Complaint for Batch '${batchNo}' registered!`, 'success');
        await NotificationsAPI.createNotification(
          "📌 Complaint Registered",
          `Batch ${batchNo} has been successfully registered.`,
          "success",
          ["production", "qc", "lab", "mf", "complaints", "cms"]
        );
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      } else {
        onShowToast(`Failed to register: ${data}`, 'error');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to save complaint: ${err.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToLab = async () => {
    if (!batchNo.trim()) {
      onShowToast('Please enter a batch number.', 'warning'); return;
    }
    
    const targetProduct = foundProductDb || (productNameUi.trim() ? productNameUi.trim().toLowerCase().replace(/\s+/g, '_') : '') || currentProduct;
    if (!targetProduct) {
      if (bypassMasterCheck) {
        onShowToast('Please enter a Product Name.', 'warning');
      } else {
        onShowToast('Please load batch details first or enable bypass.', 'warning');
      }
      return;
    }

    setMoving(true);
    try {
      const [success, data] = await ComplaintRegistrationAPI.moveToLab(targetProduct, batchNo.trim());
      if (success) {
        onShowToast(`Batch '${batchNo}' pushed to Lab queue!`, 'success');
        // Clear form fields after successfully pushing to the lab
        setProductNameUi(''); setCustomerName(''); setBatchNo('');
        setInitialObservation(''); setComplaintDetails('');
        setImageFiles([]); setImagePreviews([]);
        setBatchRefData(null); setFoundProductDb('');
        setCustomerFormulation(Array(10).fill({ rm: '', batchNo: '', qty: '' }));
      } else {
        onShowToast(`Move to Lab failed: ${data}`, 'error');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to move batch to lab: ${err.message || err}`, 'error');
    } finally {
      setMoving(false);
    }
  };

  // --------------------------------------------------------------------------
  // LOGS MODAL
  // --------------------------------------------------------------------------
  const openLogsModal = async () => {
    setShowLogsModal(true); setLoadingLogs(true); setSelectedLogDetail(null);
    const [success, data] = await ComplaintsAPI.getEntriesFiltered(1, 100);
    setLoadingLogs(false);
    if (success && typeof data !== 'string') setLogsList(data.records || []);
    else onShowToast(`Failed to load logs: ${data}`, 'error');
  };

  const handleSearchLogs = async () => {
    setLoadingLogs(true);
    const [success, data] = await ComplaintsAPI.getEntriesFiltered(1, 100, logsSearchTerm.trim() || undefined, logsDateFilter || undefined);
    setLoadingLogs(false);
    if (success && typeof data !== 'string') setLogsList(data.records || []);
  };

  const clearLogsFilters = async () => {
    setLogsSearchTerm(''); setLogsDateFilter(''); setLoadingLogs(true);
    const [success, data] = await ComplaintsAPI.getEntriesFiltered(1, 100);
    setLoadingLogs(false);
    if (success && typeof data !== 'string') setLogsList(data.records || []);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startEditLog = (log: any) => {
    setEditCustomerName(log.customer_name || '');
    setEditProductName(log.product_name || '');
    setEditBatchNo(log.batch_no || '');
    setEditStatus(log.status || 'Open');
    setEditComplaintText(log.complaint_text || '');
    setEditObservationText(log.observation_text || '');
    setIsEditingLog(true);
  };

  const handleUpdateLog = async () => {
    if (!selectedLogDetail) return;
    if (!editCustomerName.trim() || !editBatchNo.trim() || !editComplaintText.trim()) {
      onShowToast('Required: Customer Name, Batch No, and Complaint Details.', 'warning');
      return;
    }
    setUpdatingLog(true);
    const [success, result] = await ComplaintsAPI.updateEntry(
      selectedLogDetail.product_name,
      selectedLogDetail.id,
      {
        customer_name: editCustomerName.trim(),
        batch_no: editBatchNo.trim(),
        status: editStatus,
        complaint_text: editComplaintText.trim(),
        observation_text: editObservationText.trim()
      }
    );
    setUpdatingLog(false);
    if (success) {
      onShowToast(result.message || 'Complaint updated successfully.', 'success');
      setIsEditingLog(false);
      // Refresh selected log detail
      setSelectedLogDetail({
        ...selectedLogDetail,
        customer_name: editCustomerName.trim(),
        batch_no: editBatchNo.trim(),
        status: editStatus,
        complaint_text: editComplaintText.trim(),
        observation_text: editObservationText.trim()
      });
      // Refresh list
      handleSearchLogs();
    } else {
      onShowToast(`Update failed: ${result}`, 'error');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteLog = async (log: any) => {
    if (!window.confirm(`Are you sure you want to delete complaint #${log.id} for batch '${log.batch_no}'?`)) return;
    
    const [success, result] = await ComplaintsAPI.deleteEntry(log.product_name, log.id);
    if (success) {
      onShowToast(result.message || 'Complaint deleted successfully.', 'success');
      setSelectedLogDetail(null);
      setIsEditingLog(false);
      // Refresh list
      handleSearchLogs();
    } else {
      onShowToast(`Deletion failed: ${result}`, 'error');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseJsonField = (field: any, type: 'rm' | 'tests') => {
    if (!field) return 'No details available.';
    try {
      const d = typeof field === 'string' ? JSON.parse(field) : field;
      if (type === 'rm') {
        const list = d.raw_materials || d;
        if (!Array.isArray(list)) return 'Invalid format.';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return list.map((item: any, idx: number) => {
          if (typeof item === 'string') return `${idx + 1}) ${item}`;
          return `${idx + 1}) ${item.item || item.raw_material || item.material || 'N/A'} - Qty: ${item.qty1 || item.qty || '-'}`;
        }).join('\n');
      } else {
        if (!Array.isArray(d)) return 'Invalid format.';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return d.map((t: any) => `${t.method || 'Unknown'}: ${t.standard || 'N/A'} | Result: ${t.result || 'N/A'}`).join('\n');
      }
    } catch { return 'Error parsing data.'; }
  };

  // --------------------------------------------------------------------------
  // LAB COMPLAINTS
  // --------------------------------------------------------------------------
  const loadLabComplaints = async () => {
    setLoadingLab(true);
    const [success, data] = await ComplaintLabAPI.listBatchesGlobal();
    setLoadingLab(false);
    if (success && Array.isArray(data)) {
      setLabBatches(data); setLabCurrentPage(1); setLabPageInput('1');
    } else { onShowToast(`Failed to load lab complaints: ${data}`, 'error'); }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOpenLabDetail = async (batch: any) => {
    setSelectedLabComplaint(batch); setLoadingLabDetail(true); setLabComplaintDetails(null);
    const [success, data] = await ComplaintLabAPI.getRepairData(batch.product_name, batch.batch_no);
    setLoadingLabDetail(false);
    if (success && typeof data !== 'string') setLabComplaintDetails(data);
    else onShowToast(`Failed to load complaint details: ${data}`, 'error');
  };

  const handleSolveComplaint = async () => {
    if (!selectedLabComplaint) return;
    if (!window.confirm(`Mark batch '${selectedLabComplaint.batch_no}' as solved?`)) return;
    setSolving(true);
    try {
      const [success, data] = await ComplaintLabAPI.solveComplaint(selectedLabComplaint.product_name, selectedLabComplaint.batch_no);
      if (success) {
        onShowToast('Complaint resolved! Batch removed from lab queue.', 'success');
        await NotificationsAPI.createNotification(
          "[SUCCESS] Complaint Solved",
          `Batch ${selectedLabComplaint.batch_no} marked as solved.`,
          "success",
          ["complaints", "lab"]
        );
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
        setSelectedLabComplaint(null); setLabComplaintDetails(null); setShowModalImages(false);
        loadLabComplaints();
      } else { 
        onShowToast(`Failed to resolve: ${data}`, 'error'); 
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to solve complaint: ${err.message || err}`, 'error');
    } finally {
      setSolving(false);
    }
  };

  const handleModifyComplaint = async () => {
    if (!selectedLabComplaint || !labComplaintDetails) return;
    const cmsDataToLoad = {
      form_fields: { 'BATCH NO': selectedLabComplaint.batch_no, 'PRODUCT NAME': labComplaintDetails.product_name || 'N/A' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inventory: (labComplaintDetails.full_bpbs_data?.raw_materials || []).map((item: any, i: number) => ({
        sr_no: String(i + 1), mr_no: item.mrno || item.mr_no || item.mr || '',
        raw_material: item.item || item.raw_material || item.material || '', qty: String(item.qty1 || item.qty || '')
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tests: (labComplaintDetails.test_results || []).map((item: any) => ({
        method: item.method || '', standard: '', result: item.result || ''
      })),
      remarks: `Complaint: ${labComplaintDetails.complaint || ''}\n\nObservation: ${labComplaintDetails.observation || ''}`,
      image_references: labComplaintDetails.image_references || []
    };
    
    // Set active product scope in session
    const activeProd = selectedLabComplaint.product_name || labComplaintDetails.product_name;
    if (activeProd) {
      sessionStorage.setItem('product_name', activeProd);
    }
    
    sessionStorage.setItem('cms_context', 'complaint_repair');
    sessionStorage.setItem('complaint_origin_info', JSON.stringify({ product_name: selectedLabComplaint.product_name, batch_no: selectedLabComplaint.batch_no }));
    sessionStorage.setItem('complaint_data_to_load_in_cms', JSON.stringify(cmsDataToLoad));
    
    if (labComplaintDetails.full_bpbs_data) {
      sessionStorage.setItem('bpbs_data_to_load_in_cms', JSON.stringify(labComplaintDetails.full_bpbs_data));
    } else {
      sessionStorage.removeItem('bpbs_data_to_load_in_cms');
    }

    onChangeView('lab_formulations');
    onShowToast('Recipe repair workspace loaded in CMS!', 'success');
  };

  // --------------------------------------------------------------------------
  // REPAIRED FORMULATIONS
  // --------------------------------------------------------------------------
  const loadRepairedFormulations = async () => {
    setLoadingRepaired(true);
    const [success, data] = await RepairedFormulationsAPI.listBatchesWithTrialsGlobal();
    setLoadingRepaired(false);
    if (success && Array.isArray(data)) {
      setRepairedBatches(data); setRepairedCurrentPage(1); setRepairedPageInput('1');
      setSelectedRepairedBatch(null); setTrialsList([]); setRepairedViewMode('list');
    } else { onShowToast(`Failed to load repaired formulations: ${data}`, 'error'); }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectRepairedBatch = async (batch: any) => {
    setSelectedRepairedBatch(batch); setLoadingTrials(true); setTrialsList([]); setActiveTrialIdx(0);
    const [success, data] = await RepairedFormulationsAPI.getTrialsForBatch(batch.product_name, batch.batch_no);
    setLoadingTrials(false);
    if (success && Array.isArray(data)) { setTrialsList(data); setRepairedViewMode('trials'); }
    else onShowToast(`Failed to fetch trials for ${batch.batch_no}: ${data}`, 'error');
  };

  const handleBackToRepairedList = () => {
    setRepairedViewMode('list'); setSelectedRepairedBatch(null); setTrialsList([]); setActiveTrialIdx(0);
  };

  // Parse modification_details for repaired batch & remarks
  const parseModificationDetails = (modDetails: string) => {
    let repairedBatchNo = 'N/A';
    let remarks = '';
    if (!modDetails) return { repairedBatchNo, remarks };
    if (modDetails.includes('Batch:')) {
      try {
        const afterBatch = modDetails.split('Batch:', 2)[1];
        if (afterBatch.includes('|')) {
          const parts = afterBatch.split('|', 2);
          repairedBatchNo = parts[0].trim();
          remarks = parts[1].trim();
        } else {
          repairedBatchNo = afterBatch.trim();
        }
      } catch { repairedBatchNo = modDetails; }
    } else if (modDetails.includes(':')) {
      try {
        const parts = modDetails.split(':', 2);
        if (parts.length > 1) { repairedBatchNo = parts[1].trim(); }
      } catch { repairedBatchNo = modDetails; }
    } else if (modDetails.length < 30) {
      repairedBatchNo = modDetails;
    }
    return { repairedBatchNo, remarks };
  };

  // --------------------------------------------------------------------------
  // RESOLVED COMPLAINTS
  // --------------------------------------------------------------------------
  const loadResolvedComplaints = async (search?: string) => {
    setLoadingResolved(true);
    const [success, data] = await ComplaintResolutionAPI.listResolved(search);
    setLoadingResolved(false);
    if (success && Array.isArray(data)) {
      setResolvedBatches(data); setResolvedCurrentPage(1); setResolvedPageInput('1');
    } else { onShowToast(`Failed to load resolved complaints: ${data}`, 'error'); }
  };

  const handleOpenResolvedDetail = async (batchNo: string) => {
    setSelectedResolvedBatch(batchNo); setLoadingResolvedDetail(true); setResolvedDetails(null);
    const [success, data] = await ComplaintResolutionAPI.getResolvedDetails(batchNo);
    setLoadingResolvedDetail(false);
    if (success && typeof data !== 'string') setResolvedDetails(data);
    else onShowToast(`Failed to load details for ${batchNo}: ${data}`, 'error');
  };

  // --------------------------------------------------------------------------
  // PAGINATION HELPERS
  // --------------------------------------------------------------------------
  const filteredLabBatches = labBatches.filter(b => 
    normalizeBatchNo(b.batch_no).includes(normalizeBatchNo(labSearchTerm))
  );
  const labTotalPages = Math.max(1, Math.ceil(filteredLabBatches.length / PAGE_SIZE));
  const paginatedLabBatches = filteredLabBatches.slice((labCurrentPage - 1) * PAGE_SIZE, labCurrentPage * PAGE_SIZE);

  const filteredRepairedBatches = repairedBatches.filter(b => 
    normalizeBatchNo(b.batch_no).includes(normalizeBatchNo(repairedSearchTerm))
  );
  const repairedTotalPages = Math.max(1, Math.ceil(filteredRepairedBatches.length / PAGE_SIZE));
  const paginatedRepairedBatches = filteredRepairedBatches.slice((repairedCurrentPage - 1) * PAGE_SIZE, repairedCurrentPage * PAGE_SIZE);

  const filteredResolvedBatches = resolvedBatches.filter(b => 
    normalizeBatchNo(b).includes(normalizeBatchNo(resolvedSearchTerm))
  );
  const resolvedTotalPages = Math.max(1, Math.ceil(filteredResolvedBatches.length / PAGE_SIZE));
  const paginatedResolvedBatches = filteredResolvedBatches.slice((resolvedCurrentPage - 1) * PAGE_SIZE, resolvedCurrentPage * PAGE_SIZE);

  const handleLabGoPage = () => {
    const n = parseInt(labPageInput);
    if (!isNaN(n) && n >= 1 && n <= labTotalPages) setLabCurrentPage(n);
  };
  const handleRepairedGoPage = () => {
    const n = parseInt(repairedPageInput);
    if (!isNaN(n) && n >= 1 && n <= repairedTotalPages) setRepairedCurrentPage(n);
  };
  const handleResolvedGoPage = () => {
    const n = parseInt(resolvedPageInput);
    if (!isNaN(n) && n >= 1 && n <= resolvedTotalPages) setResolvedCurrentPage(n);
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>

      {/* =================== SUBVIEW 1: COMPLAINT REGISTRATION =================== */}
      {activeSubView === 'complaints' && (
        <ComplaintRegistrationForm
          productNameUi={productNameUi}
          setProductNameUi={setProductNameUi}
          customerName={customerName}
          setCustomerName={setCustomerName}
          batchNo={batchNo}
          setBatchNo={setBatchNo}
          initialObservation={initialObservation}
          setInitialObservation={setInitialObservation}
          complaintDetails={complaintDetails}
          setComplaintDetails={setComplaintDetails}
          customerFormulation={customerFormulation}
          setCustomerFormulation={setCustomerFormulation}
          imagePreviews={imagePreviews}
          handleImageChange={handleImageChange}
          removeImage={removeImage}
          onViewImage={(url) => setLightboxImage(url)}
          saving={saving}
          handleSaveComplaint={handleSaveComplaint}
          clearRegistrationForm={clearRegistrationForm}
          moving={moving}
          handleMoveToLab={handleMoveToLab}
          openLogsModal={openLogsModal}
          foundProductDb={foundProductDb}
          batchRefData={batchRefData}
          handleBatchSearch={handleBatchSearch}
          bypassMasterCheck={bypassMasterCheck}
          setBypassMasterCheck={setBypassMasterCheck}
        />
      )}

      {/* =================== SUBVIEW 2: LAB COMPLAINTS BOARD =================== */}
      {activeSubView === 'complaints_lab' && (
        <LabComplaintsBoard
          labSearchTerm={labSearchTerm}
          setLabSearchTerm={setLabSearchTerm}
          labCurrentPage={labCurrentPage}
          setLabCurrentPage={setLabCurrentPage}
          labPageInput={labPageInput}
          setLabPageInput={setLabPageInput}
          labTotalPages={labTotalPages}
          handleLabGoPage={handleLabGoPage}
          loadLabComplaints={loadLabComplaints}
          loadingLab={loadingLab}
          paginatedLabBatches={paginatedLabBatches}
          handleOpenLabDetail={handleOpenLabDetail}
        />
      )}

      {/* =================== SUBVIEW 3: REPAIRED FORMULATIONS =================== */}
      {activeSubView === 'repaired_formulations' && (
        <RepairedFormulationsBoard
          repairedViewMode={repairedViewMode}
          selectedRepairedBatch={selectedRepairedBatch}
          handleBackToRepairedList={handleBackToRepairedList}
          repairedSearchTerm={repairedSearchTerm}
          setRepairedSearchTerm={setRepairedSearchTerm}
          repairedCurrentPage={repairedCurrentPage}
          setRepairedCurrentPage={setRepairedCurrentPage}
          repairedPageInput={repairedPageInput}
          setRepairedPageInput={setRepairedPageInput}
          repairedTotalPages={repairedTotalPages}
          handleRepairedGoPage={handleRepairedGoPage}
          loadRepairedFormulations={loadRepairedFormulations}
          loadingRepaired={loadingRepaired}
          paginatedRepairedBatches={paginatedRepairedBatches}
          handleSelectRepairedBatch={handleSelectRepairedBatch}
          loadingTrials={loadingTrials}
          trialsList={trialsList}
          activeTrialIdx={activeTrialIdx}
          setActiveTrialIdx={setActiveTrialIdx}
          parseModificationDetails={parseModificationDetails}
        />
      )}

      {/* =================== SUBVIEW 4: RESOLVED COMPLAINTS =================== */}
      {activeSubView === 'resolved_complaints' && (
        <ResolvedComplaintsBoard
          resolvedSearchTerm={resolvedSearchTerm}
          setResolvedSearchTerm={setResolvedSearchTerm}
          resolvedCurrentPage={resolvedCurrentPage}
          setResolvedCurrentPage={setResolvedCurrentPage}
          resolvedPageInput={resolvedPageInput}
          setResolvedPageInput={setResolvedPageInput}
          resolvedTotalPages={resolvedTotalPages}
          handleResolvedGoPage={handleResolvedGoPage}
          loadResolvedComplaints={loadResolvedComplaints}
          loadingResolved={loadingResolved}
          paginatedResolvedBatches={paginatedResolvedBatches}
          handleOpenResolvedDetail={handleOpenResolvedDetail}
        />
      )}

      {/* =================== MODAL 1: COMPLAINT LOGS =================== */}
      <ComplaintLogsModal
        showLogsModal={showLogsModal}
        selectedLogDetail={selectedLogDetail}
        setSelectedLogDetail={setSelectedLogDetail}
        onClose={() => { if (selectedLogDetail) setSelectedLogDetail(null); else setShowLogsModal(false); }}
        isEditingLog={isEditingLog}
        setIsEditingLog={setIsEditingLog}
        editCustomerName={editCustomerName}
        setEditCustomerName={setEditCustomerName}
        editProductName={editProductName}
        editBatchNo={editBatchNo}
        setEditBatchNo={setEditBatchNo}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editComplaintText={editComplaintText}
        setEditComplaintText={setEditComplaintText}
        editObservationText={editObservationText}
        setEditObservationText={setEditObservationText}
        updatingLog={updatingLog}
        onUpdateLog={handleUpdateLog}
        startEditLog={startEditLog}
        handleDeleteLog={handleDeleteLog}
        logsSearchTerm={logsSearchTerm}
        setLogsSearchTerm={setLogsSearchTerm}
        logsDateFilter={logsDateFilter}
        setLogsDateFilter={setLogsDateFilter}
        onSearchLogs={handleSearchLogs}
        onClearLogsFilters={clearLogsFilters}
        loadingLogs={loadingLogs}
        logsList={logsList}
        parseJsonField={parseJsonField}
      />

      {/* =================== MODAL 2: LAB COMPLAINT DETAIL =================== */}
      <LabComplaintDetailsModal
        selectedLabComplaint={selectedLabComplaint}
        labComplaintDetails={labComplaintDetails}
        loadingLabDetail={loadingLabDetail}
        showModalImages={showModalImages}
        setShowModalImages={setShowModalImages}
        solving={solving}
        onClose={() => { setSelectedLabComplaint(null); setLabComplaintDetails(null); setShowModalImages(false); }}
        onViewImage={(url) => setLightboxImage(url)}
        onModify={handleModifyComplaint}
        onSolve={handleSolveComplaint}
      />

      {/* =================== MODAL 3: RESOLVED COMPLAINT DETAIL =================== */}
      <ResolvedComplaintModal
        selectedResolvedBatch={selectedResolvedBatch}
        resolvedDetails={resolvedDetails}
        loadingResolvedDetail={loadingResolvedDetail}
        onClose={() => { setSelectedResolvedBatch(null); setResolvedDetails(null); }}
      />

      {/* =================== LIGHTBOX =================== */}
      <ImageLightboxModal
        lightboxImage={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

    </div>
  );
};
