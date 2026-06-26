import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Search, RefreshCw, AlertTriangle, Plus, Trash2, CheckCircle2,
  Image, Upload, History, FileText, ChevronLeft, ChevronRight, Check, Play,
  ArrowRight, X, ZoomIn, ArrowLeft, Beaker, Wrench, Package, Edit3, Save
} from 'lucide-react';
import {
  ComplaintsAPI, ComplaintRegistrationAPI, ComplaintLabAPI, RepairedFormulationsAPI,
  ComplaintResolutionAPI, API_BASE_URL
} from '../services/api';

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
  }, [batchNo]);

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
      onShowToast(`No database record found for batch '${batchNo}'.`, 'warning');
    }
  };

  const clearRegistrationForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProductNameUi(''); setCustomerName(''); setBatchNo('');
      setInitialObservation(''); setComplaintDetails('');
      setImageFiles([]); setImagePreviews([]);
      setBatchRefData(null); setFoundProductDb('');
    }
  };

  const handleSaveComplaint = async () => {
    if (!batchNo.trim() || !customerName.trim() || !complaintDetails.trim()) {
      onShowToast('Required: Batch No, Customer Name, Complaint Details.', 'warning'); return;
    }
    if (!foundProductDb) {
      onShowToast('Please load a valid batch first.', 'warning'); return;
    }
    setSaving(true);
    const payload = {
      batch_no: batchNo.trim(), customer_name: customerName.trim(),
      product_name_ui: productNameUi.trim(), complaint_text: complaintDetails.trim(),
      observation_text: initialObservation.trim(),
      raw_materials: batchRefData?.production_sheet_data || {},
      test_results: batchRefData?.master_test_results || []
    };
    const [success, data] = await ComplaintRegistrationAPI.registerComplaintWithImage(foundProductDb, payload, imageFiles);
    setSaving(false);
    if (success) {
      onShowToast(`Complaint for Batch '${batchNo}' registered!`, 'success');
    } else {
      onShowToast(`Failed to register: ${data}`, 'error');
    }
  };

  const handleMoveToLab = async () => {
    if (!batchNo.trim() || !foundProductDb) {
      onShowToast('Please load batch details first.', 'warning'); return;
    }
    setMoving(true);
    const [success, data] = await ComplaintRegistrationAPI.moveToLab(foundProductDb, batchNo.trim());
    setMoving(false);
    if (success) {
      onShowToast(`Batch '${batchNo}' pushed to Lab queue!`, 'success');
      // Clear form fields after successfully pushing to the lab
      setProductNameUi(''); setCustomerName(''); setBatchNo('');
      setInitialObservation(''); setComplaintDetails('');
      setImageFiles([]); setImagePreviews([]);
      setBatchRefData(null); setFoundProductDb('');
    } else {
      onShowToast(`Move to Lab failed: ${data}`, 'error');
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

  const parseJsonField = (field: any, type: 'rm' | 'tests') => {
    if (!field) return 'No details available.';
    try {
      const d = typeof field === 'string' ? JSON.parse(field) : field;
      if (type === 'rm') {
        const list = d.raw_materials || d;
        if (!Array.isArray(list)) return 'Invalid format.';
        return list.map((item: any, idx: number) => {
          if (typeof item === 'string') return `${idx + 1}) ${item}`;
          return `${idx + 1}) ${item.item || item.raw_material || item.material || 'N/A'} - Qty: ${item.qty1 || item.qty || '-'}`;
        }).join('\n');
      } else {
        if (!Array.isArray(d)) return 'Invalid format.';
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
    const [success, data] = await ComplaintLabAPI.solveComplaint(selectedLabComplaint.product_name, selectedLabComplaint.batch_no);
    setSolving(false);
    if (success) {
      onShowToast('Complaint resolved! Batch removed from lab queue.', 'success');
      setSelectedLabComplaint(null); setLabComplaintDetails(null); setShowModalImages(false);
      loadLabComplaints();
    } else { onShowToast(`Failed to resolve: ${data}`, 'error'); }
  };

  const handleModifyComplaint = async () => {
    if (!selectedLabComplaint || !labComplaintDetails) return;
    const cmsDataToLoad = {
      form_fields: { 'BATCH NO': selectedLabComplaint.batch_no, 'PRODUCT NAME': labComplaintDetails.product_name || 'N/A' },
      inventory: (labComplaintDetails.full_bpbs_data?.raw_materials || []).map((item: any, i: number) => ({
        sr_no: String(i + 1), mr_no: item.mrno || item.mr_no || item.mr || '',
        raw_material: item.item || item.raw_material || item.material || '', qty: String(item.qty1 || item.qty || '')
      })),
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
  const filteredLabBatches = labBatches.filter(b => b.batch_no?.toLowerCase().includes(labSearchTerm.toLowerCase()));
  const labTotalPages = Math.max(1, Math.ceil(filteredLabBatches.length / PAGE_SIZE));
  const paginatedLabBatches = filteredLabBatches.slice((labCurrentPage - 1) * PAGE_SIZE, labCurrentPage * PAGE_SIZE);

  const filteredRepairedBatches = repairedBatches.filter(b => b.batch_no?.toLowerCase().includes(repairedSearchTerm.toLowerCase()));
  const repairedTotalPages = Math.max(1, Math.ceil(filteredRepairedBatches.length / PAGE_SIZE));
  const paginatedRepairedBatches = filteredRepairedBatches.slice((repairedCurrentPage - 1) * PAGE_SIZE, repairedCurrentPage * PAGE_SIZE);

  const filteredResolvedBatches = resolvedBatches.filter(b => b.toLowerCase().includes(resolvedSearchTerm.toLowerCase()));
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

  // --------------------------------------------------------------------------
  // SHARED COMPONENTS
  // --------------------------------------------------------------------------
  const PaginationControls = ({ currentPage, totalPages, pageInput, onPageInput, onGo, onPrev, onNext, light }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={onPrev} disabled={currentPage <= 1}
        style={{ background: 'none', border: `1px solid ${light ? '#94a3b8' : 'rgba(255,255,255,0.3)'}`, borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', color: light ? '#1e293b' : '#f8fafc', opacity: currentPage <= 1 ? 0.4 : 1 }}
      >
        <ChevronLeft size={14} />
      </button>
      <input
        type="text" value={pageInput} onChange={e => onPageInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onGo(); }}
        style={{ width: '40px', textAlign: 'center', padding: '3px', borderRadius: '4px', border: `1px solid ${light ? '#cbd5e1' : 'rgba(255,255,255,0.3)'}`, backgroundColor: light ? '#fff' : 'rgba(255,255,255,0.1)', color: light ? '#1e293b' : '#f8fafc', fontSize: '0.8rem', fontWeight: 700 }}
      />
      <span style={{ fontSize: '0.8rem', color: light ? '#64748b' : '#94a3b8' }}>of {totalPages}</span>
      <button
        onClick={onNext} disabled={currentPage >= totalPages}
        style={{ background: 'none', border: `1px solid ${light ? '#94a3b8' : 'rgba(255,255,255,0.3)'}`, borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', color: light ? '#1e293b' : '#f8fafc', opacity: currentPage >= totalPages ? 0.4 : 1 }}
      >
        <ChevronRight size={14} />
      </button>
      <button
        onClick={onGo}
        style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
      >
        Go
      </button>
    </div>
  );

  // Batch card used in both Lab and Repaired Formulations
  const BatchCard = ({ batchNo, productName, onClick, icon: Icon, iconColor, linkText }: any) => (
    <div
      onClick={onClick}
      style={{
        width: '200px', height: '130px', padding: '15px', backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={18} color={iconColor || '#f59e0b'} />
        <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>{batchNo}</strong>
      </div>
      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />
      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {productName}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
        {linkText || 'View Details'} <ArrowRight size={11} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>

      {/* =================== SUBVIEW 1: COMPLAINT REGISTRATION =================== */}
      {activeSubView === 'complaints' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Complaint Registration</h3>

            {/* Two Column Grid for inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '24px' }}>
              
              {/* Left Column: Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input 
                  type="text" 
                  value={productNameUi} 
                  onChange={e => setProductNameUi(e.target.value)}
                  placeholder="Product Name"
                  style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} 
                />
                
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} 
                />
                
                <input 
                  type="text" 
                  value={batchNo} 
                  onChange={e => setBatchNo(e.target.value)}
                  placeholder="Batch Number"
                  onKeyDown={e => { if (e.key === 'Enter') handleBatchSearch(); }}
                  style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} 
                />
                
                <input 
                  type="text" 
                  value={initialObservation} 
                  onChange={e => setInitialObservation(e.target.value)}
                  placeholder="Initial Observation"
                  style={{ padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} 
                />
              </div>

              {/* Right Column: Complaint Details TextArea */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <textarea 
                  value={complaintDetails} 
                  onChange={e => setComplaintDetails(e.target.value)}
                  placeholder="Complaint Details"
                  style={{ width: '100%', padding: '12px 14px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', flex: 1, boxSizing: 'border-box', minHeight: '180px' }}
                />
              </div>
            </div>

            {/* Separator */}
            <div style={{ borderBottom: '1px solid var(--border-light)', margin: '4px 0' }} />

            {/* Upload Images Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label className="flet-btn" style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px' }}>
                  <Upload size={14} /> Upload Images
                  <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              </div>

              {imagePreviews.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} style={{ width: '80px', height: '80px', borderRadius: '6px', border: '1px solid var(--border-light)', overflow: 'hidden', position: 'relative' }}>
                      <img src={preview} alt="preview" onClick={() => setLightboxImage(preview)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                      <button onClick={() => removeImage(idx)}
                        style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div style={{ borderBottom: '1px solid var(--border-light)', margin: '4px 0' }} />

            {/* Bottom Row: Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleSaveComplaint} disabled={saving} className="flet-btn flet-btn-green"
                style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
              
              <button onClick={clearRegistrationForm} className="flet-btn"
                style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#374151', color: '#fff' }}>
                <X size={14} /> Clear
              </button>
              
              <button onClick={handleMoveToLab} disabled={moving} className="flet-btn flet-btn-blue"
                style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb' }}>
                <Beaker size={14} /> {moving ? 'Moving...' : 'MOVE TO LAB'}
              </button>
              
              <button onClick={openLogsModal} className="flet-btn"
                style={{ height: '32px', padding: '0 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a', color: '#fff' }}>
                <History size={14} /> View Logs
              </button>
            </div>

            {/* Batch summary details / badge if any */}
            {foundProductDb && (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--primary-color)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                  ✓ DB: {foundProductDb}
                </span>
                {batchRefData && (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                      | Raw Materials: {batchRefData.production_sheet_data?.raw_materials?.length || 0}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                      | QC Parameters: {batchRefData.master_test_results?.length || 0}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Batch Reference Panels */}
          {batchRefData && (
            <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '20px' }}>

              {/* Left — BPBS */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '6px' }}>
                  Original Production Batch Sheet (BPBS)
                </strong>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '6px' }}>
                  {/* Header Rows */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <div><strong>Batch Size:</strong> {batchRefData.production_sheet_data?.batch_size || 'N/A'}</div>
                    <div><strong>Date:</strong> {batchRefData.production_sheet_data?.date || 'N/A'}</div>
                    <div><strong>Batch No:</strong> {batchRefData.production_sheet_data?.batch_no || 'N/A'}</div>
                    <div><strong>Product:</strong> {batchRefData.production_sheet_data?.product || 'N/A'}</div>
                    <div><strong>Customer:</strong> {batchRefData.production_sheet_data?.customer || 'N/A'}</div>
                    <div><strong>Ref. No:</strong> {batchRefData.production_sheet_data?.ref_no || 'N/A'}</div>
                    <div><strong>Batch Started:</strong> {batchRefData.production_sheet_data?.batch_started || batchRefData.production_sheet_data?.batch_started_at || 'N/A'}</div>
                    <div><strong>Batch Ended:</strong> {batchRefData.production_sheet_data?.batch_completed || batchRefData.production_sheet_data?.batch_completed_on || 'N/A'}</div>
                  </div>

                  {/* Main Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Raw Materials Recipe List</span>
                    {(() => {
                      const rawMaterials = batchRefData.production_sheet_data?.raw_materials || [];
                      // Create a 30-element array by taking loaded items and padding with empty items
                      const displayRecipe = Array.from({ length: 30 }, (_, i) => {
                        const item = rawMaterials[i] || {};
                        return {
                          sr_no: String(i + 1),
                          item: item.item || item.raw_material || item.material || '',
                          qty1: item.qty1 || item.qty || '',
                          qty2: item.qty2 || '',
                          mrno: item.mrno || item.mr_no || item.mr || '',
                          inputtime: item.inputtime || '',
                          chargedby: item.chargedby || ''
                        };
                      });
                      return (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-medium)' }}>
                                <th style={{ padding: '6px 8px', width: '50px', textAlign: 'center' }}>Sr. No.</th>
                                <th style={{ padding: '6px 8px' }}>Item Description</th>
                                <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>Qty. Used I</th>
                                <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>Qty. Used II</th>
                                <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>M.R. No.</th>
                                <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>Input Time</th>
                                <th style={{ padding: '6px 8px', width: '100px' }}>Charged By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayRecipe.map((r, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', height: '28px' }}>
                                  <td style={{ padding: '4px 8px', textAlign: 'center', backgroundColor: 'var(--bg-light)', fontWeight: 500 }}>{r.sr_no}</td>
                                  <td style={{ padding: '4px 8px', fontWeight: r.item ? 600 : 'normal' }}>{r.item || '-'}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.qty1 || '-'}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.qty2 || '-'}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.mrno || '-'}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.inputtime || '-'}</td>
                                  <td style={{ padding: '4px 8px', textTransform: 'uppercase' }}>{r.chargedby || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* QC & Testing */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Quality Control & Testing</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                        <div><strong>Material:</strong> {batchRefData.production_sheet_data?.qa_material || batchRefData.production_sheet_data?.material || 'N/A'}</div>
                        <div><strong>Q.A. Status:</strong> {batchRefData.production_sheet_data?.qa_status || 'N/A'}</div>
                        <div><strong>Filtered By:</strong> {batchRefData.production_sheet_data?.filtered_by || 'N/A'}</div>
                        <div><strong>Weighted By:</strong> {batchRefData.production_sheet_data?.weighted_by || 'N/A'}</div>
                        <div><strong>Sample Given:</strong> {batchRefData.production_sheet_data?.sample_given || 'N/A'}</div>
                        <div><strong>Machine No.:</strong> {batchRefData.production_sheet_data?.machine_no || 'N/A'}</div>
                        <div><strong>Checked By:</strong> {batchRefData.production_sheet_data?.checked_by || 'N/A'}</div>
                        <div><strong>Final Status:</strong> {batchRefData.production_sheet_data?.qa_final_status || batchRefData.production_sheet_data?.status || 'N/A'}</div>
                        <div style={{ gridColumn: 'span 2' }}><strong>Filter No.:</strong> {batchRefData.production_sheet_data?.filter_no || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Testing & Spec */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Testing & Specifications</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                        <div style={{ gridColumn: 'span 2' }}><strong>Packing Material:</strong> {batchRefData.production_sheet_data?.packing_material || 'N/A'}</div>
                        <div><strong>Density:</strong> {batchRefData.production_sheet_data?.density || 'N/A'}</div>
                        <div><strong>Viscosity:</strong> {batchRefData.production_sheet_data?.viscosity || 'N/A'} Sec/CPS</div>
                        <div><strong>Tested By:</strong> {batchRefData.production_sheet_data?.tested_by || 'N/A'}</div>
                        <div><strong>Solid Content:</strong> {batchRefData.production_sheet_data?.solid || 'N/A'}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Production Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>Production Details</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                      <div><strong>Qty Packed:</strong> {batchRefData.production_sheet_data?.qty_packed || batchRefData.production_sheet_data?.['qty._packed'] || 'N/A'} kg/ltr</div>
                      <div><strong>Tank Cleaning:</strong> {batchRefData.production_sheet_data?.tank_cleaning || batchRefData.production_sheet_data?.tank_cleaning_check || 'N/A'}</div>
                      <div><strong>Formulation:</strong> {batchRefData.production_sheet_data?.formulation || 'N/A'}</div>
                      <div><strong>Tare Weight:</strong> {batchRefData.production_sheet_data?.tare_weight || 'N/A'}</div>
                      <div><strong>Gross Weight:</strong> {batchRefData.production_sheet_data?.gross_weight || 'N/A'}</div>
                      <div><strong>Net Weight:</strong> {batchRefData.production_sheet_data?.net_weight || 'N/A'}</div>
                      <div style={{ gridColumn: 'span 3' }}><strong>Packed By:</strong> {batchRefData.production_sheet_data?.packed_by || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Approvals */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                      <strong>Formula Approval Remarks:</strong>
                      <div style={{ padding: '8px', backgroundColor: 'var(--bg-light)', borderRadius: '4px', fontStyle: 'italic', minHeight: '32px' }}>
                        {batchRefData.production_sheet_data?.signature_approval || batchRefData.production_sheet_data?.signature_of_formula_approval || 'None'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                      <strong>Formula Check Remarks:</strong>
                      <div style={{ padding: '8px', backgroundColor: 'var(--bg-light)', borderRadius: '4px', fontStyle: 'italic', minHeight: '32px' }}>
                        {batchRefData.production_sheet_data?.signature_check || batchRefData.production_sheet_data?.signature_of_formula_check || 'None'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — QC Tests */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-medium)', paddingBottom: '6px' }}>
                  Original QC Lab Test Specifications
                </strong>
                <div style={{ overflowY: 'auto', maxHeight: '400px', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-medium)' }}>
                        <th style={{ padding: '8px 10px' }}>Test Parameter</th>
                        <th style={{ padding: '8px 10px', width: '90px' }}>Standard</th>
                        <th style={{ padding: '8px 10px', width: '90px' }}>Batch Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(batchRefData.master_test_results || []).map((test: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{test.method || '-'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{test.standard || '-'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--success-color)', fontWeight: 'bold' }}>{test.result || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== SUBVIEW 2: LAB COMPLAINTS BOARD =================== */}
      {activeSubView === 'complaints_lab' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

          {/* Dark fixed header */}
          <div style={DARK_HEADER}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Beaker size={26} color="#f8fafc" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>Lab Complaints</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Active Repair Batches</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text" placeholder="Search Batch No..." value={labSearchTerm}
                  onChange={e => { setLabSearchTerm(e.target.value); setLabCurrentPage(1); setLabPageInput('1'); }}
                  style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
                />
              </div>
              <PaginationControls
                currentPage={labCurrentPage} totalPages={labTotalPages}
                pageInput={labPageInput} onPageInput={setLabPageInput}
                onGo={handleLabGoPage}
                onPrev={() => { const p = Math.max(1, labCurrentPage - 1); setLabCurrentPage(p); setLabPageInput(String(p)); }}
                onNext={() => { const p = Math.min(labTotalPages, labCurrentPage + 1); setLabCurrentPage(p); setLabPageInput(String(p)); }}
              />
              <button onClick={loadLabComplaints}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={15} className={loadingLab ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Card grid */}
          <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>
            {loadingLab ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                <RefreshCw className="animate-spin" size={32} color="#3b82f6" />
              </div>
            ) : paginatedLabBatches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
                <CheckCircle2 size={42} color="#10b981" />
                <span style={{ fontWeight: 'bold', color: '#64748b' }}>No active complaints in the lab queue!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {paginatedLabBatches.map((batch, idx) => (
                  <BatchCard key={idx} batchNo={batch.batch_no} productName={batch.product_name}
                    onClick={() => handleOpenLabDetail(batch)} icon={ShieldAlert} iconColor="#f59e0b" linkText="View Details" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== SUBVIEW 3: REPAIRED FORMULATIONS =================== */}
      {activeSubView === 'repaired_formulations' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

          {/* Dark header */}
          <div style={DARK_HEADER}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {repairedViewMode === 'trials' && (
                <button onClick={handleBackToRepairedList}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }}>
                  <ArrowLeft size={20} />
                </button>
              )}
              <Wrench size={26} color="#f8fafc" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
                  {repairedViewMode === 'trials' && selectedRepairedBatch
                    ? `Trials: ${selectedRepairedBatch.batch_no}`
                    : 'Repaired Formulations'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Lab History & Modification Records</div>
              </div>
            </div>
            {repairedViewMode === 'list' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text" placeholder="Search Batch No..." value={repairedSearchTerm}
                    onChange={e => { setRepairedSearchTerm(e.target.value); setRepairedCurrentPage(1); setRepairedPageInput('1'); }}
                    style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
                  />
                </div>
                <PaginationControls
                  currentPage={repairedCurrentPage} totalPages={repairedTotalPages}
                  pageInput={repairedPageInput} onPageInput={setRepairedPageInput}
                  onGo={handleRepairedGoPage}
                  onPrev={() => { const p = Math.max(1, repairedCurrentPage - 1); setRepairedCurrentPage(p); setRepairedPageInput(String(p)); }}
                  onNext={() => { const p = Math.min(repairedTotalPages, repairedCurrentPage + 1); setRepairedCurrentPage(p); setRepairedPageInput(String(p)); }}
                />
                <button onClick={loadRepairedFormulations}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={15} className={loadingRepaired ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>

            {/* LIST MODE */}
            {repairedViewMode === 'list' && (
              loadingRepaired ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={32} color="#3b82f6" /></div>
              ) : paginatedRepairedBatches.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
                  <AlertTriangle size={36} color="#f59e0b" />
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>No repaired formulations archived.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {paginatedRepairedBatches.map((b, idx) => (
                    <BatchCard key={idx} batchNo={b.batch_no} productName={b.product_name}
                      onClick={() => handleSelectRepairedBatch(b)} icon={Beaker} iconColor="#f59e0b" linkText="View Trials" />
                  ))}
                </div>
              )
            )}

            {/* TRIALS MODE */}
            {repairedViewMode === 'trials' && (
              loadingTrials ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={32} color="#3b82f6" /></div>
              ) : trialsList.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
                  <AlertTriangle size={32} color="#f59e0b" />
                  <span style={{ color: '#64748b' }}>No trial versions found for {selectedRepairedBatch?.batch_no}.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>

                  {/* Navigation bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '12px 24px', backgroundColor: '#fff', borderRadius: '50px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <button disabled={activeTrialIdx <= 0} onClick={() => setActiveTrialIdx(p => p - 1)}
                      style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeTrialIdx <= 0 ? 'not-allowed' : 'pointer', color: '#3b82f6', opacity: activeTrialIdx <= 0 ? 0.4 : 1 }}>
                      <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                      Trial {activeTrialIdx + 1} / {trialsList.length}
                    </span>
                    <button disabled={activeTrialIdx >= trialsList.length - 1} onClick={() => setActiveTrialIdx(p => p + 1)}
                      style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeTrialIdx >= trialsList.length - 1 ? 'not-allowed' : 'pointer', color: '#3b82f6', opacity: activeTrialIdx >= trialsList.length - 1 ? 0.4 : 1 }}>
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Trial Card */}
                  {(() => {
                    const trial = trialsList[activeTrialIdx];
                    const { repairedBatchNo, remarks } = parseModificationDetails(trial.modification_details || '');
                    const rawList: any[] = trial.raw_materials || [];
                    const testList: any[] = trial.test_results || [];
                    let createdAtStr = 'N/A';
                    try {
                      createdAtStr = new Date(trial.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } catch { }

                    return (
                      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '720px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Card header: TRIAL # badge + timestamp */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                            TRIAL #{trial.trial_number || (activeTrialIdx + 1)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{createdAtStr}</span>
                        </div>

                        <div style={{ height: '1px', backgroundColor: '#e2e8f0' }} />

                        {/* Details section */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                            <Package size={16} color="#64748b" />
                            <span style={{ fontWeight: 700, color: '#475569' }}>Repaired Batch:</span>
                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{repairedBatchNo}</span>
                          </div>
                          {remarks && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.88rem' }}>
                              <FileText size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span style={{ fontWeight: 700, color: '#475569' }}>Remarks:</span>
                              <span style={{ fontStyle: 'italic', color: '#1e293b' }}>{remarks}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                            <History size={14} />
                            <span>Original: <strong>{trial.original_batch_no || selectedRepairedBatch?.batch_no || 'N/A'}</strong></span>
                            <span>| By: <strong>{trial.created_by || 'Unknown'}</strong></span>
                          </div>
                        </div>

                        {/* Tables */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Raw Materials */}
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: '#3b82f6', borderBottom: '1px solid #e2e8f0' }}>
                              Raw Materials Added
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Material</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rawList.length === 0
                                  ? <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center' }}>No ingredients.</td></tr>
                                  : rawList.map((item: any, i: number) => (
                                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '6px 10px', color: '#1e293b' }}>{item.raw_material || item.material || item.item || '-'}</td>
                                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{item.qty || '0'}</td>
                                    </tr>
                                  ))
                                }
                              </tbody>
                            </table>
                          </div>

                          {/* Test Results */}
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: '#3b82f6', borderBottom: '1px solid #e2e8f0' }}>
                              Lab Test Results
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Method</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {testList.length === 0
                                  ? <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center' }}>No tests recorded.</td></tr>
                                  : testList.map((test: any, i: number) => (
                                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '6px 10px', color: '#1e293b' }}>{test.method || '-'}</td>
                                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{test.result || '-'}</td>
                                    </tr>
                                  ))
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* =================== SUBVIEW 4: RESOLVED COMPLAINTS =================== */}
      {activeSubView === 'resolved_complaints' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '12px', overflow: 'visible', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

          {/* Dark header */}
          <div style={DARK_HEADER}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={26} color="#10b981" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>Resolved Complaints</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Archived resolution records</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px' }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text" placeholder="Search Batch Number..." value={resolvedSearchTerm}
                  onChange={e => { setResolvedSearchTerm(e.target.value); setResolvedCurrentPage(1); setResolvedPageInput('1'); }}
                  onKeyDown={e => { if (e.key === 'Enter') loadResolvedComplaints(resolvedSearchTerm); }}
                  style={{ background: 'none', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '0.85rem', width: '200px' }}
                />
                <button onClick={() => { setResolvedSearchTerm(''); loadResolvedComplaints(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X size={14} />
                </button>
              </div>
              <PaginationControls
                currentPage={resolvedCurrentPage} totalPages={resolvedTotalPages}
                pageInput={resolvedPageInput} onPageInput={setResolvedPageInput}
                onGo={handleResolvedGoPage}
                onPrev={() => { const p = Math.max(1, resolvedCurrentPage - 1); setResolvedCurrentPage(p); setResolvedPageInput(String(p)); }}
                onNext={() => { const p = Math.min(resolvedTotalPages, resolvedCurrentPage + 1); setResolvedCurrentPage(p); setResolvedPageInput(String(p)); }}
              />
              <button onClick={() => loadResolvedComplaints()}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={15} className={loadingResolved ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Resolved batch buttons grid */}
          <div style={{ backgroundColor: '#f1f5f9', padding: '20px', minHeight: '300px' }}>
            {loadingResolved ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                <RefreshCw className="animate-spin" size={32} color="#10b981" />
              </div>
            ) : paginatedResolvedBatches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '10px' }}>
                <CheckCircle2 size={42} color="#10b981" />
                <span style={{ color: '#64748b' }}>No resolved complaints found.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {paginatedResolvedBatches.map((batchNo, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenResolvedDetail(batchNo)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '12px 20px', borderRadius: '8px',
                      backgroundColor: '#10b981', color: '#fff', border: 'none',
                      cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    <CheckCircle2 size={16} />
                    Batch {batchNo}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== MODAL 1: COMPLAINT LOGS =================== */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', minHeight: '520px' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  {selectedLogDetail ? `Details: ${selectedLogDetail.batch_no}` : 'Registered Complaint Logs'}
                </h3>
              </div>
              <button onClick={() => { if (selectedLogDetail) setSelectedLogDetail(null); else setShowLogsModal(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {selectedLogDetail ? (
              <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => { setSelectedLogDetail(null); setIsEditingLog(false); }}
                    style={{ width: 'max-content', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--border-medium)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <ChevronLeft size={14} /> Back to logs
                  </button>
                  {!isEditingLog && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => startEditLog(selectedLogDetail)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--primary-color)', borderRadius: '6px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit3 size={14} /> Edit
                      </button>
                      <button onClick={() => handleDeleteLog(selectedLogDetail)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: '6px', backgroundColor: 'var(--color-error)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>

                {isEditingLog ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Customer Name:</label>
                          <input type="text" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Batch Number:</label>
                          <input type="text" value={editBatchNo} onChange={e => setEditBatchNo(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Product Database:</label>
                          <input type="text" value={editProductName} disabled
                            style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: 'var(--bg-light)', color: 'var(--text-secondary)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Status:</label>
                          <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', height: '30px' }}>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Defect Details Narrative:</label>
                      <textarea rows={4} value={editComplaintText} onChange={e => setEditComplaintText(e.target.value)}
                        style={{ width: '100%', padding: '10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Initial Observation Remarks:</label>
                      <textarea rows={3} value={editObservationText} onChange={e => setEditObservationText(e.target.value)}
                        style={{ width: '100%', padding: '10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button onClick={handleUpdateLog} disabled={updatingLog} className="flet-btn flet-btn-green"
                        style={{ height: '30px', padding: '0 16px', fontSize: '13px', fontWeight: 600 }}>
                        <Check size={14} /> {updatingLog ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => setIsEditingLog(false)} className="flet-btn"
                        style={{ height: '30px', padding: '0 16px', fontSize: '13px', fontWeight: 600 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <div><strong>Batch No:</strong> {selectedLogDetail.batch_no}</div>
                        <div><strong>Customer:</strong> {selectedLogDetail.customer_name}</div>
                        <div><strong>Product Context:</strong> {selectedLogDetail.product_name}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <div><strong>Registered At:</strong> {selectedLogDetail.created_at ? new Date(selectedLogDetail.created_at).toLocaleString() : 'N/A'}</div>
                        <div><strong>Status:</strong> <span style={{ color: selectedLogDetail.status === 'Open' ? 'var(--color-error)' : selectedLogDetail.status === 'In Progress' ? 'var(--color-warning)' : 'var(--success-color)', fontWeight: 'bold' }}>{selectedLogDetail.status}</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Defect Details Narrative:</strong>
                      <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedLogDetail.complaint_text}</p>
                    </div>
                    {selectedLogDetail.observation_text && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>Initial Observation Remarks:</strong>
                        <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedLogDetail.observation_text}</p>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                        <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '4px' }}>Audited Formulation Materials</strong>
                        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto', margin: 0 }}>
                          {parseJsonField(selectedLogDetail.raw_materials, 'rm')}
                        </pre>
                      </div>
                      <div style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                        <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '4px' }}>Audited Lab Test Parameters</strong>
                        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto', margin: 0 }}>
                          {parseJsonField(selectedLogDetail.test_results, 'tests')}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Batch Filter</span>
                    <input type="text" placeholder="Search Batch No..." value={logsSearchTerm}
                      onChange={e => setLogsSearchTerm(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSearchLogs(); }}
                      style={{ width: '140px', padding: '5px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Filter</span>
                    <input type="date" value={logsDateFilter} onChange={e => setLogsDateFilter(e.target.value)}
                      style={{ width: '140px', padding: '5px 10px', fontSize: '0.8rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                    <button onClick={handleSearchLogs} className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Search size={12} /> Apply Filters
                    </button>
                    <button onClick={clearLogsFilters}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}>
                      Clear Filters
                    </button>
                  </div>
                </div>

                {loadingLogs ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><RefreshCw className="animate-spin" size={24} /></div>
                ) : logsList.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '30px 0', textAlign: 'center', fontStyle: 'italic' }}>No registered complaints found.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                    {logsList.map((log, idx) => (
                      <div key={idx} onClick={() => setSelectedLogDetail(log)} className="interactive"
                        style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '0.85rem' }}>Batch: {log.batch_no}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer: {log.customer_name} | Product: {log.product_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{log.created_at ? new Date(log.created_at).toLocaleDateString() : ''}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px', color: '#fff', backgroundColor: log.status === 'Open' ? 'var(--color-error)' : log.status === 'In Progress' ? '#f59e0b' : 'var(--success-color)' }}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <button onClick={() => { if (selectedLogDetail) setSelectedLogDetail(null); else setShowLogsModal(false); }}
                style={{ padding: '8px 16px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}>
                {selectedLogDetail ? 'Back to Logs' : 'Close Logs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================== MODAL 2: LAB COMPLAINT DETAIL =================== */}
      {selectedLabComplaint && (
        <div className="modal-overlay" onClick={() => { setSelectedLabComplaint(null); setLabComplaintDetails(null); setShowModalImages(false); }}>
          <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', borderRadius: '24px', padding: '32px', backgroundColor: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', minHeight: '320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <AlertTriangle size={26} color="#fff" fill="#f59e0b" style={{ marginRight: '10px' }} />
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Batch {selectedLabComplaint.batch_no}
              </h3>
            </div>

            {loadingLabDetail ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><RefreshCw className="animate-spin" size={28} /></div>
            ) : !labComplaintDetails ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>Failed to load complaint repair metadata.</div>
            ) : (
              <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: '#f0f4f8', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>PRODUCT</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{labComplaintDetails.product_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>CUSTOMER</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{labComplaintDetails.customer_name || 'N/A'}</div>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 20px 0' }} />

                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '6px' }}>Complaint</strong>
                  <p style={{ fontSize: '0.9rem', margin: 0, color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{labComplaintDetails.complaint || 'No details.'}</p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '6px' }}>Observation</strong>
                  <p style={{ fontSize: '0.9rem', margin: 0, color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{labComplaintDetails.observation || 'No remarks.'}</p>
                </div>

                {showModalImages && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', backgroundColor: '#f8fafc', marginBottom: '20px' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', color: '#475569' }}>
                      Attached Images ({labComplaintDetails.image_references?.length || 0})
                    </strong>
                    {labComplaintDetails.image_references && labComplaintDetails.image_references.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {labComplaintDetails.image_references.map((filename: string, idx: number) => {
                          const fileUrl = `${API_BASE_URL}/complaint-lab/image/${selectedLabComplaint.product_name}/${filename}`;
                          return (
                            <div key={idx} onClick={() => setLightboxImage(fileUrl)}
                              style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer', position: 'relative' }}>
                              <img src={fileUrl} alt="defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '4px', color: '#fff' }}><ZoomIn size={10} /></div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>No images attached to this complaint.</div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
                  <button onClick={() => setShowModalImages(!showModalImages)} 
                    style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '38px',
                      padding: '0 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      cursor: 'pointer',
                      outline: 'none'
                    }}>
                    <Image size={14} style={{ marginRight: '6px' }} /> View Images
                  </button>

                  <button onClick={handleModifyComplaint} 
                    style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '38px',
                      padding: '0 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none'
                    }}>
                    <Edit3 size={14} style={{ marginRight: '6px' }} /> Modify
                  </button>

                  <button onClick={handleSolveComplaint} disabled={solving} 
                    style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '38px',
                      padding: '0 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                      opacity: solving ? 0.7 : 1
                    }}>
                    <CheckCircle2 size={14} style={{ marginRight: '6px' }} /> {solving ? 'Solving...' : 'Mark Solved'}
                  </button>

                  <button onClick={() => { setSelectedLabComplaint(null); setLabComplaintDetails(null); setShowModalImages(false); }} 
                    style={{ 
                      background: 'none',
                      border: 'none',
                      padding: '0 12px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#2563eb',
                      cursor: 'pointer',
                      outline: 'none'
                    }}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== MODAL 3: RESOLVED COMPLAINT DETAIL =================== */}
      {selectedResolvedBatch && (
        <div className="modal-overlay" onClick={() => { setSelectedResolvedBatch(null); setResolvedDetails(null); }}>
          <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', minHeight: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <CheckCircle2 size={22} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>✓ Resolved: {selectedResolvedBatch}</h3>
              </div>
              <button onClick={() => { setSelectedResolvedBatch(null); setResolvedDetails(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
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
                  <button onClick={() => { setSelectedResolvedBatch(null); setResolvedDetails(null); }}
                    style={{ padding: '8px 20px', fontSize: '0.85rem', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600 }}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== LIGHTBOX =================== */}
      {lightboxImage && (
        <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.88)' }} onClick={() => setLightboxImage(null)}>
          <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightboxImage(null)}
              style={{ position: 'absolute', top: '-44px', right: '-8px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={32} />
            </button>
            <img src={lightboxImage} alt="lightbox" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '10px' }} />
          </div>
        </div>
      )}

    </div>
  );
};
