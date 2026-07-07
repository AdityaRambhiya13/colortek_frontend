import React, { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, Search, RefreshCw, AlertTriangle, Plus, Trash2, CheckCircle2,
  FileSpreadsheet, FileText, ChevronLeft, ChevronRight, CornerDownRight, X
} from 'lucide-react';
import { RDReportAPI } from '../services/api';
import { useVirtual } from '../hooks/useVirtual';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RdMainProps {
  activeSubView: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface RDFormData {
  date: string;
  batch_no: string;
  aim: string;
  input_qty: string;
  output_qty: string;
  prepared_by: string;
  checked_by: string;
  lb_no?: string;
  mo_no?: string;
  input_qty_100?: string;
  output_qty_100?: string;
  production_manager?: string;
  notes_remarks?: string;
}

interface RDRawMaterialRow {
  raw_material: string;
  parts_by_weight: string;
  raw_material_pct: string;
  remarks: string;
}

interface RDObservationRow {
  time: string;
  vt: string;
  ft: string;
  charge_obs: string;
  observed: string;
  remark: string;
}

interface RDResults {
  conclusion: string;

  // New PDF parameter fields
  k_value?: string;
  functionality?: string;
  hydroxyl_value?: string;
  theoretical_value?: string;
  nco_pct?: string;
  desired_specifications?: string;
  solid_pct?: string;
  water_spec_acid?: string;
  acid_value?: string;
  clarity?: string;
  eew?: string;
  water_of_reaction?: string;
  viscosity?: string;
  mol_wt?: string;
  gt_tube_viscosity?: string;
  color_gardner?: string;
  input_qty?: string;
  output_qty?: string;

  // Backward compatibility fields
  output_expected?: string;
  liberated_quantity?: string;
  final_value?: string;
  colour?: string;
  theoretical_80?: string;
  practical_80?: string;
  solid_content?: string;
}

interface ObservationRowProps {
  row: RDObservationRow;
  idx: number;
  onChange: (rowIdx: number, field: keyof RDObservationRow, val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => void;
  obsRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

const ObservationRow = React.memo<ObservationRowProps>(({ row, idx, onChange, onKeyDown, obsRefs }) => {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    fontSize: '0.8rem',
    border: '1px solid transparent',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#000000',
    textAlign: 'center',
    outline: 'none'
  };

  return (
    <tr style={{ 
      borderBottom: '1px solid #334155', 
      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' 
    }}>
      {/* Time */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-0`] = el; }}
          value={row.time}
          onChange={e => onChange(idx, 'time', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 0)}
          style={inputStyle}
        />
      </td>

      {/* Temp of V.T. */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-1`] = el; }}
          value={row.vt}
          onChange={e => onChange(idx, 'vt', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 1)}
          style={inputStyle}
        />
      </td>

      {/* Temp of F.T. */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-2`] = el; }}
          value={row.ft}
          onChange={e => onChange(idx, 'ft', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 2)}
          style={inputStyle}
        />
      </td>

      {/* H2O */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-3`] = el; }}
          value={row.charge_obs}
          onChange={e => onChange(idx, 'charge_obs', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 3)}
          style={inputStyle}
        />
      </td>

      {/* AV / AM.V / Nc.V / EEW */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-4`] = el; }}
          value={row.observed}
          onChange={e => onChange(idx, 'observed', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 4)}
          style={{ ...inputStyle, textAlign: 'left' }}
        />
      </td>

      {/* Observations & Remarks */}
      <td style={{ padding: '4px 6px' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-5`] = el; }}
          value={row.remark}
          onChange={e => onChange(idx, 'remark', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 5)}
          style={{ ...inputStyle, textAlign: 'left' }}
        />
      </td>
    </tr>
  );
}, (prev, next) => {
  return (
    prev.row.time === next.row.time &&
    prev.row.vt === next.row.vt &&
    prev.row.ft === next.row.ft &&
    prev.row.charge_obs === next.row.charge_obs &&
    prev.row.observed === next.row.observed &&
    prev.row.remark === next.row.remark &&
    prev.idx === next.idx
  );
});

