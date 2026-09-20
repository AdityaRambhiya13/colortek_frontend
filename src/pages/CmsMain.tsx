import React, { useState, useEffect, useRef } from 'react';
import { 
  Beaker, Search, Filter, RefreshCw, FileSpreadsheet, ArrowLeft, ArrowRight,
  AlertTriangle, Copy, Trash2, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Building,
  Edit3, ZoomIn, Bell, Info, Printer, Star, Lock, Key, ShieldCheck, Eye, EyeOff
} from 'lucide-react';
import { CmsNotifications } from './Cms/components/CmsNotifications';
import { StarRatingModal } from './Cms/components/StarRatingModal';
import { BatchModificationModal } from './Cms/components/BatchModificationModal';
import { LightboxModal } from './Cms/components/LightboxModal';
import { FormulationPanel } from './Cms/components/FormulationPanel';
import { DuplicateOverlay } from './Cms/components/DuplicateOverlay';
import { useExports } from './Cms/hooks/useExports';
import { ComplaintRepairBpbsPanel } from './Cms/components/ComplaintRepairBpbsPanel';
import { CMSAPI, LabPastFormulationsAPI, RMPastFormulationsAPI, LabFormulationsAPI, RMFormulationsAPI, RawMaterialAPI, RepairedFormulationsAPI, API_BASE_URL, NotificationsAPI, AuthAPI } from '../services/api';
import * as XLSX from '../xlsxWrapper';
import { jsPDF } from 'jspdf';

interface CmsMainProps {
  activeSubView: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onChangeView: (view: string) => void;
}

interface FormFields {
  refNo: string;
  batchNo: string;
  product: string;
  rmLot: string;
  rmName: string;
  testDate: string;
  reportDate: string;
  formulaDate: string;
}

interface InventoryRow {
  sr: string;
  mr: string;
  material: string;
  qty: string;
  solid?: string;
  solid_qty?: string;
  selected?: boolean;
}

interface TestRow {
  method: string;
  standard: string;
  result: string;
  selected?: boolean;
  isDefault?: boolean;
}

