import React, { useState, useEffect, useRef } from 'react';
import { 
  Beaker, Search, Filter, RefreshCw, FileSpreadsheet, ArrowLeft, ArrowRight,
  AlertTriangle, Copy, Trash2, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Building,
  Edit3, ZoomIn, Bell, Info, Printer
} from 'lucide-react';
import { CMSAPI, LabPastFormulationsAPI, RMPastFormulationsAPI, LabFormulationsAPI, RMFormulationsAPI, RawMaterialAPI, RepairedFormulationsAPI, API_BASE_URL, NotificationsAPI } from '../services/api';
import * as XLSX from 'xlsx';
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
  testDate: string;
  reportDate: string;
  formulaDate: string;
}

interface InventoryRow {
  sr: string;
  mr: string;
  material: string;
  qty: string;
  selected?: boolean;
}

interface TestRow {
  method: string;
  standard: string;
  result: string;
  selected?: boolean;
}

export const CmsMain: React.FC<CmsMainProps> = ({ activeSubView, onShowToast, onChangeView }) => {
  const productName = sessionStorage.getItem('product_name') || '';

  // --------------------------------------------------------------------------
  // NOTIFICATIONS SYSTEM STATE & LOGIC
  // --------------------------------------------------------------------------
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedPastBatches, setSelectedPastBatches] = useState<string[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const skipDuplicateCheck = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  const getTypeClass = (type: string) => {
    const t = (type || '').toLowerCase().trim();
    if (t === 'success' || t === 'ok') return 'success';
    if (t === 'warning' || t === 'not_ok') return 'warning';
    if (t === 'info') return 'info';
    if (t === 'error' || t === 'danger') return 'error';
    return 'info';
  };

  const renderNotificationIcon = (type: string) => {
    const t = getTypeClass(type);
    if (t === 'success') return <CheckCircle2 size={14} style={{ color: '#10B981' }} />;
    if (t === 'warning') return <AlertTriangle size={14} style={{ color: '#F59E0B' }} />;
    if (t === 'info') return <Info size={14} style={{ color: '#3B82F6' }} />;
    return <AlertTriangle size={14} style={{ color: '#EF4444' }} />;
  };

  const fetchNotifications = async () => {
    const [success, data] = await NotificationsAPI.getNotifications();
    if (success && Array.isArray(data)) {
      setNotifications(data);
      const unseen = data.filter((notif: any) => !notif.seen).length;
      setUnreadCount(unseen);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAllAsSeen = async () => {
    const unseenIds = notifications
      .filter((n: any) => !n.seen)
      .map((n: any) => n.id);

    if (unseenIds.length > 0) {
      const [success] = await NotificationsAPI.markNotificationsSeen(unseenIds);
      if (success) {
        setNotifications(prev =>
          prev.map((n: any) => ({ ...n, seen: true }))
        );
        setUnreadCount(0);
      }
    }
  };

  // --------------------------------------------------------------------------
  // STATE DEFINITIONS FOR THE DUAL FORMULATION PANELS
  // --------------------------------------------------------------------------
  const [leftForm, setLeftForm] = useState<FormFields>({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
  const [rightForm, setRightForm] = useState<FormFields>({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
  
  const [leftRemarks, setLeftRemarks] = useState('');
  const [rightRemarks, setRightRemarks] = useState('');

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

  // 25 lines of material rows (matching Flet CMS config)
  const initializeRows = (): InventoryRow[] => 
    Array.from({ length: 25 }, (_, i) => ({ sr: (i + 1).toString(), mr: '', material: '', qty: '', selected: false }));
  
  const [leftRows, setLeftRows] = useState<InventoryRow[]>(initializeRows());
  const [rightRows, setRightRows] = useState<InventoryRow[]>(initializeRows());

  // Test Parameter Rows — exactly matching lab_formulations_cms.py test_methods list
  const initializeTestRows = (): TestRow[] => [
    { method: 'RM VISCOSITY',    standard: 'GTP-06',       result: '', selected: false },
    { method: 'RM SOLID',        standard: 'IR',            result: '', selected: false },
    { method: 'LACQUER VISC.',   standard: 'GTP-06',       result: '', selected: false },
    { method: 'PH VALUE',        standard: 'WI-QC-03',     result: '', selected: false },
    { method: 'ACID VALUE',      standard: 'WI-R&D-01',    result: '', selected: false },
    { method: 'AMINE VALUE',     standard: 'WI-R&D-02',    result: '', selected: false },
    { method: 'LACQUER CLARITY', standard: 'STP-01',       result: '', selected: false },
    { method: 'LEVEL',           standard: 'STP-08',       result: '', selected: false },
    { method: 'COVERAGE',        standard: 'STP-04',       result: '', selected: false },
    { method: 'WETTING',         standard: 'STP-17',       result: '', selected: false },
    { method: 'ADHESION',        standard: 'GTP-01',       result: '', selected: false },
    { method: 'MEK',             standard: 'STP-09',       result: '', selected: false },
    { method: 'HARDNESS',        standard: 'GTP-04',       result: '', selected: false },
    { method: 'GLASS EFFECT',    standard: 'GTP-02',       result: '', selected: false },
    { method: 'YELLOWING TEST',  standard: 'STP-18',       result: '', selected: false },
    { method: 'HAZINESS',        standard: 'STP-01',       result: '', selected: false },
    { method: 'RECOATING',       standard: 'STP-15',       result: '', selected: false },
    { method: 'PERFUME/ALCOHOL', standard: 'STP-05/STP-02',result: '', selected: false },
    { method: 'COLORBLEEDING',   standard: 'STP-03',       result: '', selected: false },
    { method: 'WATER TEST',      standard: 'GTP-03',       result: '', selected: false },
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

  const handleExitComplaintMode = () => {
    setIsComplaintMode(false);
    setBpbsData(null);
    setImageReferences([]);
    setComplaintOriginInfo(null);
    setLeftForm({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
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
              rmLot: '',
              testDate: '',
              reportDate: '',
              formulaDate: ''
            });
            
            setRightRemarks(parsed.remarks || '');
            
            // Map inventory rows and fill up to 25 rows
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
    setLeftForm({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
    setLeftRows(initializeRows());
    setLeftTestRows(initializeTestRows());
    setLeftRemarks('');
    setLeftStatus('Select');
    setLeftApprovedBy('');

    setRightForm({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
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

  // Excel-like Keyboard navigation logic (arrows and Enter)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    side: 'left' | 'right', 
    rowIndex: number, 
    colType: 'mr' | 'mat' | 'qty'
  ) => {
    const rowsLength = side === 'left' ? leftRows.length : rightRows.length;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < rowsLength - 1) {
        const selector = `input[id="${side}-${colType}-${rowIndex + 1}"]`;
        const nextInput = document.querySelector(selector) as HTMLInputElement;
        if (nextInput) nextInput.focus();
      }
    } else if (e.key === 'ArrowDown' && rowIndex < rowsLength - 1) {
      e.preventDefault();
      const nextInput = document.querySelector(`input[id="${side}-${colType}-${rowIndex + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(`input[id="${side}-${colType}-${rowIndex - 1}"]`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      let selector = '';
      
      if (e.shiftKey) {
        // Navigate backwards within table only
        if (colType === 'qty') {
          selector = `input[id="${side}-mat-${rowIndex}"]`;
        } else if (colType === 'mat') {
          if (activeSubView === 'rm_testing') {
            selector = `input[id="${side}-mr-${rowIndex}"]`;
          } else if (rowIndex > 0) {
            selector = `input[id="${side}-qty-${rowIndex - 1}"]`;
          }
        } else if (colType === 'mr') {
          if (rowIndex > 0) {
            selector = `input[id="${side}-qty-${rowIndex - 1}"]`;
          }
        }
      } else {
        // Navigate forwards within table only
        if (colType === 'mr') {
          selector = `input[id="${side}-mat-${rowIndex}"]`;
        } else if (colType === 'mat') {
          selector = `input[id="${side}-qty-${rowIndex}"]`;
        } else if (colType === 'qty') {
          if (rowIndex < rowsLength - 1) {
            selector = activeSubView === 'rm_testing' 
              ? `input[id="${side}-mr-${rowIndex + 1}"]` 
              : `input[id="${side}-mat-${rowIndex + 1}"]`;
          }
        }
      }
      
      if (selector) {
        const nextInput = document.querySelector(selector) as HTMLInputElement;
        if (nextInput) nextInput.focus();
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
        if (nextInput) nextInput.focus();
      }
    } else if (e.key === 'ArrowDown' && rowIndex < rowsLength - 1) {
      e.preventDefault();
      const nextInput = document.querySelector(`input[id="${side}-test-${colType}-${rowIndex + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(`input[id="${side}-test-${colType}-${rowIndex - 1}"]`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      let selector = '';
      if (e.shiftKey) {
        // Navigate backwards within table only
        if (colType === 'result') {
          selector = `input[id="${side}-test-standard-${rowIndex}"]`;
        } else if (colType === 'standard') {
          selector = `input[id="${side}-test-method-${rowIndex}"]`;
        } else if (colType === 'method' && rowIndex > 0) {
          selector = `input[id="${side}-test-result-${rowIndex - 1}"]`;
        }
      } else {
        // Navigate forwards within table only
        if (colType === 'method') {
          selector = `input[id="${side}-test-standard-${rowIndex}"]`;
        } else if (colType === 'standard') {
          selector = `input[id="${side}-test-result-${rowIndex}"]`;
        } else if (colType === 'result' && rowIndex < rowsLength - 1) {
          selector = `input[id="${side}-test-method-${rowIndex + 1}"]`;
        }
      }
      if (selector) {
        const nextInput = document.querySelector(selector) as HTMLInputElement;
        if (nextInput) nextInput.focus();
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

    setForm({ refNo: '', batchNo: '', product: '', rmLot: '', testDate: '', reportDate: '', formulaDate: '' });
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
    if (!isLab) return;

    const rows = side === 'left' ? leftRows : rightRows;
    const materials = rows
      .map(r => [r.material, parseFloat(r.qty)] as [string, number])
      .filter(m => m[0] !== '' && !isNaN(m[1]));

    if (materials.length === 0) {
      onShowToast('No formula found. Populate sheets first.', 'warning');
      return;
    }

    setLoading(true);
    const [success, data] = await LabFormulationsAPI.filterMatches(productName, filterType, materials);
    setLoading(false);

    const setDuplicateMatches = side === 'left' ? setDuplicateMatchesLeft : setDuplicateMatchesRight;

    if (success && typeof data !== 'string') {
      const matches = data.matches || [];
      if (matches.length === 0) {
        onShowToast('No historical batches match this specific filter.', 'info');
      } else {
        // Map Filtered matches to duplicate format to display
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
      'TEST DATE': form.testDate,
      'REPORT DATE': form.reportDate,
      'FORMULA DATE': form.formulaDate,
    };

    setLoading(true);
    const [success, data] = await LabFormulationsAPI.saveMasterPayload(productName, form.batchNo, formPayload, inventoryPayload, testPayload);
    setLoading(false);

    if (success) {
      onShowToast(`Master formulation saved for batch ${form.batchNo}`, 'success');
      NotificationsAPI.createNotification(
        "[SUCCESS] Batch Approved!",
        `Batch ${form.batchNo} approved and saved to master formulations.`,
        "success",
        ["production", "mf"]
      );
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to save master.', 'error');
    }
  };

  // 5. Save Full formulation entry
  const handleSaveFull = async (side: 'left' | 'right') => {
    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;
    const tests = side === 'left' ? leftTestRows : rightTestRows;
    const remarks = side === 'left' ? leftRemarks : rightRemarks;

    const status = side === 'left' ? leftStatus : rightStatus;
    const approvedBy = side === 'left' ? leftApprovedBy : rightApprovedBy;

    if (!form.batchNo) {
      onShowToast('Batch No is required to save full data.', 'warning');
      return;
    }

    const formFieldsPayload = [
      { label: 'Ref No', value: form.refNo },
      { label: 'Batch No', value: form.batchNo },
      { label: 'Product Name', value: form.product },
      { label: 'RM Lot', value: form.rmLot },
      { label: 'Test Date', value: form.testDate },
      { label: 'Report Date', value: form.reportDate },
      { label: 'Formula Date', value: form.formulaDate },
    ];

    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';

    const inventoryPayload = rows
      .filter(r => r.material.trim() !== '')
      .map(r => {
        if (isLab) {
          return { sr_no: r.sr, raw_material: r.material, qty: r.qty };
        } else {
          return { sr_no: r.sr, mr_no: r.mr, raw_material: r.material, qty: r.qty };
        }
      });

    const testPayload = tests
      .filter(t => t.method.trim() !== '')
      .map(t => ({ method: t.method, standard: t.standard, result: t.result }));

    setLoading(true);
    const saveApi = isLab ? LabFormulationsAPI.saveFullBatch : RMFormulationsAPI.saveFullBatch;
    const [success, data] = isLab 
      ? await saveApi(productName, formFieldsPayload, inventoryPayload, testPayload, remarks)
      : await saveApi(productName, formFieldsPayload, inventoryPayload, testPayload, remarks, status, approvedBy);
    setLoading(false);

    if (success) {
      onShowToast(`Full batch compilation successfully saved: ${form.batchNo}`, 'success');
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
          batchNo: data.batch_no || fd[1] || '',
          product: fd[2] || '',
          rmLot: '',
          testDate: fd[3] || '',
          reportDate: fd[4] || '',
          formulaDate: fd[5] || '',
        });
      } else {
        setForm({
          refNo: data.ref_no || fd[0] || '',
          batchNo: data.batch_no || fd[1] || '',
          product: fd[2] || '',
          rmLot: fd[3] || '',
          testDate: fd[4] || '',
          reportDate: fd[5] || '',
          formulaDate: fd[6] || '',
        });
      }

      setRemarks(data.remarks || '');
      
      if (!isLab) {
        setStatus(data.approval_status || 'Select');
        setApprovedBy(data.approval_comments || '');
      }

      // Load inventory rows and fill up to 25 rows
      const inventory = (data.inventory || []).map((i: any) => {
        if (Array.isArray(i)) {
          return {
            sr: i[0] ? i[0].toString() : '',
            material: i[1] || '',
            qty: i[2] !== undefined ? i[2].toString() : '',
            mr: i[3] || '',
            selected: false
          };
        } else {
          return {
            sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
            material: i.raw_material || i.material || '',
            qty: i.qty !== undefined ? i.qty.toString() : '',
            mr: i.mr_no || i.mr || '',
            selected: false
          };
        }
      });
      const paddedInventory = [...inventory];
      while (paddedInventory.length < 25) {
        paddedInventory.push({ sr: (paddedInventory.length + 1).toString(), mr: '', material: '', qty: '', selected: false });
      }
      setRows(paddedInventory);
      skipDuplicateCheck.current[side] = true;

      // Duplicate check handles self-duplicates automatically now

      // Load test results
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

  // Client-side browser Excel export (blob)
  const exportToExcel = (side: 'left' | 'right') => {
    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;
    const tests = side === 'left' ? leftTestRows : rightTestRows;
    const remarks = side === 'left' ? leftRemarks : rightRemarks;
    const total = calculateTotalWeight(rows);

    const wb = XLSX.utils.book_new();
    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';
    
    // Build a unified layout array of arrays
    const data: any[][] = [
      ['Colortek CMS - Formulation Report'],
      [],
      ['Active Product Workspace', productName],
      ['Ref No', form.refNo],
      ['Batch No', form.batchNo],
      ['Product Name', form.product],
    ];

    if (!isLab) {
      data.push(['RM Lot No', form.rmLot]);
    }

    data.push(
      ['Test Date', form.testDate],
      ['Report Date', form.reportDate],
      ['Formula Date', form.formulaDate],
      [],
      ['INGREDIENTS LIST']
    );

    if (isLab) {
      data.push(['Sr No', 'Raw Material', 'Qty (grams)']);
    } else {
      data.push(['Sr No', 'MR No', 'Raw Material', 'Qty (grams)']);
    }

    // Add ingredients
    rows.filter(r => r.material.trim() !== '').forEach(r => {
      if (isLab) {
        data.push([r.sr, r.material, r.qty]);
      } else {
        data.push([r.sr, r.mr || '', r.material, r.qty]);
      }
    });

    data.push([]);
    if (isLab) {
      data.push(['TOTAL WEIGHT', '', `${total} g`]);
    } else {
      data.push(['TOTAL WEIGHT', '', '', `${total} g`]);
    }
    data.push([]);
    
    // Add tests
    data.push(['TEST SPECIFICATIONS']);
    data.push(['Test Method', 'Standard', 'Result']);
    const activeTests = tests.filter(t => t.method.trim() !== '');
    if (activeTests.length > 0) {
      activeTests.forEach(t => {
        data.push([t.method, t.standard || '', t.result || '']);
      });
    } else {
      data.push(['No test specifications recorded']);
    }

    if (remarks) {
      data.push([]);
      data.push(['REMARKS']);
      data.push([remarks]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Formulation');

    XLSX.writeFile(wb, `Batch_${form.batchNo || 'Sheet'}_CMS.xlsx`);
    onShowToast('Excel exported via in-memory download.', 'success');
  };

  // Client-side browser PDF export (blob)
  const exportToPDF = (side: 'left' | 'right') => {
    const form = side === 'left' ? leftForm : rightForm;
    const rows = side === 'left' ? leftRows : rightRows;
    const tests = side === 'left' ? leftTestRows : rightTestRows;
    const remarks = side === 'left' ? leftRemarks : rightRemarks;
    const total = calculateTotalWeight(rows);

    const doc = new jsPDF();
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Colortek CMS - Formulation Report', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Active Product Workspace: ${productName}`, 14, 28);
    doc.text(`Ref No: ${form.refNo}`, 14, 34);
    doc.text(`Batch No: ${form.batchNo}`, 14, 40);
    doc.text(`Product Name: ${form.product}`, 14, 46);
    doc.text(`Total Weight: ${total} grams`, 14, 52);

    let y = 60;
    doc.setFont('Helvetica', 'bold');
    doc.text('Ingredients List:', 14, y);
    
    y += 6;
    doc.setFontSize(9);
    // Draw columns manually
    doc.text('Sr', 14, y);
    doc.text('MR No', 24, y);
    doc.text('Raw Material', 54, y);
    doc.text('Quantity (g)', 124, y);
    doc.line(14, y + 2, 180, y + 2);

    y += 8;
    doc.setFont('Helvetica', 'normal');
    rows.filter(r => r.material !== '').forEach(r => {
      if (y > 275) {
        doc.addPage();
        y = 20;
        doc.setFont('Helvetica', 'bold');
        doc.text('Ingredients List (Continued):', 14, y);
        y += 8;
        doc.setFont('Helvetica', 'normal');
      }
      doc.text(r.sr, 14, y);
      doc.text(r.mr || '-', 24, y);
      doc.text(r.material, 54, y);
      doc.text(r.qty || '0', 124, y);
      y += 6;
    });

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.line(14, y, 180, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Test Specifications:', 14, y);

    y += 6;
    doc.setFontSize(9);
    doc.text('Test Method', 14, y);
    doc.text('Standard', 84, y);
    doc.text('Result', 144, y);
    doc.line(14, y + 2, 180, y + 2);

    y += 8;
    doc.setFont('Helvetica', 'normal');
    const activeTests = tests.filter(t => t.method.trim() !== '');
    if (activeTests.length > 0) {
      activeTests.forEach(t => {
        if (y > 275) {
          doc.addPage();
          y = 20;
          doc.setFont('Helvetica', 'bold');
          doc.text('Test Specifications (Continued):', 14, y);
          y += 8;
          doc.setFont('Helvetica', 'normal');
        }
        doc.text(t.method, 14, y);
        doc.text(t.standard || '-', 84, y);
        doc.text(t.result || '-', 144, y);
        y += 6;
      });
    } else {
      doc.text('No test specifications recorded.', 14, y);
      y += 6;
    }

    if (remarks) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      y += 4;
      doc.line(14, y, 180, y);
      y += 8;
      doc.setFont('Helvetica', 'bold');
      doc.text('Remarks:', 14, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.text(remarks, 14, y);
    }

    doc.save(`Batch_${form.batchNo || 'Sheet'}_CMS.pdf`);
    onShowToast('PDF report downloaded successfully.', 'success');
  };

  const printPastLabFormulation = async (batchNo: string) => {
    setLoading(true);
    const [success, data] = await LabFormulationsAPI.getBatchDetail(batchNo, productName);
    setLoading(false);
    if (success && typeof data !== 'string') {
      generateFormulationPrintPDF(data);
    } else {
      onShowToast('Failed to fetch formulation details for printing.', 'error');
    }
  };

  const generateFormulationPrintPDF = (data: any) => {
    const fd = data.form_data || [];
    const refNo = data.ref_no || fd[0] || 'N/A';
    const batchNo = data.batch_no || fd[1] || 'N/A';
    
    const isLab = fd.length === 6;
    const productNameField = fd[2] || data.product_name_field || data.product || 'N/A';
    const testDate = isLab ? (fd[3] || 'N/A') : (fd[4] || 'N/A');
    const reportDate = isLab ? (fd[4] || 'N/A') : (fd[5] || 'N/A');
    const formulaDate = isLab ? (fd[5] || 'N/A') : (fd[6] || 'N/A');

    const inventory = (data.inventory || []).map((i: any) => {
      if (Array.isArray(i)) {
        return {
          sr: i[0] ? i[0].toString() : '',
          material: i[1] || '',
          qty: i[2] !== undefined ? i[2].toString() : '',
          mr: i[3] || '',
        };
      } else {
        return {
          sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
          material: i.raw_material || i.material || '',
          qty: i.qty !== undefined ? i.qty.toString() : '',
          mr: i.mr_no || i.mr || '',
        };
      }
    }).filter((item: any) => item.material.trim() !== '');

    const tests = (data.tests || []).map((t: any) => {
      if (Array.isArray(t)) {
        return {
          method: t[0] || '',
          standard: t[1] || '',
          result: t[2] || '',
        };
      } else {
        return {
          method: t.method || '',
          standard: t.standard || '',
          result: t.result || '',
        };
      }
    }).filter((t: any) => {
      const methodVal = (t.method || '').trim();
      const stdVal = (t.standard || '').trim();
      const resVal = (t.result || '').trim();
      
      if (methodVal === '') return false;
      
      const isStdEmpty = stdVal === '' || stdVal === '-' || stdVal.toLowerCase() === 'select';
      const isResEmpty = resVal === '' || resVal === '-' || resVal.toLowerCase() === 'select';
      
      return !(isStdEmpty && isResEmpty);
    });

    const remarks = data.remarks || '';

    const doc = new jsPDF('p', 'mm', 'a4');

    // PAGE 1: Front Side
    doc.setDrawColor(128, 128, 128);
    doc.setLineWidth(0.5);
    doc.rect(8, 8, 194, 281);

    // Header Title (Clean, no solid fills)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('COLORTEK CMS - LABORATORY FORMULATION CARD', 105, 18, { align: 'center' });
    doc.line(12, 22, 198, 22);

    // Metadata details block
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Column 1
    doc.setFont('Helvetica', 'bold'); doc.text('Product Name:', 15, 30);
    doc.setFont('Helvetica', 'normal'); doc.text(productNameField, 45, 30);
    
    doc.setFont('Helvetica', 'bold'); doc.text('Batch No:', 15, 37);
    doc.setFont('Helvetica', 'normal'); doc.text(batchNo, 45, 37);
    
    doc.setFont('Helvetica', 'bold'); doc.text('Formula Date:', 15, 44);
    doc.setFont('Helvetica', 'normal'); doc.text(formulaDate !== 'N/A' ? formulaDate : '-', 45, 44);

    // Column 2
    doc.setFont('Helvetica', 'bold'); doc.text('Ref No:', 115, 30);
    doc.setFont('Helvetica', 'normal'); doc.text(refNo !== 'N/A' ? refNo : '-', 135, 30);
    
    doc.setFont('Helvetica', 'bold'); doc.text('Test Date:', 115, 37);
    doc.setFont('Helvetica', 'normal'); doc.text(testDate !== 'N/A' ? testDate : '-', 135, 37);
    
    doc.setFont('Helvetica', 'bold'); doc.text('Report Date:', 115, 44);
    doc.setFont('Helvetica', 'normal'); doc.text(reportDate !== 'N/A' ? reportDate : '-', 135, 44);

    doc.setDrawColor(209, 213, 219);
    doc.line(12, 50, 198, 50);

    // Ingredients Section
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INGREDIENTS FORMULA', 15, 57);

    let y = 64;
    doc.setFontSize(9.5);
    doc.setFillColor(245, 245, 245);
    doc.rect(12, y, 186, 7, 'F');
    doc.rect(12, y, 186, 7, 'S');

    doc.text('Sr', 16, y + 5);
    doc.text('MR No', 28, y + 5);
    doc.text('Raw Material Description', 62, y + 5);
    doc.text('Quantity (Grams)', 194, y + 5, { align: 'right' });

    y += 7;
    doc.setFont('Helvetica', 'normal');

    let totalQty = 0;
    inventory.forEach((item: any, index: number) => {
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(12, y, 186, 7, 'F');
      }
      doc.rect(12, y, 186, 7, 'S');

      doc.text(item.sr || String(index + 1), 16, y + 5);
      doc.text(item.mr || '-', 28, y + 5);
      doc.text(item.material, 62, y + 5);
      
      const qtyVal = parseFloat(item.qty);
      if (!isNaN(qtyVal)) {
        totalQty += qtyVal;
        doc.text(qtyVal.toFixed(2), 194, y + 5, { align: 'right' });
      } else {
        doc.text(item.qty || '0.00', 194, y + 5, { align: 'right' });
      }
      y += 7;
    });

    // Total Row
    doc.setFillColor(245, 245, 245);
    doc.rect(12, y, 186, 8, 'F');
    doc.rect(12, y, 186, 8, 'S');
    doc.setFont('Helvetica', 'bold');
    doc.text('TOTAL FORMULATION WEIGHT:', 62, y + 5.5);
    doc.text(`${totalQty.toFixed(2)} g`, 194, y + 5.5, { align: 'right' });

    y += 15;

    if (tests.length === 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Remarks & Comments:', 15, y);

      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      
      doc.rect(12, y, 186, 40);
      const splitRemarks = doc.splitTextToSize(remarks || 'No additional remarks.', 178);
      doc.text(splitRemarks, 16, y + 6);
    } else {
      // PAGE 2: Back Side
      doc.addPage();
      doc.setDrawColor(128, 128, 128);
      doc.setLineWidth(0.5);
      doc.rect(8, 8, 194, 281);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('QUALITY CONTROL TEST SPECIFICATIONS', 105, 18, { align: 'center' });
      doc.line(12, 22, 198, 22);

      y = 30;
      doc.setFontSize(9.5);
      doc.setFillColor(245, 245, 245);
      doc.rect(12, y, 186, 7, 'F');
      doc.rect(12, y, 186, 7, 'S');

      doc.setTextColor(0, 0, 0);
      doc.text('Test Method / Parameter', 16, y + 5);
      doc.text('Standard Range / Spec', 96, y + 5);
      doc.text('Observed Result', 194, y + 5, { align: 'right' });

      y += 7;
      doc.setFont('Helvetica', 'normal');

      tests.forEach((t: any, index: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(12, y, 186, 7, 'F');
        }
        doc.rect(12, y, 186, 7, 'S');

        doc.text(t.method, 16, y + 5);
        doc.text(t.standard || '-', 96, y + 5);
        doc.text(t.result || '-', 194, y + 5, { align: 'right' });
        y += 7;
      });

      y += 12;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Remarks & Comments:', 15, y);

      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      
      doc.rect(12, y, 186, 45);
      const splitRemarks = doc.splitTextToSize(remarks || 'No additional remarks.', 178);
      doc.text(splitRemarks, 16, y + 6);
    }



    // Save
    doc.save(`Lab_Formulation_${batchNo}_Card.pdf`);
    onShowToast(`Printable 2-page Card for Batch ${batchNo} downloaded!`, 'success');
  };

  const printSelectedIngredientsOnly = async () => {
    if (selectedPastBatches.length === 0) return;
    setLoading(true);
    const fetchedData: any[] = [];
    
    for (const batchNo of selectedPastBatches) {
      const [success, data] = await LabFormulationsAPI.getBatchDetail(batchNo, productName);
      if (success && typeof data !== 'string') {
        fetchedData.push(data);
      }
    }
    
    setLoading(false);
    
    if (fetchedData.length > 0) {
      generateIngredientsOnlyPDF(fetchedData);
    } else {
      onShowToast('Failed to fetch details for selected formulations.', 'error');
    }
  };

  const generateIngredientsOnlyPDF = (fetchedData: any[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let currentY = 8;
    const pageHeightLimit = 280;
    const cardWidth = 194;
    const startX = 8;

    fetchedData.forEach((data, idx) => {
      const fd = data.form_data || [];
      const refNo = data.ref_no || fd[0] || 'N/A';
      const batchNo = data.batch_no || fd[1] || 'N/A';
      
      const isLab = fd.length === 6;
      const productNameField = fd[2] || data.product_name_field || data.product || 'N/A';
      const testDate = isLab ? (fd[3] || 'N/A') : (fd[4] || 'N/A');
      const reportDate = isLab ? (fd[4] || 'N/A') : (fd[5] || 'N/A');
      const formulaDate = isLab ? (fd[5] || 'N/A') : (fd[6] || 'N/A');

      const inventory = (data.inventory || []).map((i: any) => {
        if (Array.isArray(i)) {
          return {
            sr: i[0] ? i[0].toString() : '',
            material: i[1] || '',
            qty: i[2] !== undefined ? i[2].toString() : '',
            mr: i[3] || '',
          };
        } else {
          return {
            sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
            material: i.raw_material || i.material || '',
            qty: i.qty !== undefined ? i.qty.toString() : '',
            mr: i.mr_no || i.mr || '',
          };
        }
      }).filter((item: any) => item.material.trim() !== '');

      const cardHeight = 30 + 4.5 + (inventory.length * 4.5) + 4.5 + 4;

      if (idx > 0 && currentY + cardHeight > pageHeightLimit) {
        doc.addPage();
        currentY = 8;
      }

      const startY = currentY;

      // Card Border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(startX, startY, cardWidth, cardHeight, 'S');

      // Card Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(29, 78, 216); // Blue-700
      doc.text(`Batch: ${batchNo}`, startX + 4, startY + 6);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(107, 114, 128); // Grey-500
      doc.text(`Ref: ${refNo !== 'N/A' ? refNo : '-'}`, startX + cardWidth - 4, startY + 6, { align: 'right' });

      doc.setDrawColor(229, 231, 235);
      doc.line(startX + 4, startY + 8, startX + cardWidth - 4, startY + 8);

      // BATCH DETAILS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(29, 78, 216);
      doc.text('BATCH DETAILS', startX + 4, startY + 12);

      doc.setDrawColor(209, 213, 219);
      doc.setFillColor(249, 250, 251);
      doc.rect(startX + 4, startY + 14, cardWidth - 8, 10);
      doc.line(startX + 4, startY + 19, startX + cardWidth - 4, startY + 19); // Horizontal Divider
      doc.line(startX + 4 + (cardWidth - 8) / 2, startY + 14, startX + 4 + (cardWidth - 8) / 2, startY + 24); // Vertical Divider

      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Product Name:', startX + 6, startY + 17.5);
      doc.setFont('Helvetica', 'normal'); doc.text(productNameField, startX + 28, startY + 17.5);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Formula Date:', startX + 4 + (cardWidth - 8) / 2 + 2, startY + 17.5);
      doc.setFont('Helvetica', 'normal'); doc.text(formulaDate !== 'N/A' ? formulaDate : '-', startX + 4 + (cardWidth - 8) / 2 + 22, startY + 17.5);

      doc.setFont('Helvetica', 'bold'); doc.text('Test Date:', startX + 6, startY + 22.5);
      doc.setFont('Helvetica', 'normal'); doc.text(testDate !== 'N/A' ? testDate : '-', startX + 28, startY + 22.5);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Report Date:', startX + 4 + (cardWidth - 8) / 2 + 2, startY + 22.5);
      doc.setFont('Helvetica', 'normal'); doc.text(reportDate !== 'N/A' ? reportDate : '-', startX + 4 + (cardWidth - 8) / 2 + 22, startY + 22.5);

      // RAW MATERIALS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(29, 78, 216);
      doc.text('RAW MATERIALS', startX + 4, startY + 28);

      let tableY = startY + 30;
      doc.setFillColor(245, 248, 250);
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text('Sr', startX + 6, tableY + 3.2);
      doc.text('Material Description', startX + 16, tableY + 3.2);
      doc.text('Qty (g)', startX + cardWidth - 6, tableY + 3.2, { align: 'right' });

      tableY += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);

      let totalQty = 0;
      inventory.forEach((item: any, index: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
        }
        doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');

        doc.text(item.sr || String(index + 1), startX + 6, tableY + 3.2);
        doc.text(item.material, startX + 16, tableY + 3.2);
        
        const qtyVal = parseFloat(item.qty);
        if (!isNaN(qtyVal)) {
          totalQty += qtyVal;
          doc.text(qtyVal.toFixed(2), startX + cardWidth - 6, tableY + 3.2, { align: 'right' });
        } else {
          doc.text(item.qty || '0.00', startX + cardWidth - 6, tableY + 3.2, { align: 'right' });
        }
        tableY += 4.5;
      });

      // Total Row
      doc.setFillColor(243, 244, 246);
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');
      doc.setFont('Helvetica', 'bold');
      doc.text('Total Qty:', startX + 16, tableY + 3.2);
      doc.text(`${totalQty.toFixed(2)} g`, startX + cardWidth - 6, tableY + 3.2, { align: 'right' });

      currentY += cardHeight + 4;
    });

    doc.save(`Lab_Raw_Materials_Only_${Date.now()}.pdf`);
    onShowToast(`Printable Raw Materials sheets downloaded!`, 'success');
    setSelectedPastBatches([]);
  };

  const printSelectedCompleteCards = async () => {
    if (selectedPastBatches.length === 0) return;
    setLoading(true);
    const fetchedData: any[] = [];
    
    for (const batchNo of selectedPastBatches) {
      const [success, data] = await LabFormulationsAPI.getBatchDetail(batchNo, productName);
      if (success && typeof data !== 'string') {
        fetchedData.push(data);
      }
    }
    
    setLoading(false);
    
    if (fetchedData.length > 0) {
      generateMultiFormulationsPrintPDF(fetchedData);
    } else {
      onShowToast('Failed to fetch details for selected formulations.', 'error');
    }
  };

  const generateMultiFormulationsPrintPDF = (fetchedData: any[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let currentY = 8;
    const pageHeightLimit = 280;
    const cardWidth = 194;
    const startX = 8;

    fetchedData.forEach((data, idx) => {
      const fd = data.form_data || [];
      const refNo = data.ref_no || fd[0] || 'N/A';
      const batchNo = data.batch_no || fd[1] || 'N/A';
      
      const isLab = fd.length === 6;
      const productNameField = fd[2] || data.product_name_field || data.product || 'N/A';
      const testDate = isLab ? (fd[3] || 'N/A') : (fd[4] || 'N/A');
      const reportDate = isLab ? (fd[4] || 'N/A') : (fd[5] || 'N/A');
      const formulaDate = isLab ? (fd[5] || 'N/A') : (fd[6] || 'N/A');

      const inventory = (data.inventory || []).map((i: any) => {
        if (Array.isArray(i)) {
          return {
            sr: i[0] ? i[0].toString() : '',
            material: i[1] || '',
            qty: i[2] !== undefined ? i[2].toString() : '',
            mr: i[3] || '',
          };
        } else {
          return {
            sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
            material: i.raw_material || i.material || '',
            qty: i.qty !== undefined ? i.qty.toString() : '',
            mr: i.mr_no || i.mr || '',
          };
        }
      }).filter((item: any) => item.material.trim() !== '');

      const tests = (data.tests || []).map((t: any) => {
        if (Array.isArray(t)) {
          return {
            method: t[0] || '',
            standard: t[1] || '',
            result: t[2] || '',
          };
        } else {
          return {
            method: t.method || '',
            standard: t.standard || '',
            result: t.result || '',
          };
        }
      }).filter((t: any) => {
        const methodVal = (t.method || '').trim();
        const stdVal = (t.standard || '').trim();
        const resVal = (t.result || '').trim();
        
        if (methodVal === '') return false;
        
        const isStdEmpty = stdVal === '' || stdVal === '-' || stdVal.toLowerCase() === 'select';
        const isResEmpty = resVal === '' || resVal === '-' || resVal.toLowerCase() === 'select';
        
        return !(isStdEmpty && isResEmpty);
      });

      const remarks = data.remarks || '';

      let estimatedHeight = 8 + 12 + (11 + inventory.length * 4.5);
      if (tests.length > 0) estimatedHeight += 10.5 + (tests.length * 4.5);
      if (remarks) estimatedHeight += 18;
      estimatedHeight += 4;

      if (idx > 0 && currentY + estimatedHeight > pageHeightLimit) {
        doc.addPage();
        currentY = 8;
      }

      const startY = currentY;

      // Card Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(29, 78, 216); // Blue-700
      doc.text(`Batch: ${batchNo}`, startX + 4, startY + 6);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Ref: ${refNo !== 'N/A' ? refNo : '-'}`, startX + cardWidth - 4, startY + 6, { align: 'right' });

      doc.setDrawColor(229, 231, 235);
      doc.line(startX + 4, startY + 8, startX + cardWidth - 4, startY + 8);

      // BATCH DETAILS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(29, 78, 216);
      doc.text('BATCH DETAILS', startX + 4, startY + 12);

      doc.setDrawColor(209, 213, 219);
      doc.setFillColor(249, 250, 251);
      doc.rect(startX + 4, startY + 14, cardWidth - 8, 10);
      doc.line(startX + 4, startY + 19, startX + cardWidth - 4, startY + 19); // Horizontal Divider
      doc.line(startX + 4 + (cardWidth - 8) / 2, startY + 14, startX + 4 + (cardWidth - 8) / 2, startY + 24); // Vertical Divider

      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.setFont('Helvetica', 'bold'); doc.text('Product Name:', startX + 6, startY + 17.5);
      doc.setFont('Helvetica', 'normal'); doc.text(productNameField, startX + 28, startY + 17.5);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Formula Date:', startX + 4 + (cardWidth - 8) / 2 + 2, startY + 17.5);
      doc.setFont('Helvetica', 'normal'); doc.text(formulaDate !== 'N/A' ? formulaDate : '-', startX + 4 + (cardWidth - 8) / 2 + 22, startY + 17.5);

      doc.setFont('Helvetica', 'bold'); doc.text('Test Date:', startX + 6, startY + 22.5);
      doc.setFont('Helvetica', 'normal'); doc.text(testDate !== 'N/A' ? testDate : '-', startX + 28, startY + 22.5);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Report Date:', startX + 4 + (cardWidth - 8) / 2 + 2, startY + 22.5);
      doc.setFont('Helvetica', 'normal'); doc.text(reportDate !== 'N/A' ? reportDate : '-', startX + 4 + (cardWidth - 8) / 2 + 22, startY + 22.5);

      // RAW MATERIALS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(29, 78, 216);
      doc.text('RAW MATERIALS', startX + 4, startY + 28);

      let tableY = startY + 30;
      doc.setFillColor(245, 248, 250);
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text('Sr', startX + 6, tableY + 3.2);
      doc.text('Material Description', startX + 16, tableY + 3.2);
      doc.text('Qty (g)', startX + cardWidth - 6, tableY + 3.2, { align: 'right' });

      tableY += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);

      let totalQty = 0;
      inventory.forEach((item: any, index: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
        }
        doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');

        doc.text(item.sr || String(index + 1), startX + 6, tableY + 3.2);
        doc.text(item.material, startX + 16, tableY + 3.2);
        
        const qtyVal = parseFloat(item.qty);
        if (!isNaN(qtyVal)) {
          totalQty += qtyVal;
          doc.text(qtyVal.toFixed(2), startX + cardWidth - 6, tableY + 3.2, { align: 'right' });
        } else {
          doc.text(item.qty || '0.00', startX + cardWidth - 6, tableY + 3.2, { align: 'right' });
        }
        tableY += 4.5;
      });

      // Total Row
      doc.setFillColor(243, 244, 246);
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(startX + 4, tableY, cardWidth - 8, 4.5, 'S');
      doc.setFont('Helvetica', 'bold');
      doc.text('Total Qty:', startX + 16, tableY + 3.2);
      doc.text(`${totalQty.toFixed(2)} g`, startX + cardWidth - 6, tableY + 3.2, { align: 'right' });

      let nextY = tableY + 4.5;

      // TEST RESULTS (if exist)
      if (tests.length > 0) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(29, 78, 216);
        doc.text('TEST RESULTS', startX + 4, nextY + 4);

        let testTableY = nextY + 6;
        doc.setFillColor(245, 248, 250);
        doc.rect(startX + 4, testTableY, cardWidth - 8, 4.5, 'F');
        doc.rect(startX + 4, testTableY, cardWidth - 8, 4.5, 'S');

        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text('Test Method', startX + 6, testTableY + 3.2);
        doc.text('Standard Spec', startX + 96, testTableY + 3.2);
        doc.text('Result', startX + cardWidth - 6, testTableY + 3.2, { align: 'right' });

        testTableY += 4.5;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);

        tests.forEach((t: any, index: number) => {
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(startX + 4, testTableY, cardWidth - 8, 4.5, 'F');
          }
          doc.rect(startX + 4, testTableY, cardWidth - 8, 4.5, 'S');

          doc.text(t.method, startX + 6, testTableY + 3.2);
          doc.text(t.standard || '-', startX + 96, testTableY + 3.2);
          doc.text(t.result || '-', startX + cardWidth - 6, testTableY + 3.2, { align: 'right' });
          testTableY += 4.5;
        });

        nextY = testTableY;
      }

      // Remarks & Comments (if exist)
      if (remarks) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(29, 78, 216);
        doc.text('Remarks & Comments:', startX + 4, nextY + 4);

        const remarksBoxY = nextY + 6;
        const remarksBoxHeight = 12;
        doc.setDrawColor(209, 213, 219);
        doc.rect(startX + 4, remarksBoxY, cardWidth - 8, remarksBoxHeight);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        const splitRem = doc.splitTextToSize(remarks, cardWidth - 16);
        doc.text(splitRem, startX + 6, remarksBoxY + 4.5);

        nextY = remarksBoxY + remarksBoxHeight;
      }

      // Draw Card Border exactly around the final content bottom
      const finalCardHeight = (nextY + 4) - startY;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(startX, startY, cardWidth, finalCardHeight, 'S');

      currentY = startY + finalCardHeight + 5; // Add gap between cards
    });

    doc.save(`Lab_Complete_Cards_${Date.now()}.pdf`);
    onShowToast(`Printable Complete Cards downloaded successfully!`, 'success');
    setSelectedPastBatches([]); // Reset selection after printing
  };



  const parseDuplicateDetails = (data: any) => {
    if (!data) return null;
    const fd = data.form_data || [];
    const metadata = {
      refNo: data.ref_no || '',
      batchNo: data.batch_no || '',
      product: fd[2] || data.product_name || '',
      rmLot: fd[3] || data.rm_name_lot_no || '',
      testDate: fd[4] || data.test_date || '',
      reportDate: fd[5] || data.report_date || '',
      formulaDate: fd[6] || data.formula_date || '',
    };

    const inventory = (data.inventory || []).map((i: any) => {
      if (Array.isArray(i)) {
        return {
          sr: i[0] ? i[0].toString() : '',
          material: i[1] || '',
          qty: i[2] !== undefined ? i[2].toString() : '',
          mr: i[3] || '',
        };
      } else {
        return {
          sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
          material: i.raw_material || i.material || '',
          qty: i.qty !== undefined ? i.qty.toString() : '',
          mr: i.mr_no || i.mr || '',
        };
      }
    }).filter((r: any) => r.material.trim() !== '');

    const tests = (data.tests || []).map((t: any) => {
      if (Array.isArray(t)) {
        return {
          method: t[0] || '',
          standard: t[1] || '',
          result: t[2] || '',
        };
      } else {
        return {
          method: t.method || '',
          standard: t.standard || '',
          result: t.result || '',
        };
      }
    });

    const remarks = data.remarks || '';
    return { metadata, inventory, tests, remarks };
  };

  const renderDuplicateOverlay = (overlaySide: 'left' | 'right') => {
    // If overlay is on the Left side, it displays duplicates for the Right formulation.
    // If overlay is on the Right side, it displays duplicates for the Left formulation.
    const duplicateMatches = overlaySide === 'left' ? duplicateMatchesRight : duplicateMatchesLeft;
    const duplicateDetails = overlaySide === 'left' ? duplicateDetailsRight : duplicateDetailsLeft;
    const selectedBatchNo = overlaySide === 'left' ? selectedDuplicateBatchNoRight : selectedDuplicateBatchNoLeft;
    const sourceSide = overlaySide === 'left' ? 'right' : 'left'; // the side that triggered the duplicate
    const isLab = activeSubView === 'lab_formulations' || activeSubView === 'past_lab_formulations';

    if (duplicateMatches.length === 0) return null;

    const parsed = parseDuplicateDetails(duplicateDetails);

    const handleDismiss = () => {
      if (overlaySide === 'left') {
        handleDismissDuplicatesRight();
      } else {
        handleDismissDuplicatesLeft();
      }
    };

    const handleLoadToSide = async (targetSide: 'left' | 'right') => {
      if (selectedBatchNo) {
        await loadBatchIntoPane(selectedBatchNo, targetSide);
        // Clear duplicates state for the source side to close the overlay
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

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        boxSizing: 'border-box',
        border: '2px solid var(--color-warning)',
        borderRadius: '4px',
        overflowY: 'auto',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Header Block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '10px',
          marginBottom: '10px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)', fontWeight: 'bold', fontSize: '14px' }}>
              <AlertTriangle size={18} />
              <span style={{ letterSpacing: '0.05em' }}>DUPLICATE DETECTED ({sourceSide.toUpperCase()} SIDE)</span>
            </div>
            <button 
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '18px',
                cursor: 'pointer',
                fontWeight: 'bold',
                padding: '4px'
              }}
              title="Dismiss Duplicate Alert"
            >
              ✕
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Select a matching duplicate batch to inspect:</span>
            
            {/* Matches Buttons/Chips Container */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0' }}>
              {duplicateMatches.map((m: any, idx: number) => {
                const isSelected = selectedBatchNo === m.batch_no;
                return (
                  <button
                    key={idx}
                    onClick={() => fetchDuplicateDetails(m.batch_no, sourceSide)}
                    style={{
                      backgroundColor: isSelected ? 'var(--primary-color)' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: isSelected ? '1px solid var(--primary-color)' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Batch {m.batch_no}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Details Content */}
        {!selectedBatchNo ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            gap: '12px',
            border: '2px dashed #cbd5e1',
            borderRadius: '6px',
            marginTop: '8px',
            padding: '24px',
            backgroundColor: 'var(--bg-app)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-app)'
            }}>
              <Building size={32} color="#94a3b8" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, textAlign: 'center' }}>
              Select a batch number button from the options above to check and load its details.
            </span>
            <button 
              onClick={handleDismiss} 
              className="flet-btn flet-btn-orange"
              style={{ fontSize: '11px', height: '24px', padding: '0 12px', marginTop: '4px' }}
            >
              Dismiss / Close Overlay
            </button>
          </div>
        ) : !parsed ? (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading duplicate details...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto' }}>
            {/* Top action row inside detailed sheet */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button 
                onClick={() => handleLoadToSide(sourceSide)} 
                className="flet-btn flet-btn-blue"
                style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
              >
                Overwrite {sourceSide.toUpperCase()}
              </button>
              <button 
                onClick={() => handleLoadToSide(overlaySide)} 
                className="flet-btn flet-btn-green"
                style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
              >
                Load to {overlaySide.toUpperCase()} (Compare)
              </button>
              <button 
                onClick={handleDismiss} 
                className="flet-btn flet-btn-orange"
                style={{ fontSize: '11px', height: '26px', padding: '0 12px' }}
              >
                Dismiss
              </button>
            </div>

            {/* Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              backgroundColor: 'var(--bg-app)',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              color: '#334155'
            }}>
              <div><strong>Ref No:</strong> {parsed.metadata.refNo || '-'}</div>
              <div><strong>Batch No:</strong> {parsed.metadata.batchNo || '-'}</div>
              <div><strong>Product:</strong> {parsed.metadata.product || '-'}</div>
              {!isLab && <div><strong>RM Lot:</strong> {parsed.metadata.rmLot || '-'}</div>}
              <div><strong>Test Date:</strong> {parsed.metadata.testDate || '-'}</div>
              <div><strong>Report Date:</strong> {parsed.metadata.reportDate || '-'}</div>
              <div style={{ gridColumn: isLab ? undefined : 'span 3' }}><strong>Formula Date:</strong> {parsed.metadata.formulaDate || '-'}</div>
            </div>

            {/* Ingredients Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>INGREDIENTS:</span>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <table className="desktop-data-grid" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ width: '40px', padding: '6px' }}>Sr</th>
                      {!isLab && <th style={{ width: '80px', padding: '6px' }}>MR No</th>}
                      <th style={{ padding: '6px' }}>Raw Material</th>
                      <th style={{ width: '95px', textAlign: 'right', padding: '6px' }}>Qty (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.inventory.map((row: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px' }}>{row.sr}</td>
                        {!isLab && <td style={{ padding: '6px' }}>{row.mr}</td>}
                        <td style={{ fontWeight: 'bold', padding: '6px' }}>{row.material}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '6px' }}>{row.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tests Table */}
            {parsed.tests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>TEST SPECIFICATIONS:</span>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <table className="desktop-data-grid" style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '6px' }}>Test Method / Parameter</th>
                        <th style={{ padding: '6px' }}>Standard Specification</th>
                        <th style={{ padding: '6px' }}>Observed Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.tests.map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px' }}>{row.method}</td>
                          <td style={{ padding: '6px' }}>{row.standard}</td>
                          <td style={{ fontWeight: 'bold', padding: '6px' }}>{row.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Remarks */}
            {parsed.remarks && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>REMARKS:</span>
                <textarea 
                  value={parsed.remarks} 
                  readOnly 
                  style={{
                    width: '100%',
                    height: '60px',
                    fontSize: '12px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    resize: 'none',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
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
              <div style={{ position: 'relative' }} ref={notificationsRef}>
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications) markAllAsSeen();
                  }} 
                  className={`header-icon-btn ${showNotifications ? 'active-bell' : ''}`}
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="notification-badge-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Panel */}
                {showNotifications && (
                  <div className="notification-panel" style={{ top: '30px', right: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: '#1e293b' }}>
                        Notifications
                      </h4>
                      <button 
                        onClick={fetchNotifications}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--primary-color)', 
                          fontSize: '0.75rem', 
                          cursor: 'pointer',
                          fontWeight: 600,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        Refresh
                      </button>
                    </div>
                    <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {notifications.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          color: 'var(--text-light)', 
                          fontSize: '0.85rem', 
                          padding: '24px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Bell size={24} style={{ opacity: 0.3, color: '#64748b' }} />
                          <span style={{ color: '#64748b' }}>No alerts at this time</span>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            className={`notification-card ${getTypeClass(notif.notification_type)} ${notif.seen ? 'seen' : 'unread'}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {renderNotificationIcon(notif.notification_type)}
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                                  {notif.title}
                                </span>
                              </div>
                              {!notif.seen && (
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  backgroundColor: 'var(--primary-color)',
                                  borderRadius: '50%'
                                }} />
                              )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#475569', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                              {notif.message}
                            </p>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', alignSelf: 'flex-end', marginTop: '2px' }}>
                              {new Date(notif.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dual-pane-layout" style={{ height: 'calc(100vh - 75px)', overflow: 'hidden' }}>
            
            {/* ================================================================
                LEFT PANEL SHEET
                ================================================================ */}
            <div className="pane-section" style={{ position: 'relative' }}>
              {renderDuplicateOverlay('left')}
              {isComplaintMode && bpbsData ? (
                /* READ-ONLY BPBS PANEL FOR LEFT SIDE */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', flexShrink: 0 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>ORIGINAL PRODUCTION BATCH SHEET (BPBS)</span>
                    <button onClick={handleExitComplaintMode} className="flet-btn flet-btn-orange" style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>
                      Exit Repair Mode
                    </button>
                  </div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                    {/* Header fields grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', backgroundColor: 'var(--primary-light)', padding: '8px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-color)' }}>
                      <div><strong>Batch No:</strong> {bpbsData.batch_no || bpbsData.batch_no_field || 'N/A'}</div>
                      <div><strong>Product:</strong> {bpbsData.product || bpbsData.product_name || 'N/A'}</div>
                      <div><strong>Ref. No:</strong> {bpbsData.ref_no || 'N/A'}</div>
                      <div><strong>Customer:</strong> {bpbsData.customer || 'N/A'}</div>
                      <div><strong>Date:</strong> {bpbsData.date || 'N/A'}</div>
                      <div><strong>Batch Size:</strong> {bpbsData.batch_size || 'N/A'}</div>
                      <div><strong>Started:</strong> {bpbsData.batch_started || bpbsData.batch_started_at || 'N/A'}</div>
                      <div><strong>Ended:</strong> {bpbsData.batch_completed || bpbsData.batch_completed_on || 'N/A'}</div>
                    </div>
                    
                    {/* Recipe Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)' }}>RAW MATERIALS RECIPE LIST</span>
                      {(() => {
                        const rawMaterials = bpbsData.raw_materials || [];
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
                          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)', height: '24px' }}>
                                  <th style={{ padding: '4px 6px', width: '40px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Sr.</th>
                                  <th style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color)' }}>Item Description</th>
                                  <th style={{ padding: '4px 6px', width: '70px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>Qty I</th>
                                  <th style={{ padding: '4px 6px', width: '70px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>Qty II</th>
                                  <th style={{ padding: '4px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>M.R. No.</th>
                                  <th style={{ padding: '4px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Input Time</th>
                                  <th style={{ padding: '4px 6px', width: '80px' }}>Charged By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayRecipe.map((r, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', height: '22px', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                    <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)', fontWeight: 500 }}>{r.sr_no}</td>
                                    <td style={{ padding: '3px 6px', borderRight: '1px solid var(--border-color)', fontWeight: r.item ? 600 : 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.item || '-'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>{r.qty1 || '-'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>{r.qty2 || '-'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.mrno || '-'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>{r.inputtime || '-'}</td>
                                    <td style={{ padding: '3px 6px', textTransform: 'uppercase', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.chargedby || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* QC & Specifications */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>QUALITY CONTROL & TESTING</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
                          <div><strong>Material:</strong> {bpbsData.qa_material || bpbsData.material || 'N/A'}</div>
                          <div><strong>Q.A. Status:</strong> {bpbsData.qa_status || 'N/A'}</div>
                          <div><strong>Filtered By:</strong> {bpbsData.filtered_by || 'N/A'}</div>
                          <div><strong>Weighted By:</strong> {bpbsData.weighted_by || 'N/A'}</div>
                          <div><strong>Sample Given:</strong> {bpbsData.sample_given || 'N/A'}</div>
                          <div><strong>Machine No.:</strong> {bpbsData.machine_no || 'N/A'}</div>
                          <div><strong>Checked By:</strong> {bpbsData.checked_by || 'N/A'}</div>
                          <div><strong>Final Status:</strong> {bpbsData.qa_final_status || bpbsData.status || 'N/A'}</div>
                          <div style={{ gridColumn: 'span 2' }}><strong>Filter No.:</strong> {bpbsData.filter_no || 'N/A'}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>TESTING & SPECIFICATIONS</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
                          <div style={{ gridColumn: 'span 2' }}><strong>Packing Material:</strong> {bpbsData.packing_material || 'N/A'}</div>
                          <div><strong>Density:</strong> {bpbsData.density || 'N/A'}</div>
                          <div><strong>Viscosity:</strong> {bpbsData.viscosity || 'N/A'} CPS</div>
                          <div style={{ gridColumn: 'span 2' }}><strong>Tested By:</strong> {bpbsData.tested_by || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Sticky Header for RM Testing / Lab Formulations Material Details */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '8px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>MATERIAL DETAILS (LEFT)</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleSaveFull('left')} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                        <button onClick={() => handleClearAllFields('left')} className="flet-btn flet-btn-orange" disabled={loading}>Clear</button>
                        <button onClick={() => handleAddRow('left')} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                        <button onClick={() => handleDeleteSelectedRows('left')} className="flet-btn flet-btn-red" disabled={loading}>Del Row</button>
                        <button onClick={() => exportToExcel('left')} className="flet-btn flet-btn-green">Excel</button>
                      </div>
                    </div>
                  ) : null}

                  {/* Form Metadata fields — matching Python field labels exactly */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', flexShrink: 0 }}>
                    <div className="form-input-container">
                      <span className="form-label">Ref No</span>
                      <input type="text" className="field-input" value={leftForm.refNo} onChange={e => setLeftForm({...leftForm, refNo: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Batch No</span>
                      <input type="text" className="field-input" value={leftForm.batchNo} onChange={e => setLeftForm({...leftForm, batchNo: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Product Name</span>
                      <input type="text" className="field-input" value={leftForm.product} onChange={e => setLeftForm({...leftForm, product: e.target.value})} />
                    </div>
                    {activeSubView === 'rm_testing' && (
                      <div className="form-input-container">
                        <span className="form-label">RM Lot No</span>
                        <input type="text" className="field-input" value={leftForm.rmLot} onChange={e => setLeftForm({...leftForm, rmLot: e.target.value})} />
                      </div>
                    )}
                    <div className="form-input-container">
                      <span className="form-label">Test Date</span>
                      <input type="text" className="field-input" value={leftForm.testDate} onChange={e => setLeftForm({...leftForm, testDate: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Report Date</span>
                      <input type="text" className="field-input" value={leftForm.reportDate} onChange={e => setLeftForm({...leftForm, reportDate: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Formula Date</span>
                      <input type="text" className="field-input" value={leftForm.formulaDate} onChange={e => setLeftForm({...leftForm, formulaDate: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: activeSubView === 'rm_testing' ? 'span 1' : 'span 2' }}></div>
                  </div>

                  {/* Filter controls row below form fields */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Database Filter:</span>
                      <select 
                        className="field-input" 
                        value={leftFilterType} 
                        onChange={e => setLeftFilterType(e.target.value)}
                        style={{ flexGrow: 1, height: '28px', maxWidth: '240px' }}
                      >
                        <option value="material_diff_qty">Same Material, Diff Qty</option>
                        <option value="resin_same_qty">Same Resin, Same Qty</option>
                        <option value="solvent_same_qty">Same Solvent, Same Qty</option>
                      </select>
                      <button 
                        onClick={() => handleFilterMatches('left', leftFilterType)} 
                        className="flet-btn flet-btn-blue" 
                        style={{ height: '28px', padding: '0 12px' }}
                        disabled={loading}
                      >
                        Filter
                      </button>
                    </div>
                  )}

                  {/* Formulations Grid Table — matching Python: Sr No | MR No | Raw Material | Qty */}
                  <div id="left-material-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={leftRows.length > 0 && leftRows.every(r => r.selected)}
                              onChange={e => {
                                setLeftRows(leftRows.map(r => ({ ...r, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th style={{ width: '40px', textAlign: 'center' }}>SR NO</th>
                          {activeSubView === 'rm_testing' && <th style={{ width: '80px' }}>MR NO</th>}
                          <th>RAW MATERIAL</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>QTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leftRows.map((row, idx) => (
                          <tr key={row.sr} style={{ backgroundColor: row.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-app)' : 'var(--bg-card)') }}>
                            <td style={{ textAlign: 'center', width: '30px' }}>
                              <input 
                                type="checkbox" 
                                checked={!!row.selected} 
                                onChange={e => {
                                  const updated = [...leftRows];
                                  updated[idx].selected = e.target.checked;
                                  setLeftRows(updated);
                                }} 
                              />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{row.sr}</td>
                            {activeSubView === 'rm_testing' && (
                              <td>
                                <input 
                                  id={`left-mr-${idx}`}
                                  type="text" 
                                  className="cell-input" 
                                  value={row.mr} 
                                  onChange={e => {
                                    const updated = [...leftRows];
                                    updated[idx].mr = e.target.value;
                                    setLeftRows(updated);
                                  }}
                                  onKeyDown={e => handleCellKeyDown(e, 'left', idx, 'mr')}
                                />
                              </td>
                            )}
                            <td>
                              <input 
                                id={`left-mat-${idx}`}
                                type="text" 
                                className="cell-input" 
                                list={['lab_formulations', 'rm_testing'].includes(activeSubView) ? undefined : "common-raw-materials"}
                                value={row.material} 
                                onChange={e => {
                                  const updated = [...leftRows];
                                  updated[idx].material = e.target.value;
                                  setLeftRows(updated);
                                }}
                                onKeyDown={e => handleCellKeyDown(e, 'left', idx, 'mat')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-qty-${idx}`}
                                type="text" 
                                className="cell-input" 
                                style={{ 
                                  textAlign: 'center',
                                  borderColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'var(--color-error)' : '#cbd5e1',
                                  backgroundColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'rgba(239, 68, 68, 0.05)' : '#ffffff'
                                }}
                                title={(row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'Quantity must be a positive number' : undefined}
                                value={row.qty} 
                                onChange={e => {
                                  const updated = [...leftRows];
                                  updated[idx].qty = e.target.value;
                                  setLeftRows(updated);
                                }}
                                onKeyDown={e => handleCellKeyDown(e, 'left', idx, 'qty')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pinned Total Weight Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', padding: '4px 10px', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, marginBottom: '6px' }}>
                    <span>TOTAL WEIGHT:</span>
                    <span style={{ color: 'var(--primary-color)' }}>{calculateTotalWeight(leftRows)} g</span>
                  </div>

                  {/* Material control buttons inline below table (Only for Lab Formulations) */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', flexShrink: 0 }}>
                      <button onClick={() => handleAddRow('left')} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                      <button onClick={() => handleDeleteSelectedRows('left')} className="flet-btn flet-btn-red" disabled={loading}>Delete Selected</button>
                      <button onClick={() => handleClearAllFields('left')} className="flet-btn flet-btn-orange" disabled={loading}>Clear All</button>
                      <button onClick={() => handleSaveFull('left')} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                      <button onClick={() => handleSaveMaster('left')} className="flet-btn flet-btn-green" disabled={loading}>Save Master</button>
                      <button onClick={() => exportToExcel('left')} className="flet-btn flet-btn-green">Export Excel</button>
                    </div>
                  )}

                  {/* Test Specifications Header / Sync Panel */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>TEST METHODS (LEFT)</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow('left')} className="flet-btn flet-btn-blue" disabled={loading}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests('left')} className="flet-btn flet-btn-red" disabled={loading}>Del Test</button>
                        <button onClick={() => handleRmApproval('left', 'OK')} className="flet-btn flet-btn-green" disabled={loading}>OK</button>
                        <button onClick={() => handleRmApproval('left', 'Not OK')} className="flet-btn flet-btn-red" disabled={loading}>NOT OK</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Test Specifications</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow('left')} className="flet-btn" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests('left')} className="flet-btn flet-btn-red" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Delete Selected</button>
                      </div>
                    </div>
                  )}

                  <div id="left-test-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={leftTestRows.length > 0 && leftTestRows.every(t => t.selected)}
                              onChange={e => {
                                setLeftTestRows(leftTestRows.map(t => ({ ...t, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th>TEST METHOD</th>
                          <th style={{ width: '130px' }}>STANDARD</th>
                          <th style={{ width: '120px' }}>RESULT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leftTestRows.map((t, idx) => (
                          <tr key={idx} style={{ backgroundColor: t.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)') }}>
                            <td style={{ textAlign: 'center', width: '30px' }}>
                              <input 
                                type="checkbox" 
                                checked={!!t.selected} 
                                onChange={e => {
                                  const updated = [...leftTestRows];
                                  updated[idx].selected = e.target.checked;
                                  setLeftTestRows(updated);
                                }} 
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-method-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.method} 
                                onChange={e => {
                                  const updated = [...leftTestRows];
                                  updated[idx].method = e.target.value;
                                  setLeftTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'left', idx, 'method')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-standard-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.standard} 
                                onChange={e => {
                                  const updated = [...leftTestRows];
                                  updated[idx].standard = e.target.value;
                                  setLeftTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'left', idx, 'standard')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`left-test-result-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.result} 
                                onChange={e => {
                                  const updated = [...leftTestRows];
                                  updated[idx].result = e.target.value;
                                  setLeftTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'left', idx, 'result')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', flexShrink: 0 }}>
                    <div className="form-input-container" style={{ width: '100%' }}>
                      <span className="form-label">Remarks</span>
                      <textarea 
                        className="field-input" 
                        value={leftRemarks} 
                        onChange={e => setLeftRemarks(e.target.value)} 
                        style={{ height: '48px', width: '100%', resize: 'vertical', padding: '4px 8px', fontSize: '12px' }} 
                      />
                    </div>

                    {/* Report status & Approved by for RM Testing */}
                    {activeSubView === 'rm_testing' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div className="form-input-container">
                          <span className="form-label">Report Status</span>
                          <select 
                            className="field-input" 
                            value={leftStatus} 
                            onChange={e => setLeftStatus(e.target.value)}
                            style={{ padding: '0 4px', height: '28px' }}
                          >
                            <option value="Select">Select</option>
                            <option value="OK">OK</option>
                            <option value="Not OK">Not OK</option>
                          </select>
                        </div>
                        <div className="form-input-container">
                          <span className="form-label">Approved By</span>
                          <input 
                            type="text" 
                            className="field-input" 
                            value={leftApprovedBy} 
                            onChange={e => setLeftApprovedBy(e.target.value)} 
                            style={{ height: '28px' }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ================================================================
                RIGHT PANEL SHEET
                ================================================================ */}
            <div className="pane-section" style={{ position: 'relative' }}>
              {renderDuplicateOverlay('right')}
              <>
                  {/* Sticky Header for RM Testing / Lab Formulations Material Details */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '8px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>MATERIAL DETAILS (RIGHT)</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleSaveFull('right')} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                        <button onClick={() => handleClearAllFields('right')} className="flet-btn flet-btn-orange" disabled={loading}>Clear</button>
                        <button onClick={() => handleAddRow('right')} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                        <button onClick={() => handleDeleteSelectedRows('right')} className="flet-btn flet-btn-red" disabled={loading}>Del Row</button>
                        <button onClick={() => exportToExcel('right')} className="flet-btn flet-btn-green">Excel</button>
                      </div>
                    </div>
                  ) : null}

                  {/* Form Metadata fields — matching Python field labels exactly */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', flexShrink: 0 }}>
                    <div className="form-input-container">
                      <span className="form-label">Ref No</span>
                      <input type="text" className="field-input" value={rightForm.refNo} onChange={e => setRightForm({...rightForm, refNo: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Batch No</span>
                      <input type="text" className="field-input" value={rightForm.batchNo} onChange={e => setRightForm({...rightForm, batchNo: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Product Name</span>
                      <input type="text" className="field-input" value={rightForm.product} onChange={e => setRightForm({...rightForm, product: e.target.value})} />
                    </div>
                    {activeSubView === 'rm_testing' && (
                      <div className="form-input-container">
                        <span className="form-label">RM Lot No</span>
                        <input type="text" className="field-input" value={rightForm.rmLot} onChange={e => setRightForm({...rightForm, rmLot: e.target.value})} />
                      </div>
                    )}
                    <div className="form-input-container">
                      <span className="form-label">Test Date</span>
                      <input type="text" className="field-input" value={rightForm.testDate} onChange={e => setRightForm({...rightForm, testDate: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Report Date</span>
                      <input type="text" className="field-input" value={rightForm.reportDate} onChange={e => setRightForm({...rightForm, reportDate: e.target.value})} />
                    </div>
                    <div className="form-input-container">
                      <span className="form-label">Formula Date</span>
                      <input type="text" className="field-input" value={rightForm.formulaDate} onChange={e => setRightForm({...rightForm, formulaDate: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: activeSubView === 'rm_testing' ? 'span 1' : 'span 2' }}></div>
                  </div>

                  {/* Filter controls row below form fields */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Database Filter:</span>
                      <select 
                        className="field-input" 
                        value={rightFilterType} 
                        onChange={e => setRightFilterType(e.target.value)}
                        style={{ flexGrow: 1, height: '28px', maxWidth: '240px' }}
                      >
                        <option value="material_diff_qty">Same Material, Diff Qty</option>
                        <option value="resin_same_qty">Same Resin, Same Qty</option>
                        <option value="solvent_same_qty">Same Solvent, Same Qty</option>
                      </select>
                      <button 
                        onClick={() => handleFilterMatches('right', rightFilterType)} 
                        className="flet-btn flet-btn-blue" 
                        style={{ height: '28px', padding: '0 12px' }}
                        disabled={loading}
                      >
                        Filter
                      </button>
                    </div>
                  )}

                  {/* Formulations Grid Table — matching Python: Sr No | MR No | Raw Material | Qty */}
                  <div id="right-material-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={rightRows.length > 0 && rightRows.every(r => r.selected)}
                              onChange={e => {
                                setRightRows(rightRows.map(r => ({ ...r, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th style={{ width: '40px', textAlign: 'center' }}>SR NO</th>
                          {activeSubView === 'rm_testing' && <th style={{ width: '80px' }}>MR NO</th>}
                          <th>RAW MATERIAL</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>QTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rightRows.map((row, idx) => (
                          <tr key={row.sr} style={{ backgroundColor: row.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-app)' : 'var(--bg-card)') }}>
                            <td style={{ textAlign: 'center', width: '30px' }}>
                              <input 
                                type="checkbox" 
                                checked={!!row.selected} 
                                onChange={e => {
                                  const updated = [...rightRows];
                                  updated[idx].selected = e.target.checked;
                                  setRightRows(updated);
                                }} 
                              />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{row.sr}</td>
                            {activeSubView === 'rm_testing' && (
                              <td>
                                <input 
                                  id={`right-mr-${idx}`}
                                  type="text" 
                                  className="cell-input" 
                                  value={row.mr} 
                                  onChange={e => {
                                    const updated = [...rightRows];
                                    updated[idx].mr = e.target.value;
                                    setRightRows(updated);
                                  }}
                                  onKeyDown={e => handleCellKeyDown(e, 'right', idx, 'mr')}
                                />
                              </td>
                            )}
                            <td>
                              <input 
                                id={`right-mat-${idx}`}
                                type="text" 
                                className="cell-input" 
                                list={['lab_formulations', 'rm_testing'].includes(activeSubView) ? undefined : "common-raw-materials"}
                                value={row.material} 
                                onChange={e => {
                                  const updated = [...rightRows];
                                  updated[idx].material = e.target.value;
                                  setRightRows(updated);
                                }}
                                onKeyDown={e => handleCellKeyDown(e, 'right', idx, 'mat')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`right-qty-${idx}`}
                                type="text" 
                                className="cell-input" 
                                style={{ 
                                  textAlign: 'center',
                                  borderColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'var(--color-error)' : '#cbd5e1',
                                  backgroundColor: (row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'rgba(239, 68, 68, 0.05)' : '#ffffff'
                                }}
                                title={(row.qty !== '' && (isNaN(parseFloat(row.qty)) || parseFloat(row.qty) <= 0)) ? 'Quantity must be a positive number' : undefined}
                                value={row.qty} 
                                onChange={e => {
                                  const updated = [...rightRows];
                                  updated[idx].qty = e.target.value;
                                  setRightRows(updated);
                                }}
                                onKeyDown={e => handleCellKeyDown(e, 'right', idx, 'qty')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pinned Total Weight Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', padding: '4px 10px', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, marginBottom: '6px' }}>
                    <span>TOTAL WEIGHT:</span>
                    <span style={{ color: 'var(--primary-color)' }}>{calculateTotalWeight(rightRows)} g</span>
                  </div>

                  {/* Material control buttons inline below table (Only for Lab Formulations) */}
                  {activeSubView === 'lab_formulations' && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', flexShrink: 0 }}>
                      <button onClick={() => handleAddRow('right')} className="flet-btn flet-btn-blue" disabled={loading}>Add Row</button>
                      <button onClick={() => handleDeleteSelectedRows('right')} className="flet-btn flet-btn-red" disabled={loading}>Delete Selected</button>
                      <button onClick={() => handleClearAllFields('right')} className="flet-btn flet-btn-orange" disabled={loading}>Clear All</button>
                       {isComplaintMode ? (
                        <button onClick={handleSaveAsNewTrial} className="flet-btn flet-btn-blue" disabled={loading}>Save as New Trial</button>
                      ) : (
                        <button onClick={() => handleSaveFull('right')} className="flet-btn flet-btn-blue" disabled={loading}>Save</button>
                      )}
                      <button onClick={() => handleSaveMaster('right')} className="flet-btn flet-btn-green" disabled={loading}>
                        {isComplaintMode ? 'Approve to Master' : 'Save Master'}
                      </button>
                      <button onClick={() => exportToExcel('right')} className="flet-btn flet-btn-green">Export Excel</button>
                    </div>
                  )}

                  {/* Test Specifications Header / Sync Panel */}
                  {activeSubView === 'rm_testing' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>TEST METHODS (RIGHT)</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow('right')} className="flet-btn flet-btn-blue" disabled={loading}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests('right')} className="flet-btn flet-btn-red" disabled={loading}>Del Test</button>
                        <button onClick={() => handleRmApproval('right', 'OK')} className="flet-btn flet-btn-green" disabled={loading}>OK</button>
                        <button onClick={() => handleRmApproval('right', 'Not OK')} className="flet-btn flet-btn-red" disabled={loading}>NOT OK</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', marginTop: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Test Specifications</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAddTestRow('right')} className="flet-btn" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Add Test</button>
                        <button onClick={() => handleDeleteSelectedTests('right')} className="flet-btn flet-btn-red" disabled={loading} style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}>Delete Selected</button>
                      </div>
                    </div>
                  )}

                  <div id="right-test-container" className="table-scroll-container" style={{ height: '308px', overflowY: 'auto', marginBottom: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <table className="table-locked-header">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={rightTestRows.length > 0 && rightTestRows.every(t => t.selected)}
                              onChange={e => {
                                setRightTestRows(rightTestRows.map(t => ({ ...t, selected: e.target.checked })));
                              }} 
                            />
                          </th>
                          <th>TEST METHOD</th>
                          <th style={{ width: '130px' }}>STANDARD</th>
                          <th style={{ width: '120px' }}>RESULT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rightTestRows.map((t, idx) => (
                          <tr key={idx} style={{ backgroundColor: t.selected ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)') }}>
                            <td style={{ textAlign: 'center', width: '30px' }}>
                              <input 
                                type="checkbox" 
                                checked={!!t.selected} 
                                onChange={e => {
                                  const updated = [...rightTestRows];
                                  updated[idx].selected = e.target.checked;
                                  setRightTestRows(updated);
                                }} 
                              />
                            </td>
                            <td>
                              <input 
                                id={`right-test-method-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.method} 
                                onChange={e => {
                                  const updated = [...rightTestRows];
                                  updated[idx].method = e.target.value;
                                  setRightTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'right', idx, 'method')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`right-test-standard-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.standard} 
                                onChange={e => {
                                  const updated = [...rightTestRows];
                                  updated[idx].standard = e.target.value;
                                  setRightTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'right', idx, 'standard')}
                              />
                            </td>
                            <td>
                              <input 
                                id={`right-test-result-${idx}`}
                                type="text" 
                                className="cell-input" 
                                value={t.result} 
                                onChange={e => {
                                  const updated = [...rightTestRows];
                                  updated[idx].result = e.target.value;
                                  setRightTestRows(updated);
                                }}
                                onKeyDown={e => handleTestCellKeyDown(e, 'right', idx, 'result')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', flexShrink: 0 }}>
                    <div className="form-input-container" style={{ width: '100%' }}>
                      <span className="form-label">Remarks</span>
                      <textarea 
                        className="field-input" 
                        value={rightRemarks} 
                        onChange={e => setRightRemarks(e.target.value)} 
                        style={{ height: '48px', width: '100%', resize: 'vertical', padding: '4px 8px', fontSize: '12px' }} 
                      />
                    </div>

                    {isComplaintMode && imageReferences.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Complaint Image References</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {imageReferences.map((filename: string, idx: number) => {
                            const fileUrl = `${API_BASE_URL}/complaint-lab/image/${productName}/${filename}`;
                            return (
                              <div key={idx} onClick={() => setLightboxImage(fileUrl)}
                                style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative' }}>
                                <img src={fileUrl} alt="defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '1px', borderRadius: '2px', color: '#fff', display: 'flex', alignItems: 'center' }}>
                                  <ZoomIn size={8} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Report status & Approved by for RM Testing */}
                    {activeSubView === 'rm_testing' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div className="form-input-container">
                          <span className="form-label">Report Status</span>
                          <select 
                            className="field-input" 
                            value={rightStatus} 
                            onChange={e => setRightStatus(e.target.value)}
                            style={{ padding: '0 4px', height: '28px' }}
                          >
                            <option value="Select">Select</option>
                            <option value="OK">OK</option>
                            <option value="Not OK">Not OK</option>
                          </select>
                        </div>
                        <div className="form-input-container">
                          <span className="form-label">Approved By</span>
                          <input 
                            type="text" 
                            className="field-input" 
                            value={rightApprovedBy} 
                            onChange={e => setRightApprovedBy(e.target.value)} 
                            style={{ height: '28px' }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              </div>

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
                  const totalWeight = (b.inventory || []).reduce((sum: number, item: any) => {
                    const qtyStr = item.qty || (Array.isArray(item) ? item[2] : '0');
                    const q = parseFloat(qtyStr);
                    return isNaN(q) ? sum : sum + q;
                  }, 0).toFixed(2);

                  const refNo = b.ref_no || '-';
                  const batchNo = b.batch_no || '-';
                  const productNameValue = b.product_name || (Array.isArray(b.form_data) ? b.form_data[2] : b.product || '-');
                  const rmLotNoValue = b.rm_name_lot_no || (Array.isArray(b.form_data) ? b.form_data[3] : b.rm_lot || '-');
                  const testDate = b.test_date || (Array.isArray(b.form_data) ? b.form_data[4] : '-');
                  const reportDate = b.report_date || (Array.isArray(b.form_data) ? b.form_data[5] : '-');
                  const formulaDate = b.formula_date || (Array.isArray(b.form_data) ? b.form_data[6] : '-');
                  const approvalStatus = b.approval_status || '-';
                  const approvalComments = b.approval_comments || '-';

                  return (
                    <div key={b.id || b.batch_no} className="flet-report-card">
                      {/* Card Header Title */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '8px' }}>
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
                          <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--primary-color)' }}>
                            Batch: {batchNo}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#e2e8f0', borderRadius: '2px', fontWeight: 'bold' }}>
                          Ref: {refNo}
                        </span>
                      </div>

                      {/* 1. Batch Details Section */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Batch Details
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: '1px solid #cbd5e1' }}>
                          <tbody>
                            <tr>
                              <td style={{ fontWeight: 'bold', width: '35%' }}>Product</td><td>{productNameValue}</td>
                            </tr>
                            {!isLabCard && (
                              <tr>
                                <td style={{ fontWeight: 'bold' }}>RM Lot No</td><td>{rmLotNoValue}</td>
                              </tr>
                            )}
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Test Date</td><td>{testDate}</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Report Date</td><td>{reportDate}</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: 'bold' }}>Formula Date</td><td>{formulaDate}</td>
                            </tr>
                            {!isLabCard && (
                              <>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>Status</td>
                                  <td style={{ fontWeight: 'bold', color: approvalStatus === 'OK' ? 'var(--color-success)' : 'var(--color-error)' }}>{approvalStatus}</td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: 'bold' }}>Approved By</td><td>{approvalComments}</td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 2. Raw Materials Table */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Raw Materials
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: '1px solid #cbd5e1' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Sr</th>
                              {!isLabCard && <th>MR No</th>}
                              <th>Material</th>
                              <th style={{ width: '70px', textAlign: 'right' }}>Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(b.inventory || []).map((item: any, idx: number) => {
                              const sr = item.sr_no || (Array.isArray(item) ? item[0] : (idx + 1).toString());
                              const mr = item.mr_no || (Array.isArray(item) ? item[3] : '');
                              const mat = item.raw_material || item.material || (Array.isArray(item) ? item[1] : '-');
                              const qty = item.qty !== undefined ? item.qty : (Array.isArray(item) ? item[2] : '0');
                              return (
                                <tr key={idx}>
                                  <td>{sr}</td>
                                  {!isLabCard && <td>{mr || '-'}</td>}
                                  <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{mat}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{qty}</td>
                                </tr>
                              );
                            })}
                            <tr className="total-row">
                              <td colSpan={isLabCard ? 2 : 3} style={{ textAlign: 'right' }}>Total Qty</td>
                              <td style={{ textAlign: 'right', color: 'var(--primary-color)' }}>{totalWeight}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 3. Test Results Table */}
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Test Results
                        </span>
                        <table className="desktop-data-grid" style={{ marginBottom: '8px', border: '1px solid #cbd5e1' }}>
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
                              return (
                                <tr key={idx}>
                                  <td>{method}</td>
                                  <td>{standard}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{result}</td>
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
                        <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', fontSize: '11px', fontStyle: 'italic', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                          Remarks: {b.remarks}
                        </div>
                      )}

                      {/* Actions Footer */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #cbd5e1' }}>
                        <button 
                          onClick={() => {
                            onChangeView(isLabCard ? 'lab_formulations' : 'rm_testing');
                            setTimeout(() => loadBatchIntoPane(batchNo, 'left', isLabCard), 150);
                          }}
                          className="flet-btn"
                          style={{ flexGrow: 1 }}
                        >
                          <ArrowLeft size={12} /> Load Left
                        </button>
                        <button 
                          onClick={() => {
                            onChangeView(isLabCard ? 'lab_formulations' : 'rm_testing');
                            setTimeout(() => loadBatchIntoPane(batchNo, 'right', isLabCard), 150);
                          }}
                          className="flet-btn"
                          style={{ flexGrow: 1 }}
                        >
                          Load Right <ArrowRight size={12} />
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

      {lightboxImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, cursor: 'zoom-out'
        }} onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Enlarged view" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
        </div>
      )}



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
