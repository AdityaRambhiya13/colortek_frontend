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
  output_expected: string;
  liberated_quantity: string;
  final_value: string;
  viscosity: string;
  colour: string;
  theoretical_80: string;
  practical_80: string;
  solid_content: string;
  conclusion: string;
}

interface TheoreticalRow {
  key: string;
  value: string;
}

interface ObservationRowProps {
  row: RDObservationRow;
  idx: number;
  onChange: (rowIdx: number, field: keyof RDObservationRow, val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => void;
  obsRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

const ObservationRow = React.memo<ObservationRowProps>(({ row, idx, onChange, onKeyDown, obsRefs }) => {
  return (
    <tr style={{ 
      borderBottom: '1px solid #94a3b8', 
      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' 
    }}>
      {/* Time */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-0`] = el; }}
          value={row.time}
          onChange={e => onChange(idx, 'time', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 0)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '0.8rem',
            border: '1px solid transparent',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: '#1e293b'
          }}
        />
      </td>

      {/* VT / FT */}
      <td style={{ padding: '4px 4px', borderRight: '1px solid #94a3b8' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          <input 
            type="text"
            ref={el => { obsRefs.current[`obs-${idx}-1`] = el; }}
            value={row.vt}
            onChange={e => onChange(idx, 'vt', e.target.value)}
            onKeyDown={e => onKeyDown(e, idx, 1)}
            style={{
              width: '50%',
              padding: '4px 4px',
              textAlign: 'center',
              fontSize: '0.8rem',
              border: '1px solid transparent',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: '#1e293b'
            }}
          />
          <div style={{ width: '1px', backgroundColor: '#94a3b8' }}></div>
          <input 
            type="text"
            ref={el => { obsRefs.current[`obs-${idx}-2`] = el; }}
            value={row.ft}
            onChange={e => onChange(idx, 'ft', e.target.value)}
            onKeyDown={e => onKeyDown(e, idx, 2)}
            style={{
              width: '50%',
              padding: '4px 4px',
              textAlign: 'center',
              fontSize: '0.8rem',
              border: '1px solid transparent',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: '#1e293b'
            }}
          />
        </div>
      </td>

      {/* Charge & Obs */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-3`] = el; }}
          value={row.charge_obs}
          onChange={e => onChange(idx, 'charge_obs', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 3)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '0.8rem',
            border: '1px solid transparent',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: '#1e293b'
          }}
        />
      </td>

      {/* Observed Value */}
      <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-4`] = el; }}
          value={row.observed}
          onChange={e => onChange(idx, 'observed', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 4)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '0.8rem',
            border: '1px solid transparent',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: '#1e293b'
          }}
        />
      </td>

      {/* Remark/Observation */}
      <td style={{ padding: '4px 6px' }}>
        <input 
          type="text"
          ref={el => { obsRefs.current[`obs-${idx}-5`] = el; }}
          value={row.remark}
          onChange={e => onChange(idx, 'remark', e.target.value)}
          onKeyDown={e => onKeyDown(e, idx, 5)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '0.8rem',
            border: '1px solid transparent',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: '#1e293b'
          }}
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
    checked_by: ''
  });

  const [form, setForm] = useState<RDFormData>(initialForm());

  // Raw Materials List (Starts with 10 rows)
  const [rawMaterials, setRawMaterials] = useState<string[]>(Array(10).fill(''));
  
  // Theoretical Values (Initial key-value list with 10 elements)
  const initialTheoretical = (): TheoreticalRow[] => {
    const keys = ["Molecular Weight", "Hydroxyl", "Functionality", "Acid value", "Amine value", "Epoxy Value"];
    const rows: TheoreticalRow[] = keys.map(k => ({ key: k, value: '' }));
    while (rows.length < 10) {
      rows.push({ key: '', value: '' });
    }
    return rows;
  };
  const [theoreticalValues, setTheoreticalValues] = useState<TheoreticalRow[]>(initialTheoretical());

  // Procedure steps (Starts with 10 rows)
  const [procedures, setProcedures] = useState<string[]>(Array(10).fill(''));

  // Observation matrix (12 pre-allocated rows)
  const initialObservations = (): RDObservationRow[] =>
    Array.from({ length: 12 }, () => ({ time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' }));
  const [observations, setObservations] = useState<RDObservationRow[]>(initialObservations());

  // Results & Conclusions
  const initialResults = (): RDResults => ({
    output_expected: '',
    liberated_quantity: '',
    final_value: '',
    viscosity: '',
    colour: '',
    theoretical_80: '',
    practical_80: '',
    solid_content: '',
    conclusion: ''
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
    setRawMaterials(prev => [...prev, '']);
  };

  const addTheoreticalRow = () => {
    setTheoreticalValues(prev => [...prev, { key: '', value: '' }]);
  };

  const addProcedureRow = () => {
    setProcedures(prev => [...prev, '']);
  };

  // Input Change Handlers
  const handleFormChange = (field: keyof RDFormData, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleRawChange = (idx: number, val: string) => {
    const copy = [...rawMaterials];
    copy[idx] = val;
    setRawMaterials(copy);
  };

  const handleTheoreticalChange = (idx: number, type: 'key' | 'value', val: string) => {
    const copy = [...theoreticalValues];
    copy[idx][type] = val;
    setTheoreticalValues(copy);
  };

  const handleProcedureChange = (idx: number, val: string) => {
    const copy = [...procedures];
    copy[idx] = val;
    setProcedures(copy);
  };

  const handleObservationChange = (rowIdx: number, field: keyof RDObservationRow, val: string) => {
    const copy = [...observations];
    copy[rowIdx][field] = val;
    setObservations(copy);
  };

  const handleResultChange = (field: keyof RDResults, val: string) => {
    setResults(prev => ({ ...prev, [field]: val }));
  };

  const clearAllFields = () => {
    if (window.confirm("Are you sure you want to clear all fields? Unsaved changes will be lost.")) {
      setForm(initialForm());
      setRawMaterials(Array(10).fill(''));
      setTheoreticalValues(initialTheoretical());
      setProcedures(Array(10).fill(''));
      setObservations(initialObservations());
      setResults(initialResults());
      setBatchsheetNo('');
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
    // Build Theoretical Values Dictionary mapping non-empty keys to values
    const theoDict: Record<string, string> = {};
    theoreticalValues.forEach(row => {
      if (row.key.trim() && row.value.trim()) {
        theoDict[row.key.trim()] = row.value.trim();
      }
    });

    const payload = {
      form: {
        ...form,
        batch_no: form.batch_no.trim()
      },
      raw_materials: rawMaterials.filter(x => x.trim()),
      theoretical_values: theoDict,
      procedure: procedures.filter(x => x.trim()),
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
      raw_materials: rawMaterials.filter(x => x.trim()),
      theoretical_values: theoreticalValues.reduce((acc: any, curr) => {
        if (curr.key.trim() && curr.value.trim()) acc[curr.key.trim()] = curr.value.trim();
        return acc;
      }, {}),
      procedure: procedures.filter(x => x.trim()),
      observations: observations,
      results: results,
      batchsheet_no: batchsheetNo
    };

    const activeBatchNo = d.form?.batch_no || 'RD_Report';
    const wb = XLSX.utils.book_new();
    const wsRows: any[] = [];

    // Title Row
    wsRows.push(["R&D REPORT", "", "", "", "", "", ""]);
    wsRows.push(["Date:", d.form?.date || '', "", "Batch No.:", d.form?.batch_no || '', "", ""]);
    wsRows.push(["Aim:", d.form?.aim || '', "", "", "", "", ""]);
    wsRows.push([]);

    // Split raw materials and theoretical values
    wsRows.push(["Raw Materials", "", "", "Theoretical Values", "", "", ""]);
    
    const rawList = d.raw_materials || [];
    const theoItems = Object.entries(d.theoretical_values || {});
    const maxLen = Math.max(rawList.length, theoItems.length, 10);

    for (let i = 0; i < maxLen; i++) {
      const rm = rawList[i] || '';
      const theo = theoItems[i] ? `${theoItems[i][0]}: ${theoItems[i][1]}` : '';
      wsRows.push([`${i+1}) ${rm}`, "", "", theo, "", "", ""]);
    }
    wsRows.push([]);

    // Quantities
    wsRows.push(["Input Quantity:", d.form?.input_qty || '', "", "Output Quantity:", d.form?.output_qty || '', "", ""]);
    wsRows.push([]);

    // Procedure
    wsRows.push(["Procedure:", "", "", "", "", "", ""]);
    const procList = d.procedure || [];
    procList.forEach((step: string, idx: number) => {
      wsRows.push([`${idx+1}) ${step}`, "", "", "", "", "", ""]);
    });
    wsRows.push([]);

    // Observations
    wsRows.push(["Observations Matrix:", "", "", "", "", "", ""]);
    wsRows.push(["Time", "V.T. Temp", "F.T. Temp", "Charge & Obs", "Observed Value", "Remark/Observation", ""]);
    
    const obsList = d.observations || [];
    obsList.forEach((obs: any) => {
      wsRows.push([
        obs.time || '',
        obs.vt || '',
        obs.ft || '',
        obs.charge_obs || '',
        obs.observed || '',
        obs.remark || '',
        ''
      ]);
    });
    wsRows.push([]);

    // Batch Results
    wsRows.push(["Batch Results", "", "", "", "", "", ""]);
    const res = d.results || {};
    wsRows.push(["Output (Expected):", res.output_expected || '']);
    wsRows.push(["Liberated Quantity:", res.liberated_quantity || '']);
    wsRows.push(["Final Value:", res.final_value || '']);
    wsRows.push(["Viscosity @ 25°C:", res.viscosity || '']);
    wsRows.push(["Colour:", res.colour || '']);
    wsRows.push(["80% H2O Theoretical:", res.theoretical_80 || '']);
    wsRows.push(["80% H2O Practical:", res.practical_80 || '']);
    wsRows.push(["Solid Content:", res.solid_content || '']);
    wsRows.push(["Conclusion:", res.conclusion || '']);
    wsRows.push([]);

    // Signatures
    wsRows.push(["Prepared By:", d.form?.prepared_by || '', "", "Checked By:", d.form?.checked_by || '', "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(wsRows);

    // Apply Merges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title
      { s: { r: 2, c: 1 }, e: { r: 2, c: 6 } }, // Aim
      { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } }, // RM header
      { s: { r: 4, c: 3 }, e: { r: 4, c: 6 } }, // Theo header
    ];

    // Auto fit column widths
    ws['!cols'] = [
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
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
      raw_materials: rawMaterials.filter(x => x.trim()),
      theoretical_values: theoreticalValues.reduce((acc: any, curr) => {
        if (curr.key.trim() && curr.value.trim()) acc[curr.key.trim()] = curr.value.trim();
        return acc;
      }, {}),
      procedure: procedures.filter(x => x.trim()),
      observations: observations,
      results: results,
      batchsheet_no: batchsheetNo
    };

    const activeBatchNo = d.form?.batch_no || 'RD_Report';
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Page 1
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("R&D BATCH SHEET", 15, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Date & Batch No Top right block
    doc.text("Date :", 130, 16);
    doc.text(d.form?.date || '', 160, 16);
    doc.line(160, 18, 195, 18);

    doc.text("Batch No. :", 130, 24);
    doc.text(d.form?.batch_no || '', 160, 24);
    doc.line(160, 26, 195, 26);

    // Aim Block
    doc.setFont("helvetica", "bold");
    doc.text("Aim :", 15, 34);
    doc.setFont("helvetica", "normal");
    const splitAim = doc.splitTextToSize(d.form?.aim || 'None', 170);
    doc.rect(15, 36, 180, 18);
    doc.text(splitAim, 18, 41);

    // Split Raw Materials and Theoretical Value Titles
    doc.setFont("helvetica", "bold");
    doc.text("Raw Materials :", 15, 61);
    doc.text("Theoretical Value :", 105, 61);
    doc.setFont("helvetica", "normal");

    // Grid details
    const rawList = d.raw_materials || [];
    const theoItems = Object.entries(d.theoretical_values || {});
    const printRows = Math.max(10, rawList.length, theoItems.length);
    
    let currentY = 66;
    for (let i = 0; i < printRows; i++) {
      const rmVal = rawList[i] || '';
      doc.text(`${i+1})`, 15, currentY);
      doc.line(21, currentY + 1, 95, currentY + 1);
      doc.text(rmVal, 22, currentY);

      if (i < theoItems.length) {
        const [k, v] = theoItems[i];
        doc.text(`${k} :`, 105, currentY);
        doc.line(155, currentY + 1, 195, currentY + 1);
        doc.text(String(v), 156, currentY);
      } else {
        doc.line(105, currentY + 1, 195, currentY + 1);
      }
      currentY += 8;
    }

    currentY += 4;
    // Input / Output Quantities
    doc.setFont("helvetica", "bold");
    doc.text("Input Quantity :", 15, currentY);
    doc.setFont("helvetica", "normal");
    doc.line(45, currentY + 1, 95, currentY + 1);
    doc.text(d.form?.input_qty || '', 47, currentY);

    doc.setFont("helvetica", "bold");
    doc.text("Output Quantity :", 108, currentY);
    doc.setFont("helvetica", "normal");
    doc.line(142, currentY + 1, 195, currentY + 1);
    doc.text(d.form?.output_qty || '', 144, currentY);

    currentY += 10;
    // Procedure Steps
    doc.setFont("helvetica", "bold");
    doc.text("Procedure :", 15, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 5;

    const procList = d.procedure || [];
    const printProcRows = Math.max(10, procList.length);
    for (let i = 0; i < printProcRows; i++) {
      const procVal = procList[i] || '';
      doc.text(`${i+1})`, 15, currentY);
      doc.line(21, currentY + 1, 195, currentY + 1);
      doc.text(procVal, 22, currentY);
      currentY += 8;
    }

    // Page 2 - Observations & Results
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Batchsheet No :  ${d.batchsheet_no || 'N/A'}`, 15, 15);

    // Render Observations Table using autoTable
    const tableHeaders = [
      ["Time", "V.T.", "F.T.", "Charge & Obs.", "Observed Value", "Remark/Observation"]
    ];
    const obsList = d.observations || [];
    const tableRows = obsList.map((obs: any) => [
      obs.time || '',
      obs.vt || '',
      obs.ft || '',
      obs.charge_obs || '',
      obs.observed || '',
      obs.remark || ''
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 20,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [148, 163, 184], lineWidth: 0.2, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [148, 163, 184] }
    });

    let resultsY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Batch Results", 15, resultsY);
    resultsY += 5;

    doc.setFontSize(10);
    const resFields = [
      ["Output (Expected)", d.results?.output_expected || ''],
      ["Liberated Quantity", d.results?.liberated_quantity || ''],
      ["Final Value", d.results?.final_value || ''],
      ["Viscosity @ 25°C", d.results?.viscosity || ''],
      ["Colour", d.results?.colour || ''],
      ["80% H2O Theoretical", d.results?.theoretical_80 || ''],
      ["80% H2O Practical", d.results?.practical_80 || ''],
      ["Solid Content", d.results?.solid_content || '']
    ];

    resFields.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label} :`, 15, resultsY);
      doc.setFont("helvetica", "normal");
      doc.line(65, resultsY + 1, 195, resultsY + 1);
      doc.text(String(value), 66, resultsY);
      resultsY += 8;
    });

    resultsY += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Conclusion :", 15, resultsY);
    resultsY += 5;
    
    const splitConclusion = doc.splitTextToSize(d.results?.conclusion || 'None', 180);
    doc.setFont("helvetica", "normal");
    doc.rect(15, resultsY, 180, 24);
    doc.text(splitConclusion, 18, resultsY + 5);

    resultsY += 34;
    // Signatures
    doc.setFont("helvetica", "bold");
    doc.text("Prepared By :", 15, resultsY);
    doc.setFont("helvetica", "normal");
    doc.line(40, resultsY + 1, 95, resultsY + 1);
    doc.text(d.form?.prepared_by || '', 42, resultsY);

    doc.setFont("helvetica", "bold");
    doc.text("Checked By :", 108, resultsY);
    doc.setFont("helvetica", "normal");
    doc.line(132, resultsY + 1, 195, resultsY + 1);
    doc.text(d.form?.checked_by || '', 134, resultsY);

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
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date:</span>
                <input 
                  type="text" 
                  value={form.date} 
                  disabled 
                  style={{
                    width: '120px',
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                    border: '1px solid #94a3b8',
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Batch No.:</span>
                <input 
                  type="text" 
                  value={form.batch_no} 
                  onChange={e => handleFormChange('batch_no', e.target.value)}
                  style={{
                    width: '160px',
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    border: '1px solid #94a3b8',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b'
                  }}
                />
              </div>

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
            height: '100%',
            overflowY: 'auto',
            padding: '20px',
            paddingTop: '95px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>

            {/* Aim Section */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '10px' }}>
              <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content', margin: 0 }}>Aim:</h4>
              <textarea 
                rows={2}
                value={form.aim}
                onChange={e => handleFormChange('aim', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.85rem',
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  resize: 'none'
                }}
              />
            </div>

            {/* Split Materials & Theoretical Values Pane */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Raw Materials Column */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content' }}>Raw Materials List</h4>
                  <button 
                    onClick={addRawMaterialRow}
                    className="btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary-color)',
                      border: '1px solid var(--primary-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                  {rawMaterials.map((rm, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '30px', fontWeight: 600 }}>{idx + 1})</span>
                      <input 
                        type="text"
                        id={`rm-${idx}`}
                        value={rm}
                        onChange={e => handleRawChange(idx, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextInput = document.getElementById(`rm-${idx + 1}`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          border: '1px solid #94a3b8',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          color: '#1e293b'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Theoretical Values Column */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content' }}>Theoretical Values Matrix</h4>
                  <button 
                    onClick={addTheoreticalRow}
                    className="btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary-color)',
                      border: '1px solid var(--primary-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={12} /> Add Custom
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                  {theoreticalValues.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="text"
                        value={row.key}
                        onChange={e => handleTheoreticalChange(idx, 'key', e.target.value)}
                        style={{
                          width: '180px',
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          border: '1px solid #94a3b8',
                          borderRadius: '6px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569'
                        }}
                      />
                      <input 
                        type="text"
                        id={`theo-val-${idx}`}
                        value={row.value}
                        onChange={e => handleTheoreticalChange(idx, 'value', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextInput = document.getElementById(`theo-val-${idx + 1}`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          border: '1px solid #94a3b8',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          color: '#1e293b'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Quantities Card */}
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-around', gap: '20px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Input Quantity:</span>
                <input 
                  type="text"
                  value={form.input_qty}
                  onChange={e => handleFormChange('input_qty', e.target.value)}
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    border: '1px solid #94a3b8',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Output Quantity:</span>
                <input 
                  type="text"
                  value={form.output_qty}
                  onChange={e => handleFormChange('output_qty', e.target.value)}
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    border: '1px solid #94a3b8',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b'
                  }}
                />
              </div>
            </div>

            {/* Procedure Steps Section */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content' }}>Reaction/Compounding Procedure</h4>
                <button 
                  onClick={addProcedureRow}
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary-color)',
                    border: '1px solid var(--primary-color)',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={12} /> Add Step
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                {procedures.map((proc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '30px', fontWeight: 600 }}>{idx + 1})</span>
                    <input 
                      type="text"
                      id={`proc-${idx}`}
                      value={proc}
                      onChange={e => handleProcedureChange(idx, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const nextInput = document.getElementById(`proc-${idx + 1}`) as HTMLInputElement;
                          if (nextInput) nextInput.focus();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        border: '1px solid #94a3b8',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        color: '#1e293b'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Observations Grid */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content', margin: 0 }}>R&D Observations Log</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Batchsheet No.:</span>
                  <input 
                    type="text" 
                    value={batchsheetNo}
                    onChange={e => setBatchsheetNo(e.target.value)}
                    style={{
                      width: '180px',
                      padding: '5px 10px',
                      fontSize: '0.8rem',
                      border: '1px solid #94a3b8',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#1e293b'
                    }}
                  />
                </div>
              </div>

              {/* Custom Grid Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #94a3b8', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e2e8f0', color: '#1e293b', borderBottom: '2px solid #94a3b8' }}>
                      <th style={{ padding: '10px 12px', width: '90px', borderRight: '1px solid #94a3b8' }}>Time</th>
                      <th style={{ padding: 0, width: '140px', borderRight: '1px solid #94a3b8' }}>
                        <div style={{ textAlign: 'center', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontWeight: 600 }}>Temp (°C)</div>
                        <div style={{ display: 'flex' }}>
                          <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', borderRight: '1px solid #94a3b8', fontWeight: 600 }}>V.T.</div>
                          <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>F.T.</div>
                        </div>
                      </th>
                      <th style={{ padding: '10px 12px', width: '220px', borderRight: '1px solid #94a3b8' }}>Charge & Obs.</th>
                      <th style={{ padding: '10px 12px', width: '220px', borderRight: '1px solid #94a3b8' }}>Observed Value</th>
                      <th style={{ padding: '10px 12px' }}>Remark/Observation</th>
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

            {/* Results & Conclusions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Batch Results Left Column */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', borderRadius: '8px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content' }}>Batch Results</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Output (Expected):</span>
                    <input 
                      type="text"
                      value={results.output_expected}
                      onChange={e => handleResultChange('output_expected', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Liberated Quantity:</span>
                    <input 
                      type="text"
                      value={results.liberated_quantity}
                      onChange={e => handleResultChange('liberated_quantity', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Final Value:</span>
                    <input 
                      type="text"
                      value={results.final_value}
                      onChange={e => handleResultChange('final_value', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Viscosity @ 25°C:</span>
                    <input 
                      type="text"
                      value={results.viscosity}
                      onChange={e => handleResultChange('viscosity', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Colour:</span>
                    <input 
                      type="text"
                      value={results.colour}
                      onChange={e => handleResultChange('colour', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px' }}>Solid Content:</span>
                    <input 
                      type="text"
                      value={results.solid_content}
                      onChange={e => handleResultChange('solid_content', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ margin: '10px 0 5px 0', borderTop: '1px solid #94a3b8', paddingTop: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-color)' }}>80% H2O Recover:</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', paddingLeft: '12px' }}>Theoretical:</span>
                    <input 
                      type="text"
                      value={results.theoretical_80}
                      onChange={e => handleResultChange('theoretical_80', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', paddingLeft: '12px' }}>Practical:</span>
                    <input 
                      type="text"
                      value={results.practical_80}
                      onChange={e => handleResultChange('practical_80', e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                    />
                  </div>

                </div>
              </div>

              {/* Conclusions & Signatures Right Column */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '8px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '6px', width: 'max-content' }}>Conclusions & Signatures</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Conclusion Narrative:</span>
                  <textarea 
                    rows={8}
                    value={results.conclusion}
                    onChange={e => handleResultChange('conclusion', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '0.85rem',
                      border: '1px solid #94a3b8',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#1e293b',
                      resize: 'none',
                      flex: 1
                    }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '110px' }}>Prepared By:</span>
                      <input 
                        type="text"
                        value={form.prepared_by}
                        onChange={e => handleFormChange('prepared_by', e.target.value)}
                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '110px' }}>Checked By:</span>
                      <input 
                        type="text"
                        value={form.checked_by}
                        onChange={e => handleFormChange('checked_by', e.target.value)}
                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b' }}
                      />
                    </div>
                  </div>

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
              const detailRawMaterials = [...(selectedBatchDetails.raw_materials || [])];
              while (detailRawMaterials.length < 10) {
                detailRawMaterials.push('');
              }

              const detailProcedures = [...(selectedBatchDetails.procedure || [])];
              while (detailProcedures.length < 10) {
                detailProcedures.push('');
              }

              const detailObservations = [...(selectedBatchDetails.observations || [])];
              while (detailObservations.length < 12) {
                detailObservations.push({ time: '', vt: '', ft: '', charge_obs: '', observed: '', remark: '' });
              }

              const savedTheo = selectedBatchDetails.theoretical_values || {};
              const standardKeys = ["Molecular Weight", "Hydroxyl", "Functionality", "Acid value", "Amine value", "Epoxy Value"];
              const detailTheoreticalRows: { key: string; value: string }[] = [];
              
              // First, populate standard keys
              standardKeys.forEach(k => {
                detailTheoreticalRows.push({ key: k, value: savedTheo[k] || '' });
              });
              
              // Then, populate any other custom keys that were saved and aren't in standard keys
              Object.entries(savedTheo).forEach(([k, v]) => {
                if (!standardKeys.includes(k)) {
                  detailTheoreticalRows.push({ key: k, value: String(v) });
                }
              });
              
              // Pad to at least 10 rows
              while (detailTheoreticalRows.length < 10) {
                detailTheoreticalRows.push({ key: '', value: '' });
              }

              return (
                <div className="animated-fade" style={{
                  flex: 1,
                  overflowY: 'auto',
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
                    padding: '25px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #94a3b8'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Lightbulb size={28} color="#334155" />
                      <div>
                        <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>R&D BATCH SHEET</h2>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Product database context: {productName}</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 500, width: '100px', color: '#334155' }}>Date:</span>
                        <input 
                          type="text" 
                          ref={el => { detailRefs.current['past-date'] = el; }}
                          value={selectedBatchDetails.form?.date || ''} 
                          readOnly 
                          onKeyDown={e => handlePastDetailKeyDown(e, 'past-date')}
                          style={{
                            width: '150px',
                            height: '45px',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            color: '#334155',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 500, width: '100px', color: '#334155' }}>Batch No.:</span>
                        <input 
                          type="text" 
                          ref={el => { detailRefs.current['past-batch_no'] = el; }}
                          value={selectedBatchDetails.form?.batch_no || ''} 
                          readOnly 
                          onKeyDown={e => handlePastDetailKeyDown(e, 'past-batch_no')}
                          style={{
                            width: '150px',
                            height: '45px',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            color: '#334155',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                        <button 
                          onClick={() => handleExportPDF(selectedBatchDetails)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '40px',
                            padding: '0 16px',
                            fontSize: '0.85rem',
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
                            height: '40px',
                            padding: '0 16px',
                            fontSize: '0.85rem',
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
                  </div>

                  {/* Technical objective block */}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', margin: 0, color: '#1e293b' }}>Aim:</h4>
                    <textarea 
                      rows={2}
                      ref={el => { detailRefs.current['past-aim'] = el; }}
                      value={selectedBatchDetails.form?.aim || ''}
                      readOnly
                      onKeyDown={e => handlePastDetailKeyDown(e, 'past-aim')}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.85rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        color: '#334155',
                        resize: 'none',
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

                  {/* Split Materials & Theoretical Values Pane */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* Raw Materials Column */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', color: '#1e293b' }}>Raw Materials:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                        {detailRawMaterials.map((rm, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#475569', width: '30px', fontWeight: 600 }}>{idx + 1})</span>
                            <input 
                              type="text"
                              ref={el => { detailRefs.current[`past-rm-${idx}`] = el; }}
                              value={rm}
                              readOnly
                              onKeyDown={e => handlePastDetailKeyDown(e, `past-rm-${idx}`)}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
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
                        ))}
                      </div>
                    </div>

                    {/* Theoretical Values Column */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', color: '#1e293b' }}>Theoretical Value:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                        {detailTheoreticalRows.map((row, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="text"
                              ref={el => { detailRefs.current[`past-theo-key-${idx}`] = el; }}
                              value={row.key}
                              readOnly
                              onKeyDown={e => handlePastDetailKeyDown(e, `past-theo-key-${idx}`)}
                              style={{
                                width: '180px',
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
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
                            <input 
                              type="text"
                              ref={el => { detailRefs.current[`past-theo-val-${idx}`] = el; }}
                              value={row.value}
                              readOnly
                              onKeyDown={e => handlePastDetailKeyDown(e, `past-theo-val-${idx}`)}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
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
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Quantities Card */}
                  <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-around', gap: '20px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>Input Quantity:</span>
                      <input 
                        type="text"
                        ref={el => { detailRefs.current['past-input_qty'] = el; }}
                        value={selectedBatchDetails.form?.input_qty || ''}
                        readOnly
                        onKeyDown={e => handlePastDetailKeyDown(e, 'past-input_qty')}
                        style={{
                          width: '200px',
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>Output Quantity:</span>
                      <input 
                        type="text"
                        ref={el => { detailRefs.current['past-output_qty'] = el; }}
                        value={selectedBatchDetails.form?.output_qty || ''}
                        readOnly
                        onKeyDown={e => handlePastDetailKeyDown(e, 'past-output_qty')}
                        style={{
                          width: '200px',
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
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
                  </div>

                  {/* Procedure Steps Section */}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', margin: 0, color: '#1e293b' }}>Procedure:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                      {detailProcedures.map((proc, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#475569', width: '30px', fontWeight: 600 }}>{idx + 1})</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current[`past-proc-${idx}`] = el; }}
                            value={proc}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, `past-proc-${idx}`)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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
                      ))}
                    </div>
                  </div>

                  {/* Observations Grid */}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', margin: 0, color: '#1e293b' }}>Observations Matrix Logs</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Batchsheet No.:</span>
                        <input 
                          type="text" 
                          value={selectedBatchDetails.batchsheet_no || ''}
                          readOnly
                          style={{
                            width: '180px',
                            padding: '5px 10px',
                            fontSize: '0.8rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Custom Grid Table */}
                    <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{ padding: '10px 12px', width: '90px', borderRight: '1px solid #cbd5e1' }}>Time</th>
                            <th style={{ padding: 0, width: '140px', borderRight: '1px solid #cbd5e1' }}>
                              <div style={{ textAlign: 'center', padding: '6px 12px', borderBottom: '1px solid #cbd5e1', fontWeight: 600 }}>Temp (°C)</div>
                              <div style={{ display: 'flex' }}>
                                <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 600 }}>V.T.</div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>F.T.</div>
                              </div>
                            </th>
                            <th style={{ padding: '10px 12px', width: '220px', borderRight: '1px solid #cbd5e1' }}>Charge & Obs.</th>
                            <th style={{ padding: '10px 12px', width: '220px', borderRight: '1px solid #cbd5e1' }}>Observed Value</th>
                            <th style={{ padding: '10px 12px' }}>Remark/Observation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailObservations.map((row, idx) => (
                            <tr key={idx} style={{ 
                              borderBottom: '1px solid #cbd5e1', 
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' 
                            }}>
                              
                              {/* Time */}
                              <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                                <input 
                                  type="text"
                                  ref={el => { detailRefs.current[`past-obs-${idx}-0`] = el; }}
                                  value={row.time}
                                  readOnly
                                  onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-0`)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    border: '1px solid transparent',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    color: '#334155',
                                    outline: 'none'
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.outline = '2px solid #3b82f6';
                                    e.currentTarget.style.outlineOffset = '-2px';
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.outline = 'none';
                                  }}
                                />
                              </td>

                              {/* VT / FT */}
                              <td style={{ padding: '4px 4px', borderRight: '1px solid #cbd5e1' }}>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                  <input 
                                    type="text"
                                    ref={el => { detailRefs.current[`past-obs-${idx}-1`] = el; }}
                                    value={row.vt}
                                    readOnly
                                    onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-1`)}
                                    style={{
                                      width: '50%',
                                      padding: '4px 4px',
                                      textAlign: 'center',
                                      fontSize: '0.8rem',
                                      border: '1px solid transparent',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      color: '#334155',
                                      outline: 'none'
                                    }}
                                    onFocus={e => {
                                      e.currentTarget.style.outline = '2px solid #3b82f6';
                                      e.currentTarget.style.outlineOffset = '-2px';
                                    }}
                                    onBlur={e => {
                                      e.currentTarget.style.outline = 'none';
                                    }}
                                  />
                                  <div style={{ width: '1px', backgroundColor: '#cbd5e1' }}></div>
                                  <input 
                                    type="text"
                                    ref={el => { detailRefs.current[`past-obs-${idx}-2`] = el; }}
                                    value={row.ft}
                                    readOnly
                                    onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-2`)}
                                    style={{
                                      width: '50%',
                                      padding: '4px 4px',
                                      textAlign: 'center',
                                      fontSize: '0.8rem',
                                      border: '1px solid transparent',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      color: '#334155',
                                      outline: 'none'
                                    }}
                                    onFocus={e => {
                                      e.currentTarget.style.outline = '2px solid #3b82f6';
                                      e.currentTarget.style.outlineOffset = '-2px';
                                    }}
                                    onBlur={e => {
                                      e.currentTarget.style.outline = 'none';
                                    }}
                                  />
                                </div>
                              </td>

                              {/* Charge & Obs */}
                              <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                                <input 
                                  type="text"
                                  ref={el => { detailRefs.current[`past-obs-${idx}-3`] = el; }}
                                  value={row.charge_obs}
                                  readOnly
                                  onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-3`)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    border: '1px solid transparent',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    color: '#334155',
                                    outline: 'none'
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.outline = '2px solid #3b82f6';
                                    e.currentTarget.style.outlineOffset = '-2px';
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.outline = 'none';
                                  }}
                                />
                              </td>

                              {/* Observed Value */}
                              <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                                <input 
                                  type="text"
                                  ref={el => { detailRefs.current[`past-obs-${idx}-4`] = el; }}
                                  value={row.observed}
                                  readOnly
                                  onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-4`)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    border: '1px solid transparent',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    color: '#334155',
                                    outline: 'none'
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.outline = '2px solid #3b82f6';
                                    e.currentTarget.style.outlineOffset = '-2px';
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.outline = 'none';
                                  }}
                                />
                              </td>

                              {/* Remark/Observation */}
                              <td style={{ padding: '4px 6px' }}>
                                <input 
                                  type="text"
                                  ref={el => { detailRefs.current[`past-obs-${idx}-5`] = el; }}
                                  value={row.remark}
                                  readOnly
                                  onKeyDown={e => handlePastDetailKeyDown(e, `past-obs-${idx}-5`)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    border: '1px solid transparent',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    color: '#334155',
                                    outline: 'none'
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.outline = '2px solid #3b82f6';
                                    e.currentTarget.style.outlineOffset = '-2px';
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.outline = 'none';
                                  }}
                                />
                              </td>

                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Results & Conclusions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* Batch Results Left Column */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', color: '#1e293b' }}>Batch Results</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Output (Expected):</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-0'] = el; }}
                            value={selectedBatchDetails.results?.output_expected || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-0')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Liberated Quantity:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-1'] = el; }}
                            value={selectedBatchDetails.results?.liberated_quantity || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-1')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Final Value:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-2'] = el; }}
                            value={selectedBatchDetails.results?.final_value || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-2')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Viscosity @ 25°C:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-3'] = el; }}
                            value={selectedBatchDetails.results?.viscosity || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-3')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Colour:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-4'] = el; }}
                            value={selectedBatchDetails.results?.colour || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-4')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', color: '#334155' }}>Solid Content:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-5'] = el; }}
                            value={selectedBatchDetails.results?.solid_content || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-5')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ margin: '10px 0 5px 0', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>80% H2O Recover:</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', paddingLeft: '12px', color: '#334155' }}>Theoretical:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-6'] = el; }}
                            value={selectedBatchDetails.results?.theoretical_80 || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-6')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '160px', paddingLeft: '12px', color: '#334155' }}>Practical:</span>
                          <input 
                            type="text"
                            ref={el => { detailRefs.current['past-res-7'] = el; }}
                            value={selectedBatchDetails.results?.practical_80 || ''}
                            readOnly
                            onKeyDown={e => handlePastDetailKeyDown(e, 'past-res-7')}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
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

                      </div>
                    </div>

                    {/* Conclusions & Signatures Right Column */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '2px solid #64748b', paddingBottom: '6px', width: 'max-content', color: '#1e293b' }}>Conclusion:</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        <textarea 
                          rows={11}
                          ref={el => { detailRefs.current['past-conclusion'] = el; }}
                          value={selectedBatchDetails.results?.conclusion || ''}
                          readOnly
                          onKeyDown={e => handlePastDetailKeyDown(e, 'past-conclusion')}
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '0.85rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc',
                            color: '#334155',
                            resize: 'none',
                            outline: 'none',
                            flex: 1,
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '120px', color: '#334155' }}>Prepared By:</span>
                            <input 
                              type="text"
                              ref={el => { detailRefs.current['past-prepared_by'] = el; }}
                              value={selectedBatchDetails.form?.prepared_by || ''}
                              readOnly
                              onKeyDown={e => handlePastDetailKeyDown(e, 'past-prepared_by')}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '120px', color: '#334155' }}>Checked By:</span>
                            <input 
                              type="text"
                              ref={el => { detailRefs.current['past-checked_by'] = el; }}
                              value={selectedBatchDetails.form?.checked_by || ''}
                              readOnly
                              onKeyDown={e => handlePastDetailKeyDown(e, 'past-checked_by')}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
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
                        </div>

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
