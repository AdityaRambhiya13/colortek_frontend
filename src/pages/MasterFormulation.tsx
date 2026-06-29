import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, Calendar, RefreshCw, 
  Download, Edit3, CheckCircle, Scale, Eye, ChevronLeft, ChevronRight, Play, Info
} from 'lucide-react';
import { MasterFormulationAPI } from '../services/api';
import * as XLSX from 'xlsx';

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

  // Edit Field binds for all 11 parameters in mf.py
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
    const [success, data] = await MasterFormulationAPI.getBatchList(productName, fromDate, toDate, searchTerm);
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
  }, [fromDate, toDate, searchTerm]);

  // Load detailed specifications
  const loadBatchDetails = async (batchNo: string) => {
    setLoading(true);
    const [success, data] = await MasterFormulationAPI.getBatchDetail(productName, batchNo);
    setLoading(false);

    if (success && typeof data !== 'string') {
      setSelectedBatch(batchNo);
      setDetailData(data);
      setIsEditing(false);
      setAutosaveStatus('');

      const form = data.form || {};

      // Load all 11 parameter fields
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
    } else {
      onShowToast('Could not load formulation details.', 'error');
    }
  };

  // Unified debounced autosave matching 1500ms debounce in mf.py
  const triggerAutosave = (
    currentInv = localInventory,
    currentParams = { density, viscosity, refBookNo, packaging, date, time, ratio, filtration, remarks, sender, approval, grams }
  ) => {
    setAutosaveStatus('Saving recipe changes...');
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    
    autosaveTimer.current = window.setTimeout(async () => {
      if (!selectedBatch || !detailData) return;
      
      const updatedForm = {
        ...(detailData.form || {}),
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
        'QUANTITY (Grams)': currentParams.grams
      };

      const updatedPayload = {
        form: updatedForm,
        inventory: currentInv.map(item => ({
          material: item.material || item.raw_material || '',
          qty: item.qty || 0,
          percent: item.percent || '',
          final_qty: item.final_qty || '',
          rounded_qty: item.rounded_qty || '',
          remarks: item.remarks || ''
        })),
        tests: detailData.tests || [],
        grams: parseFloat(currentParams.grams) || 100.0,
        date: currentParams.date,
        time: currentParams.time,
        ref_book_no: currentParams.refBookNo,
        packaging: currentParams.packaging,
        viscosity: currentParams.viscosity,
        density: currentParams.density,
        ratio: currentParams.ratio,
        filtration: currentParams.filtration
      };
      
      const [success] = await MasterFormulationAPI.updateBatch(productName, selectedBatch, updatedPayload);
      if (success) {
        setAutosaveStatus('✓ Recipe changes saved automatically');
        setTimeout(() => setAutosaveStatus(''), 3000);
      } else {
        setAutosaveStatus('✗ Failed to autosave changes');
      }
    }, 1500);
  };

  // State changes for params trigger autosave
  const handleParamChange = (field: string, val: string) => {
    const params = { density, viscosity, refBookNo, packaging, date, time, ratio, filtration, remarks, sender, approval, grams };
    params[field as keyof typeof params] = val;
    
    if (field === 'density') setDensity(val);
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
    setLocalInventory(updated);
    triggerAutosave(updated);
  };

  // Immediate save on click
  const handleUpdateFormulation = async () => {
    if (!selectedBatch || !detailData) return;
    
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    
    const updatedForm = {
      ...(detailData.form || {}),
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
      'QUANTITY (Grams)': grams
    };

    const updatedPayload = {
      form: updatedForm,
      inventory: localInventory.map(item => ({
        material: item.material || item.raw_material || '',
        qty: item.qty || 0,
        percent: item.percent || '',
        final_qty: item.final_qty || '',
        rounded_qty: item.rounded_qty || '',
        remarks: item.remarks || ''
      })),
      tests: detailData.tests || [],
      grams: parseFloat(grams) || 100.0,
      date,
      time,
      ref_book_no: refBookNo,
      packaging,
      viscosity,
      density,
      ratio,
      filtration
    };

    setLoading(true);
    const [success] = await MasterFormulationAPI.updateBatch(productName, selectedBatch, updatedPayload);
    setLoading(false);

    if (success) {
      onShowToast(`Master formulation ${selectedBatch} successfully updated.`, 'success');
      setIsEditing(false);
      loadBatchDetails(selectedBatch);
    } else {
      onShowToast('Failed to update formulation parameters.', 'error');
    }
  };

  // Fully formatted A4 Excel download matching python implementation
  const exportMasterToExcel = (batchNo: string) => {
    if (!detailData) return;

    const get_val = (key: string, defaultVal = '') => {
      return getRecordValue(key, defaultVal);
    };

    const format_date = (val: string) => {
      if (!val) return '';
      const clean = val.split(' ')[0];
      try {
        const parts = clean.split('-');
        if (parts.length === 3) {
          // Assuming yyyy-mm-dd
          if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
          return clean;
        }
        return clean;
      } catch {
        return clean;
      }
    };

    // Calculate totals
    const sumQty = localInventory.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    
    // Build AOA rows matching python structure
    const excelRows: any[][] = [];

    // Title Row
    excelRows.push(['Master Formulation Book - Production', '', '', '', '', '', '']); // Row 0
    // Doc Row
    excelRows.push(['DOC #', '', get_val('doc_no', 'doc_no'), 'REVIEW 03', '', 'ISSUE 01', '']); // Row 1
    // Issue Date Row
    excelRows.push(['REVIEW DATE:', '', format_date(get_val('review_date', '01.04.2025')), 'ISSUE DATE:', '', format_date(get_val('issue_date', '01.04.2025')), '']); // Row 2
    // Formula Date Row
    excelRows.push(['FORMULA DATE:', '', format_date(get_val('formula_date')), '', '', '', '']); // Row 3
    // Customer Name Row
    excelRows.push(['CUSTOMER NAME:', '', get_val('customer_name'), '', '', '', '']); // Row 4
    // Product Name Row
    excelRows.push(['PRODUCT NAME:', '', get_val('product_name', productName), '', '', '', '']); // Row 5
    // Batch No Row
    excelRows.push(['BATCH NO:', '', batchNo, '', '', '', '']); // Row 6
    // Ref No Row
    excelRows.push(['REF NO:', '', get_val('ref_no'), '', '', '', '']); // Row 7
    // Ref Book No Row
    excelRows.push(['REF BOOK NO :', '', refBookNo, '', '', '', '']); // Row 8
    // Quantity Grams Row
    excelRows.push(['QUANTITY (Grams):', '', Number(grams) || 100, '', '', '', '']); // Row 9

    // Empty row
    excelRows.push([]); // Row 10 (Spacer)

    // Table Headers
    excelRows.push(['Sr. No.', 'STEPS', 'RAW MATERIAL', 'QUANTITY', '%', 'FINAL QUANTITY', 'ROUND QUANTITY']); // Row 11

    let totalQty = 0;
    let totalFinal = 0;
    let totalRounded = 0;

    // Build 24 rows
    for (let i = 0; i < 24; i++) {
      if (i < localInventory.length) {
        const item = localInventory[i];
        const qty = parseFloat(item.qty) || 0;
        const percent = sumQty > 0 ? (qty / sumQty) * 100 : 0;
        const finalQty = sumQty > 0 ? (qty / sumQty) * parseFloat(grams || '100') : 0;
        const defaultR = Math.round(finalQty);
        const roundedQty = parseFloat(item.rounded_qty) || defaultR;

        totalQty += qty;
        totalFinal += finalQty;
        totalRounded += roundedQty;

        excelRows.push([
          i + 1,
          item.remarks || '', // Steps / Remarks
          item.material || item.raw_material || '',
          qty ? qty : '',
          percent ? `${percent.toFixed(2)}%` : '',
          finalQty ? Number(finalQty.toFixed(2)) : '',
          roundedQty ? roundedQty : ''
        ]);
      } else {
        excelRows.push([i + 1, '', '', '', '', '', '']);
      }
    }

    // Total Row
    excelRows.push([
      'TOTAL',
      '',
      '',
      totalQty ? Number(totalQty.toFixed(2)) : '',
      '100.00%',
      totalFinal ? Number(totalFinal.toFixed(2)) : '',
      totalRounded ? Number(totalRounded.toFixed(2)) : ''
    ]);

    // Footer Rows
    excelRows.push(['PACKING :-', '', packaging, '', 'VISCOSITY :-', viscosity, '']);
    excelRows.push(['FILTERATION :-', '', filtration, '', 'DENSITY :-', density, '']);
    excelRows.push(['REMARK :-', '', remarks, '', 'RATIO', ratio, '']);
    excelRows.push(['SENDER :-', '', sender, '', '', '', '']);
    excelRows.push(['APPROVAL :-', '', approval, '', '', '', '']);

    // Date/Time Row
    excelRows.push(['', '', '', 'DATE', format_date(date), 'TIME', time]);

    // Signatures
    excelRows.push(['INCHARGE SIGNATURE', '', 'APPROVER SIGNATURE', '', '', 'PRODUCTION SIGNATURE', '']);
    excelRows.push(['', '', '', '', '', '', '']); // Signature box 1
    excelRows.push(['', '', '', '', '', '', '']); // Signature box 2
    excelRows.push(['', '', '', '', '', '', '']); // Signature box 3

    // Create worksheet and workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelRows);

    // Apply merges matching Flet merges exactly
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title Row
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }, { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, { s: { r: 3, c: 2 }, e: { r: 3, c: 6 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, { s: { r: 4, c: 2 }, e: { r: 4, c: 6 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } }, { s: { r: 5, c: 2 }, e: { r: 5, c: 6 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } }, { s: { r: 6, c: 2 }, e: { r: 6, c: 6 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } }, { s: { r: 7, c: 2 }, e: { r: 7, c: 6 } },
      { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } }, { s: { r: 8, c: 2 }, e: { r: 8, c: 6 } },
      { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } }, { s: { r: 9, c: 2 }, e: { r: 9, c: 6 } },
      { s: { r: 36, c: 0 }, e: { r: 36, c: 2 } }, // TOTALS label merge
      { s: { r: 37, c: 0 }, e: { r: 37, c: 1 } }, { s: { r: 37, c: 2 }, e: { r: 37, c: 3 } }, { s: { r: 37, c: 5 }, e: { r: 37, c: 6 } }, // PACKING / VISCOSITY
      { s: { r: 38, c: 0 }, e: { r: 38, c: 1 } }, { s: { r: 38, c: 2 }, e: { r: 38, c: 3 } }, { s: { r: 38, c: 5 }, e: { r: 38, c: 6 } }, // FILTERATION / DENSITY
      { s: { r: 39, c: 0 }, e: { r: 39, c: 1 } }, { s: { r: 39, c: 2 }, e: { r: 39, c: 3 } }, { s: { r: 39, c: 5 }, e: { r: 39, c: 6 } }, // REMARK / RATIO
      { s: { r: 40, c: 0 }, e: { r: 40, c: 1 } }, { s: { r: 40, c: 2 }, e: { r: 40, c: 6 } }, // SENDER
      { s: { r: 41, c: 0 }, e: { r: 41, c: 1 } }, { s: { r: 41, c: 2 }, e: { r: 41, c: 6 } }, // APPROVAL
      { s: { r: 43, c: 0 }, e: { r: 43, c: 1 } }, { s: { r: 43, c: 2 }, e: { r: 43, c: 4 } }, { s: { r: 43, c: 5 }, e: { r: 43, c: 6 } }, // Signature headers
      { s: { r: 44, c: 0 }, e: { r: 46, c: 1 } }, // Incharge Sig Box
      { s: { r: 44, c: 2 }, e: { r: 46, c: 4 } }, // Approver Sig Box
      { s: { r: 44, c: 5 }, e: { r: 46, c: 6 } }  // Production Sig Box
    ];

    ws['!merges'] = merges;

    // Set column widths
    const wscols = [
      { wch: 8 },  // A: Sr
      { wch: 15 }, // B: STEPS
      { wch: 35 }, // C: Raw Material
      { wch: 14 }, // D: Quantity
      { wch: 10 }, // E: %
      { wch: 16 }, // F: Final Quantity
      { wch: 16 }  // G: Round Quantity
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'Master Formulation');
    XLSX.writeFile(wb, `${batchNo}_MASTER.xlsx`);
    onShowToast(`Batch ${batchNo} master Excel recipe downloaded.`, 'success');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={28} color="var(--primary-color)" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>
                {viewMode === 'mf_production' ? 'Production Formulations' : 'Master Formulations'}
              </h3>
            </div>
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
                placeholder="Search batch..."
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
            {displayedBatches.map((row) => (
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
              >
                <span className="batch-label">BATCH NO</span>
                <span className="batch-value">{row.batch_no}</span>
                <span className="batch-view-chip">
                  {viewMode === 'mf_production' ? 'Load Sheet' : 'View Details'}
                </span>
              </div>
            ))}
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
                <Scale size={20} color="#3b82f6" /> Master Formulation Specification: {selectedBatch}
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
              
              {/* Row: Formulation Details (Left Card) & Recalculator Inputs (Right Card) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', flexShrink: 0 }}>
                
                {/* Formulation Details Summary Card */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <Info size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formulation Details</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Ref No</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{detailData.ref_no || detailData.form?.ref_no || '-'}</strong>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label" style={{ color: '#1d4ed8' }}>Batch No</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{selectedBatch}</strong>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '10px', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label" style={{ color: '#059669' }}>Product Name</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{getRecordValue('product_name', productName)}</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="premium-field-label">Formula Date</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{date || detailData.form?.formula_date || '-'}</strong>
                    </div>
                  </div>
                </div>
 
                {/* Live Recalculator Targets Card */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'linear-gradient(to right bottom, #ffffff, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <RefreshCw size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standard Recalculator</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '6px' }}>
                    <div className="premium-field-container" style={{ flexGrow: 1 }}>
                      <span className="premium-field-label">Target Quantity (Grams)</span>
                      <input 
                        type="number" 
                        className="premium-field-input" 
                        value={grams} 
                        onChange={e => handleParamChange('grams', e.target.value)} 
                        style={{ fontWeight: 'bold', fontSize: '15px' }}
                      />
                    </div>
                    
                    <button 
                      onClick={() => triggerAutosave(localInventory)} 
                      className="refresh-btn" 
                      style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} 
                      title="Recalculate & Save"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>
 
              </div>
 
              {/* Parameter Editor Forms (Additional Details section matching Flet cards) */}
              <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <Edit3 size={16} color="#3b82f6" />
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Parameters</span>
                </div>
 
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Ref Book No</span>
                    <input type="text" className="premium-field-input" value={refBookNo} onChange={e => handleParamChange('refBookNo', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Date</span>
                    <input type="text" className="premium-field-input" value={date} onChange={e => handleParamChange('date', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Time</span>
                    <input type="text" className="premium-field-input" value={time} onChange={e => handleParamChange('time', e.target.value)} disabled={!isEditing} />
                  </div>
                </div>
 
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Packaging</span>
                    <input type="text" className="premium-field-input" value={packaging} onChange={e => handleParamChange('packaging', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Viscosity</span>
                    <input type="text" className="premium-field-input" value={viscosity} onChange={e => handleParamChange('viscosity', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Density</span>
                    <input type="text" className="premium-field-input" value={density} onChange={e => handleParamChange('density', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Ratio</span>
                    <input type="text" className="premium-field-input" value={ratio} onChange={e => handleParamChange('ratio', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Filtration</span>
                    <input type="text" className="premium-field-input" value={filtration} onChange={e => handleParamChange('filtration', e.target.value)} disabled={!isEditing} />
                  </div>
                </div>
 
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                  <div className="premium-field-container">
                    <span className="premium-field-label">Remarks</span>
                    <textarea 
                      className="premium-field-input" 
                      value={remarks} 
                      onChange={e => handleParamChange('remarks', e.target.value)} 
                      disabled={!isEditing} 
                      style={{ height: '80px', resize: 'none', fontFamily: 'inherit' }} 
                    />
                  </div>
                  
                  {/* Sender & Approval fields stacked vertically */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Sender</span>
                      <input type="text" className="premium-field-input" value={sender} onChange={e => handleParamChange('sender', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="premium-field-container">
                      <span className="premium-field-label">Approval</span>
                      <input type="text" className="premium-field-input" value={approval} onChange={e => handleParamChange('approval', e.target.value)} disabled={!isEditing} />
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
                {(() => {
                  const totalQty = localInventory.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
                  const totalRounded = localInventory.reduce((sum, item) => {
                    const itemQty = parseFloat(item.qty) || 0;
                    const itemFinalQty = totalQty > 0 ? (itemQty / totalQty) * parseFloat(grams || '100') : 0;
                    const defaultR = Math.round(itemFinalQty);
                    return sum + (parseFloat(item.rounded_qty) || defaultR);
                  }, 0);
 
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="table-scroll-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                        <table className="table-locked-header" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ width: '45px', textAlign: 'center', padding: '10px' }}>Sr</th>
                              <th style={{ width: '220px', padding: '10px' }}>Steps / Remarks</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Raw Material</th>
                              <th style={{ width: '110px', textAlign: 'right', padding: '10px' }}>Original Qty</th>
                              <th style={{ width: '100px', textAlign: 'right', padding: '10px' }}>% Form</th>
                              <th style={{ width: '110px', textAlign: 'right', padding: '10px' }}>Final Qty</th>
                              <th style={{ width: '110px', textAlign: 'center', padding: '10px' }}>Rounded Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localInventory.map((item, idx) => {
                              const qty = parseFloat(item.qty) || 0;
                              const percent = totalQty > 0 ? ((qty / totalQty) * 100).toFixed(2) : '0.00';
                              const finalQty = totalQty > 0 ? ((qty / totalQty) * parseFloat(grams || '100')).toFixed(2) : '0.00';
                              const defaultRounded = Math.round(parseFloat(finalQty));
                              const roundedQty = item.rounded_qty || String(defaultRounded);
 
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, padding: '6px 10px' }}>{idx + 1}</td>
                                  <td style={{ padding: '4px' }}>
                                    <input 
                                      type="text" 
                                      className="table-cell-input" 
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', height: '30px' }}
                                      value={item.remarks || ''} 
                                      placeholder="Add step/remark"
                                      onChange={e => handleInventoryChange(idx, 'remarks', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#1e293b', padding: '6px 10px' }}>{item.material || item.raw_material || '-'}</td>
                                  <td style={{ textAlign: 'right', color: '#475569', padding: '6px 10px' }}>{qty.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 10px' }}>{percent}%</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#f8fafc', padding: '6px 10px' }}>{finalQty}</td>
                                  <td style={{ padding: '4px' }}>
                                    <input 
                                      type="text" 
                                      className="table-cell-input" 
                                      style={{ textAlign: 'center', width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', height: '30px', color: '#1d4ed8' }}
                                      value={roundedQty} 
                                      onChange={e => handleInventoryChange(idx, 'rounded_qty', e.target.value)}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                              <td colSpan={3} style={{ padding: '10px 12px', color: '#0f172a' }}>TOTALS</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>{totalQty.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>100.00%</td>
                              <td style={{ textAlign: 'right', color: '#1d4ed8', padding: '10px 12px' }}>{parseFloat(grams).toFixed(2)}</td>
                              <td style={{ textAlign: 'center', color: '#1d4ed8', padding: '10px 12px', borderLeft: '1px solid #cbd5e1' }}>{totalRounded.toFixed(2)}</td>
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
                onClick={() => exportMasterToExcel(selectedBatch)}
                className="flet-btn flet-btn-green"
                style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }}
              >
                <Download size={14} /> Download Excel
              </button>
 
              {viewMode === 'master_formulation' && (
                isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="flet-btn flet-btn-orange" style={{ padding: '0 20px', height: '38px', borderRadius: '8px', fontWeight: 600 }} disabled={loading}>
                      Cancel
                    </button>
                    <button onClick={handleUpdateFormulation} className="flet-btn flet-btn-blue" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }} disabled={loading}>
                      <CheckCircle size={14} /> Save Changes
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="flet-btn flet-btn-blue" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }}>
                    <Edit3 size={14} /> Edit Parameters
                  </button>
                )
              )}
 
              {!isEditing && (
                <button onClick={() => setSelectedBatch(null)} className="flet-btn flet-btn-orange" style={{ padding: '0 20px', height: '38px', borderRadius: '8px', fontWeight: 600 }}>
                  Close
                </button>
              )}
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
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
          width: 100%;
          padding: 8px 4px;
        }

        .mf-batch-card {
          height: 90px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
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
        }
      `}</style>

    </div>
  );
};