export const CmsMain: React.FC<CmsMainProps> = ({ activeSubView, onShowToast, onChangeView }) => {
  const productName = sessionStorage.getItem('product_name') || '';

  const [selectedPastBatches, setSelectedPastBatches] = useState<string[]>([]);
  const skipDuplicateCheck = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  const [starModalOpen, setStarModalOpen] = useState(false);
  const [selectedBatchForStar, setSelectedBatchForStar] = useState<{ batchNo: string; isStarred: boolean; okRating: string } | null>(null);
  const [okRatingInput, setOkRatingInput] = useState('');
  const [isStarredOnlyFilter, setIsStarredOnlyFilter] = useState(false);
  const [lastNextBatchNo, setLastNextBatchNo] = useState<string>('');

  
  // --------------------------------------------------------------------------
  // STATE DEFINITIONS FOR THE DUAL FORMULATION PANELS
  // --------------------------------------------------------------------------
  const activeProductFormatted = (sessionStorage.getItem('product_name') || '').replace(/_/g, ' ').toUpperCase();
  const [leftForm, setLeftForm] = useState<FormFields>({ refNo: '', batchNo: '', product: activeProductFormatted, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
  const [rightForm, setRightForm] = useState<FormFields>({ refNo: '', batchNo: '', product: activeProductFormatted, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
  const [leftOriginalBatchNo, setLeftOriginalBatchNo] = useState<string>('');
  const [rightOriginalBatchNo, setRightOriginalBatchNo] = useState<string>('');
  
  const [leftRemarks, setLeftRemarks] = useState('');
  const [rightRemarks, setRightRemarks] = useState('');
  const [printSlot, setPrintSlot] = useState<'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right'>('top-left');

  // Report status & Approved by for RM Testing
  const [leftStatus, setLeftStatus] = useState('Select');
  const [rightStatus, setRightStatus] = useState('Select');
  const [leftApprovedBy, setLeftApprovedBy] = useState('');
  const [rightApprovedBy, setRightApprovedBy] = useState('');

  // Complaint Repair mode states
  const [isComplaintMode, setIsComplaintMode] = useState(false);
  const [bpbsData, setBpbsData] = useState<any | null>(null);
  const [imageReferences, setImageReferences] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [complaintOriginInfo, setComplaintOriginInfo] = useState<any | null>(null);

  // Batch modification authorization state
  const [modifyAuthModalOpen, setModifyAuthModalOpen] = useState(false);
  const [batchToModify, setBatchToModify] = useState<{ batchNo: string; side: 'left' | 'right'; isLab: boolean } | null>(null);
  const [modifyPasswordInput, setModifyPasswordInput] = useState('');
  const [showModifyPassword, setShowModifyPassword] = useState(false);
  const [modifyPasswordError, setModifyPasswordError] = useState('');
  const [modifyAuthLoading, setModifyAuthLoading] = useState(false);

  const handleOpenModifyAuthModal = (batchNo: string, side: 'left' | 'right', isLab: boolean) => {
    setBatchToModify({ batchNo, side, isLab });
    setModifyPasswordInput('');
    setModifyPasswordError('');
    setShowModifyPassword(false);
    setModifyAuthModalOpen(true);
  };

  const handleVerifyModifyPasswordAndLoad = async (password: string) => {
    if (!batchToModify) return;

    if (!password.trim()) {
      setModifyPasswordError('Please enter your batch modification authorization password.');
      return;
    }

    setModifyAuthLoading(true);
    setModifyPasswordError('');

    const currentUsername = sessionStorage.getItem('username') || '';
    const [success, resData] = await AuthAPI.verifyModifyPassword(currentUsername, password.trim());
    setModifyAuthLoading(false);

    if (success) {
      const targetSide = batchToModify.side;
      const targetBatchNo = batchToModify.batchNo;
      const isLab = batchToModify.isLab;
      setModifyAuthModalOpen(false);
      setBatchToModify(null);

      onChangeView(isLab ? 'lab_formulations' : 'rm_testing');
      setTimeout(() => {
        loadBatchIntoPane(targetBatchNo, targetSide, isLab);
        onShowToast(`Authorization verified. Batch ${targetBatchNo} loaded in ${targetSide.toUpperCase()} panel for modification.`, 'success');
      }, 150);
    } else {
      setModifyPasswordError(typeof resData === 'string' ? resData : 'Incorrect modification password or access denied.');
    }
  };

  // 25 lines of material rows (matching Flet CMS config)
  const initializeRows = (): InventoryRow[] => 
    Array.from({ length: 25 }, (_, i) => ({ sr: (i + 1).toString(), mr: '', material: '', qty: '', solid: '', solid_qty: '0', selected: false }));
  
  const [leftRows, setLeftRows] = useState<InventoryRow[]>(initializeRows());
  const [rightRows, setRightRows] = useState<InventoryRow[]>(initializeRows());

  // Test Parameter Rows — exactly matching lab_formulations_cms.py test_methods list
  const initializeTestRows = (): TestRow[] => [
    { method: 'RM VISCOSITY',    standard: 'GTP-06',       result: '', selected: false, isDefault: true },
    { method: 'RM SOLID',        standard: 'IR',           result: '', selected: false, isDefault: true },
    { method: 'LACQUER VISC.',   standard: 'GTP-06',       result: '', selected: false, isDefault: true },
    { method: 'PH VALUE',        standard: 'WI-QC-03',     result: '', selected: false, isDefault: true },
    { method: 'ACID VALUE',      standard: 'WI-R&D-01',    result: '', selected: false, isDefault: true },
    { method: 'AMINE VALUE',     standard: 'WI-R&D-02',    result: '', selected: false, isDefault: true },
    { method: 'LACQUER CLARITY', standard: 'STP-01',       result: '', selected: false, isDefault: true },
    { method: 'LEVEL',           standard: 'STP-08',       result: '', selected: false, isDefault: true },
    { method: 'COVERAGE',        standard: 'STP-04',       result: '', selected: false, isDefault: true },
    { method: 'WETTING',         standard: 'STP-17',       result: '', selected: false, isDefault: true },
    { method: 'ADHESION',        standard: 'GTP-01',       result: '', selected: false, isDefault: true },
    { method: 'MEK',             standard: 'STP-09',       result: '', selected: false, isDefault: true },
    { method: 'HARDNESS',        standard: 'GTP-04',       result: '', selected: false, isDefault: true },
    { method: 'GLASS EFFECT',    standard: 'GTP-02',       result: '', selected: false, isDefault: true },
    { method: 'YELLOWING TEST',  standard: 'STP-18',       result: '', selected: false, isDefault: true },
    { method: 'HAZINESS',        standard: 'STP-01',       result: '', selected: false, isDefault: true },
    { method: 'RECOATING',       standard: 'STP-15',       result: '', selected: false, isDefault: true },
    { method: 'PERFUME/ALCOHOL', standard: 'STP-05/STP-02',result: '', selected: false, isDefault: true },
    { method: 'COLORBLEEDING',   standard: 'STP-03',       result: '', selected: false, isDefault: true },
    { method: 'WATER TEST',      standard: 'GTP-03',       result: '', selected: false, isDefault: true },
  ];

  const [leftTestRows, setLeftTestRows] = useState<TestRow[]>(initializeTestRows());
  const [rightTestRows, setRightTestRows] = useState<TestRow[]>(initializeTestRows());

  // Loader & Dialog controllers
  const [loading, setLoading] = useState(false);
  const [duplicateMatchesLeft, setDuplicateMatchesLeft] = useState<any[]>([]); // matches Left formulation, shown on Right panel
  const [duplicateMatchesRight, setDuplicateMatchesRight] = useState<any[]>([]); // matches Right formulation, shown on Left panel
  const [matchedBatchSide, setMatchedBatchSide] = useState<'left' | 'right'>('left');

  // Symmetrical detailed duplicate states
  const [duplicateDetailsLeft, setDuplicateDetailsLeft] = useState<any | null>(null);
  const [selectedDuplicateBatchNoLeft, setSelectedDuplicateBatchNoLeft] = useState<string | null>(null);
  const [duplicateDetailsRight, setDuplicateDetailsRight] = useState<any | null>(null);
  const [selectedDuplicateBatchNoRight, setSelectedDuplicateBatchNoRight] = useState<string | null>(null);

  const fetchDuplicateDetails = async (batchNo: string, side: 'left' | 'right') => {
    const [success, data] = await LabFormulationsAPI.getBatchDetail(batchNo, productName);
    if (success && typeof data !== 'string') {
      if (side === 'left') {
        setSelectedDuplicateBatchNoLeft(batchNo);
        setDuplicateDetailsLeft(data);
      } else {
        setSelectedDuplicateBatchNoRight(batchNo);
        setDuplicateDetailsRight(data);
      }
    }
  };

  // Live Cross-Table Duplicate indicator
  const [isCrossDuplicate, setIsCrossDuplicate] = useState(false);

  // --------------------------------------------------------------------------
  // STATE DEFINITIONS FOR THE PAST ENTRIES GRID VIEW
  // --------------------------------------------------------------------------
  const [pastBatches, setPastBatches] = useState<any[]>([]);
  const [pastCurrentPage, setPastCurrentPage] = useState(1);
  const [pastTotalPages, setPastTotalPages] = useState(1);
  const [pastSearchTerm, setPastSearchTerm] = useState('');
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);

  // --------------------------------------------------------------------------
  // AUTO-CALCULATION OF WEIGHTS
  // --------------------------------------------------------------------------
  const calculateTotalWeight = (rows: InventoryRow[]) => {
    return rows.reduce((sum, row) => {
      const q = parseFloat(row.qty);
      return isNaN(q) ? sum : sum + q;
    }, 0).toFixed(2);
  };

  const calculateTotalSolidQty = (rows: InventoryRow[]) => {
    return rows.reduce((sum, row) => {
      const q = parseFloat(row.qty);
      if (isNaN(q)) return sum;
      const rawS = row.solid !== undefined && row.solid !== null ? row.solid.toString().trim().toLowerCase() : '';
      if (rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil') return sum;
      const s = parseFloat(rawS);
      const sPct = isNaN(s) ? 0 : s;
      return sum + (q * (sPct / 100));
    }, 0).toFixed(2);
  };

  const calculateFormulationSolidity = (rows: InventoryRow[]) => {
    const totalWeight = parseFloat(calculateTotalWeight(rows));
    const totalSolidQty = parseFloat(calculateTotalSolidQty(rows));
    if (isNaN(totalWeight) || totalWeight === 0) return '0.00';
    const solidity = (totalSolidQty * 100) / totalWeight;
    return solidity.toFixed(2);
  };

  const getNextBatchNumber = (batchNoStr: string) => {
    if (!batchNoStr || !batchNoStr.trim()) return 'R-0001';
    const trimmed = batchNoStr.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const nextVal = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
      return `${prefix}${nextVal}`;
    }
    return `${trimmed}-1`;
  };

  const openStarModal = (batchNo: string, isStarred: boolean = false, currentOkRating: string = '') => {
    if (!batchNo || !batchNo.trim()) {
      onShowToast('Batch No is required to bookmark formulation.', 'warning');
      return;
    }
    setSelectedBatchForStar({ batchNo, isStarred, okRating: currentOkRating });
    setOkRatingInput(currentOkRating || '95% OK');
    setStarModalOpen(true);
  };

  const handleSaveStarStatus = async (starredStatus: boolean) => {
    if (!selectedBatchForStar) return;
    try {
      setLoading(true);
      const [success, res] = await LabFormulationsAPI.toggleStar(
        productName, 
        selectedBatchForStar.batchNo, 
        starredStatus, 
        okRatingInput
      );
      if (success) {
        onShowToast(starredStatus ? `Bookmarked ${selectedBatchForStar.batchNo} (${okRatingInput})` : `Unstarred ${selectedBatchForStar.batchNo}`, 'success');
        setStarModalOpen(false);
        setSelectedBatchForStar(null);
        if (activeSubView === 'past_lab_formulations') {
          loadPastFormulations();
        }
      } else {
        onShowToast(typeof res === 'string' ? res : 'Failed to update star bookmark', 'error');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update star bookmark', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExitComplaintMode = () => {
    setIsComplaintMode(false);
    setBpbsData(null);
    setImageReferences([]);
    setComplaintOriginInfo(null);
    setLeftForm({ refNo: '', batchNo: '', product: (sessionStorage.getItem('product_name') || '').replace(/_/g, ' ').toUpperCase(), rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
    setLeftRows(initializeRows());
    setLeftTestRows(initializeTestRows());
    setLeftRemarks('');
    onShowToast('Exited repair mode to standard dual workspace.', 'info');
  };

  const handleSaveAsNewTrial = async () => {
    console.log("[START] Executing 'Save as New Trial'...");
    if (!complaintOriginInfo) {
      onShowToast("Original complaint context is missing. Cannot save trial.", "error");
      return;
    }

    const repairedBatchNo = rightForm.batchNo;
    if (!repairedBatchNo || !repairedBatchNo.trim()) {
      onShowToast("Please enter a Repaired Batch No (in the Batch No field) on the right side.", "warning");
      return;
    }

    const currentInventory = rightRows
      .filter(r => r.material.trim() !== '')
      .map(r => ({
        raw_material: r.material,
        qty: r.qty
      }));

    if (currentInventory.length === 0) {
      onShowToast("At least one raw material is required to save a trial.", "warning");
      return;
    }

    const currentTests = rightTestRows
      .filter(t => t.method.trim() !== '')
      .map(t => ({
        method: t.method,
        result: t.result
      }));

    const remarksText = rightRemarks || "";

    // Format: "Batch: {Number} | {Remarks}"
    let formattedDetails = `Batch: ${repairedBatchNo}`;
    if (remarksText) {
      formattedDetails += ` | ${remarksText}`;
    }

    const trialPayload = {
      original_batch_no: complaintOriginInfo.batch_no,
      modification_details: formattedDetails,
      raw_materials: currentInventory,
      test_results: currentTests
    };

    setLoading(true);
    const [success, response] = await RepairedFormulationsAPI.createNewTrial(complaintOriginInfo.product_name, trialPayload);
    setLoading(false);

    if (success) {
      onShowToast(`New trial (Batch ${repairedBatchNo}) has been saved to Repaired Formulations.`, "success");
    } else {
      const errorMsg = response && typeof response === 'object' && response.detail 
        ? response.detail 
        : (typeof response === 'string' ? response : "An unknown error occurred.");
      onShowToast(`Failed to save trial: ${errorMsg}`, "error");
    }
  };

  // Check and load complaint details if in complaint repair context
  useEffect(() => {
    if (activeSubView === 'lab_formulations') {
      const cmsContext = sessionStorage.getItem('cms_context');
      const dataStr = sessionStorage.getItem('complaint_data_to_load_in_cms');
      const bpbsStr = sessionStorage.getItem('bpbs_data_to_load_in_cms');
      
      if (cmsContext === 'complaint_repair' && dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed) {
            setIsComplaintMode(true);
            
            // 1. Populate the RIGHT panel
            const formFields = parsed.form_fields || {};
            setRightForm({
              refNo: '',
              batchNo: formFields['BATCH NO'] || '',
              product: formFields['PRODUCT NAME'] || '',
              rmLot: '', rmName: '',
              testDate: '',
              reportDate: '',
              formulaDate: ''
            });
            
            setRightRemarks(parsed.remarks || '');
            
            // Map inventory rows and fill up to 25 rows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inventory = (parsed.inventory || []).map((i: any) => ({
              sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
              material: i.raw_material || i.material || '',
              qty: i.qty !== undefined ? i.qty.toString() : '',
              mr: i.mr_no || i.mr || '',
              selected: false
            }));
            const paddedInventory = [...inventory];
            while (paddedInventory.length < 25) {
              paddedInventory.push({ sr: (paddedInventory.length + 1).toString(), mr: '', material: '', qty: '', selected: false });
            }
            setRightRows(paddedInventory);
            
            // Merge test results into Right panel test methods
            const defaultTestRows = initializeTestRows();
            const incomingTests = parsed.tests || [];
            
            const incomingMap = new Map();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            incomingTests.forEach((t: any) => {
              if (t.method) {
                incomingMap.set(t.method.toUpperCase(), t);
              }
            });
            
            const mergedTests = defaultTestRows.map(def => {
              const matched = incomingMap.get(def.method.toUpperCase());
              if (matched) {
                return {
                  ...def,
                  result: matched.result || ''
                };
              }
              return def;
            });
            
            // Append any non-standard incoming tests
            const defaultMethods = new Set(defaultTestRows.map(d => d.method.toUpperCase()));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            incomingTests.forEach((t: any) => {
              if (t.method && !defaultMethods.has(t.method.toUpperCase())) {
                mergedTests.push({
                  method: t.method,
                  standard: t.standard || '',
                  result: t.result || '',
                  selected: false
                });
              }
            });
            setRightTestRows(mergedTests);
            
            // Image references
            setImageReferences(parsed.image_references || []);
            
            // 2. Populate the LEFT panel BPBS data if it exists
            if (bpbsStr) {
              try {
                const parsedBpbs = JSON.parse(bpbsStr);
                setBpbsData(parsedBpbs);
              } catch (e) {
                console.error('Error parsing BPBS data:', e);
              }
            } else {
              setBpbsData(null);
            }
            
            // Get original info
            const originStr = sessionStorage.getItem('complaint_origin_info');
            if (originStr) {
              try {
                setComplaintOriginInfo(JSON.parse(originStr));
              } catch (e) {
                console.error('Error parsing complaint origin info:', e);
              }
            }
            
            // Clear session storage context and data so it doesn't reload on subsequent renders
            sessionStorage.removeItem('cms_context');
            sessionStorage.removeItem('complaint_data_to_load_in_cms');
            sessionStorage.removeItem('bpbs_data_to_load_in_cms');
            sessionStorage.removeItem('complaint_origin_info');
            
            onShowToast('Recipe repair data loaded in Right panel!', 'success');
          }
        } catch (e) {
          console.error('Error loading complaint data in CMS:', e);
        }
      }
    }
  }, [activeSubView]);

  // Re-run whenever quantities change
  useEffect(() => {
    if (activeSubView === 'lab_formulations' || activeSubView === 'rm_testing') {
      checkLiveCrossDuplicates();
    }
  }, [leftRows, rightRows]);

  // Reset duplicate matches state and spreadsheet panels when active view changes
  useEffect(() => {
    setDuplicateMatchesLeft([]);
    setDuplicateMatchesRight([]);
    setDuplicateDetailsLeft(null);
    setSelectedDuplicateBatchNoLeft(null);
    setDuplicateDetailsRight(null);
    setSelectedDuplicateBatchNoRight(null);
    setDismissedDuplicatesLeft(new Set());
    setDismissedDuplicatesRight(new Set());

    // Reset spreadsheet states to prevent data bleeding between tabs (Lab Formulations vs RM Testing)
    const activeProd = (sessionStorage.getItem('product_name') || '').replace(/_/g, ' ').toUpperCase();
    setLeftForm({ refNo: '', batchNo: '', product: activeProd, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
    setLeftOriginalBatchNo('');
    setLeftRows(initializeRows());
    setLeftTestRows(initializeTestRows());
    setLeftRemarks('');
    setLeftStatus('Select');
    setLeftApprovedBy('');

    setRightForm({ refNo: '', batchNo: '', product: activeProd, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
    setRightOriginalBatchNo('');
    setRightRows(initializeRows());
    setRightTestRows(initializeTestRows());
    setRightRemarks('');
    setRightStatus('Select');
    setRightApprovedBy('');
    
    setLastCheckedLeftKey('');
    setLastCheckedRightKey('');
  }, [activeSubView]);

  // Real-time automatic duplicate checking state
  const [lastCheckedLeftKey, setLastCheckedLeftKey] = useState<string>('');
  const [lastCheckedRightKey, setLastCheckedRightKey] = useState<string>('');
  const [dismissedDuplicatesLeft, setDismissedDuplicatesLeft] = useState<Set<string>>(new Set());
  const [dismissedDuplicatesRight, setDismissedDuplicatesRight] = useState<Set<string>>(new Set());

  // Real-time debounced database duplicate check for lab formulations (symmetrical)
  useEffect(() => {
    if (activeSubView !== 'lab_formulations') return;

    const handler = setTimeout(() => {
      autoCheckDuplicates('left');
      autoCheckDuplicates('right');
    }, 1000); // 1-second debounce to allow typing

    return () => clearTimeout(handler);
  }, [leftRows, rightRows, activeSubView]);

  // Clear checks and dismissed list when product workspace changes
  useEffect(() => {
    setLastCheckedLeftKey('');
    setLastCheckedRightKey('');
    setDismissedDuplicatesLeft(new Set());
    setDismissedDuplicatesRight(new Set());
  }, [productName]);

  // Clear checks and dismissed list when Left batch number changes
  useEffect(() => {
    setLastCheckedLeftKey('');
    setDismissedDuplicatesLeft(new Set());
  }, [leftForm.batchNo]);

  // Clear checks and dismissed list when Right batch number changes
  useEffect(() => {
    setLastCheckedRightKey('');
    setDismissedDuplicatesRight(new Set());
  }, [rightForm.batchNo]);

  // Excel-like Keyboard navigation logic (arrows, Tab, Shift+Tab, and Enter)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    side: 'left' | 'right', 
    rowIndex: number, 
    colType: 'mr' | 'mat' | 'qty' | 'solid'
  ) => {
    const rowsLength = side === 'left' ? leftRows.length : rightRows.length;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < rowsLength - 1) {
        const selector = `input[id="${side}-${colType}-${rowIndex + 1}"]`;
        const nextInput = document.querySelector(selector) as HTMLInputElement;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
      }
    } else if (e.key === 'ArrowDown' && rowIndex < rowsLength - 1) {
      e.preventDefault();
      const nextInput = document.querySelector(`input[id="${side}-${colType}-${rowIndex + 1}"]`) as HTMLInputElement;
      if (nextInput) { nextInput.focus(); nextInput.select(); }
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(`input[id="${side}-${colType}-${rowIndex - 1}"]`) as HTMLInputElement;
      if (prevInput) { prevInput.focus(); prevInput.select(); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      let selector = '';
      
      if (e.shiftKey) {
        // Navigate backwards
        if (colType === 'solid') {
          selector = `input[id="${side}-qty-${rowIndex}"]`;
        } else if (colType === 'qty') {
          selector = `input[id="${side}-mat-${rowIndex}"]`;
        } else if (colType === 'mat') {
          if (activeSubView === 'rm_testing') {
            selector = `input[id="${side}-mr-${rowIndex}"]`;
          } else if (rowIndex > 0) {
            selector = activeSubView === 'lab_formulations'
              ? `input[id="${side}-solid-${rowIndex - 1}"]`
              : `input[id="${side}-qty-${rowIndex - 1}"]`;
          } else {
            selector = `input[id="${side}-reportDate"]`;
          }
        } else if (colType === 'mr') {
          if (rowIndex > 0) {
            selector = activeSubView === 'lab_formulations'
              ? `input[id="${side}-solid-${rowIndex - 1}"]`
              : `input[id="${side}-qty-${rowIndex - 1}"]`;
          } else {
            selector = `input[id="${side}-reportDate"]`;
          }
        }
      } else {
        // Navigate forwards
        if (colType === 'mr') {
          selector = `input[id="${side}-mat-${rowIndex}"]`;
        } else if (colType === 'mat') {
          selector = `input[id="${side}-qty-${rowIndex}"]`;
        } else if (colType === 'qty') {
          if (activeSubView === 'lab_formulations') {
            selector = `input[id="${side}-solid-${rowIndex}"]`;
          } else if (rowIndex < rowsLength - 1) {
            selector = activeSubView === 'rm_testing' 
              ? `input[id="${side}-mr-${rowIndex + 1}"]` 
              : `input[id="${side}-mat-${rowIndex + 1}"]`;
          } else {
            selector = `input[id="${side}-test-method-0"]`;
          }
        } else if (colType === 'solid') {
          if (rowIndex < rowsLength - 1) {
            selector = `input[id="${side}-mat-${rowIndex + 1}"]`;
          } else {
            selector = `input[id="${side}-test-method-0"]`;
          }
        }
      }
      
      if (selector) {
        let nextInput = document.querySelector(selector) as HTMLElement;
        if (!nextInput && !e.shiftKey) {
          nextInput = document.querySelector(`textarea[id="${side}-remarks"]`) as HTMLElement;
        }
        if (nextInput) {
          nextInput.focus();
          if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
            (nextInput as any).select();
          }
        }
      }
    }
  };

  const handleTestCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    side: 'left' | 'right', 
    rowIndex: number, 
    colType: 'method' | 'standard' | 'result'
  ) => {
    const testRows = side === 'left' ? leftTestRows : rightTestRows;
    const rowsLength = testRows.length;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < rowsLength - 1) {
        const selector = `input[id="${side}-test-${colType}-${rowIndex + 1}"]`;
        const nextInput = document.querySelector(selector) as HTMLInputElement;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
      }
    } else if (e.key === 'ArrowDown' && rowIndex < rowsLength - 1) {
      e.preventDefault();
      const nextInput = document.querySelector(`input[id="${side}-test-${colType}-${rowIndex + 1}"]`) as HTMLInputElement;
      if (nextInput) { nextInput.focus(); nextInput.select(); }
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(`input[id="${side}-test-${colType}-${rowIndex - 1}"]`) as HTMLInputElement;
      if (prevInput) { prevInput.focus(); prevInput.select(); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      let selector = '';
      if (e.shiftKey) {
        // Navigate backwards
        if (colType === 'result') {
          selector = `input[id="${side}-test-standard-${rowIndex}"]`;
        } else if (colType === 'standard') {
          selector = `input[id="${side}-test-method-${rowIndex}"]`;
        } else if (colType === 'method') {
          if (rowIndex > 0) {
            selector = `input[id="${side}-test-result-${rowIndex - 1}"]`;
          } else {
            const rowsLength = (side === 'left' ? leftRows : rightRows).length;
            selector = activeSubView === 'lab_formulations'
              ? `input[id="${side}-solid-${rowsLength - 1}"]`
              : `input[id="${side}-qty-${rowsLength - 1}"]`;
          }
        }
      } else {
        // Navigate forwards
        if (colType === 'method') {
          selector = `input[id="${side}-test-standard-${rowIndex}"]`;
        } else if (colType === 'standard') {
          selector = `input[id="${side}-test-result-${rowIndex}"]`;
        } else if (colType === 'result') {
          if (rowIndex < rowsLength - 1) {
            selector = `input[id="${side}-test-method-${rowIndex + 1}"]`;
          } else {
            selector = `textarea[id="${side}-remarks"]`;
          }
        }
      }
      if (selector) {
        const nextInput = document.querySelector(selector) as HTMLElement;
        if (nextInput) {
          nextInput.focus();
          if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
            (nextInput as any).select();
          }
        }
      }
    }
  };

  const handleHeaderFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, side: 'left' | 'right', fieldName: string) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      if (fieldName === 'reportDate') {
        e.preventDefault();
        const firstCell = document.querySelector(
          activeSubView === 'rm_testing' ? `input[id="${side}-mr-0"]` : `input[id="${side}-mat-0"]`
        ) as HTMLElement;
        if (firstCell) {
          firstCell.focus();
          if ('select' in firstCell) (firstCell as any).select();
        }
      }
    }
  };

  // Normalization utils matching Python duplicate models
  const normalizeMaterialName = (name: string) => {
    if (!name) return '';
    let clean = name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').trim();
    if (clean.startsWith('r') && /^\d+$/.test(clean.slice(1))) {
      return `r${clean.slice(1).padStart(3, '0')}`;
    }
    if (clean.startsWith('b') && /^\d+$/.test(clean.slice(1))) {
      return `b${clean.slice(1).padStart(3, '0')}`;
    }
    if (clean.startsWith('w') && /^\d+$/.test(clean.slice(1))) {
      return `w${clean.slice(1).padStart(3, '0')}`;
    }
    return clean;
  };

  // 1. Cross-Table live duplicate checking
  const checkLiveCrossDuplicates = () => {
    if (isComplaintMode) {
      setIsCrossDuplicate(false);
      return;
    }
    const extractPairs = (rows: InventoryRow[]) => {
      return rows
        .map(r => ({ mat: normalizeMaterialName(r.material), qty: parseFloat(r.qty) }))
        .filter(p => p.mat !== '' && !isNaN(p.qty));
    };

    const leftPairs = extractPairs(leftRows);
    const rightPairs = extractPairs(rightRows);

    if (leftPairs.length === 0 || rightPairs.length === 0) {
      setIsCrossDuplicate(false);
      return;
    }

    if (leftPairs.length !== rightPairs.length) {
      setIsCrossDuplicate(false);
      return;
    }

    // Sort and compare elements
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortFn = (a: any, b: any) => a.mat.localeCompare(b.mat) || a.qty - b.qty;
    const sortedLeft = [...leftPairs].sort(sortFn);
    const sortedRight = [...rightPairs].sort(sortFn);

    const match = sortedLeft.every((p, idx) => p.mat === sortedRight[idx].mat && p.qty.toFixed(2) === sortedRight[idx].qty.toFixed(2));
    setIsCrossDuplicate(match);
  };

  // Real-time automatic duplicate checking from database (symmetrical)
  const autoCheckDuplicates = async (side: 'left' | 'right') => {
    if (skipDuplicateCheck.current[side]) {
      const setDuplicateMatches = side === 'left' ? setDuplicateMatchesLeft : setDuplicateMatchesRight;
      setDuplicateMatches([]);
      if (side === 'left') {
        setDuplicateDetailsLeft(null);
        setSelectedDuplicateBatchNoLeft(null);
      } else {
        setDuplicateDetailsRight(null);
        setSelectedDuplicateBatchNoRight(null);
      }
      skipDuplicateCheck.current[side] = false;
      return;
    }
    if (isComplaintMode) {
      const setDuplicateMatches = side === 'left' ? setDuplicateMatchesLeft : setDuplicateMatchesRight;
      setDuplicateMatches([]);
      return;
    }
    const rows = side === 'left' ? leftRows : rightRows;
    const materials = rows
      .map(r => [normalizeMaterialName(r.material), parseFloat(r.qty).toFixed(2)] as [string, string])
      .filter(m => m[0] !== '' && m[1] !== 'NaN');

    const setDuplicateMatches = side === 'left' ? setDuplicateMatchesLeft : setDuplicateMatchesRight;

    if (materials.length === 0) {
      setDuplicateMatches([]);
      if (side === 'left') {
        setDuplicateDetailsLeft(null);
        setSelectedDuplicateBatchNoLeft(null);
        setLastCheckedLeftKey('');
      } else {
        setDuplicateDetailsRight(null);
        setSelectedDuplicateBatchNoRight(null);
        setLastCheckedRightKey('');
      }
      return;
    }

    // Create a normalized key for comparison and dismissal
    const currentKey = materials.map(m => `${m[0]}:${m[1]}`).sort().join('|');

    // Avoid calling duplicate check repeatedly on the same key or already dismissed key
    const lastChecked = side === 'left' ? lastCheckedLeftKey : lastCheckedRightKey;
    const dismissed = side === 'left' ? dismissedDuplicatesLeft : dismissedDuplicatesRight;
    if (currentKey === lastChecked || dismissed.has(currentKey)) {
      return;
    }

    if (side === 'left') setLastCheckedLeftKey(currentKey);
    else setLastCheckedRightKey(currentKey);

    const [success, data] = await LabFormulationsAPI.checkDuplicates(productName, materials);

    if (success && typeof data !== 'string') {
      const currentBatchNo = side === 'left' ? leftForm.batchNo : rightForm.batchNo;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matches = (data.matches || []).filter((m: any) => m.toString() !== currentBatchNo.toString());
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        setMatchedBatchSide(side);
        if (side === 'left') {
          setDuplicateDetailsLeft(null);
          setSelectedDuplicateBatchNoLeft(null);
        } else {
          setDuplicateDetailsRight(null);
          setSelectedDuplicateBatchNoRight(null);
        }
      } else {
        setDuplicateMatches([]);
        if (side === 'left') {
          setDuplicateDetailsLeft(null);
          setSelectedDuplicateBatchNoLeft(null);
        } else {
          setDuplicateDetailsRight(null);
          setSelectedDuplicateBatchNoRight(null);
        }
      }
    } else {
      setDuplicateMatches([]);
      if (side === 'left') {
        setDuplicateDetailsLeft(null);
        setSelectedDuplicateBatchNoLeft(null);
      } else {
        setDuplicateDetailsRight(null);
        setSelectedDuplicateBatchNoRight(null);
      }
    }
  };

  const handleDismissDuplicatesLeft = () => {
    const materials = leftRows
      .map(r => [normalizeMaterialName(r.material), parseFloat(r.qty).toFixed(2)] as [string, string])
      .filter(m => m[0] !== '' && m[1] !== 'NaN');
    
    if (materials.length > 0) {
      const currentKey = materials.map(m => `${m[0]}:${m[1]}`).sort().join('|');
      setDismissedDuplicatesLeft(prev => {
        const next = new Set(prev);
        next.add(currentKey);
        return next;
      });
    }
    setDuplicateMatchesLeft([]);
    setDuplicateDetailsLeft(null);
    setSelectedDuplicateBatchNoLeft(null);
  };

  const handleDismissDuplicatesRight = () => {
    const materials = rightRows
      .map(r => [normalizeMaterialName(r.material), parseFloat(r.qty).toFixed(2)] as [string, string])
      .filter(m => m[0] !== '' && m[1] !== 'NaN');
    
    if (materials.length > 0) {
      const currentKey = materials.map(m => `${m[0]}:${m[1]}`).sort().join('|');
      setDismissedDuplicatesRight(prev => {
        const next = new Set(prev);
        next.add(currentKey);
        return next;
      });
    }
    setDuplicateMatchesRight([]);
    setDuplicateDetailsRight(null);
    setSelectedDuplicateBatchNoRight(null);
  };

  const [leftFilterType, setLeftFilterType] = useState('material_diff_qty');
  const [rightFilterType, setRightFilterType] = useState('material_diff_qty');

  const btnStyle = (type: 'primary' | 'danger' | 'warning' | 'success') => {
    const bg = type === 'primary' ? 'var(--primary-color)' 
             : type === 'danger' ? 'var(--color-error)'
             : type === 'warning' ? 'var(--color-warning)'
             : 'var(--color-success)';
    return {
      backgroundColor: bg,
      color: '#ffffff',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      padding: '6px 12px',
      fontWeight: 500,
      fontSize: '0.8rem',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: 'opacity 0.2s',
    } as React.CSSProperties;
  };

  const handleAddRow = (side: 'left' | 'right') => {
    const setRows = side === 'left' ? setLeftRows : setRightRows;
    setRows(prev => [
      ...prev,
      { sr: (prev.length + 1).toString(), mr: '', material: '', qty: '', selected: false }
    ]);
    onShowToast("Row added", "info");

    // Auto-scroll to the bottom of the raw materials container and focus the first input of the new row
    setTimeout(() => {
      const container = document.getElementById(`${side}-material-container`);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      
      const targetCol = activeSubView === 'rm_testing' ? 'mr' : 'mat';
      const inputs = document.querySelectorAll(`input[id^="${side}-${targetCol}-"]`);
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        if (lastInput) {
          lastInput.focus();
          lastInput.select();
        }
      }
    }, 50);
  };

  const handleDeleteSelectedRows = (side: 'left' | 'right') => {
    const rows = side === 'left' ? leftRows : rightRows;
    const setRows = side === 'left' ? setLeftRows : setRightRows;
    const selectedCount = rows.filter(r => r.selected).length;
    if (selectedCount === 0) {
      onShowToast("No rows selected", "warning");
      return;
    }
    const updated = rows.filter(r => !r.selected);
    const renumbered = updated.map((r, i) => ({
      ...r,
      sr: (i + 1).toString(),
      selected: false
    }));
    setRows(renumbered);
    onShowToast(`Deleted ${selectedCount} row(s)`, "info");
  };

  const handleClearAllFields = (side: 'left' | 'right') => {
    const setForm = side === 'left' ? setLeftForm : setRightForm;
    const setRows = side === 'left' ? setLeftRows : setRightRows;
    const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
    const setRemarks = side === 'left' ? setLeftRemarks : setRightRemarks;
    const setStatus = side === 'left' ? setLeftStatus : setRightStatus;
    const setApprovedBy = side === 'left' ? setLeftApprovedBy : setRightApprovedBy;
    const activeProdFormatted = (sessionStorage.getItem('product_name') || '').replace(/_/g, ' ').toUpperCase();

    setForm({ refNo: '', batchNo: side === 'left' ? (lastNextBatchNo || '') : '', product: activeProdFormatted, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
    if (side === 'left') setLeftOriginalBatchNo('');
    else setRightOriginalBatchNo('');
    setRows(initializeRows());
    setTestRows(initializeTestRows());
    setRemarks('');
    setStatus('Select');
    setApprovedBy('');
    onShowToast(`Cleared all fields for ${side} pane.`, "info");
  };

  const handleAddTestRow = (side: 'left' | 'right') => {
    const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
    setTestRows(prev => [
      ...prev,
      { method: '', standard: '', result: '', selected: false }
    ]);
    onShowToast("Test row added", "info");

    // Auto-scroll to the bottom of the test specifications container and focus the first input of the new test row
    setTimeout(() => {
      const container = document.getElementById(`${side}-test-container`);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      
      const inputs = document.querySelectorAll(`input[id^="${side}-test-method-"]`);
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        if (lastInput) {
          lastInput.focus();
          lastInput.select();
        }
      }
    }, 50);
  };

  const handleDeleteSelectedTests = (side: 'left' | 'right') => {
    const testRows = side === 'left' ? leftTestRows : rightTestRows;
    const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
    const selectedCount = testRows.filter(t => t.selected).length;
    if (selectedCount === 0) {
      onShowToast("No test rows selected", "warning");
      return;
    }
    const updated = testRows.filter(t => !t.selected);
    setTestRows(updated);
    onShowToast(`Deleted ${selectedCount} test row(s)`, "info");
  };

  const handleRmApproval = async (side: 'left' | 'right', status: 'OK' | 'Not OK') => {
    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;

    const lotNo = form.rmLot.trim();
    const reportDateVal = form.reportDate.trim();

    if (!lotNo) {
      onShowToast("Validation Failed: Please enter 'RM Lot No'.", "error");
      return;
    }

    const validMaterials = rows.filter(r => r.mr.trim() !== '' && r.material.trim() !== '');
    if (validMaterials.length === 0) {
      onShowToast("Validation Failed: No valid material rows found (must have MR No and Material name).", "error");
      return;
    }

    setLoading(true);
    
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedNow = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    let reportDateToSave = formattedNow;
    if (reportDateVal) {
      reportDateToSave = reportDateVal;
    }

    const entriesToSync = validMaterials.map(m => ({
      entry_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      date_time: formattedNow,
      material_name: m.material,
      mr_no: m.mr,
      lot_no_batch_no: lotNo,
      internal_batch_no: "",
      report_date: reportDateToSave,
      lab_approval: status,
      checked_by_reporter_sign: "",
      head_sign: "",
      rd_sign: "",
      qc_approval: ""
    }));

    const [success, response] = await RawMaterialAPI.saveEntries(productName, entriesToSync);
    setLoading(false);

    if (success) {
      if (side === 'left') {
        setLeftStatus(status);
      } else {
        setRightStatus(status);
      }
      onShowToast(`Sync Successful: Synced ${entriesToSync.length} items to QC as '${status}'.`, "success");
    } else {
      onShowToast(`Sync Failed: ${typeof response === 'string' ? response : 'Error saving entries'}`, "error");
    }
  };

  // 3. Side-panel filters query
  const handleFilterMatches = async (side: 'left' | 'right', filterType: string) => {
    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';
    const isRM = activeSubView === 'rm_testing' || activeSubView === 'past_rm_testing';
    if (!isLab && !isRM) return;

    const rows = side === 'left' ? leftRows : rightRows;
    const materials = rows
      .map(r => [r.material, String(parseFloat(r.qty))])
      .filter(m => m[0] !== '' && m[1] !== 'NaN');

    if (materials.length === 0) {
      onShowToast('No formula found. Populate sheets first.', 'warning');
      return;
    }

    setLoading(true);
    let success, data;
    if (isLab) {
      [success, data] = await LabFormulationsAPI.filterMatches(productName, filterType, materials);
    } else {
      [success, data] = await RMFormulationsAPI.filterMatches(productName, filterType, materials);
    }
    setLoading(false);

    const setDuplicateMatches = side === 'left' ? setDuplicateMatchesLeft : setDuplicateMatchesRight;

    if (success && typeof data !== 'string') {
      const matches = data.matches || [];
      if (matches.length === 0) {
        onShowToast('No historical batches match this specific filter.', 'info');
      } else {
        // Map Filtered matches to duplicate format to display
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = matches.map((m: any) => ({
          batch_no: m.batch_no,
          ref_no: m.ref_no,
          test_date: m.test_date || 'No Date'
        }));
        setDuplicateMatches(mapped);
        setMatchedBatchSide(side);
        if (side === 'left') {
          setDuplicateDetailsLeft(null);
          setSelectedDuplicateBatchNoLeft(null);
        } else {
          setDuplicateDetailsRight(null);
          setSelectedDuplicateBatchNoRight(null);
        }
      }
    } else {
      onShowToast('Failed to retrieve matched batches.', 'error');
    }
  };

  // 4. Save Master formulation payload
  const handleSaveMaster = async (side: 'left' | 'right') => {
    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';
    if (!isLab) return;

    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;
    const tests = side === 'left' ? leftTestRows : rightTestRows;

    if (!form.batchNo) {
      onShowToast('Batch No is required to save master data.', 'warning');
      return;
    }

    const inventoryPayload = rows
      .filter(r => r.material.trim() !== '')
      .map(r => ({ sr_no: r.sr, raw_material: r.material, qty: r.qty }));

    const testPayload = tests
      .filter(t => t.method.trim() !== '')
      .map(t => ({ method: t.method, standard: t.standard, result: t.result }));

    const formPayload: Record<string, string> = {
      'REF NO': form.refNo,
      'BATCH NO': form.batchNo,
      'PRODUCT NAME': form.product,
      'RM LOT NO': form.rmLot,
      'RM NAME': form.rmName,
      'TEST DATE': form.testDate,
      'REPORT DATE': form.reportDate,
      'FORMULA DATE': form.formulaDate,
    };

    const origBatchNo = side === 'left' ? leftOriginalBatchNo : rightOriginalBatchNo;
    setLoading(true);
    const [success, data] = await LabFormulationsAPI.saveMasterPayload(productName, form.batchNo, formPayload, inventoryPayload, testPayload, origBatchNo);
    setLoading(false);

    if (success) {
      if (side === 'left') setLeftOriginalBatchNo('');
      else setRightOriginalBatchNo('');
      onShowToast(`Master formulation saved for batch ${form.batchNo}`, 'success');
      NotificationsAPI.createNotification(
        "[SUCCESS] Batch Approved!",
        `Batch ${form.batchNo} approved and saved to master formulations.`,
        "success",
        ["production", "mf"]
      );

      // Reset all fields so new entries can be made cleanly without manual clearing
      const setForm = side === 'left' ? setLeftForm : setRightForm;
      const setRows = side === 'left' ? setLeftRows : setRightRows;
      const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
      const setRemarks = side === 'left' ? setLeftRemarks : setRightRemarks;
      const setStatus = side === 'left' ? setLeftStatus : setRightStatus;
      const setApprovedBy = side === 'left' ? setLeftApprovedBy : setRightApprovedBy;
      const activeProdFormatted = (sessionStorage.getItem('product_name') || '').replace(/_/g, ' ').toUpperCase();

      setForm({ refNo: '', batchNo: '', product: activeProdFormatted, rmLot: '', rmName: '', testDate: '', reportDate: '', formulaDate: '' });
      setRows(initializeRows());
      setTestRows(initializeTestRows());
      setRemarks('');
      setStatus('Select');
      setApprovedBy('');

      if (side === 'left') {
        setDuplicateMatchesLeft([]);
        setDuplicateDetailsLeft(null);
        setSelectedDuplicateBatchNoLeft(null);
        setLastCheckedLeftKey('');
      } else {
        setDuplicateMatchesRight([]);
        setDuplicateDetailsRight(null);
        setSelectedDuplicateBatchNoRight(null);
        setLastCheckedRightKey('');
      }
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to save master.', 'error');
    }
  };

  // OCR Upload handler
  const handleOCRUpload = async (side: 'left' | 'right', useCamera: boolean = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        setLoading(true);
        onShowToast('Uploading image for OCR analysis...', 'info');
        
        const [success, response] = await LabFormulationsAPI.uploadOCRImage(file);
        
        if (success && response && response.data) {
          const setRows = side === 'left' ? setLeftRows : setRightRows;
          const rows = side === 'left' ? leftRows : rightRows;
          const setForm = side === 'left' ? setLeftForm : setRightForm;
          const currentForm = side === 'left' ? leftForm : rightForm;
          const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
          const testRows = side === 'left' ? leftTestRows : rightTestRows;
          
          const newRows = [...rows];
          let emptyIdx = newRows.findIndex(r => !r.material && !r.qty);
          if (emptyIdx === -1) emptyIdx = newRows.length; // append if full
          
          // Handle new response format: { batch_no: "...", materials: [...], tests: [...] }
          const materialsList = Array.isArray(response.data) ? response.data : (response.data.materials || []);
          const testsList = response.data.tests || [];
          const batchNo = response.data.batch_no || '';

          if (batchNo) {
            setForm({ ...currentForm, batchNo: batchNo });
          }

          materialsList.forEach((item: any, idx: number) => {
            const targetIdx = emptyIdx + idx;
            if (targetIdx < newRows.length) {
              newRows[targetIdx] = {
                ...newRows[targetIdx],
                material: item.material || '',
                qty: item.qty ? item.qty.toString() : ''
              };
            } else {
              newRows.push({
                sr: '',
                mr: '',
                material: item.material || '',
                qty: item.qty ? item.qty.toString() : '',
                selected: false
              });
            }
          });
          
          setRows(newRows);

          // Handle extracted tests
          if (testsList.length > 0) {
            const newTestRows = [...testRows];
            let emptyTestIdx = newTestRows.findIndex(t => !t.method && !t.result && !t.standard);
            if (emptyTestIdx === -1) emptyTestIdx = newTestRows.length;

            testsList.forEach((testItem: any, idx: number) => {
              const targetTestIdx = emptyTestIdx + idx;
              if (targetTestIdx < newTestRows.length) {
                newTestRows[targetTestIdx] = {
                  ...newTestRows[targetTestIdx],
                  method: testItem.test_name || '',
                  result: testItem.result || ''
                };
              } else {
                newTestRows.push({
                  method: testItem.test_name || '',
                  standard: '',
                  result: testItem.result || '',
                  selected: false
                });
              }
            });
            setTestRows(newTestRows);
          }

          onShowToast('OCR Data successfully loaded!', 'success');
        } else {
          onShowToast(response?.detail || response || 'Failed to extract data', 'error');
        }
      } catch (err: any) {
        onShowToast(`Error parsing handwritten data: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  // 5. Save Full formulation entry
  const handleSaveFull = async (side: 'left' | 'right') => {
    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;
    const tests = side === 'left' ? leftTestRows : rightTestRows;
    const remarks = side === 'left' ? leftRemarks : rightRemarks;

    const status = side === 'left' ? leftStatus : rightStatus;
    const approvedBy = side === 'left' ? leftApprovedBy : rightApprovedBy;
    const origBatchNo = side === 'left' ? leftOriginalBatchNo : rightOriginalBatchNo;

    if (!form.batchNo) {
      onShowToast('Batch No is required to save full data.', 'warning');
      return;
    }

    const formFieldsPayload = [
      { label: 'Ref No', value: form.refNo },
      { label: 'Batch No', value: form.batchNo },
      { label: 'Product Name', value: form.product },
      { label: 'RM Lot No', value: form.rmLot },
      { label: 'RM Name', value: form.rmName },
      { label: 'Test Date', value: form.testDate },
      { label: 'Report Date', value: form.reportDate },
      { label: 'Formula Date', value: form.formulaDate },
    ];

    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';

    const inventoryPayload = rows
      .filter(r => r.material.trim() !== '')
      .map(r => {
        const q = parseFloat(r.qty) || 0;
        const rawS = r.solid !== undefined && r.solid !== null ? r.solid.toString().trim().toLowerCase() : '';
        const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
        const s = isNA ? 0 : (parseFloat(rawS) || 0);
        const sQty = q * (s / 100);
        if (isLab) {
          return { sr_no: r.sr, raw_material: r.material, qty: r.qty, solid: r.solid || '', solid_qty: sQty.toFixed(2) };
        } else {
          return { sr_no: r.sr, mr_no: r.mr, raw_material: r.material, qty: r.qty, solid: r.solid || '', solid_qty: sQty.toFixed(2) };
        }
      });

    const testPayload = tests
      .filter(t => t.method.trim() !== '')
      .map(t => ({ method: t.method, standard: t.standard, result: t.result }));

    setLoading(true);
    const saveApi = isLab ? LabFormulationsAPI.saveFullBatch : RMFormulationsAPI.saveFullBatch;
    const [success, data] = isLab 
      ? await saveApi(productName, formFieldsPayload, inventoryPayload, testPayload, remarks, origBatchNo)
      : await saveApi(productName, formFieldsPayload, inventoryPayload, testPayload, remarks, status, approvedBy, origBatchNo);
    setLoading(false);

    if (success) {
      if (side === 'left') setLeftOriginalBatchNo(form.batchNo);
      else setRightOriginalBatchNo(form.batchNo);
      onShowToast(`Full batch compilation successfully saved: ${form.batchNo}`, 'success');
      const nextBatch = getNextBatchNumber(form.batchNo);
      setLastNextBatchNo(nextBatch);
      if (side === 'left') {
        setRightForm(prev => ({ ...prev, batchNo: nextBatch }));
      }
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to save full batch.', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // HISTORICAL PAST VIEWS LOADING & IN-MEMORY BLOB DOWNLOADS
  // --------------------------------------------------------------------------
  const loadPastFormulations = async () => {
    setLoading(true);
    const isLab = activeSubView === 'past_lab_formulations';
    const fetchApi = isLab
      ? LabPastFormulationsAPI.getPastLabFormulations 
      : RMPastFormulationsAPI.getPastRmFormulations;

    const [success, data] = await fetchApi(productName, pastCurrentPage - 1, 3, pastSearchTerm);
    setLoading(false);

    if (success && typeof data !== 'string') {
      setPastBatches(data.batches || []);
      setPastTotalPages(data.total_pages || 1);
    }
  };

  useEffect(() => {
    setSelectedPastBatches([]); // Reset selection only when activeSubView changes
  }, [activeSubView]);

  useEffect(() => {
    if (activeSubView === 'past_lab_formulations' || activeSubView === 'past_rm_testing') {
      loadPastFormulations();
    }
  }, [activeSubView, pastCurrentPage, pastSearchTerm]);

  // Load a historical batch straight into the left or right active spreadsheet panel
  const loadBatchIntoPane = async (batchNo: string, side: 'left' | 'right', forceIsLab?: boolean) => {
    setLoading(true);
    const isLab = forceIsLab !== undefined 
      ? forceIsLab 
      : (activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations');
    const fetchApi = isLab ? LabFormulationsAPI.getBatchDetail : RMFormulationsAPI.getBatchDetail;
    const [success, data] = await fetchApi(batchNo, productName);
    setLoading(false);

    if (success && typeof data !== 'string') {
      if (side === 'left') setLeftOriginalBatchNo(batchNo);
      else setRightOriginalBatchNo(batchNo);

      const setForm = side === 'left' ? setLeftForm : setRightForm;
      const setRows = side === 'left' ? setLeftRows : setRightRows;
      const setTestRows = side === 'left' ? setLeftTestRows : setRightTestRows;
      const setRemarks = side === 'left' ? setLeftRemarks : setRightRemarks;

      const setStatus = side === 'left' ? setLeftStatus : setRightStatus;
      const setApprovedBy = side === 'left' ? setLeftApprovedBy : setRightApprovedBy;

      const fd = data.form_data || [];
      if (isLab) {
        setForm({
          refNo: data.ref_no || fd[0] || '',
          batchNo: data.batch_no || batchNo,
          product: data.product_name_field || (activeSubView.includes('lab') ? (fd[2] || '') : productName),
          rmLot: '', rmName: '',
          testDate: data.test_date || (fd[3] || ''),
          reportDate: data.report_date || (fd[4] || ''),
          formulaDate: data.formula_date || (fd[5] || ''),
        });
      } else {
        setForm({
          refNo: data.ref_no || fd[0] || '',
          batchNo: data.batch_no || fd[1] || batchNo,
          product: data.product_name_field || fd[2] || '',
          rmLot: data.rm_name_lot_no || (fd.length === 8 ? (fd[3] || '') : (fd[3] || '')),
          rmName: data.rm_name || (fd.length === 8 ? (fd[4] || '') : ''),
          testDate: data.test_date || (fd.length === 8 ? (fd[5] || '') : (fd[4] || '')),
          reportDate: data.report_date || (fd.length === 8 ? (fd[6] || '') : (fd[5] || '')),
          formulaDate: data.formula_date || (fd.length === 8 ? (fd[7] || '') : (fd[6] || '')),
        });
      }

      setRemarks(data.remarks || '');
      
      if (!isLab) {
        setStatus(data.approval_status || 'Select');
        setApprovedBy(data.approval_comments || '');
      }

      // Load inventory rows and fill up to 25 rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inventory = (data.inventory || []).map((i: any) => {
        if (Array.isArray(i)) {
          const mat = i[1] || '';
          const sVal = (mat.trim() !== '' && i[4] !== undefined && i[4] !== null) ? i[4].toString() : '';
          const rawS = sVal.trim().toLowerCase();
          const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
          const sPctVal = isNA ? 0 : (parseFloat(rawS) || 0);
          const qVal = parseFloat(i[2]) || 0;
          const sQtyVal = (qVal * (sPctVal / 100)).toFixed(2);
          return {
            sr: i[0] ? i[0].toString() : '',
            material: mat,
            qty: i[2] !== undefined ? i[2].toString() : '',
            solid: sVal,
            solid_qty: (mat.trim() !== '') ? sQtyVal : '0',
            mr: i[3] || '',
            selected: false
          };
        } else {
          const mat = i.raw_material || i.material || '';
          const sVal = (mat.trim() !== '' && i.solid !== undefined && i.solid !== null) ? i.solid.toString() : '';
          const rawS = sVal.trim().toLowerCase();
          const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
          const sPctVal = isNA ? 0 : (parseFloat(rawS) || 0);
          const qVal = parseFloat(i.qty) || 0;
          const sQtyVal = (qVal * (sPctVal / 100)).toFixed(2);
          return {
            sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
            material: mat,
            qty: i.qty !== undefined ? i.qty.toString() : '',
            solid: sVal,
            solid_qty: (mat.trim() !== '') ? sQtyVal : '0',
            mr: i.mr_no || i.mr || '',
            selected: false
          };
        }
      });
      const paddedInventory = [...inventory];
      while (paddedInventory.length < 25) {
        paddedInventory.push({ sr: (paddedInventory.length + 1).toString(), mr: '', material: '', qty: '', solid: '', solid_qty: '0', selected: false });
      }
      setRows(paddedInventory);
      skipDuplicateCheck.current[side] = true;

      // Duplicate check handles self-duplicates automatically now

      // Load test results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tests = (data.tests || []).map((t: any) => {
        if (Array.isArray(t)) {
          return {
            method: t[0] || '',
            standard: t[1] || '',
            result: t[2] || '',
            selected: false
          };
        } else {
          return {
            method: t.method || '',
            standard: t.standard || '',
            result: t.result || '',
            selected: false
          };
        }
      });
      setTestRows(tests);

      onShowToast(`Loaded batch ${batchNo} into the ${side} pane.`, 'success');
      setSelectedBatchDetails(null);
    } else {
      onShowToast('Failed to load batch details.', 'error');
    }
  };

  const {
    exportToExcel,
    exportToPDF,
    generateFormulationPrintPDF,
    generateIngredientsOnlyPDF,
    generateMultiFormulationsPrintPDF,
    printSelectedIngredientsOnly,
    printSelectedCompleteCards
  } = useExports({
    leftForm, rightForm,
    leftRows, rightRows,
    leftTestRows, rightTestRows,
    leftRemarks, rightRemarks,
    activeSubView,
    calculateTotalWeight,
    productName,
    onShowToast,
    setLoading,
    selectedPastBatches,
    setSelectedPastBatches,
    printSlot
  });

  const handleDismissDuplicateOverlay = (overlaySide: 'left' | 'right') => {
    if (overlaySide === 'left') {
      handleDismissDuplicatesRight();
    } else {
      handleDismissDuplicatesLeft();
    }
  };

  const handleLoadDuplicateToSide = async (targetSide: 'left' | 'right', sourceSide: 'left' | 'right', selectedBatchNo: string | null) => {
    if (selectedBatchNo) {
      await loadBatchIntoPane(selectedBatchNo, targetSide);
      if (sourceSide === 'left') {
        setDuplicateMatchesLeft([]);
        setDuplicateDetailsLeft(null);
        setSelectedDuplicateBatchNoLeft(null);
      } else {
        setDuplicateMatchesRight([]);
        setDuplicateDetailsRight(null);
        setSelectedDuplicateBatchNoRight(null);
      }
    }
  };


  const isLabView = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';
  
  const themeStyles = isLabView 
    ? {
        '--primary-color': '#3B82F6',
        '--primary-light': '#eff6ff',
        '--primary-gradient': 'linear-gradient(135deg, #3B82F6, #1d4ed8)',
        '--border-color': '#e2e8f0',
        '--color-success': '#10B981',
        '--color-success-light': '#ecfdf5',
        '--color-warning': '#f59e0b',
        '--color-warning-light': '#fef3c7',
        '--color-error': '#ef4444',
        '--color-error-light': '#fef2f2',
        '--text-primary': '#1e293b',
        '--text-secondary': '#475569',
      } as React.CSSProperties
    : {
        '--primary-color': '#0d9488', // Teal 600 accent in Flet
        '--primary-light': '#f0fdfa',
        '--primary-gradient': 'linear-gradient(135deg, #0d9488, #0f172a)', // Teal to Slate
        '--border-color': '#cbd5e1',
        '--color-success': '#059669',
        '--color-success-light': '#ecfdf5',
        '--color-warning': '#d97706',
        '--color-warning-light': '#fef3c7',
        '--color-error': '#be123c', // Rose 700 danger in Flet
        '--color-error-light': '#fff1f2',
        '--text-primary': '#1e293b',
        '--text-secondary': '#64748b',
      } as React.CSSProperties;

  const handleEnterKeyNav = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'textarea') return;

      const cell = target.closest('td');
      const row = target.closest('tr');
      const table = target.closest('table');

      if (table && cell && row) {
        // Grid navigation: move down one row, same column
        e.preventDefault();
        const colIndex = Array.from(row.children).indexOf(cell);
        const tbody = target.closest('tbody');
        if (tbody) {
          const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(row);
          if (rowIndex > -1 && colIndex > -1) {
            const nextRow = tbody.querySelectorAll('tr')[rowIndex + 1];
            if (nextRow) {
              const nextCell = nextRow.children[colIndex];
              if (nextCell) {
                const nextInput = nextCell.querySelector('input:not([disabled]):not([readOnly]), select:not([disabled]):not([readOnly])') as HTMLElement;
                if (nextInput) nextInput.focus();
              }
            }
          }
        }
        return;
      }

      const form = e.currentTarget;
      const elements = Array.from(form.querySelectorAll('input:not([disabled]):not([readOnly]), select:not([disabled]):not([readOnly]), button:not([disabled])')) as HTMLElement[];
      const index = elements.indexOf(target);
      if (index > -1 && index < elements.length - 1) {
        e.preventDefault();
        elements[index + 1].focus();
      }
    }
  };

  const handleCopyLeftToRight = () => {
    skipDuplicateCheck.current.right = true;
    const newBatchNo = getNextBatchNumber(leftForm.batchNo);
    setRightForm({ ...leftForm, batchNo: newBatchNo });
    setRightRows(leftRows.map(row => ({ ...row })));
    setRightTestRows(leftTestRows.map(row => ({ ...row })));
    setRightRemarks(leftRemarks);
    onShowToast(`Formulation copied from Left to Right panel (New Batch: ${newBatchNo})`, "success");
  };

  const handleCopyRightToLeft = () => {
    skipDuplicateCheck.current.left = true;
    const newBatchNo = getNextBatchNumber(rightForm.batchNo);
    setLeftForm({ ...rightForm, batchNo: newBatchNo });
    setLeftRows(rightRows.map(row => ({ ...row })));
    setLeftTestRows(rightTestRows.map(row => ({ ...row })));
    setLeftRemarks(rightRemarks);
    onShowToast(`Formulation copied from Right to Left panel (New Batch: ${newBatchNo})`, "success");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', ...themeStyles, overflow: 'hidden' }}>
      
      {/* ----------------------------------------------------------------------
          DUAL FORMULATION SHEETS WORKSPACE
          ---------------------------------------------------------------------- */}
      {(activeSubView === 'lab_formulations' || activeSubView === 'rm_testing') && (
        <>
          {/* Fixed Flet Style Header Toolbar */}
          <div className="flet-fixed-toolbar">
            <div className="flet-toolbar-title">
              {activeSubView === 'lab_formulations' ? 'LAB FORMULATIONS' : 'RM Laboratory Testing Scope'}
            </div>

            {/* Cross table alert */}
            {isCrossDuplicate && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-error)',
                border: '1px solid var(--color-error)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px'
              }}>
                <AlertTriangle size={14} />
                <span>CROSS-TABLE DUPLICATE: BOTH SIDE GRID SHEETS CONTAIN IDENTICAL FORMULAS!</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--header-text-secondary)', fontWeight: 500 }}>
                Active Workspace: <strong style={{ color: 'var(--primary-color)' }}>{productName}</strong>
              </div>
              
              {/* Notifications Popover */}
              <CmsNotifications />
            </div>
          </div>

          <div className="dual-pane-layout" onKeyDown={handleEnterKeyNav} style={{ height: 'calc(100vh - 75px)', overflow: 'hidden' }}>
            
            <FormulationPanel 
              side="left"
              activeSubView={activeSubView}
              isLab={activeSubView === 'lab_formulations'}
              loading={loading}
              isComplaintMode={isComplaintMode}
              bpbsData={bpbsData}
              form={leftForm}
              setForm={setLeftForm}
              rows={leftRows}
              setRows={setLeftRows}
              testRows={leftTestRows}
              setTestRows={setLeftTestRows}
              remarks={leftRemarks}
              setRemarks={setLeftRemarks}
              status={leftStatus}
              setStatus={setLeftStatus}
              approvedBy={leftApprovedBy}
              setApprovedBy={setLeftApprovedBy}
              duplicateMatches={duplicateMatchesRight}
              duplicateDetails={duplicateDetailsRight}
              selectedDuplicateBatchNo={selectedDuplicateBatchNoRight}
              filterType={leftFilterType}
              setFilterType={setLeftFilterType}
              onCopy={handleCopyLeftToRight}
              handleSaveFull={handleSaveFull}
              handleClearAllFields={handleClearAllFields}
              handleAddRow={handleAddRow}
              handleDeleteSelectedRows={handleDeleteSelectedRows}
              handleOCRUpload={handleOCRUpload}
              handleFilterMatches={handleFilterMatches}

              openStarModal={openStarModal}
              calculateTotalSolidQty={calculateTotalSolidQty}
              calculateFormulationSolidity={calculateFormulationSolidity}
              calculateTotalWeight={calculateTotalWeight}
              handleHeaderFieldKeyDown={handleHeaderFieldKeyDown}
              handleCellKeyDown={handleCellKeyDown}
              handleAddTestRow={handleAddTestRow}
              handleDeleteSelectedTests={handleDeleteSelectedTests}
              handleTestCellKeyDown={handleTestCellKeyDown}
              handleSaveMaster={handleSaveMaster}
              handleRmApproval={handleRmApproval}
              handleExitComplaintMode={handleExitComplaintMode}
              fetchDuplicateDetails={fetchDuplicateDetails}
              handleDismissDuplicateOverlay={handleDismissDuplicateOverlay}
              handleLoadDuplicateToSide={handleLoadDuplicateToSide}
            />
            <FormulationPanel 
              side="right"
              activeSubView={activeSubView}
              isLab={activeSubView === 'lab_formulations'}
              loading={loading}
              form={rightForm}
              setForm={setRightForm}
              rows={rightRows}
              setRows={setRightRows}
              testRows={rightTestRows}
              setTestRows={setRightTestRows}
              remarks={rightRemarks}
              setRemarks={setRightRemarks}
              status={rightStatus}
              setStatus={setRightStatus}
              approvedBy={rightApprovedBy}
              setApprovedBy={setRightApprovedBy}
              duplicateMatches={duplicateMatchesLeft}
              duplicateDetails={duplicateDetailsLeft}
              selectedDuplicateBatchNo={selectedDuplicateBatchNoLeft}
              filterType={rightFilterType}
              setFilterType={setRightFilterType}
              onCopy={handleCopyRightToLeft}
              handleSaveFull={handleSaveFull}
              handleClearAllFields={handleClearAllFields}
              handleAddRow={handleAddRow}
              handleDeleteSelectedRows={handleDeleteSelectedRows}
              handleOCRUpload={handleOCRUpload}
              handleFilterMatches={handleFilterMatches}

              openStarModal={openStarModal}
              calculateTotalSolidQty={calculateTotalSolidQty}
              calculateFormulationSolidity={calculateFormulationSolidity}
              calculateTotalWeight={calculateTotalWeight}
              handleHeaderFieldKeyDown={handleHeaderFieldKeyDown}
              handleCellKeyDown={handleCellKeyDown}
              handleAddTestRow={handleAddTestRow}
              handleDeleteSelectedTests={handleDeleteSelectedTests}
              handleTestCellKeyDown={handleTestCellKeyDown}
              handleSaveMaster={handleSaveMaster}
              handleRmApproval={handleRmApproval}
              fetchDuplicateDetails={fetchDuplicateDetails}
              handleDismissDuplicateOverlay={handleDismissDuplicateOverlay}
              handleLoadDuplicateToSide={handleLoadDuplicateToSide}
            />
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------------
          HISTORICAL PAST BATCHES LOG GRID
          ---------------------------------------------------------------------- */}
      {(activeSubView === 'past_lab_formulations' || activeSubView === 'past_rm_testing') && (
        <>
          {/* Flet Fixed Header Toolbar */}
          <div className="flet-fixed-toolbar">
            <div className="flet-toolbar-title">
              {activeSubView === 'past_lab_formulations' ? 'Lab Past Formulations' : 'Past RM Testing'}
            </div>

            {/* Search and Pagination in a single row */}
            <div className="flet-toolbar-row">
              {/* Search fields */}
              <input 
                type="text" 
                className="field-input" 
                placeholder="Search by Batch Number..."
                value={pastSearchTerm} 
                onChange={e => {
                  setPastSearchTerm(e.target.value);
                  setPastCurrentPage(1);
                }} 
                style={{ width: '220px', height: '32px' }}
              />
              <button onClick={loadPastFormulations} className="flet-btn flet-btn-blue" style={{ height: '32px' }}>Search</button>
              <button 
                onClick={() => {
                  setPastSearchTerm('');
                  setPastCurrentPage(1);
                }} 
                className="flet-btn flet-btn-orange"
                style={{ height: '32px' }}
              >
                Clear
              </button>
              <button onClick={loadPastFormulations} className="flet-btn flet-btn-green" style={{ height: '32px' }}>Refresh</button>
              {activeSubView === 'past_lab_formulations' && (
                <button 
                  onClick={() => {
                    setIsStarredOnlyFilter(!isStarredOnlyFilter);
                    setPastCurrentPage(1);
                  }} 
                  className="flet-btn"
                  style={{ 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    backgroundColor: isStarredOnlyFilter ? '#f59e0b' : '#ffffff', 
                    color: isStarredOnlyFilter ? '#ffffff' : '#1e293b',
                    border: '1px solid #f59e0b',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  <Star size={14} fill={isStarredOnlyFilter ? '#ffffff' : '#f59e0b'} color="#f59e0b" />
                  {isStarredOnlyFilter ? 'Starred Only (Active)' : 'Starred Only'}
                </button>
              )}

              {activeSubView === 'past_lab_formulations' && (
                <>
                  <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1', margin: '0 8px' }}></div>
                  <button 
                    onClick={printSelectedIngredientsOnly} 
                    className="flet-btn" 
                    disabled={selectedPastBatches.length === 0}
                    style={{ height: '32px', backgroundColor: selectedPastBatches.length > 0 ? '#2563eb' : '#e2e8f0', color: selectedPastBatches.length > 0 ? '#ffffff' : '#94a3b8', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: selectedPastBatches.length > 0 ? 'pointer' : 'default' }}
                  >
                    <Printer size={14} /> Print Raw Materials Only ({selectedPastBatches.length})
                  </button>
                  <button 
                    onClick={printSelectedCompleteCards} 
                    className="flet-btn" 
                    disabled={selectedPastBatches.length === 0}
                    style={{ height: '32px', backgroundColor: selectedPastBatches.length > 0 ? '#10b981' : '#e2e8f0', color: selectedPastBatches.length > 0 ? '#ffffff' : '#94a3b8', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: selectedPastBatches.length > 0 ? 'pointer' : 'default', marginLeft: '6px' }}
                  >
                    <Printer size={14} /> Print Complete Cards ({selectedPastBatches.length})
                  </button>

                  {selectedPastBatches.length === 1 && (
                    <select 
                      value={printSlot} 
                      onChange={(e) => setPrintSlot(e.target.value as any)}
                      style={{ height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', marginLeft: '6px', cursor: 'pointer', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: '500' }}
                    >
                      <option value="top-left">Slot: Top Left</option>
                      <option value="top-right">Slot: Top Right</option>
                      <option value="middle-left">Slot: Middle Left</option>
                      <option value="middle-right">Slot: Middle Right</option>
                      <option value="bottom-left">Slot: Bottom Left</option>
                      <option value="bottom-right">Slot: Bottom Right</option>
                    </select>
                  )}
                </>
              )}

              {/* Vertical divider */}
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1', margin: '0 8px' }}></div>

              {/* Pagination controls */}
              <button 
                onClick={() => setPastCurrentPage(prev => Math.max(1, prev - 1))}
                className="flet-btn"
                disabled={pastCurrentPage === 1}
                style={{ height: '32px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                Page {pastCurrentPage} of {pastTotalPages}
              </span>
              <button 
                onClick={() => setPastCurrentPage(prev => Math.min(pastTotalPages, prev + 1))}
                className="flet-btn"
                disabled={pastCurrentPage === pastTotalPages}
                style={{ height: '32px' }}
              >
                Next
              </button>
            </div>
          </div>

          {/* Scrollable report list content */}
          <div className="past-batches-scroll-container" style={{ height: 'calc(100vh - 75px)' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <RefreshCw size={24} className="spin-loader" />
              </div>
            ) : pastBatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                No formulation entries found.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {pastBatches.map((b) => {
                  const isLabCard = activeSubView === 'past_lab_formulations';
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const totalWeight = (b.inventory || []).reduce((sum: number, item: any) => {
                    const qtyStr = item.qty || (Array.isArray(item) ? item[2] : '0');
                    const q = parseFloat(qtyStr);
                    return isNaN(q) ? sum : sum + q;
                  }, 0).toFixed(2);

                  const refNo = b.ref_no || '-';
                  const batchNo = b.batch_no || '-';
                  const productNameValue = b.product_name || (Array.isArray(b.form_data) ? b.form_data[2] : b.product || '-');
                  const rmLotNoValue = isLabCard ? '-' : (b.rm_name_lot_no || (Array.isArray(b.form_data) ? b.form_data[3] : b.rm_lot || '-'));
                  const rmNameValue = isLabCard ? '-' : (b.rm_name || (Array.isArray(b.form_data) ? b.form_data[4] : b.rm_name || '-'));
                  const testDate = b.test_date || (Array.isArray(b.form_data) ? (isLabCard ? (b.form_data[3] || '-') : (b.form_data.length === 8 ? (b.form_data[5] || '-') : (b.form_data[4] || '-'))) : '-');
                  const reportDate = b.report_date || (Array.isArray(b.form_data) ? (isLabCard ? (b.form_data[4] || '-') : (b.form_data.length === 8 ? (b.form_data[6] || '-') : (b.form_data[5] || '-'))) : '-');
                  const formulaDate = b.formula_date || (Array.isArray(b.form_data) ? (isLabCard ? (b.form_data[5] || '-') : (b.form_data.length === 8 ? (b.form_data[7] || '-') : (b.form_data[6] || '-'))) : '-');
                  const approvalStatus = b.approval_status || '-';
                  const approvalComments = b.approval_comments || '-';

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const totalSolidQty = (b.inventory || []).reduce((sum: number, item: any) => {
                    const qtyStr = item.qty !== undefined ? item.qty : (Array.isArray(item) ? item[2] : '0');
                    const q = parseFloat(qtyStr);
                    if (isNaN(q)) return sum;
                    const rawS = item.solid !== undefined && item.solid !== null ? item.solid.toString().trim().toLowerCase() : '';
                    const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
                    const sPct = isNA ? 0 : (parseFloat(rawS) || 0);
                    return sum + (q * (sPct / 100));
                  }, 0).toFixed(2);

                  const twNum = parseFloat(totalWeight);
                  const tsqNum = parseFloat(totalSolidQty);
                  const cardSolidity = (twNum > 0 ? ((tsqNum * 100) / twNum) : 0).toFixed(2);

                  // Parse diff payload for modified batch granular red highlighting
                  let diff: any = null;
                  if (b.is_modified && b.modified_details) {
                    if (typeof b.modified_details === 'object') {
                      diff = b.modified_details;
                    } else if (typeof b.modified_details === 'string') {
                      try {
                        diff = JSON.parse(b.modified_details);
                      } catch {
                        diff = null;
                      }
                    }
                  }

                  const isBatchNoChanged = !!diff?.field_diffs?.batch_no;
                  const isRefNoChanged = !!diff?.field_diffs?.ref_no;
                  const isFormulaDateChanged = !!diff?.field_diffs?.formula_date;
                  const isTestDateChanged = !!diff?.field_diffs?.test_date;
                  const isReportDateChanged = !!diff?.field_diffs?.report_date;
                  const isRemarksChanged = !!diff?.field_diffs?.remarks;
                  const isStatusChanged = !!diff?.field_diffs?.approval_status;
                  const isApprovedByChanged = !!diff?.field_diffs?.approval_comments;
                  const isRmNameChanged = !!diff?.field_diffs?.rm_name;
                  const isRmLotChanged = !!diff?.field_diffs?.rm_lot_no;

                  return (
                    <div 
                      key={b.id || b.batch_no} 
                      className="flet-report-card"
                      style={{
                        backgroundColor: b.is_modified ? '#fff1f2' : '#ffffff',
                        borderColor: b.is_modified ? '#f87171' : '#cbd5e1',
                        borderWidth: b.is_modified ? '1.5px' : '1px',
                        borderStyle: 'solid',
                        boxShadow: b.is_modified ? '0 4px 12px rgba(239, 68, 68, 0.12)' : undefined
                      }}
                    >
                      {/* Card Header Title */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: b.is_modified ? '1px solid #fca5a5' : '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isLabCard && (
                            <input 
                              type="checkbox" 
                              checked={selectedPastBatches.includes(batchNo)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPastBatches(prev => [...prev, batchNo]);
                                } else {
                                  setSelectedPastBatches(prev => prev.filter(id => id !== batchNo));
                                }
                              }}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                          )}
                          {isLabCard && (
                            <button 
                              type="button" 
                              onClick={() => openStarModal(batchNo, !!b.is_starred, b.ok_rating || '')} 
                              title={b.is_starred ? `Starred (${b.ok_rating || 'OK'}) - Click to edit` : "Click to Star/Bookmark"}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            >
                              <Star size={16} fill={b.is_starred ? '#f59e0b' : 'none'} color="#f59e0b" />
                            </button>
                          )}
                          <span style={{ 
                            fontWeight: 'bold', 
                            fontSize: '15px', 
                            color: isBatchNoChanged ? '#dc2626' : (b.is_modified ? '#b91c1c' : 'var(--primary-color)'),
                            backgroundColor: isBatchNoChanged ? '#fee2e2' : 'transparent',
                            padding: isBatchNoChanged ? '2px 6px' : undefined,
                            borderRadius: isBatchNoChanged ? '4px' : undefined,
                            border: isBatchNoChanged ? '1px solid #fca5a5' : undefined
                          }}>
                            Batch: {batchNo}
                            {isBatchNoChanged && diff?.field_diffs?.batch_no?.old && (
                              <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, marginLeft: '6px' }}>
                                (was {diff.field_diffs.batch_no.old})
                              </span>
                            )}
                          </span>
                          {b.is_starred && b.ok_rating && (
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', padding: '1px 6px', borderRadius: '10px' }}>
                              {b.ok_rating}
                            </span>
                          )}
                          {b.is_modified && (
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b', backgroundColor: '#fee2e2', border: '1px solid #f87171', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> MODIFIED
                            </span>
                          )}
                        </div>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          backgroundColor: isRefNoChanged ? '#fee2e2' : (b.is_modified ? '#fee2e2' : '#e2e8f0'), 
                          color: isRefNoChanged ? '#dc2626' : (b.is_modified ? '#991b1b' : '#334155'), 
                          border: isRefNoChanged ? '1px solid #fca5a5' : undefined,
                          borderRadius: '2px', 
                          fontWeight: 'bold' 
                        }}>
                          Ref: {refNo}
                          {isRefNoChanged && diff?.field_diffs?.ref_no?.old && (
                            <span style={{ fontSize: '10px', color: '#991b1b', marginLeft: '4px' }}>(was {diff.field_diffs.ref_no.old})</span>
                          )}
                        </span>
                      </div>

                      {/* 1. Batch Details Section */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: b.is_modified ? '#b91c1c' : 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Batch Details
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: b.is_modified ? '1px solid #fca5a5' : '1px solid #cbd5e1' }}>
                          <tbody>
                            {b.is_modified && (
                              <>
                                <tr style={{ backgroundColor: '#fee2e2' }}>
                                  <td style={{ fontWeight: 'bold', color: '#991b1b', width: '35%' }}>Modified On</td>
                                  <td style={{ fontWeight: 'bold', color: '#991b1b' }}>
                                    {b.modified_at || '-'}
                                    {b.modified_by && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#7f1d1d', fontWeight: 600 }}>(by {b.modified_by})</span>}
                                  </td>
                                </tr>
                                {(diff?.summary_text || b.modified_details) && (
                                  <tr style={{ backgroundColor: '#fef2f2' }}>
                                    <td style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '11px' }}>Changes (in Red)</td>
                                    <td style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                                      {diff?.summary_text || (typeof b.modified_details === 'string' ? b.modified_details : JSON.stringify(b.modified_details))}
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                            <tr>
                              <td style={{ fontWeight: 'bold', width: '35%' }}>Product</td><td>{productNameValue}</td>
                            </tr>
                            {!isLabCard && (
                              <>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>RM Name</td>
                                  <td style={{ color: isRmNameChanged ? '#dc2626' : undefined, fontWeight: isRmNameChanged ? 'bold' : undefined, backgroundColor: isRmNameChanged ? '#fee2e2' : undefined }}>
                                    {rmNameValue}
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>RM Lot No</td>
                                  <td style={{ color: isRmLotChanged ? '#dc2626' : undefined, fontWeight: isRmLotChanged ? 'bold' : undefined, backgroundColor: isRmLotChanged ? '#fee2e2' : undefined }}>
                                    {rmLotNoValue}
                                  </td>
                                </tr>
                              </>
                            )}
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Formula Date</td>
                              <td style={{ color: isFormulaDateChanged ? '#dc2626' : undefined, fontWeight: isFormulaDateChanged ? 'bold' : undefined, backgroundColor: isFormulaDateChanged ? '#fee2e2' : undefined }}>
                                {formulaDate}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Test Date</td>
                              <td style={{ color: isTestDateChanged ? '#dc2626' : undefined, fontWeight: isTestDateChanged ? 'bold' : undefined, backgroundColor: isTestDateChanged ? '#fee2e2' : undefined }}>
                                {testDate}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Report Date</td>
                              <td style={{ color: isReportDateChanged ? '#dc2626' : undefined, fontWeight: isReportDateChanged ? 'bold' : undefined, backgroundColor: isReportDateChanged ? '#fee2e2' : undefined }}>
                                {reportDate}
                              </td>
                            </tr>
                            {!isLabCard && (
                              <>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>Status</td>
                                  <td style={{ fontWeight: 'bold', color: isStatusChanged ? '#dc2626' : (approvalStatus === 'OK' ? 'var(--color-success)' : 'var(--color-error)'), backgroundColor: isStatusChanged ? '#fee2e2' : undefined }}>
                                    {approvalStatus}
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>Approved By</td>
                                  <td style={{ color: isApprovedByChanged ? '#dc2626' : undefined, fontWeight: isApprovedByChanged ? 'bold' : undefined, backgroundColor: isApprovedByChanged ? '#fee2e2' : undefined }}>
                                    {approvalComments}
                                  </td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 2. Raw Materials Table */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: b.is_modified ? '#b91c1c' : 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Raw Materials
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: b.is_modified ? '1px solid #fca5a5' : '1px solid #cbd5e1' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '30px' }}>Sr</th>
                              {!isLabCard && <th>MR No</th>}
                              <th>Material</th>
                              <th style={{ width: '60px', textAlign: 'right' }}>Qty</th>
                              {isLabCard && <th style={{ width: '55px', textAlign: 'right' }}>Solid%</th>}
                              {isLabCard && <th style={{ width: '65px', textAlign: 'right' }}>Solid Qty</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(b.inventory || []).map((item: any, idx: number) => {
                              const sr = item.sr_no || (Array.isArray(item) ? item[0] : (idx + 1).toString());
                              const mr = item.mr_no || (Array.isArray(item) ? item[3] : '');
                              const mat = item.raw_material || item.material || (Array.isArray(item) ? item[1] : '-');
                              const qty = item.qty !== undefined ? item.qty : (Array.isArray(item) ? item[2] : '0');
                              const qVal = parseFloat(qty) || 0;
                              const rawS = item.solid !== undefined && item.solid !== null ? item.solid.toString().trim().toLowerCase() : '';
                              const isNA = rawS === '' || rawS === 'n/a' || rawS === 'na' || rawS === '-' || rawS === 'nil';
                              const sPct = isNA ? 0 : (parseFloat(rawS) || 0);
                              const sQtyCalc = (qVal * (sPct / 100)).toFixed(2);
                              const displaySolidLabel = rawS === '' ? '-' : (isNA ? (item.solid || '-') : `${sPct}%`);

                              // Match material diff
                              const matDiff = diff?.materials_diff?.find((m: any) => {
                                if (m.index === idx) return true;
                                const itemNorm = (mat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                const diffNorm = (m.raw_material || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                return itemNorm && diffNorm && itemNorm === diffNorm;
                              });

                              const isNewMat = !!matDiff?.is_new;
                              const isQtyDiff = !!matDiff?.qty_changed;
                              const isMatNameDiff = !!matDiff?.material_changed;
                              const isSolidDiff = !!matDiff?.solid_changed;

                              return (
                                <tr 
                                  key={idx}
                                  style={{
                                    backgroundColor: isNewMat ? '#fee2e2' : undefined,
                                    borderBottom: isNewMat ? '1.5px solid #f87171' : undefined
                                  }}
                                >
                                  <td style={{ color: isNewMat ? '#b91c1c' : undefined, fontWeight: isNewMat ? 'bold' : undefined }}>{sr}</td>
                                  {!isLabCard && <td style={{ color: isNewMat ? '#b91c1c' : undefined }}>{mr || '-'}</td>}
                                  <td style={{ 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    maxWidth: '120px',
                                    color: (isNewMat || isMatNameDiff) ? '#dc2626' : undefined,
                                    fontWeight: (isNewMat || isMatNameDiff) ? 'bold' : undefined,
                                    backgroundColor: isMatNameDiff && !isNewMat ? '#fee2e2' : undefined
                                  }}>
                                    {mat}
                                    {isNewMat && (
                                      <span style={{ fontSize: '9px', fontWeight: 800, color: '#ffffff', backgroundColor: '#dc2626', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>
                                        NEW
                                      </span>
                                    )}
                                    {isMatNameDiff && !isNewMat && matDiff.old_material && (
                                      <span style={{ fontSize: '10px', color: '#991b1b', marginLeft: '4px' }}>(was {matDiff.old_material})</span>
                                    )}
                                  </td>
                                  <td style={{ 
                                    textAlign: 'right', 
                                    fontWeight: 'bold',
                                    color: (isNewMat || isQtyDiff) ? '#dc2626' : undefined,
                                    backgroundColor: (isQtyDiff || isNewMat) ? '#fee2e2' : undefined,
                                    border: (isQtyDiff && !isNewMat) ? '1px solid #fca5a5' : undefined,
                                    borderRadius: (isQtyDiff && !isNewMat) ? '4px' : undefined
                                  }}
                                  title={isQtyDiff && matDiff?.old_qty !== undefined && matDiff?.old_qty !== null ? `Was: ${matDiff.old_qty}` : undefined}
                                  >
                                    {qty}
                                  </td>
                                  {isLabCard && (
                                    <td style={{ 
                                      textAlign: 'right', 
                                      color: (isNewMat || isSolidDiff) ? '#dc2626' : '#64748b',
                                      fontWeight: isSolidDiff ? 'bold' : undefined,
                                      backgroundColor: isSolidDiff ? '#fee2e2' : undefined
                                    }}>
                                      {displaySolidLabel}
                                    </td>
                                  )}
                                  {isLabCard && (
                                    <td style={{ 
                                      textAlign: 'right', 
                                      fontWeight: 'bold', 
                                      color: isNewMat ? '#dc2626' : '#16a34a' 
                                    }}>
                                      {sQtyCalc}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                            <tr className="total-row">
                              <td colSpan={isLabCard ? 2 : 3} style={{ textAlign: 'right' }}>Total Qty</td>
                              <td style={{ textAlign: 'right', color: 'var(--primary-color)' }}>{totalWeight}</td>
                              {isLabCard && <td colSpan={2} style={{ textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>Solid: {totalSolidQty}</td>}
                            </tr>
                            {isLabCard && (
                              <tr className="total-row" style={{ borderTop: '1px solid #cbd5e1', backgroundColor: b.is_modified ? '#fee2e2' : '#f8fafc' }}>
                                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>FORMULATION SOLID(100%)</td>
                                <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 'bold' }}>{cardSolidity}%</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 3. Test Results Table */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: b.is_modified ? '#b91c1c' : 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Test Results
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: b.is_modified ? '1px solid #fca5a5' : '1px solid #cbd5e1' }}>
                          <thead>
                            <tr>
                              <th>Test Method</th>
                              <th>Standard</th>
                              <th style={{ width: '70px', textAlign: 'right' }}>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(b.tests || []).filter((test: any) => {
                              const res = test.result || (Array.isArray(test) ? test[2] : '');
                              return res !== '';
                            }).map((test: any, idx: number) => {
                              const method = test.method || (Array.isArray(test) ? test[0] : '-');
                              const standard = test.standard || (Array.isArray(test) ? test[1] : '-');
                              const result = test.result || (Array.isArray(test) ? test[2] : '-');

                              const testDiff = diff?.tests_diff?.find((t: any) => {
                                if (t.index === idx) return true;
                                const itemNorm = (method || '').toLowerCase().trim();
                                const diffNorm = (t.method || '').toLowerCase().trim();
                                return itemNorm && diffNorm && itemNorm === diffNorm;
                              });

                              const isNewTest = !!testDiff?.is_new;
                              const isResultDiff = !!testDiff?.result_changed;
                              const isStdDiff = !!testDiff?.standard_changed;

                              return (
                                <tr 
                                  key={idx}
                                  style={{
                                    backgroundColor: isNewTest ? '#fee2e2' : undefined
                                  }}
                                >
                                  <td style={{ color: isNewTest ? '#dc2626' : undefined, fontWeight: isNewTest ? 'bold' : undefined }}>
                                    {method}
                                    {isNewTest && (
                                      <span style={{ fontSize: '9px', fontWeight: 800, color: '#ffffff', backgroundColor: '#dc2626', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>
                                        NEW
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ 
                                    color: (isNewTest || isStdDiff) ? '#dc2626' : undefined,
                                    fontWeight: isStdDiff ? 'bold' : undefined,
                                    backgroundColor: isStdDiff ? '#fee2e2' : undefined
                                  }}>
                                    {standard}
                                  </td>
                                  <td style={{ 
                                    textAlign: 'right', 
                                    fontWeight: 'bold',
                                    color: (isNewTest || isResultDiff) ? '#dc2626' : undefined,
                                    backgroundColor: (isNewTest || isResultDiff) ? '#fee2e2' : undefined,
                                    border: (isResultDiff && !isNewTest) ? '1px solid #fca5a5' : undefined,
                                    borderRadius: (isResultDiff && !isNewTest) ? '4px' : undefined
                                  }}
                                  title={isResultDiff && testDiff?.old_result ? `Was: ${testDiff.old_result}` : undefined}
                                  >
                                    {result}
                                  </td>
                                </tr>
                              );
                            })}
                            {(b.tests || []).filter((test: any) => {
                              const res = test.result || (Array.isArray(test) ? test[2] : '');
                              return res !== '';
                            }).length === 0 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No test specifications recorded.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Remarks */}
                      {b.remarks && (
                        <div style={{ 
                          padding: '6px 8px', 
                          backgroundColor: isRemarksChanged ? '#fee2e2' : (b.is_modified ? '#fee2e2' : 'var(--bg-app)'), 
                          border: (isRemarksChanged || b.is_modified) ? '1px solid #fca5a5' : '1px solid var(--border-color)', 
                          fontSize: '11px', 
                          fontStyle: 'italic', 
                          marginBottom: '8px', 
                          color: isRemarksChanged ? '#dc2626' : (b.is_modified ? '#991b1b' : 'var(--text-secondary)'),
                          fontWeight: isRemarksChanged ? 'bold' : 'normal'
                        }}>
                          Remarks: {b.remarks}
                          {isRemarksChanged && diff?.field_diffs?.remarks?.old && (
                            <span style={{ display: 'block', fontSize: '10px', color: '#991b1b', fontStyle: 'normal' }}>
                              (Previous: "{diff.field_diffs.remarks.old}")
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions Footer: Modify Left & Modify Right */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: b.is_modified ? '1px solid #fca5a5' : '1px solid #cbd5e1' }}>
                        <button 
                          onClick={() => handleOpenModifyAuthModal(batchNo, 'left', isLabCard)}
                          className="flet-btn"
                          style={{ 
                            flexGrow: 1, 
                            backgroundColor: '#7c3aed', 
                            color: '#ffffff', 
                            border: 'none', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            fontWeight: 'bold',
                            padding: '6px 8px'
                          }}
                          title={`Modify batch ${batchNo} on Left spreadsheet`}
                        >
                          <Lock size={12} /> Modify Left
                        </button>
                        <button 
                          onClick={() => handleOpenModifyAuthModal(batchNo, 'right', isLabCard)}
                          className="flet-btn"
                          style={{ 
                            flexGrow: 1, 
                            backgroundColor: '#2563eb', 
                            color: '#ffffff', 
                            border: 'none', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            fontWeight: 'bold',
                            padding: '6px 8px'
                          }}
                          title={`Modify batch ${batchNo} on Right spreadsheet`}
                        >
                          Modify Right <Lock size={12} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}


      <datalist id="common-raw-materials">
        {[
          'Epoxy Resin', 'Titanium Dioxide', 'Xylene', 'Butyl Acetate', 'Talc', 
          'Calcium Carbonate', 'Acrylic Resin', 'Iron Oxide Red', 'Iron Oxide Yellow',
          'Iron Oxide Black', 'Bentonite Clay', 'Defoamer', 'Dispersant', 'PU Resin', 
          'Aliphatic Polyisocyanate', 'Ethyl Acetate', 'Methanol', 'Acetone', 'Toluene',
          'Phthalocyanine Blue', 'Phthalocyanine Green', 'Carbon Black', 'Silica', 'Barium Sulfate',
          ...Array.from(new Set([
            ...leftRows.map(r => r.material.trim()),
            ...rightRows.map(r => r.material.trim())
          ])).filter(m => m !== '' && ![
            'Epoxy Resin', 'Titanium Dioxide', 'Xylene', 'Butyl Acetate', 'Talc', 
            'Calcium Carbonate', 'Acrylic Resin', 'Iron Oxide Red', 'Iron Oxide Yellow',
            'Iron Oxide Black', 'Bentonite Clay', 'Defoamer', 'Dispersant', 'PU Resin', 
            'Aliphatic Polyisocyanate', 'Ethyl Acetate', 'Methanol', 'Acetone', 'Toluene',
            'Phthalocyanine Blue', 'Phthalocyanine Green', 'Carbon Black', 'Silica', 'Barium Sulfate'
          ].includes(m))
        ].map((m, idx) => (
          <option key={idx} value={m} />
        ))}
      </datalist>

      <StarRatingModal 
        isOpen={starModalOpen}
        batchNo={selectedBatchForStar?.batchNo || ''}
        isStarred={selectedBatchForStar?.isStarred || false}
        initialOkRating={okRatingInput}
        loading={loading}
        onSave={handleSaveStarStatus}
        onClose={() => setStarModalOpen(false)}
      />

      <LightboxModal 
        imageSrc={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      <BatchModificationModal 
        isOpen={modifyAuthModalOpen}
        batchToModify={batchToModify}
        loading={modifyAuthLoading}
        error={modifyPasswordError}
        onVerify={handleVerifyModifyPasswordAndLoad}
        onClose={() => {
          setModifyAuthModalOpen(false);
          setBatchToModify(null);
        }}
      />



      <style>{`
        .spin-loader {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};

export default CmsMain;