export const RdMain: React.FC<RdMainProps> = ({ activeSubView, onShowToast }) => {
  const productName = sessionStorage.getItem('product_name') || '';

  // --------------------------------------------------------------------------
  // STATE DEFINITIONS FOR DATA ENTRY VIEW
  // --------------------------------------------------------------------------
  const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const initialForm = (): RDFormData => ({
    date: getTodayDateString(),
    batch_no: '',
    aim: '',
    input_qty: '',
    output_qty: '',
    prepared_by: '',
    checked_by: '',
    lb_no: '',
    mo_no: '',
    input_qty_100: '',
    output_qty_100: '',
    production_manager: '',
    notes_remarks: ''
  });

  const [form, setForm] = useState<RDFormData>(initialForm());

  // Raw Materials List (Starts with 15 rows)
  const initialRawMaterials = (): RDRawMaterialRow[] =>
    Array.from({ length: 15 }, () => ({ raw_material: '', parts_by_weight: '', raw_material_pct: '', remarks: '' }));
  const [rawMaterials, setRawMaterials] = useState<RDRawMaterialRow[]>(initialRawMaterials());

  // Observation matrix (15 pre-allocated rows)
  const initialObservations = (): RDObservationRow[] =>
    Array.from({ length: 15 }, () => ({ time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' }));
  const [observations, setObservations] = useState<RDObservationRow[]>(initialObservations());

  // Results & Parameters
  const initialResults = (): RDResults => ({
    conclusion: '',
    k_value: '',
    functionality: '',
    hydroxyl_value: '',
    theoretical_value: '',
    nco_pct: '',
    desired_specifications: '',
    solid_pct: '',
    water_spec_acid: '',
    acid_value: '',
    clarity: '',
    eew: '',
    water_of_reaction: '',
    viscosity: '',
    mol_wt: '',
    gt_tube_viscosity: '',
    color_gardner: '',
    input_qty: '',
    output_qty: '',
    output_expected: '',
    liberated_quantity: '',
    final_value: '',
    colour: '',
    theoretical_80: '',
    practical_80: '',
    solid_content: ''
  });
  const [results, setResults] = useState<RDResults>(initialResults());

  const [saving, setSaving] = useState(false);
  const [batchsheetNo, setBatchsheetNo] = useState('');

  // --------------------------------------------------------------------------
  // STATE DEFINITIONS FOR ARCHIVE / PAST ENTRIES
  // --------------------------------------------------------------------------
  const [searchFilters, setSearchFilters] = useState({
    batch_no: '',
    date: '',
    molecular_weight: '',
    hydroxyl: '',
    functionality: '',
    acid_value: '',
    amine_value: '',
    epoxy_value: ''
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pastCurrentPage, setPastCurrentPage] = useState(1);
  const [pastTotalPages, setPastTotalPages] = useState(1);
  const [searching, setSearching] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);
  const [customParameters, setCustomParameters] = useState<{ key: string; value: string }[]>([]);

  // Virtualization for R&D search results
  const {
    containerRef: searchScrollRef,
    onScroll: onSearchScroll,
    startIndex: searchStartIdx,
    endIndex: searchEndIdx,
    translateY: searchTranslateY,
    totalHeight: searchTotalHeight,
  } = useVirtual({
    totalItems: searchResults.length,
    itemHeight: 52,
  });

  // Focus Coordination Refs
  const obsRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const filterRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const detailRefs = useRef<{[key: string]: HTMLInputElement | HTMLTextAreaElement | null}>({});

  // --------------------------------------------------------------------------
  // CORE FUNCTIONS - DATA ENTRY
  // --------------------------------------------------------------------------

  // Row Adders
  const addRawMaterialRow = () => {
    setRawMaterials(prev => [...prev, { raw_material: '', parts_by_weight: '', raw_material_pct: '', remarks: '' }]);
  };

  const addObservationRow = () => {
    setObservations(prev => [...prev, { time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' }]);
  };

  const addCustomParameterRow = () => {
    setCustomParameters(prev => [...prev, { key: '', value: '' }]);
  };

  const handleCustomParameterChange = (idx: number, field: 'key' | 'value', val: string) => {
    setCustomParameters(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  // Input Change Handlers
  const handleFormChange = (field: keyof RDFormData, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleRawMaterialRowChange = (idx: number, field: keyof RDRawMaterialRow, val: string) => {
    const copy = [...rawMaterials];
    copy[idx] = {
      ...copy[idx],
      [field]: val
    };
    setRawMaterials(copy);
  };

  const handleObservationChange = (rowIdx: number, field: keyof RDObservationRow, val: string) => {
    setObservations(prev => {
      const copy = [...prev];
      copy[rowIdx] = {
        ...copy[rowIdx],
        [field]: val
      };
      return copy;
    });
  };

  const handleResultChange = (field: keyof RDResults, val: string) => {
    setResults(prev => ({ ...prev, [field]: val }));
  };

  const clearAllFields = () => {
    if (window.confirm("Are you sure you want to clear all fields? Unsaved changes will be lost.")) {
      setForm(initialForm());
      setRawMaterials(initialRawMaterials());
      setObservations(initialObservations());
      setResults(initialResults());
      setBatchsheetNo('');
      setCustomParameters([]);
      onShowToast("Form cleared successfully.", "info");
    }
  };

  // Keyboard navigation logic in spreadsheet matrix
  const handleObsKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    const maxRows = 12;
    const maxCols = 6; // time, vt, ft, charge_obs, observed, remark

    let nextRow = rowIdx;
    let nextCol = colIdx;

    if (e.key === 'Enter') {
      e.preventDefault();
      nextRow = rowIdx + 1; // Move down
    } else if (e.key === 'ArrowDown') {
      nextRow = rowIdx + 1;
    } else if (e.key === 'ArrowUp') {
      nextRow = rowIdx - 1;
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      nextCol = colIdx + 1;
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      nextCol = colIdx - 1;
    } else {
      return;
    }

    if (nextRow >= 0 && nextRow < maxRows && nextCol >= 0 && nextCol < maxCols) {
      e.preventDefault();
      const refKey = `obs-${nextRow}-${nextCol}`;
      obsRefs.current[refKey]?.focus();
      obsRefs.current[refKey]?.select();
    }
  };

  // Filter input change handler with automatic uppercase conversion
  const handleFilterChange = (field: keyof typeof searchFilters, val: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: val.toUpperCase() }));
  };

  // Keyboard navigation for filters (vertical navigation)
  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: string) => {
    const fields = [
      'batch_no',
      'date',
      'molecular_weight',
      'hydroxyl',
      'functionality',
      'acid_value',
      'amine_value',
      'epoxy_value'
    ];
    const idx = fields.indexOf(field);
    if (idx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextField = fields[idx + 1];
      if (nextField) {
        filterRefs.current[nextField]?.focus();
        filterRefs.current[nextField]?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevField = fields[idx - 1];
      if (prevField) {
        filterRefs.current[prevField]?.focus();
        filterRefs.current[prevField]?.select();
      }
    }
  };

  // Keyboard navigation for historical details view
  const handlePastDetailKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: string
  ) => {
    let nextKey = '';

    const rmMatch = key.match(/^past-rm-(\d+)$/);
    const theoKeyMatch = key.match(/^past-theo-key-(\d+)$/);
    const theoValMatch = key.match(/^past-theo-val-(\d+)$/);
    const procMatch = key.match(/^past-proc-(\d+)$/);
    const obsMatch = key.match(/^past-obs-(\d+)-(\d+)$/);
    const resMatch = key.match(/^past-res-(\d+)$/);

    if (key === 'past-date') {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-batch_no';
      }
    } else if (key === 'past-batch_no') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-date';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-aim';
      }
    } else if (key === 'past-aim') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-batch_no';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-rm-0';
      }
    } else if (rmMatch) {
      const idx = parseInt(rmMatch[1], 10);
      if (e.key === 'ArrowUp') {
        if (idx === 0) nextKey = 'past-aim';
        else nextKey = `past-rm-${idx - 1}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (idx === 9) nextKey = 'past-input_qty';
        else nextKey = `past-rm-${idx + 1}`;
      } else if (e.key === 'ArrowRight') {
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          nextKey = `past-theo-key-${idx}`;
        }
      }
    } else if (theoKeyMatch) {
      const idx = parseInt(theoKeyMatch[1], 10);
      if (e.key === 'ArrowUp') {
        if (idx === 0) nextKey = 'past-aim';
        else nextKey = `past-theo-key-${idx - 1}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (idx === 9) nextKey = 'past-output_qty';
        else nextKey = `past-theo-key-${idx + 1}`;
      } else if (e.key === 'ArrowLeft') {
        if (e.currentTarget.selectionStart === 0) {
          nextKey = `past-rm-${idx}`;
        }
      } else if (e.key === 'ArrowRight') {
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          nextKey = `past-theo-val-${idx}`;
        }
      }
    } else if (theoValMatch) {
      const idx = parseInt(theoValMatch[1], 10);
      if (e.key === 'ArrowUp') {
        if (idx === 0) nextKey = 'past-aim';
        else nextKey = `past-theo-val-${idx - 1}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (idx === 9) nextKey = 'past-output_qty';
        else nextKey = `past-theo-val-${idx + 1}`;
      } else if (e.key === 'ArrowLeft') {
        if (e.currentTarget.selectionStart === 0) {
          nextKey = `past-theo-key-${idx}`;
        }
      }
    } else if (key === 'past-input_qty') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-rm-9';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-proc-0';
      } else if (e.key === 'ArrowRight') {
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          nextKey = 'past-output_qty';
        }
      }
    } else if (key === 'past-output_qty') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-theo-val-9';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-proc-0';
      } else if (e.key === 'ArrowLeft') {
        if (e.currentTarget.selectionStart === 0) {
          nextKey = 'past-input_qty';
        }
      }
    } else if (procMatch) {
      const idx = parseInt(procMatch[1], 10);
      if (e.key === 'ArrowUp') {
        if (idx === 0) nextKey = 'past-input_qty';
        else nextKey = `past-proc-${idx - 1}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (idx === 9) nextKey = 'past-obs-0-0';
        else nextKey = `past-proc-${idx + 1}`;
      }
    } else if (obsMatch) {
      const rowIdx = parseInt(obsMatch[1], 10);
      const colIdx = parseInt(obsMatch[2], 10);
      if (e.key === 'ArrowUp') {
        if (rowIdx === 0) nextKey = 'past-proc-9';
        else nextKey = `past-obs-${rowIdx - 1}-${colIdx}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (rowIdx === 11) nextKey = 'past-res-0';
        else nextKey = `past-obs-${rowIdx + 1}-${colIdx}`;
      } else if (e.key === 'ArrowLeft') {
        if (e.currentTarget.selectionStart === 0) {
          if (colIdx > 0) nextKey = `past-obs-${rowIdx}-${colIdx - 1}`;
        }
      } else if (e.key === 'ArrowRight') {
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          if (colIdx < 5) nextKey = `past-obs-${rowIdx}-${colIdx + 1}`;
        }
      }
    } else if (resMatch) {
      const idx = parseInt(resMatch[1], 10);
      if (e.key === 'ArrowUp') {
        if (idx === 0) nextKey = 'past-obs-11-0';
        else nextKey = `past-res-${idx - 1}`;
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (idx === 7) nextKey = 'past-prepared_by';
        else nextKey = `past-res-${idx + 1}`;
      } else if (e.key === 'ArrowRight') {
        nextKey = 'past-conclusion';
      }
    } else if (key === 'past-conclusion') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-obs-11-5';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-prepared_by';
      } else if (e.key === 'ArrowLeft') {
        nextKey = 'past-res-0';
      }
    } else if (key === 'past-prepared_by') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-res-7';
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextKey = 'past-checked_by';
      }
    } else if (key === 'past-checked_by') {
      if (e.key === 'ArrowUp') {
        nextKey = 'past-prepared_by';
      }
    }

    if (nextKey && detailRefs.current[nextKey]) {
      e.preventDefault();
      detailRefs.current[nextKey]?.focus();
      detailRefs.current[nextKey]?.select();
    }
  };

  // Database Save
  const handleSaveReport = async () => {
    if (!form.batch_no) {
      onShowToast("Batch Number is required to save report.", "warning");
      return;
    }

    setSaving(true);

    const customParamsDict: Record<string, string> = {};
    customParameters.forEach(row => {
      if (row.key.trim()) {
        customParamsDict[row.key.trim()] = row.value.trim();
      }
    });

    const payload = {
      form: {
        ...form,
        batch_no: form.batch_no.trim()
      },
      raw_materials: rawMaterials.filter(x => x.raw_material.trim()),
      theoretical_values: customParamsDict,
      procedure: [],
      observations: observations.map(obs => ({
        time: obs.time.trim(),
        vt: obs.vt.trim(),
        ft: obs.ft.trim(),
        charge_obs: obs.charge_obs.trim(),
        observed: obs.observed.trim(),
        remark: obs.remark.trim()
      })),
      results: results,
      batchsheet_no: batchsheetNo.trim()
    };

    const [success, data] = await RDReportAPI.createReport(productName, payload);
    setSaving(false);

    if (success) {
      onShowToast(`R&D Report for Batch '${form.batch_no}' saved successfully!`, "success");
      handleExportPDF();
    } else {
      onShowToast(`Save Failed: ${data}`, "error");
    }
  };

  // --------------------------------------------------------------------------
  // ARCHIVE SEARCH & DETAIL FETCHING
  // --------------------------------------------------------------------------
  const executeSearch = async (pageNum = 1) => {
    setSearching(true);
    const cleanFilters: any = {};
    Object.entries(searchFilters).forEach(([k, v]) => {
      if (v.trim()) cleanFilters[k] = v.trim();
    });

    const [success, data] = await RDReportAPI.searchReports(productName, cleanFilters, pageNum);
    setSearching(false);

    if (success && typeof data !== 'string') {
      setSearchResults(data.records || []);
      setPastCurrentPage(data.current_page || 1);
      setPastTotalPages(data.total_pages || 1);
      if ((data.records || []).length === 0) {
        onShowToast("No matching trials found in database.", "info");
      }
    } else {
      onShowToast(`Search Failed: ${data}`, "error");
    }
  };

  const handleSelectBatch = async (batchNo: string) => {
    setSelectedBatchDetails(null);
    onShowToast(`Loading Batch '${batchNo}' details...`, "info");
    
    const [success, data] = await RDReportAPI.getReportDetails(productName, batchNo);
    if (success && typeof data !== 'string') {
      setSelectedBatchDetails(data.data || null);
    } else {
      onShowToast(`Failed to load batch details: ${data}`, "error");
    }
  };

  const handleClearFilters = () => {
    setSearchFilters({
      batch_no: '',
      date: '',
      molecular_weight: '',
      hydroxyl: '',
      functionality: '',
      acid_value: '',
      amine_value: '',
      epoxy_value: ''
    });
    setSearchResults([]);
    setPastCurrentPage(1);
    setPastTotalPages(1);
    setSelectedBatchDetails(null);
  };

  // --------------------------------------------------------------------------
  // EXCEL EXPORT (SHEETJS)
  // --------------------------------------------------------------------------
  const handleExportExcel = (customData?: any) => {
    const d = customData || {
      form,
      raw_materials: rawMaterials,
      observations: observations,
      results: results,
      batchsheet_no: batchsheetNo
    };

    const activeBatchNo = d.form?.batch_no || 'RD_Report';
    const wb = XLSX.utils.book_new();
    const wsRows: any[] = [];

    // Title Row
    wsRows.push(["R&D BATCH SHEET", "", "", "", "", "", ""]);
    wsRows.push(["Date:", d.form?.date || '', "Batch No:", d.form?.batch_no || '', "LB No:", d.form?.lb_no || '', "Mo No:", d.form?.mo_no || '']);
    wsRows.push(["Aim:", d.form?.aim || '', "", "", "", "", "", ""]);
    wsRows.push([]);

    // Raw Materials Headers
    wsRows.push(["Raw Materials Formula", "", "", "", "", ""]);
    wsRows.push(["Sr. No.", "Raw Material", "Parts by Weight", "Raw Material %", "Remarks"]);
    
    // Normalize raw materials:
    const rawList: any[] = (d.raw_materials || []).map((rm: any) => {
      if (typeof rm === 'string') {
        return { raw_material: rm, parts_by_weight: '', raw_material_pct: '', remarks: '' };
      }
      return rm;
    });

    rawList.forEach((rm: any, idx: number) => {
      wsRows.push([
        idx + 1,
        rm.raw_material || '',
        rm.parts_by_weight || '',
        rm.raw_material_pct || '',
        rm.remarks || ''
      ]);
    });
    wsRows.push([]);

    // Batch Results
    wsRows.push(["Batch Results", "", "", "", "", ""]);
    const res = d.results || {};
    wsRows.push(["K Value:", res.k_value || '', "Functionality:", res.functionality || '']);
    wsRows.push(["Hydroxyl Value (mg KOH/g):", res.hydroxyl_value || '', "Theoretical Value:", res.theoretical_value || '']);
    wsRows.push(["% NCO:", res.nco_pct || '', "Desired Specifications:", res.desired_specifications || '']);
    wsRows.push(["% Solid:", res.solid_pct || '', "Water @ Specific Acid Value:", res.water_spec_acid || '']);
    wsRows.push(["% Acid Value:", res.acid_value || '', "Clarity:", res.clarity || '']);
    wsRows.push(["EEW (g/eq):", res.eew || '', "Water of Reaction (g):", res.water_of_reaction || '']);
    wsRows.push(["Viscosity @ 25°C (mPa.s):", res.viscosity || '', "Mol / Wt (g/mol):", res.mol_wt || '']);
    wsRows.push(["GT Tube Viscosity @ 25°C:", res.gt_tube_viscosity || '', "Color (Gardner):", res.color_gardner || '']);
    wsRows.push(["Input Quantity:", res.input_qty || '', "Output Quantity:", res.output_qty || '']);

    // Add custom parameters to Excel
    const customParamsList: { key: string; value: string }[] = [];
    if (customData) {
      const savedTheo = d.theoretical_values || {};
      const standardKeys = [
        'k_value', 'hydroxyl_value', 'nco_pct', 'solid_pct', 'solid_content', 'acid_value', 'eew', 'viscosity', 'gt_tube_viscosity', 'input_qty',
        'functionality', 'theoretical_value', 'desired_specifications', 'water_spec_acid', 'clarity', 'water_of_reaction', 'mol_wt', 'color_gardner', 'colour', 'output_qty', 'output_expected'
      ];
      Object.entries(savedTheo).forEach(([k, v]) => {
        const normalizedKey = k.toLowerCase().replace(/%/g, '').replace(/ /g, '_');
        const isStandard = standardKeys.some(sk => sk.toLowerCase() === normalizedKey);
        if (!isStandard) {
          customParamsList.push({ key: k, value: String(v) });
        }
      });
    } else {
      customParamsList.push(...customParameters);
    }

    for (let i = 0; i < customParamsList.length; i += 2) {
      const p1 = customParamsList[i];
      const p2 = customParamsList[i + 1];
      wsRows.push([
        p1.key ? (p1.key + ":") : "", p1.value || '',
        p2 ? (p2.key + ":") : "", p2 ? (p2.value || '') : ""
      ]);
    }

    wsRows.push(["Conclusion:", res.conclusion || '', "", ""]);
    wsRows.push([]);

    // Observations
    wsRows.push(["Process Observation Sheet", "", "", "", "", ""]);
    wsRows.push(["Batchsheet No:", d.batchsheet_no || '']);
    wsRows.push(["Time", "Temp of V.T.", "Temp of F.T.", "H2O", "AV / AM.V / Nc.V / EEW", "Observations & Remarks"]);
    
    const obsList = d.observations || [];
    obsList.forEach((obs: any) => {
      wsRows.push([
        obs.time || '',
        obs.vt || '',
        obs.ft || '',
        obs.charge_obs || '',
        obs.observed || '',
        obs.remark || ''
      ]);
    });
    wsRows.push([]);
    
    // Bottom details of Observation sheet
    wsRows.push(["Input Quantity 100%:", d.form?.input_qty_100 || '', "Output Quantity 100%:", d.form?.output_qty_100 || '']);
    wsRows.push(["Notes / Remarks:", d.form?.notes_remarks || '']);
    wsRows.push([]);

    // Signatures
    wsRows.push(["Prepared By:", d.form?.prepared_by || '', "Checked By:", d.form?.checked_by || '', "Production Manager:", d.form?.production_manager || '']);

    const ws = XLSX.utils.aoa_to_sheet(wsRows);

    // Apply Merges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title
      { s: { r: 2, c: 1 }, e: { r: 2, c: 6 } }, // Aim
    ];

    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "R&D Report");
    XLSX.writeFile(wb, `${activeBatchNo}_RD_REPORT.xlsx`);
    onShowToast(`Excel file for batch ${activeBatchNo} downloaded successfully!`, "success");
  };

  // --------------------------------------------------------------------------
  // PDF EXPORT (JSPDF)
  // --------------------------------------------------------------------------
  const handleExportPDF = (customData?: any) => {
    const d = customData || {
      form,
      raw_materials: rawMaterials,
      observations: observations,
      results: results,
      batchsheet_no: batchsheetNo
    };

    const activeBatchNo = d.form?.batch_no || 'RD_Report';
    const doc = new jsPDF('l', 'mm', 'a4'); // width = 297, height = 210
    
    // Draw boundary line down the middle
    doc.setDrawColor(51, 65, 85); // Slate 700 (#334155)
    doc.setLineWidth(0.5);
    doc.line(148.5, 0, 148.5, 210);

    // ==========================================
    // LEFT SHEET: R & D BATCH SHEET
    // ==========================================
    const leftMargin = 8;
    const leftWidth = 132.5;

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("R & D BATCH SHEET", leftMargin + leftWidth / 2, 12, { align: "center" });

    // Underline
    doc.line(leftMargin + leftWidth / 2 - 25, 14, leftMargin + leftWidth / 2 + 25, 14);

    // Metadata Grid
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    
    // Y-position for metadata
    const metaY = 17;
    doc.text("Date:", leftMargin, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(d.form?.date || '', leftMargin + 8, metaY);
    doc.line(leftMargin + 8, metaY + 1, leftMargin + 25, metaY + 1);

    doc.setFont("helvetica", "bold");
    doc.text("Batch No:", leftMargin + 28, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(d.form?.batch_no || '', leftMargin + 41, metaY);
    doc.line(leftMargin + 41, metaY + 1, leftMargin + 65, metaY + 1);

    doc.setFont("helvetica", "bold");
    doc.text("LB No:", leftMargin + 68, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(d.form?.lb_no || '', leftMargin + 78, metaY);
    doc.line(leftMargin + 78, metaY + 1, leftMargin + 98, metaY + 1);

    doc.setFont("helvetica", "bold");
    doc.text("Mo. No:", leftMargin + 101, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(d.form?.mo_no || '', leftMargin + 112, metaY);
    doc.line(leftMargin + 112, metaY + 1, leftMargin + leftWidth, metaY + 1);

    // Aim Box
    const aimY = 21;
    doc.rect(leftMargin, aimY, leftWidth, 10);
    doc.setFont("helvetica", "bold");
    doc.text("Aim :", leftMargin + 2, aimY + 4);
    doc.setFont("helvetica", "normal");
    const splitAim = doc.splitTextToSize(d.form?.aim || '', leftWidth - 14);
    doc.text(splitAim, leftMargin + 10, aimY + 4);

    // Raw Materials Title
    const rmTitleY = 34;
    doc.setFillColor(71, 85, 105); // Slate 600
    doc.rect(leftMargin, rmTitleY, leftWidth, 5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("RAW MATERIALS FORMULA", leftMargin + leftWidth / 2, rmTitleY + 3.5, { align: "center" });

    // Raw Materials Grid Headers
    const rmHeaderY = 39;
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(leftMargin, rmHeaderY, leftWidth, 5, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.rect(leftMargin, rmHeaderY, leftWidth, 5); // Border

    // Draw RM Header columns:
    // Sr.No (10), Raw Material (52), Parts by Wt (20), RM% (20), Remarks (30.5)
    doc.line(leftMargin + 10, rmHeaderY, leftMargin + 10, rmHeaderY + 5);
    doc.line(leftMargin + 62, rmHeaderY, leftMargin + 62, rmHeaderY + 5);
    doc.line(leftMargin + 82, rmHeaderY, leftMargin + 82, rmHeaderY + 5);
    doc.line(leftMargin + 102, rmHeaderY, leftMargin + 102, rmHeaderY + 5);

    doc.text("Sr. No.", leftMargin + 5, rmHeaderY + 3.5, { align: "center" });
    doc.text("Raw Material", leftMargin + 12, rmHeaderY + 3.5);
    doc.text("Parts by Weight", leftMargin + 72, rmHeaderY + 3.5, { align: "center" });
    doc.text("Raw Material %", leftMargin + 92, rmHeaderY + 3.5, { align: "center" });
    doc.text("Observations & Remarks", leftMargin + 104, rmHeaderY + 3.5);

    // Raw Materials Rows
    let currentY = rmHeaderY + 5;
    const rawList: any[] = (d.raw_materials || []).map((rm: any) => {
      if (typeof rm === 'string') return { raw_material: rm, parts_by_weight: '', raw_material_pct: '', remarks: '' };
      return rm;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);

    for (let idx = 0; idx < 15; idx++) {
      const rm = rawList[idx] || { raw_material: '', parts_by_weight: '', raw_material_pct: '', remarks: '' };
      
      // Alternating backgrounds
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(leftMargin, currentY, leftWidth, 4.5, 'F');
      }
      doc.rect(leftMargin, currentY, leftWidth, 4.5); // Row border

      // Cell borders
      doc.line(leftMargin + 10, currentY, leftMargin + 10, currentY + 4.5);
      doc.line(leftMargin + 62, currentY, leftMargin + 62, currentY + 4.5);
      doc.line(leftMargin + 82, currentY, leftMargin + 82, currentY + 4.5);
      doc.line(leftMargin + 102, currentY, leftMargin + 102, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.text(String(idx + 1), leftMargin + 5, currentY + 3.2, { align: "center" });
      doc.setFont("helvetica", "normal");

      // Text truncation to avoid overlapping columns
      const rmName = doc.splitTextToSize(rm.raw_material || '', 50)[0] || '';
      doc.text(rmName, leftMargin + 12, currentY + 3.2);
      doc.text(rm.parts_by_weight || '', leftMargin + 72, currentY + 3.2, { align: "center" });
      doc.text(rm.raw_material_pct || '', leftMargin + 92, currentY + 3.2, { align: "center" });
      
      const remarkText = doc.splitTextToSize(rm.remarks || '', 29)[0] || '';
      doc.text(remarkText, leftMargin + 104, currentY + 3.2);

      currentY += 4.5;
    }

    // Batch Result Title
    const brTitleY = currentY + 3;
    doc.setFillColor(71, 85, 105);
    doc.rect(leftMargin, brTitleY, leftWidth, 5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("BATCH RESULT", leftMargin + leftWidth / 2, brTitleY + 3.5, { align: "center" });

    // Batch Result Grid Headers
    const brHeaderY = brTitleY + 5;
    doc.setFillColor(241, 245, 249);
    doc.rect(leftMargin, brHeaderY, leftWidth, 4.5, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.rect(leftMargin, brHeaderY, leftWidth, 4.5); // Border
    doc.line(leftMargin + 40, brHeaderY, leftMargin + 40, brHeaderY + 4.5);
    doc.line(leftMargin + 66, brHeaderY, leftMargin + 66, brHeaderY + 4.5);
    doc.line(leftMargin + 106, brHeaderY, leftMargin + 106, brHeaderY + 4.5);

    doc.text("Parameter", leftMargin + 2, brHeaderY + 3.2);
    doc.text("Value", leftMargin + 53, brHeaderY + 3.2, { align: "center" });
    doc.text("Parameter", leftMargin + 68, brHeaderY + 3.2);
    doc.text("Value", leftMargin + 119, brHeaderY + 3.2, { align: "center" });

    // Draw Batch Result Rows
    let brY = brHeaderY + 4.5;
    const res = d.results || {};
    const brRows = [
      { p1: 'K Value', val1: res.k_value, p2: 'Functionality', val2: res.functionality },
      { p1: 'Hydroxyl Value (mg KOH/g)', val1: res.hydroxyl_value, p2: 'Theoretical Value', val2: res.theoretical_value },
      { p1: '% NCO', val1: res.nco_pct, p2: 'Desired Specifications', val2: res.desired_specifications },
      { p1: '% Solid', val1: res.solid_pct, p2: 'Water @ Specific Acid Value', val2: res.water_spec_acid },
      { p1: '% Acid Value', val1: res.acid_value, p2: 'Clarity', val2: res.clarity },
      { p1: 'EEW (g/eq)', val1: res.eew, p2: 'Water of Reaction (g)', val2: res.water_of_reaction },
      { p1: 'Viscosity @ 25°C (mPa.s)', val1: res.viscosity, p2: 'Mol / Wt (g/mol)', val2: res.mol_wt },
      { p1: 'GT Tube Viscosity @ 25°C', val1: res.gt_tube_viscosity, p2: 'Color (Gardner)', val2: res.color_gardner },
      { p1: 'Input Quantity :', val1: res.input_qty, p2: 'Output Quantity :', val2: res.output_qty },
    ];

    // Add custom parameters to PDF Batch Result
    const customParamsPDF: { key: string; value: string }[] = [];
    if (customData) {
      const savedTheo = d.theoretical_values || {};
      const standardKeys = [
        'k_value', 'hydroxyl_value', 'nco_pct', 'solid_pct', 'solid_content', 'acid_value', 'eew', 'viscosity', 'gt_tube_viscosity', 'input_qty',
        'functionality', 'theoretical_value', 'desired_specifications', 'water_spec_acid', 'clarity', 'water_of_reaction', 'mol_wt', 'color_gardner', 'colour', 'output_qty', 'output_expected'
      ];
      Object.entries(savedTheo).forEach(([k, v]) => {
        const normalizedKey = k.toLowerCase().replace(/%/g, '').replace(/ /g, '_');
        const isStandard = standardKeys.some(sk => sk.toLowerCase() === normalizedKey);
        if (!isStandard) {
          customParamsPDF.push({ key: k, value: String(v) });
        }
      });
    } else {
      customParamsPDF.push(...customParameters);
    }

    for (let i = 0; i < customParamsPDF.length; i += 2) {
      brRows.push({
        p1: customParamsPDF[i].key,
        val1: customParamsPDF[i].value,
        p2: customParamsPDF[i + 1]?.key || '',
        val2: customParamsPDF[i + 1]?.value || ''
      });
    }

    doc.setTextColor(0, 0, 0);
    brRows.forEach((row, rIdx) => {
      doc.rect(leftMargin, brY, leftWidth, 4.5);
      doc.line(leftMargin + 40, brY, leftMargin + 40, brY + 4.5);
      doc.line(leftMargin + 66, brY, leftMargin + 66, brY + 4.5);
      doc.line(leftMargin + 106, brY, leftMargin + 106, brY + 4.5);

      // Parameter 1 & Value 1
      doc.setFont("helvetica", "bold");
      doc.text(row.p1, leftMargin + 2, brY + 3.2);
      doc.setFont("helvetica", "normal");
      doc.text(String(row.val1 || ''), leftMargin + 53, brY + 3.2, { align: "center" });

      // Parameter 2 & Value 2
      doc.setFont("helvetica", "bold");
      doc.text(row.p2, leftMargin + 68, brY + 3.2);
      doc.setFont("helvetica", "normal");
      doc.text(String(row.val2 || ''), leftMargin + 119, brY + 3.2, { align: "center" });

      brY += 4.5;
    });

    // Signatures Section
    const sigY = brY + 3;
    doc.rect(leftMargin, sigY, leftWidth, 13);
    doc.line(leftMargin + 44, sigY, leftMargin + 44, sigY + 13);
    doc.line(leftMargin + 88, sigY, leftMargin + 88, sigY + 13);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Prepared by:", leftMargin + 2, sigY + 3);
    doc.text("QC Checked by:", leftMargin + 46, sigY + 3);
    doc.text("Production Manager:", leftMargin + 90, sigY + 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(d.form?.prepared_by || '', leftMargin + 22, sigY + 9, { align: "center" });
    doc.text(d.form?.checked_by || '', leftMargin + 66, sigY + 9, { align: "center" });
    doc.text(d.form?.production_manager || '', leftMargin + 110, sigY + 9, { align: "center" });

    // ==========================================
    // RIGHT SHEET: PROCESS OBSERVATION SHEET
    // ==========================================
    const rightMargin = 156.5;
    const rightWidth = 132.5;

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("PROCESS OBSERVATION SHEET", rightMargin + rightWidth / 2, 12, { align: "center" });
    doc.line(rightMargin + rightWidth / 2 - 35, 14, rightMargin + rightWidth / 2 + 35, 14);

    // Batchsheet No
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Batchsheet No:", rightMargin, 19);
    doc.setFont("helvetica", "normal");
    doc.text(d.batchsheet_no || '', rightMargin + 22, 19);
    doc.line(rightMargin + 22, 20, rightMargin + 60, 20);

    // Observation Table Header
    const obsHeaderY = 22;
    doc.setFillColor(226, 232, 240); // Grey 200
    doc.rect(rightMargin, obsHeaderY, rightWidth, 6, 'F');
    doc.rect(rightMargin, obsHeaderY, rightWidth, 6);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);

    // Observation Columns layout:
    // Time (12), Temp of VT (18), Temp of FT (18), H2O (12), AV/AM/NC (35), Remarks (37.5)
    doc.line(rightMargin + 12, obsHeaderY, rightMargin + 12, obsHeaderY + 6);
    doc.line(rightMargin + 30, obsHeaderY, rightMargin + 30, obsHeaderY + 6);
    doc.line(rightMargin + 48, obsHeaderY, rightMargin + 48, obsHeaderY + 6);
    doc.line(rightMargin + 60, obsHeaderY, rightMargin + 60, obsHeaderY + 6);
    doc.line(rightMargin + 95, obsHeaderY, rightMargin + 95, obsHeaderY + 6);

    doc.text("Time", rightMargin + 6, obsHeaderY + 4, { align: "center" });
    doc.text("Temp of V.T.", rightMargin + 21, obsHeaderY + 4, { align: "center" });
    doc.text("Temp of F.T.", rightMargin + 39, obsHeaderY + 4, { align: "center" });
    doc.text("H₂O", rightMargin + 54, obsHeaderY + 4, { align: "center" });
    doc.text("AV / AM.V / Nc.V / EEW", rightMargin + 62, obsHeaderY + 4);
    doc.text("Observations & Remarks", rightMargin + 97, obsHeaderY + 4);

    // Observations rows
    let obsY = obsHeaderY + 6;
    const obsList = d.observations || [];
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    for (let idx = 0; idx < 15; idx++) {
      const obs = obsList[idx] || { time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' };
      
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(rightMargin, obsY, rightWidth, 7.5, 'F');
      }
      doc.rect(rightMargin, obsY, rightWidth, 7.5);

      doc.line(rightMargin + 12, obsY, rightMargin + 12, obsY + 7.5);
      doc.line(rightMargin + 30, obsY, rightMargin + 30, obsY + 7.5);
      doc.line(rightMargin + 48, obsY, rightMargin + 48, obsY + 7.5);
      doc.line(rightMargin + 60, obsY, rightMargin + 60, obsY + 7.5);
      doc.line(rightMargin + 95, obsY, rightMargin + 95, obsY + 7.5);

      doc.text(obs.time || '', rightMargin + 6, obsY + 4.8, { align: "center" });
      doc.text(obs.vt || '', rightMargin + 21, obsY + 4.8, { align: "center" });
      doc.text(obs.ft || '', rightMargin + 39, obsY + 4.8, { align: "center" });
      doc.text(obs.charge_obs || '', rightMargin + 54, obsY + 4.8, { align: "center" });
      
      const obsVal = doc.splitTextToSize(obs.observed || '', 33)[0] || '';
      doc.text(obsVal, rightMargin + 62, obsY + 4.8);
      
      const remarkText = doc.splitTextToSize(obs.remark || '', 35)[0] || '';
      doc.text(remarkText, rightMargin + 97, obsY + 4.8);

      obsY += 7.5;
    }

    // Quantities 100% Box
    const qtyY = obsY + 3;
    doc.rect(rightMargin, qtyY, rightWidth, 9);
    doc.line(rightMargin + rightWidth / 2, qtyY, rightMargin + rightWidth / 2, qtyY + 9);

    doc.setFont("helvetica", "bold");
    doc.text("Input Quantity 100%:", rightMargin + 2, qtyY + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text(String(d.form?.input_qty_100 || ''), rightMargin + 32, qtyY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.text("Output Quantity 100%:", rightMargin + rightWidth / 2 + 2, qtyY + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text(String(d.form?.output_qty_100 || ''), rightMargin + rightWidth / 2 + 34, qtyY + 5.5);

    // Notes / Remarks Box
    const noteY = qtyY + 12;
    doc.rect(rightMargin, noteY, rightWidth, 23);
    doc.setFont("helvetica", "bold");
    doc.text("Notes / Remarks :", rightMargin + 2, noteY + 4.5);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(d.form?.notes_remarks || '', rightWidth - 6);
    doc.text(splitNotes, rightMargin + 2, noteY + 9.5);

    doc.save(`${activeBatchNo}_RD_Report.pdf`);
    onShowToast(`PDF file for batch ${activeBatchNo} downloaded successfully!`, "success");
  };

  // --------------------------------------------------------------------------
  // RENDER CORRESPONDING VIEW
  // --------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* ----------------- SUBVIEW 1: R&D BATCH SHEET ENTRY ----------------- */}
      {activeSubView === 'rd' && (
        <div className="animated-fade" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          
          {/* Frozen Header Panel */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '75px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            backgroundColor: '#f1f5f9',
            borderBottom: '2px solid #94a3b8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Lightbulb size={28} color="var(--primary-color)" />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>R&D Batch Sheet</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Product database context: {productName}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={handleSaveReport}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none'
                  }}
                >
                  <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
                  {saving ? 'Saving...' : 'Save'}
                </button>

                <button 
                  onClick={() => handleExportPDF()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor: '#15803d',
                    color: '#fff',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  <FileText size={14} />
                  Print
                </button>

                <button 
                  onClick={() => handleExportExcel()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  <FileSpreadsheet size={14} />
                  Excel
                </button>

                <button 
                  onClick={clearAllFields}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor: '#ea580c',
                    color: '#fff',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  <X size={14} />
                  Clear
                </button>
              </div>
            </div>
          </div>
          {/* Scrollable Content Pane */}
          <div style={{
            position: 'absolute',
            top: '75px',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '24px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            overflowX: 'auto',
            backgroundColor: '#f1f5f9'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.05fr 0.95fr',
              gap: '24px',
              minWidth: '1280px',
              width: '100%',
              boxSizing: 'border-box'
            }}>

            {/* LEFT SHEET: R & D Batch Sheet */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '2px solid #334155',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#000000',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}>
              {/* Header Title */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#1e293b', margin: 0 }}>R & D Batch Sheet</h2>
                <div style={{ height: '3px', backgroundColor: '#334155', margin: '8px auto 0 auto', width: '180px' }}></div>
              </div>

              {/* Top metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '12px', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Date:</span>
                  <input type="text" value={form.date} disabled style={{ flex: 1, border: 'none', borderBottom: '1px dotted #334155', backgroundColor: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', padding: 0, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Batch No:</span>
                  <input type="text" value={form.batch_no} onChange={e => handleFormChange('batch_no', e.target.value)} style={{ flex: 1, border: 'none', borderBottom: '1px dotted #334155', backgroundColor: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', padding: 0 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>LB No:</span>
                  <input type="text" value={form.lb_no || ''} onChange={e => handleFormChange('lb_no', e.target.value)} style={{ flex: 1, border: 'none', borderBottom: '1px dotted #334155', backgroundColor: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', padding: 0 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Mo. No:</span>
                  <input type="text" value={form.mo_no || ''} onChange={e => handleFormChange('mo_no', e.target.value)} style={{ flex: 1, border: 'none', borderBottom: '1px dotted #334155', backgroundColor: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', padding: 0 }} />
                </div>
              </div>

              {/* Aim Box */}
              <div style={{ display: 'flex', gap: '10px', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', minWidth: '40px' }}>Aim :</span>
                <textarea value={form.aim} onChange={e => handleFormChange('aim', e.target.value)} rows={2} style={{ flex: 1, border: 'none', resize: 'none', fontSize: '0.85rem', color: '#1e293b', padding: 0, outline: 'none', backgroundColor: 'transparent' }} />
              </div>

              {/* Raw Materials formula Table */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#475569', color: '#ffffff', padding: '6px 12px', border: '1px solid #334155', borderBottom: 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Raw Materials formula</span>
                  <button 
                    type="button"
                    onClick={addRawMaterialRow}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    <Plus size={10} /> Add Row
                  </button>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #334155' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #334155' }}>
                        <th style={{ width: '40px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center', color: '#475569', fontWeight: 'bold' }}>Sr. No.</th>
                        <th style={{ padding: '4px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold' }}>Raw Material</th>
                        <th style={{ width: '100px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center', color: '#475569', fontWeight: 'bold' }}>Parts by Weight</th>
                        <th style={{ width: '100px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center', color: '#475569', fontWeight: 'bold' }}>Raw Material %</th>
                        <th style={{ padding: '4px', color: '#475569', fontWeight: 'bold' }}>Observations & Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterials.map((rm, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === rawMaterials.length - 1 ? 'none' : '1px solid #cbd5e1' }}>
                          <td style={{ padding: '2px', borderRight: '1px solid #334155', textAlign: 'center', fontWeight: 'bold', color: '#64748b', backgroundColor: '#f8fafc' }}>{idx + 1}</td>
                          <td style={{ padding: '2px', borderRight: '1px solid #334155' }}>
                            <input type="text" value={rm.raw_material} onChange={e => handleRawMaterialRowChange(idx, 'raw_material', e.target.value)} style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b' }} />
                          </td>
                          <td style={{ padding: '2px', borderRight: '1px solid #334155' }}>
                            <input type="text" value={rm.parts_by_weight} onChange={e => handleRawMaterialRowChange(idx, 'parts_by_weight', e.target.value)} style={{ width: '100%', border: 'none', textAlign: 'center', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b' }} />
                          </td>
                          <td style={{ padding: '2px', borderRight: '1px solid #334155' }}>
                            <input type="text" value={rm.raw_material_pct} onChange={e => handleRawMaterialRowChange(idx, 'raw_material_pct', e.target.value)} style={{ width: '100%', border: 'none', textAlign: 'center', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b' }} />
                          </td>
                          <td style={{ padding: '2px' }}>
                            <input type="text" value={rm.remarks} onChange={e => handleRawMaterialRowChange(idx, 'remarks', e.target.value)} style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b' }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Batch Result Table */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#475569', color: '#ffffff', padding: '6px 12px', border: '1px solid #334155', borderBottom: 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Batch Result</span>
                  <button 
                    type="button"
                    onClick={addCustomParameterRow}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    <Plus size={10} /> Add Parameter
                  </button>
                </div>
                <div style={{ border: '1px solid #334155' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #334155' }}>
                        <th style={{ width: '30%', padding: '4px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold' }}>Parameter</th>
                        <th style={{ width: '20%', padding: '4px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold' }}>Value</th>
                        <th style={{ width: '30%', padding: '4px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold' }}>Parameter</th>
                        <th style={{ width: '20%', padding: '4px', color: '#475569', fontWeight: 'bold' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { p1: 'K Value', key1: 'k_value', p2: 'Functionality', key2: 'functionality' },
                        { p1: 'Hydroxyl Value (mg KOH/g)', key1: 'hydroxyl_value', p2: 'Theoretical Value', key2: 'theoretical_value' },
                        { p1: '% NCO', key1: 'nco_pct', p2: 'Desired Specifications', key2: 'desired_specifications' },
                        { p1: '% Solid', key1: 'solid_pct', p2: 'Water @ Specific Acid Value', key2: 'water_spec_acid' },
                        { p1: '% Acid Value', key1: 'acid_value', p2: 'Clarity', key2: 'clarity' },
                        { p1: 'EEW (g/eq)', key1: 'eew', p2: 'Water of Reaction (g)', key2: 'water_of_reaction' },
                        { p1: 'Viscosity @ 25°C (mPa.s)', key1: 'viscosity', p2: 'Mol / Wt (g/mol)', key2: 'mol_wt' },
                        { p1: 'GT Tube Viscosity @ 25°C', key1: 'gt_tube_viscosity', p2: 'Color (Gardner)', key2: 'color_gardner' },
                        { p1: 'Input Quantity :', key1: 'input_qty', p2: 'Output Quantity :', key2: 'output_qty' },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: (idx === 8 && customParameters.length === 0) ? 'none' : '1px solid #cbd5e1' }}>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', backgroundColor: '#f8fafc', fontSize: '0.75rem' }}>{row.p1}</td>
                          <td style={{ padding: '2px', borderRight: '1px solid #cbd5e1' }}>
                            <input type="text" value={results[row.key1 as keyof RDResults] || ''} onChange={e => handleResultChange(row.key1 as keyof RDResults, e.target.value)} style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b', textAlign: 'center' }} />
                          </td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', backgroundColor: '#f8fafc', fontSize: '0.75rem' }}>{row.p2}</td>
                          <td style={{ padding: '2px' }}>
                            <input type="text" value={results[row.key2 as keyof RDResults] || ''} onChange={e => handleResultChange(row.key2 as keyof RDResults, e.target.value)} style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b', textAlign: 'center' }} />
                          </td>
                        </tr>
                      ))}
                      {(() => {
                        const pairs: { key1: string; val1: string; idx1: number; key2?: string; val2?: string; idx2?: number }[] = [];
                        for (let i = 0; i < customParameters.length; i += 2) {
                          pairs.push({
                            key1: customParameters[i].key,
                            val1: customParameters[i].value,
                            idx1: i,
                            key2: customParameters[i + 1]?.key,
                            val2: customParameters[i + 1]?.value,
                            idx2: i + 1
                          });
                        }
                        return pairs.map((pair, pIdx) => (
                          <tr key={`custom-${pIdx}`} style={{ borderBottom: pIdx === pairs.length - 1 ? 'none' : '1px solid #cbd5e1' }}>
                            <td style={{ padding: '2px', borderRight: '1px solid #cbd5e1' }}>
                              <input 
                                type="text" 
                                placeholder="Custom Parameter" 
                                value={pair.key1} 
                                onChange={e => handleCustomParameterChange(pair.idx1, 'key', e.target.value)} 
                                style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#334155', fontWeight: 'bold', backgroundColor: '#f8fafc' }} 
                              />
                            </td>
                            <td style={{ padding: '2px', borderRight: '1px solid #cbd5e1' }}>
                              <input 
                                type="text" 
                                placeholder="Value" 
                                value={pair.val1} 
                                onChange={e => handleCustomParameterChange(pair.idx1, 'value', e.target.value)} 
                                style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b', textAlign: 'center' }} 
                              />
                            </td>
                            <td style={{ padding: '2px', borderRight: '1px solid #cbd5e1' }}>
                              {pair.idx2 !== undefined && (
                                <input 
                                  type="text" 
                                  placeholder="Custom Parameter" 
                                  value={pair.key2} 
                                  onChange={e => handleCustomParameterChange(pair.idx2!, 'key', e.target.value)} 
                                  style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#334155', fontWeight: 'bold', backgroundColor: '#f8fafc' }} 
                                />
                              )}
                            </td>
                            <td style={{ padding: '2px' }}>
                              {pair.idx2 !== undefined && (
                                <input 
                                  type="text" 
                                  placeholder="Value" 
                                  value={pair.val2} 
                                  onChange={e => handleCustomParameterChange(pair.idx2!, 'value', e.target.value)} 
                                  style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '0.8rem', outline: 'none', color: '#1e293b', textAlign: 'center' }} 
                                />
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: 'auto', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Prepared by:</span>
                  <input type="text" value={form.prepared_by} onChange={e => handleFormChange('prepared_by', e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #94a3b8', fontSize: '0.8rem', outline: 'none', padding: '2px 0', backgroundColor: 'transparent', color: '#1e293b' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>QC Checked by:</span>
                  <input type="text" value={form.checked_by} onChange={e => handleFormChange('checked_by', e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #94a3b8', fontSize: '0.8rem', outline: 'none', padding: '2px 0', backgroundColor: 'transparent', color: '#1e293b' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Production Manager:</span>
                  <input type="text" value={form.production_manager || ''} onChange={e => handleFormChange('production_manager', e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #94a3b8', fontSize: '0.8rem', outline: 'none', padding: '2px 0', backgroundColor: 'transparent', color: '#1e293b' }} />
                </div>
              </div>
            </div>

            {/* RIGHT SHEET: Process Observation Sheet */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '2px solid #334155',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#000000',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}>
              {/* Header Title */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#1e293b', margin: 0 }}>Process Observation Sheet</h2>
                <div style={{ height: '3px', backgroundColor: '#334155', margin: '8px auto 0 auto', width: '220px' }}></div>
              </div>

              {/* Batchsheet No and Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', width: 'max-content' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Batchsheet No:</span>
                    <input type="text" value={batchsheetNo} onChange={e => setBatchsheetNo(e.target.value)} style={{ width: '150px', border: 'none', borderBottom: '1px dotted #334155', backgroundColor: 'transparent', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', padding: 0 }} />
                  </div>
                  <button 
                    type="button"
                    onClick={addObservationRow}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    <Plus size={12} /> Add Observation Row
                  </button>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e2e8f0', color: '#1e293b', borderBottom: '2px solid #334155' }}>
                        <th style={{ padding: '8px 10px', width: '80px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>Time</th>
                        <th style={{ padding: '8px 10px', width: '90px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>Temp of V.T.</th>
                        <th style={{ padding: '8px 10px', width: '90px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>Temp of F.T.</th>
                        <th style={{ padding: '8px 10px', width: '70px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>H₂O</th>
                        <th style={{ padding: '8px 10px', width: '180px', borderRight: '1px solid #334155', color: '#475569', fontWeight: 'bold' }}>AV / AM.V / Nc.V / EEW</th>
                        <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 'bold' }}>Observations & Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observations.map((row, idx) => (
                        <ObservationRow 
                          key={idx}
                          row={row}
                          idx={idx}
                          onChange={handleObservationChange}
                          onKeyDown={handleObsKeyDown}
                          obsRefs={obsRefs}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quantities 100% */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Input Quantity 100% :</span>
                  <input type="text" value={form.input_qty_100 || ''} onChange={e => handleFormChange('input_qty_100', e.target.value)} style={{ flex: 1, border: 'none', borderBottom: '1px solid #cbd5e1', fontSize: '0.8rem', padding: '2px 0', outline: 'none', backgroundColor: 'transparent', color: '#1e293b' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Output Quantity 100% :</span>
                  <input type="text" value={form.output_qty_100 || ''} onChange={e => handleFormChange('output_qty_100', e.target.value)} style={{ flex: 1, border: 'none', borderBottom: '1px solid #cbd5e1', fontSize: '0.8rem', padding: '2px 0', outline: 'none', backgroundColor: 'transparent', color: '#1e293b' }} />
                </div>
              </div>

              {/* Notes / Remarks textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', height: '120px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Notes / Remarks :</span>
                <textarea 
                  value={form.notes_remarks || ''} 
                  onChange={e => handleFormChange('notes_remarks', e.target.value)} 
                  rows={3} 
                  style={{ width: '100%', border: 'none', resize: 'none', fontSize: '0.8rem', color: '#1e293b', padding: 0, outline: 'none', backgroundColor: 'transparent', flex: 1 }} 
                />
              </div>

            </div>

          </div>
          </div>
        </div>
      )}

      {/* ----------------- SUBVIEW 2: PAST R&D TRIALS ARCHIVE ----------------- */}
      {activeSubView === 'past_rd_entries' && (
        <div className="animated-fade" style={{ display: 'flex', gap: '20px', height: '100%', width: '100%', padding: '20px', overflow: 'hidden', boxSizing: 'border-box' }}>
          
          {/* LEFT PANEL: Filters and Search Results */}
          <div style={{
            width: '360px',
            height: '100%',
            overflowY: 'hidden',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            boxSizing: 'border-box'
          }}>
            <h4 style={{ fontWeight: 700, fontSize: '1.1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px' }}>Search Filters</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '55%', paddingRight: '4px', flexShrink: 0 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Batch No.</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['batch_no'] = el; }}
                  value={searchFilters.batch_no}
                  onChange={e => handleFilterChange('batch_no', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'batch_no')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Date (DD-MM-YYYY)</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['date'] = el; }}
                  value={searchFilters.date}
                  onChange={e => handleFilterChange('date', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'date')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Molecular Wt.</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['molecular_weight'] = el; }}
                  value={searchFilters.molecular_weight}
                  onChange={e => handleFilterChange('molecular_weight', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'molecular_weight')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Hydroxyl</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['hydroxyl'] = el; }}
                  value={searchFilters.hydroxyl}
                  onChange={e => handleFilterChange('hydroxyl', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'hydroxyl')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Functionality</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['functionality'] = el; }}
                  value={searchFilters.functionality}
                  onChange={e => handleFilterChange('functionality', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'functionality')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Acid Value</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['acid_value'] = el; }}
                  value={searchFilters.acid_value}
                  onChange={e => handleFilterChange('acid_value', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'acid_value')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Amine Value</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['amine_value'] = el; }}
                  value={searchFilters.amine_value}
                  onChange={e => handleFilterChange('amine_value', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'amine_value')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Epoxy Value</label>
                <input 
                  type="text"
                  ref={el => { filterRefs.current['epoxy_value'] = el; }}
                  value={searchFilters.epoxy_value}
                  onChange={e => handleFilterChange('epoxy_value', e.target.value)}
                  onKeyDown={e => handleFilterKeyDown(e, 'epoxy_value')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                <button 
                  onClick={() => executeSearch(1)}
                  disabled={searching}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '6px', backgroundColor: '#334155', color: '#ffffff', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#334155'}
                >
                  <Search size={14} />
                  {searching ? 'Searching...' : 'Search'}
                </button>

                <button 
                  onClick={handleClearFilters}
                  className="btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '6px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c2410c'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ea580c'}
                >
                  Clear
                </button>
              </div>

            </div>

            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 }}>
              <h5 style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, color: '#1e293b' }}>Search Results</h5>
              
              <div 
                ref={searchScrollRef}
                onScroll={onSearchScroll}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '4px', position: 'relative' }}
              >
                {searchResults.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>No search query executed yet.</span>
                ) : (
                  <div style={{ height: `${searchTotalHeight}px`, width: '100%', position: 'relative' }}>
                    <div style={{ transform: `translateY(${searchTranslateY}px)`, display: 'flex', flexDirection: 'column', gap: '6px', position: 'absolute', left: 0, right: 0 }}>
                      {searchResults.slice(searchStartIdx, searchEndIdx).map((rec, slicedIdx) => {
                        const idx = searchStartIdx + slicedIdx;
                        return (
                          <div 
                            key={idx}
                            onClick={() => handleSelectBatch(rec.batch_no)}
                            className="interactive"
                            style={{
                              padding: '10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: selectedBatchDetails?.form?.batch_no === rec.batch_no ? '#e2e8f0' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={e => {
                              if (selectedBatchDetails?.form?.batch_no !== rec.batch_no) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }
                            }}
                            onMouseLeave={e => {
                              if (selectedBatchDetails?.form?.batch_no !== rec.batch_no) {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }
                            }}
                          >
                            <strong style={{ fontSize: '0.85rem', color: selectedBatchDetails?.form?.batch_no === rec.batch_no ? '#0f172a' : '#334155' }}>Batch: {rec.batch_no}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Date: {rec.report_date || 'N/A'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination block */}
              {pastTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '5px' }}>
                  <button 
                    disabled={pastCurrentPage === 1}
                    onClick={() => executeSearch(pastCurrentPage - 1)}
                    style={{ padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Page {pastCurrentPage} of {pastTotalPages}</span>
                  <button 
                    disabled={pastCurrentPage >= pastTotalPages}
                    onClick={() => executeSearch(pastCurrentPage + 1)}
                    style={{ padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

            </div>

          </div>

          {/* RIGHT PANEL: Read-only detailed trial view */}
          <div style={{
            flex: 1,
            height: '100%',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            {!selectedBatchDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '100px 0' }}>
                <Lightbulb size={48} color="#94a3b8" />
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>No R&D Batch Selected</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '4px 0 0 0' }}>Select a trial batch from the left search panel to explore the historical reaction grid and theoretical specs.</p>
                </div>
              </div>
            ) : (() => {
              // Normalize raw materials:
              const detailRawMaterials: RDRawMaterialRow[] = (selectedBatchDetails.raw_materials || []).map((rm: any) => {
                if (typeof rm === 'string') {
                  return { raw_material: rm, parts_by_weight: '', raw_material_pct: '', remarks: '' };
                }
                return {
                  raw_material: rm.raw_material || '',
                  parts_by_weight: rm.parts_by_weight || '',
                  raw_material_pct: rm.raw_material_pct || '',
                  remarks: rm.remarks || ''
                };
              });
              while (detailRawMaterials.length < 15) {
                detailRawMaterials.push({ raw_material: '', parts_by_weight: '', raw_material_pct: '', remarks: '' });
              }

              const detailObservations: RDObservationRow[] = (selectedBatchDetails.observations || []).map((obs: any) => ({
                time: obs.time || '',
                vt: obs.vt || '',
                ft: obs.ft || '',
                charge_obs: obs.charge_obs || '',
                observed: obs.observed || '',
                remark: obs.remark || ''
              }));
              while (detailObservations.length < 15) {
                detailObservations.push({ time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' });
              }

              const res = selectedBatchDetails.results || {};

              return (
                <div className="animated-fade" style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  paddingRight: '5px'
                }}>
                  
                  {/* Detail Header bar */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '16px 24px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Lightbulb size={24} color="#334155" />
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Batch sheet: {selectedBatchDetails.form?.batch_no || 'N/A'}</h4>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Product database context: {productName}</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => handleExportPDF(selectedBatchDetails)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '36px',
                          padding: '0 14px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: '#334155',
                          color: '#ffffff',
                          border: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#334155'}
                      >
                        <FileText size={14} /> Print PDF
                      </button>
                      <button 
                        onClick={() => handleExportExcel(selectedBatchDetails)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '36px',
                          padding: '0 14px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: '#475569',
                          color: '#ffffff',
                          border: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#334155'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#475569'}
                      >
                        <FileSpreadsheet size={14} /> Export Excel
                      </button>
                    </div>
                  </div>

                  {/* Side-by-side Grid layout */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.05fr 0.95fr',
                    gap: '24px',
                    minWidth: '1280px',
                    boxSizing: 'border-box'
                  }}>

                    {/* LEFT SHEET: R & D Batch Sheet */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #334155',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      color: '#000000',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                    }}>
                      {/* Header Title */}
                      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b', margin: 0 }}>R & D Batch Sheet</h2>
                        <div style={{ height: '2px', backgroundColor: '#334155', margin: '4px auto 0 auto', width: '140px' }}></div>
                      </div>

                      {/* Top metadata grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '8px', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Date:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', borderBottom: '1px dotted #334155', padding: '0 4px', flex: 1, textAlign: 'center' }}>{selectedBatchDetails.form?.date || ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Batch:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px dotted #334155', padding: '0 4px', flex: 1 }}>{selectedBatchDetails.form?.batch_no || ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>LB No:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px dotted #334155', padding: '0 4px', flex: 1 }}>{selectedBatchDetails.form?.lb_no || ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Mo. No:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px dotted #334155', padding: '0 4px', flex: 1 }}>{selectedBatchDetails.form?.mo_no || ''}</span>
                        </div>
                      </div>

                      {/* Aim Box */}
                      <div style={{ display: 'flex', gap: '6px', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', minWidth: '40px' }}>Aim :</span>
                        <div style={{ fontSize: '0.75rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>{selectedBatchDetails.form?.aim || 'N/A'}</div>
                      </div>

                      {/* Raw Materials Table */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#475569', color: '#ffffff', padding: '4px', border: '1px solid #334155', borderBottom: 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>RAW MATERIALS FORMULA</div>
                        <div style={{ overflowX: 'auto', border: '1px solid #334155' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #334155' }}>
                                <th style={{ width: '40px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center' }}>Sr. No.</th>
                                <th style={{ padding: '4px', borderRight: '1px solid #334155' }}>Raw Material</th>
                                <th style={{ width: '80px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center' }}>Parts by Wt</th>
                                <th style={{ width: '80px', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center' }}>RM %</th>
                                <th style={{ padding: '4px' }}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailRawMaterials.map((rm, idx) => (
                                <tr key={idx} style={{ borderBottom: idx === 14 ? 'none' : '1px solid #cbd5e1', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  <td style={{ padding: '2px', borderRight: '1px solid #334155', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                                  <td style={{ padding: '2px 6px', borderRight: '1px solid #334155', color: '#1e293b' }}>{rm.raw_material || ''}</td>
                                  <td style={{ padding: '2px', borderRight: '1px solid #334155', textAlign: 'center', color: '#1e293b' }}>{rm.parts_by_weight || ''}</td>
                                  <td style={{ padding: '2px', borderRight: '1px solid #334155', textAlign: 'center', color: '#1e293b' }}>{rm.raw_material_pct || ''}</td>
                                  <td style={{ padding: '2px 6px', color: '#1e293b' }}>{rm.remarks || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Batch Result Table */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#475569', color: '#ffffff', padding: '4px', border: '1px solid #334155', borderBottom: 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>BATCH RESULT</div>
                        <div style={{ border: '1px solid #334155' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #334155' }}>
                                <th style={{ width: '30%', padding: '4px', borderRight: '1px solid #334155' }}>Parameter</th>
                                <th style={{ width: '20%', padding: '4px', borderRight: '1px solid #334155', textAlign: 'center' }}>Value</th>
                                <th style={{ width: '30%', padding: '4px', borderRight: '1px solid #334155' }}>Parameter</th>
                                <th style={{ width: '20%', padding: '4px', textAlign: 'center' }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { p1: 'K Value', val1: res.k_value, p2: 'Functionality', val2: res.functionality },
                                { p1: 'Hydroxyl Value (mg KOH/g)', val1: res.hydroxyl_value, p2: 'Theoretical Value', val2: res.theoretical_value },
                                { p1: '% NCO', val1: res.nco_pct, p2: 'Desired Specifications', val2: res.desired_specifications },
                                { p1: '% Solid', val1: res.solid_pct || res.solid_content, p2: 'Water @ Specific Acid Value', val2: res.water_spec_acid },
                                { p1: '% Acid Value', val1: res.acid_value, p2: 'Clarity', val2: res.clarity },
                                { p1: 'EEW (g/eq)', val1: res.eew, p2: 'Water of Reaction (g)', val2: res.water_of_reaction },
                                { p1: 'Viscosity @ 25°C (mPa.s)', val1: res.viscosity, p2: 'Mol / Wt (g/mol)', val2: res.mol_wt },
                                { p1: 'GT Tube Viscosity @ 25°C', val1: res.gt_tube_viscosity, p2: 'Color (Gardner)', val2: res.color_gardner || res.colour },
                                { p1: 'Input Quantity :', val1: res.input_qty, p2: 'Output Quantity :', val2: res.output_qty || res.output_expected },
                              ].map((row, idx) => {
                                const savedTheo = selectedBatchDetails.theoretical_values || {};
                                const hasCustom = Object.keys(savedTheo).some(k => {
                                  const nk = k.toLowerCase().replace(/%/g, '').replace(/ /g, '_');
                                  const standards = ['k_value', 'hydroxyl_value', 'nco_pct', 'solid_pct', 'solid_content', 'acid_value', 'eew', 'viscosity', 'gt_tube_viscosity', 'input_qty', 'functionality', 'theoretical_value', 'desired_specifications', 'water_spec_acid', 'clarity', 'water_of_reaction', 'mol_wt', 'color_gardner', 'colour', 'output_qty', 'output_expected'];
                                  return !standards.includes(nk);
                                });
                                return (
                                  <tr key={idx} style={{ borderBottom: (idx === 8 && !hasCustom) ? 'none' : '1px solid #cbd5e1', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', fontSize: '0.7rem' }}>{row.p1}</td>
                                    <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'center', color: '#1e293b' }}>{String(row.val1 || '')}</td>
                                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', fontSize: '0.7rem' }}>{row.p2}</td>
                                    <td style={{ padding: '4px', textAlign: 'center', color: '#1e293b' }}>{String(row.val2 || '')}</td>
                                  </tr>
                                );
                              })}
                              {(() => {
                                const savedTheo = selectedBatchDetails.theoretical_values || {};
                                const standardKeys = [
                                  'k_value', 'hydroxyl_value', 'nco_pct', 'solid_pct', 'solid_content', 'acid_value', 'eew', 'viscosity', 'gt_tube_viscosity', 'input_qty',
                                  'functionality', 'theoretical_value', 'desired_specifications', 'water_spec_acid', 'clarity', 'water_of_reaction', 'mol_wt', 'color_gardner', 'colour', 'output_qty', 'output_expected'
                                ];
                                const customParams: { key: string; value: string }[] = [];
                                Object.entries(savedTheo).forEach(([k, v]) => {
                                  const normalizedKey = k.toLowerCase().replace(/%/g, '').replace(/ /g, '_');
                                  const isStandard = standardKeys.some(sk => sk.toLowerCase() === normalizedKey);
                                  if (!isStandard) {
                                    customParams.push({ key: k, value: String(v) });
                                  }
                                });
                                
                                const pairs: { key1: string; val1: string; key2?: string; val2?: string }[] = [];
                                for (let i = 0; i < customParams.length; i += 2) {
                                  pairs.push({
                                    key1: customParams[i].key,
                                    val1: customParams[i].value,
                                    key2: customParams[i + 1]?.key,
                                    val2: customParams[i + 1]?.value,
                                  });
                                }
                                
                                return pairs.map((pair, pIdx) => (
                                  <tr key={`past-custom-${pIdx}`} style={{ borderBottom: pIdx === pairs.length - 1 ? 'none' : '1px solid #cbd5e1', backgroundColor: pIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', fontSize: '0.7rem' }}>{pair.key1}</td>
                                    <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'center', color: '#1e293b' }}>{pair.val1}</td>
                                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155', fontSize: '0.7rem' }}>{pair.key2 || ''}</td>
                                    <td style={{ padding: '4px', textAlign: 'center', color: '#1e293b' }}>{pair.val2 || ''}</td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Signatures footer */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>Prepared by:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #94a3b8', padding: '2px 0', textAlign: 'center' }}>{selectedBatchDetails.form?.prepared_by || ''}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>QC Checked by:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #94a3b8', padding: '2px 0', textAlign: 'center' }}>{selectedBatchDetails.form?.checked_by || ''}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>Production Manager:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #94a3b8', padding: '2px 0', textAlign: 'center' }}>{selectedBatchDetails.form?.production_manager || ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT SHEET: Process Observation Sheet */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #334155',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      color: '#000000',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                    }}>
                      {/* Header Title */}
                      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b', margin: 0 }}>Process Observation Sheet</h2>
                        <div style={{ height: '2px', backgroundColor: '#334155', margin: '4px auto 0 auto', width: '180px' }}></div>
                      </div>

                      {/* Batchsheet No and Table */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', backgroundColor: '#f8fafc', width: 'max-content' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Batchsheet No:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px dotted #334155', padding: '0 4px' }}>{selectedBatchDetails.batchsheet_no || ''}</span>
                        </div>

                        <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#e2e8f0', color: '#1e293b', borderBottom: '2px solid #334155' }}>
                                <th style={{ padding: '6px 8px', width: '60px', borderRight: '1px solid #334155', textAlign: 'center' }}>Time</th>
                                <th style={{ padding: '6px 8px', width: '70px', borderRight: '1px solid #334155', textAlign: 'center' }}>Temp of V.T.</th>
                                <th style={{ padding: '6px 8px', width: '70px', borderRight: '1px solid #334155', textAlign: 'center' }}>Temp of F.T.</th>
                                <th style={{ padding: '6px 8px', width: '50px', borderRight: '1px solid #334155', textAlign: 'center' }}>H₂O</th>
                                <th style={{ padding: '6px 8px', width: '130px', borderRight: '1px solid #334155' }}>AV / AM.V / Nc.V / EEW</th>
                                <th style={{ padding: '6px 8px' }}>Observations & Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailObservations.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: idx === 14 ? 'none' : '1px solid #cbd5e1', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  <td style={{ padding: '4px 6px', borderRight: '1px solid #334155', textAlign: 'center' }}>{row.time || ''}</td>
                                  <td style={{ padding: '4px 6px', borderRight: '1px solid #334155', textAlign: 'center' }}>{row.vt || ''}</td>
                                  <td style={{ padding: '4px 6px', borderRight: '1px solid #334155', textAlign: 'center' }}>{row.ft || ''}</td>
                                  <td style={{ padding: '4px 6px', borderRight: '1px solid #334155', textAlign: 'center' }}>{row.charge_obs || ''}</td>
                                  <td style={{ padding: '4px 6px', borderRight: '1px solid #334155' }}>{row.observed || ''}</td>
                                  <td style={{ padding: '4px 6px' }}>{row.remark || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Quantities 100% */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>Input Qty 100%:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #cbd5e1', padding: '2px 0', flex: 1 }}>{selectedBatchDetails.form?.input_qty_100 || ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>Output Qty 100%:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #cbd5e1', padding: '2px 0', flex: 1 }}>{selectedBatchDetails.form?.output_qty_100 || ''}</span>
                        </div>
                      </div>

                      {/* Notes / Remarks */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', minHeight: '80px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>Notes / Remarks :</span>
                        <div style={{ fontSize: '0.75rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>{selectedBatchDetails.form?.notes_remarks || 'N/A'}</div>
                      </div>

                    </div>

                  </div>

                </div>
              );
            })()}
          </div>

        </div>
      )}

    </div>
  );
};
