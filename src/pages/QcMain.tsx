import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Beaker, Search, RefreshCw, FileText, CheckCircle2, 
  XCircle, AlertTriangle, Download, Plus, Trash2, Calendar, User, 
  Check, Printer, Info, Lock, Eye, PlusCircle
} from 'lucide-react';
import { 
  QCReportAPI, 
  RawMaterialAPI, 
  ProductionBatchAPI, 
  ObservationAPI, 
  W56RndAPI, 
  ProductionBatchEntryAPI, 
  LabReturnAPI, 
  LiveProductionAPI,
  NotificationsAPI
} from '../services/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const parseAndFormatDate = (dateStr: string): string => {
  if (!dateStr || !dateStr.trim()) {
    return new Date().toISOString().split('T')[0];
  }
  const cleanStr = dateStr.trim();
  
  // Try matching DD-MM-YYYY format (e.g., 24-06-2026 or 24/06/2026, optionally followed by time)
  const ddMmYyyyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const matchDmy = cleanStr.match(ddMmYyyyPattern);
  if (matchDmy) {
    const day = matchDmy[1].padStart(2, '0');
    const month = matchDmy[2].padStart(2, '0');
    const year = matchDmy[3];
    return `${year}-${month}-${day}`;
  }

  // Try matching YYYY-MM-DD format (e.g. 2026-06-24 or 2026/06/24, optionally followed by time)
  const yyyyMmDdPattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const matchYmd = cleanStr.match(yyyyMmDdPattern);
  if (matchYmd) {
    const year = matchYmd[1];
    const month = matchYmd[2].padStart(2, '0');
    const day = matchYmd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback: try JS Date parsing
  try {
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore and fallback
  }

  return new Date().toISOString().split('T')[0];
};

const parseAndFormatDateTimeDb = (dateStr: string): string => {
  const datePart = parseAndFormatDate(dateStr);
  return `${datePart} 00:00:00`;
};

// Sticky table header styles for double-row headers in QC
const qcHeaderRow1Style: React.CSSProperties = {
  position: 'sticky',
  top: '0px',
  zIndex: 12,
  backgroundColor: '#059669',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.75rem',
  padding: '8px 4px',
  border: '1px solid #047857',
  textAlign: 'center',
  verticalAlign: 'middle'
};

const qcHeaderRow2Style: React.CSSProperties = {
  position: 'sticky',
  top: '32px',
  zIndex: 12,
  backgroundColor: '#059669',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.75rem',
  padding: '4px',
  border: '1px solid #047857',
  textAlign: 'center',
  verticalAlign: 'middle'
};

interface QcMainProps {
  activeSubView: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const QcMain: React.FC<QcMainProps> = ({ activeSubView, onShowToast }) => {
  const productName = sessionStorage.getItem('product_name') || '';
  const username = sessionStorage.getItem('username') || '';

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  const debounceTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    setActiveTab('entry');
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, [activeSubView]);

  // General keyboard cell focus helper
  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    colKeys: string[],
    maxRows: number,
    prefix: string
  ) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === 'ArrowUp') {
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = Math.min(maxRows - 1, rowIndex + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      targetCol = Math.max(0, colIndex - 1);
    } else if (e.key === 'ArrowRight') {
      targetCol = Math.min(colKeys.length - 1, colIndex + 1);
    } else {
      return;
    }

    const id = `${prefix}-input-${targetRow}-${colKeys[targetCol]}`;
    const element = document.getElementById(id);
    if (element) {
      (element as HTMLInputElement).focus();
      (element as HTMLInputElement).select();
    }
  };

  // ==========================================================================
  // 1. QC LAB REPORT REPLICA (QC1 - qc1.py)
  // ==========================================================================
  const [qc1Params, setQc1Params] = useState<any[]>(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      s_no: String(i + 1),
      batch_no: '',
      date_time: '',
      viscosity: '',
      coverage: '',
      levelling_test: '',
      wetting_test: '',
      adhesion_test: '',
      mek_rub_test: '',
      hardness: '',
      recoating: '',
      abrasion: '',
      gloss_finish: '',
      matt_finish: '',
      product_name: '',
      extra_1: '',
      extra_2: ''
    }));
  });

  const [qc1Obs, setQc1Obs] = useState<Record<string, any[]>>(() => {
    const days = ["day_1", "day_2", "day_7", "day_15", "day_30", "day_180"];
    const initialState: Record<string, any[]> = {};
    days.forEach(day => {
      initialState[day] = Array.from({ length: 25 }, () => ({
        water: '',
        perfume: '',
        dip_test: ''
      }));
    });
    return initialState;
  });

  const [qc1Footer, setQc1Footer] = useState<any[]>(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      s_no: String(i + 1),
      batch_no: '',
      checked_by_1: '',
      checked_by_2: '',
      date_time: '',
      extra_1: '',
      extra_2: '',
      remarks: ''
    }));
  });

  const [qc1SaveStatus, setQc1SaveStatus] = useState<'ready' | 'saving' | 'success' | 'warning' | 'error'>('ready');
  const [qc1SaveMessage, setQc1SaveMessage] = useState('');
  const [qc1LastSavedTime, setQc1LastSavedTime] = useState('');

  const updateQc1Param = (idx: number, field: string, val: string) => {
    setQc1Params(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      debouncedQc1Save();
      return updated;
    });
  };

  const updateQc1Obs = (dayKey: string, idx: number, field: string, val: string) => {
    setQc1Obs(prev => {
      const updatedList = [...prev[dayKey]];
      updatedList[idx] = { ...updatedList[idx], [field]: val };
      const updatedObs = { ...prev, [dayKey]: updatedList };
      debouncedQc1Save();
      return updatedObs;
    });
  };

  const updateQc1Footer = (idx: number, field: string, val: string) => {
    setQc1Footer(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      debouncedQc1Save();
      return updated;
    });
  };

  const debouncedQc1Save = () => {
    const key = `qc1_autosave`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

    setQc1SaveStatus('saving');

    debounceTimers.current[key] = window.setTimeout(async () => {
      const batchNoRow = qc1Params.find(r => r.batch_no && r.batch_no.trim() !== '');
      if (!batchNoRow) {
        setQc1SaveStatus('warning');
        setQc1SaveMessage('Enter Batch No');
        return;
      }

      setQc1SaveStatus('saving');

      // Find first date or default to current date
      const dateTimeRow = qc1Params.find(r => r.date_time && r.date_time.trim() !== '');
      const testDate = parseAndFormatDate(dateTimeRow ? dateTimeRow.date_time : '');

      // Cast s_no to int
      const mainQcParams = qc1Params.map(r => ({
        ...r,
        s_no: parseInt(r.s_no, 10) || 1
      }));

      const qualityVerification = qc1Footer.map(r => ({
        ...r,
        s_no: parseInt(r.s_no, 10) || 1
      }));

      const signatures = {
        qc_incharge: '',
        lab_supervisor: '',
        production_manager: '',
        date_time: ''
      };

      const payload = {
        batch_no: batchNoRow.batch_no.trim(),
        test_date: testDate,
        main_qc_params: mainQcParams,
        observations: qc1Obs,
        quality_verification: qualityVerification,
        signatures: signatures
      };

      const [success, error] = await QCReportAPI.saveReport(productName, payload);
      if (success) {
        setQc1SaveStatus('success');
        setQc1LastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setQc1SaveStatus('error');
        setQc1SaveMessage(typeof error === 'string' ? error : 'Save failed');
      }
    }, 2000);
  };

  const padMainQcParams = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 25) {
      padded.push({
        s_no: String(padded.length + 1),
        batch_no: '',
        date_time: '',
        viscosity: '',
        coverage: '',
        levelling_test: '',
        wetting_test: '',
        adhesion_test: '',
        mek_rub_test: '',
        hardness: '',
        recoating: '',
        abrasion: '',
        gloss_finish: '',
        matt_finish: '',
        product_name: '',
        extra_1: '',
        extra_2: ''
      });
    }
    return padded.map((item, idx) => ({ ...item, s_no: String(idx + 1) }));
  };

  const padObservations = (obsData: Record<string, any[]>): Record<string, any[]> => {
    const days = ["day_1", "day_2", "day_7", "day_15", "day_30", "day_180"];
    const padded: Record<string, any[]> = {};
    days.forEach(day => {
      const list = obsData[day] || [];
      const paddedList = [...list];
      while (paddedList.length < 25) {
        paddedList.push({
          water: '',
          perfume: '',
          dip_test: ''
        });
      }
      padded[day] = paddedList;
    });
    return padded;
  };

  const padFooter = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 25) {
      padded.push({
        s_no: String(padded.length + 1),
        batch_no: '',
        checked_by_1: '',
        checked_by_2: '',
        date_time: '',
        extra_1: '',
        extra_2: '',
        remarks: ''
      });
    }
    return padded.map((item, idx) => ({ ...item, s_no: String(idx + 1) }));
  };

  const handleQc1Load = async () => {
    setLoading(true);
    const [success, data] = await QCReportAPI.getAllReports(productName);
    
    if (success && Array.isArray(data) && data.length > 0) {
      const latestBatch = data[0].batch_no;
      const [detailSuccess, detailData] = await QCReportAPI.getReportDetail(productName, latestBatch);
      setLoading(false);

      if (detailSuccess && detailData && detailData.report_data) {
        const report = detailData.report_data;
        if (report.main_qc_params) setQc1Params(padMainQcParams(report.main_qc_params));
        if (report.observations) setQc1Obs(padObservations(report.observations));
        if (report.quality_verification) {
          setQc1Footer(padFooter(report.quality_verification));
        }
        setQc1SaveStatus('success');
        setQc1LastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        onShowToast(`QC Lab report for batch ${latestBatch} loaded.`, 'success');
      } else {
        onShowToast('Failed to load report details.', 'error');
      }
    } else {
      setLoading(false);
      onShowToast('No active QC Lab reports found.', 'info');
    }
  };

  const handleQc1SubmitAndExport = async () => {
    const batchNoRow = qc1Params.find(r => r.batch_no && r.batch_no.trim() !== '');
    if (!batchNoRow) {
      onShowToast('Please enter at least one Batch No to save.', 'warning');
      return;
    }

    setLoading(true);
    const dateTimeRow = qc1Params.find(r => r.date_time && r.date_time.trim() !== '');
    const testDate = parseAndFormatDate(dateTimeRow ? dateTimeRow.date_time : '');

    const mainQcParams = qc1Params.map(r => ({
      ...r,
      s_no: parseInt(r.s_no, 10) || 1
    }));

    const qualityVerification = qc1Footer.map(r => ({
      ...r,
      s_no: parseInt(r.s_no, 10) || 1
    }));

    const signatures = {
      qc_incharge: '',
      lab_supervisor: '',
      production_manager: '',
      date_time: ''
    };

    const payload = {
      batch_no: batchNoRow.batch_no.trim(),
      test_date: testDate,
      main_qc_params: mainQcParams,
      observations: qc1Obs,
      quality_verification: qualityVerification,
      signatures: signatures
    };

    const [success, response] = await QCReportAPI.saveReport(productName, payload);
    setLoading(false);

    if (success) {
      setQc1SaveStatus('success');
      setQc1LastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      onShowToast('QC Lab report saved successfully! Generating PDF...', 'success');
      
      const activeBatch = batchNoRow.batch_no.trim();
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      // PAGE 1: Section A
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("LAB REPORT FOR SOLVENT/WATER BASED COATS - QC LAB REPORT", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("SECTION A: QC PARAMETERS", 15, 29);

      const mainHeaders = [
        "S.No", "Batch No", "Date & Time", "Viscosity @ 25C", "% Cov.",
        "% Lev.", "% Wet.", "Adhesion", "MEK Rub", "% Hard.",
        "% Recoat", "% Abr.", "% Gloss", "% Matt", "Product Particular",
        "", ""
      ];
      const mainBody = qc1Params.map((r, idx) => [
        idx + 1,
        r.batch_no || '',
        r.date_time || '',
        r.viscosity || '',
        r.coverage || '',
        r.levelling_test || '',
        r.wetting_test || '',
        r.adhesion_test || '',
        r.mek_rub_test || '',
        r.hardness || '',
        r.recoating || '',
        r.abrasion || '',
        r.gloss_finish || '',
        r.matt_finish || '',
        r.product_name || '',
        r.extra_1 || '',
        r.extra_2 || ''
      ]);

      autoTable(doc, {
        head: [mainHeaders],
        body: mainBody,
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 12 },
          5: { cellWidth: 12 },
          6: { cellWidth: 12 },
          7: { cellWidth: 16 },
          8: { cellWidth: 16 },
          9: { cellWidth: 12 },
          10: { cellWidth: 12 },
          11: { cellWidth: 12 },
          12: { cellWidth: 12 },
          13: { cellWidth: 12 },
          14: { cellWidth: 35, halign: 'left' },
          15: { cellWidth: 15 },
          16: { cellWidth: 15 }
        }
      });

      // PAGE 2: Section B
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("LAB REPORT FOR SOLVENT/WATER BASED COATS - QC LAB REPORT", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105);
      doc.text("SECTION B: STABILITY OBSERVATIONS", 15, 29);

      const obsHead = [
        [
          { content: 'S.No', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
          { content: 'after 1 Day', colSpan: 3, styles: { halign: 'center' as const } },
          { content: 'after 2 Days', colSpan: 3, styles: { halign: 'center' as const } },
          { content: 'after 7 Days', colSpan: 3, styles: { halign: 'center' as const } },
          { content: 'after 15 Days', colSpan: 3, styles: { halign: 'center' as const } },
          { content: 'after 30 Days', colSpan: 3, styles: { halign: 'center' as const } },
          { content: 'after 180 Days', colSpan: 3, styles: { halign: 'center' as const } }
        ],
        [
          '% H2O', '% Perf.', 'Dip',
          '% H2O', '% Perf.', 'Dip',
          '% H2O', '% Perf.', 'Dip',
          '% H2O', '% Perf.', 'Dip',
          '% H2O', '% Perf.', 'Dip',
          '% H2O', '% Perf.', 'Dip'
        ]
      ];

      const obsBody = Array.from({ length: 25 }).map((_, idx) => {
        const row = [idx + 1];
        ["day_1", "day_2", "day_7", "day_15", "day_30", "day_180"].forEach(day => {
          const r = qc1Obs[day][idx] || {};
          row.push(r.water || '', r.perfume || '', r.dip_test || '');
        });
        return row;
      });

      autoTable(doc, {
        head: obsHead,
        body: obsBody,
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      // PAGE 3: Section C
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("LAB REPORT FOR SOLVENT/WATER BASED COATS - QC LAB REPORT", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(124, 58, 237);
      doc.text("SECTION C: VERIFICATION SIGN-OFFS", 15, 29);

      const footerHeaders = ["S.No", "Batch No", "Checked by (1)", "Checked by (2)", "Date & Time", "", "", "Remarks"];
      const footerBody = qc1Footer.map((r, idx) => [
        idx + 1,
        r.batch_no || '',
        r.checked_by_1 || '',
        r.checked_by_2 || '',
        r.date_time || '',
        r.extra_1 || '',
        r.extra_2 || '',
        r.remarks || ''
      ]);

      autoTable(doc, {
        head: [footerHeaders],
        body: footerBody,
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 },
          7: { halign: 'left' }
        }
      });

      doc.save(`${activeBatch}_QC_Report.pdf`);
    } else {
      setQc1SaveStatus('error');
      setQc1SaveMessage(typeof response === 'string' ? response : 'Save failed');
      onShowToast(`Failed to save QC report: ${response}`, 'error');
    }
  };

  const handleQc1Clear = () => {
    setQc1Params(Array.from({ length: 25 }, (_, i) => ({
      s_no: String(i + 1),
      batch_no: '',
      date_time: '',
      viscosity: '',
      coverage: '',
      levelling_test: '',
      wetting_test: '',
      adhesion_test: '',
      mek_rub_test: '',
      hardness: '',
      recoating: '',
      abrasion: '',
      gloss_finish: '',
      matt_finish: '',
      product_name: '',
      extra_1: '',
      extra_2: ''
    })));

    const days = ["day_1", "day_2", "day_7", "day_15", "day_30", "day_180"];
    const resetObs: Record<string, any[]> = {};
    days.forEach(day => {
      resetObs[day] = Array.from({ length: 25 }, () => ({
        water: '',
        perfume: '',
        dip_test: ''
      }));
    });
    setQc1Obs(resetObs);

    setQc1Footer(Array.from({ length: 25 }, (_, i) => ({
      s_no: String(i + 1),
      batch_no: '',
      checked_by_1: '',
      checked_by_2: '',
      date_time: '',
      extra_1: '',
      extra_2: '',
      remarks: ''
    })));

    setQc1SaveStatus('warning');
    setQc1SaveMessage('Enter Batch No');
    onShowToast('QC Lab report sheet cleared.', 'info');
  };

  // QC Lab History
  const [qc1HistoryQuery, setQc1HistoryQuery] = useState('');
  const [qc1HistoryLogs, setQc1HistoryLogs] = useState<any[]>([]);

  const handleQc1HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await QCReportAPI.getPastEntries(productName, undefined, qc1HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc1HistoryLogs((data as any).entries || []);
      onShowToast('QC History loaded.', 'success');
    } else {
      onShowToast('No matching QC reports found.', 'info');
    }
  };

  const handleLoadHistoricalReport = (log: any) => {
    const report = log.full_data;
    if (report) {
      if (report.main_qc_params) setQc1Params(padMainQcParams(report.main_qc_params));
      if (report.observations) setQc1Obs(padObservations(report.observations));
      if (report.quality_verification) {
        setQc1Footer(padFooter(report.quality_verification));
      }
      setQc1SaveStatus('success');
      setQc1LastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setActiveTab('entry');
      onShowToast(`QC Report for Batch ${log.batch_no} loaded successfully. You can view all Sections (A, B, C) in the sheet.`, 'success');
    } else {
      onShowToast('Failed to load full report details.', 'error');
    }
  };

  // Advanced Excel-like keydown handler for QC1
  const handleQc1GridKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    sec: 'a' | 'b' | 'c',
    rowIndex: number,
    colIndex: number
  ) => {
    const numRows = 25;
    let targetSec = sec;
    let targetRow = rowIndex;
    let targetCol = colIndex;

    const isHorizontalKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const val = e.currentTarget.value;
    const canMoveHorizontal = isHorizontalKey && (val === '' || e.ctrlKey || e.metaKey || e.altKey);

    if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      targetRow = rowIndex - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = rowIndex + 1;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && canMoveHorizontal) {
      targetCol = colIndex - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && canMoveHorizontal) {
      targetCol = colIndex + 1;
      e.preventDefault();
    } else if (isHorizontalKey) {
      return;
    } else {
      return;
    }

    // Vertical boundary transitions
    if (targetRow < 0) {
      if (sec === 'b') {
        targetSec = 'a';
        targetRow = numRows - 1;
        targetCol = Math.min(colIndex + 1, 15); 
      } else if (sec === 'c') {
        targetSec = 'b';
        targetRow = numRows - 1;
        targetCol = Math.min(colIndex * 2 + 1, 17);
      } else {
        targetRow = 0;
      }
    } else if (targetRow >= numRows) {
      if (sec === 'a') {
        targetSec = 'b';
        targetRow = 0;
        targetCol = Math.min(colIndex, 17);
      } else if (sec === 'b') {
        targetSec = 'c';
        targetRow = 0;
        targetCol = Math.min(Math.floor(colIndex / 2.5), 6);
      } else {
        targetRow = numRows - 1;
      }
    }

    // Focus targeting
    if (targetSec === 'a') {
      const colKeys = ['batch_no', 'date_time', 'viscosity', 'coverage', 'levelling_test', 'wetting_test', 'adhesion_test', 'mek_rub_test', 'hardness', 'recoating', 'abrasion', 'gloss_finish', 'matt_finish', 'product_name', 'extra_1', 'extra_2'];
      if (targetCol < 0) targetCol = 0;
      if (targetCol >= colKeys.length) targetCol = colKeys.length - 1;
      const id = `qc1-input-${targetRow}-${colKeys[targetCol]}`;
      const element = document.getElementById(id);
      if (element) {
        (element as HTMLInputElement).focus();
        (element as HTMLInputElement).select();
      }
    } else if (targetSec === 'b') {
      if (targetCol < 0) {
        targetSec = 'a';
        targetCol = 15;
        const colKeys = ['batch_no', 'date_time', 'viscosity', 'coverage', 'levelling_test', 'wetting_test', 'adhesion_test', 'mek_rub_test', 'hardness', 'recoating', 'abrasion', 'gloss_finish', 'matt_finish', 'product_name', 'extra_1', 'extra_2'];
        const id = `qc1-input-${targetRow}-${colKeys[targetCol]}`;
        const element = document.getElementById(id);
        if (element) {
          (element as HTMLInputElement).focus();
          (element as HTMLInputElement).select();
        }
      } else if (targetCol >= 18) {
        targetCol = 17;
        const id = `qc1obs-input-${targetRow}-${targetCol}`;
        const element = document.getElementById(id);
        if (element) {
          (element as HTMLInputElement).focus();
          (element as HTMLInputElement).select();
        }
      } else {
        const id = `qc1obs-input-${targetRow}-${targetCol}`;
        const element = document.getElementById(id);
        if (element) {
          (element as HTMLInputElement).focus();
          (element as HTMLInputElement).select();
        }
      }
    } else if (targetSec === 'c') {
      const colKeys = ['batch_no', 'checked_by_1', 'checked_by_2', 'date_time', 'extra_1', 'extra_2', 'remarks'];
      if (targetCol < 0) targetCol = 0;
      if (targetCol >= colKeys.length) targetCol = colKeys.length - 1;
      const id = `qc1f-input-${targetRow}-${colKeys[targetCol]}`;
      const element = document.getElementById(id);
      if (element) {
        (element as HTMLInputElement).focus();
        (element as HTMLInputElement).select();
      }
    }
  };

  // ==========================================================================
  // 2. LIVE QC RELEASE & APPROVALS (qc_live_approval.py)
  // ==========================================================================
  const [liveBatches, setLiveBatches] = useState<any[]>([]);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');

  const loadLiveQCList = async () => {
    setLoading(true);
    const [success, data] = await LiveProductionAPI.getProdCompletedBatches(productName);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      const batches = (data as any).batches || [];
      // Filter client-side by liveSearchQuery if provided
      const filtered = liveSearchQuery.trim()
        ? batches.filter((b: any) => 
            (b.batch_no || '').toLowerCase().includes(liveSearchQuery.toLowerCase()) ||
            (b.customer_name || '').toLowerCase().includes(liveSearchQuery.toLowerCase()) ||
            (b.product_name || '').toLowerCase().includes(liveSearchQuery.toLowerCase())
          )
        : batches;
      setLiveBatches(filtered);
    } else {
      setLiveBatches([]);
    }
  };

  useEffect(() => {
    if (activeSubView === 'live_qc_approval') {
      loadLiveQCList();
    }
  }, [activeSubView, liveSearchQuery]);

  const handleSignOffBatch = async (batchNo: string, status: 'ok' | 'not_ok') => {
    setLoading(true);
    const [success, response] = await LiveProductionAPI.updateQCStatus(productName, batchNo, status);
    setLoading(false);

    if (success) {
      onShowToast(`Batch ${batchNo} has been marked as ${status === 'ok' ? 'Approved' : 'Rejected'}.`, 'success');
      NotificationsAPI.createNotification(
        "QC Status Updated",
        `Batch '${batchNo}' (${productName}) QC status set to ${status} by QC.`,
        status === 'ok' ? 'info' : 'warning',
        ["production"]
      );
      loadLiveQCList();
    } else {
      onShowToast(`Failed to update status: ${response}`, 'error');
    }
  };

  const handleDeleteBatch = async (batchNo: string) => {
    if (window.confirm(`Are you sure you want to permanently delete batch '${batchNo}'?`)) {
      setLoading(true);
      const [success, response] = await LiveProductionAPI.deleteLiveProdBatch(productName, batchNo);
      setLoading(false);

      if (success) {
        onShowToast(`Batch ${batchNo} deleted successfully.`, 'success');
        loadLiveQCList();
      } else {
        onShowToast(`Failed to delete batch: ${response}`, 'error');
      }
    }
  };

  // ==========================================================================
  // 3. PRODUCTION BATCHES ENTRY (QC3 - qc3.py)
  // ==========================================================================
  const [qc3Rows, setQc3Rows] = useState<any[]>(() => {
    return Array.from({ length: 25 }, () => ({
      date: '',
      product_name: '',
      batch_no: '',
      party_name: '',
      settling: '',
      shade_variation: '',
      adhesion: '',
      perfume: '',
      water: '',
      color_bleeding: '',
      observation: '',
      remarks: ''
    }));
  });

  const [qc3HistoryQuery, setQc3HistoryQuery] = useState('');
  const [qc3HistoryLogs, setQc3HistoryLogs] = useState<any[]>([]);

  const [qc2HistoryQuery, setQc2HistoryQuery] = useState('');
  const [qc2HistoryLogs, setQc2HistoryLogs] = useState<any[]>([]);

  const [qc5HistoryQuery, setQc5HistoryQuery] = useState('');
  const [qc5HistoryLogs, setQc5HistoryLogs] = useState<any[]>([]);

  const [qc6HistoryQuery, setQc6HistoryQuery] = useState('');
  const [qc6HistoryLogs, setQc6HistoryLogs] = useState<any[]>([]);

  const [qc7HistoryQuery, setQc7HistoryQuery] = useState('');
  const [qc7HistoryLogs, setQc7HistoryLogs] = useState<any[]>([]);

  const [qc5Rows, setQc5Rows] = useState<any[]>(() => {
    return Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      qty: '',
      given_by: '',
      given_to: '',
      lab_person_sign: ''
    }));
  });

  const [qc6Rows, setQc6Rows] = useState<any[]>(() => {
    return Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      customer_name: '',
      viscosity: '',
      rt_50: '',
      report_given_50: '',
      rt_100: '',
      report_given_100: '',
      approval: '',
      received_by: '',
      given_by: '',
      remarks: ''
    }));
  });

  const [qc7Rows, setQc7Rows] = useState<any[]>(() => {
    return Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      qty: '',
      given_by: '',
      given_to: '',
      lab_person_sign: ''
    }));
  });

  const updateQc5Row = (idx: number, field: string, val: string) => {
    setQc5Rows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const updateQc6Row = (idx: number, field: string, val: string) => {
    setQc6Rows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const updateQc7Row = (idx: number, field: string, val: string) => {
    setQc7Rows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const padQc3Rows = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 25) {
      padded.push({
        date: '',
        product_name: '',
        batch_no: '',
        party_name: '',
        settling: '',
        shade_variation: '',
        adhesion: '',
        perfume: '',
        water: '',
        color_bleeding: '',
        observation: '',
        remarks: ''
      });
    }
    return padded.slice(0, 25);
  };

  const updateQc3Row = (idx: number, field: string, val: string) => {
    setQc3Rows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleQc3Load = async () => {
    setLoading(true);
    const [success, data] = await ProductionBatchAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 25);
    setLoading(false);
    
    if (success && data && typeof data !== 'string') {
      const items = (data as any).items || [];
      if (items.length > 0) {
        const mapped = items.map((item: any) => ({
          date: item.date_time ? item.date_time.split(' ')[0] : '',
          product_name: item.product_name || '',
          batch_no: item.batch_no || '',
          party_name: item.party_name || '',
          settling: item.settling_test || '',
          shade_variation: item.shade_variation_test || '',
          adhesion: item.adhesion_test || '',
          perfume: item.perfume_test || '',
          water: item.water_test || '',
          color_bleeding: item.color_bleeding_test || '',
          observation: item.observation_test || '',
          remarks: item.remarks || ''
        }));
        
        setQc3Rows(padQc3Rows(mapped));
        onShowToast('Production QC records loaded successfully.', 'success');
      } else {
        onShowToast('No active Production QC records found.', 'info');
      }
    } else {
      onShowToast('Failed to load past production records.', 'error');
    }
  };

  const handleQc3Clear = () => {
    setQc3Rows(Array.from({ length: 25 }, () => ({
      date: '',
      product_name: '',
      batch_no: '',
      party_name: '',
      settling: '',
      shade_variation: '',
      adhesion: '',
      perfume: '',
      water: '',
      color_bleeding: '',
      observation: '',
      remarks: ''
    })));
    onShowToast('Production batches QC sheet cleared.', 'info');
  };

  const handleQc3HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await ProductionBatchAPI.getPastEntries(productName, undefined, undefined, qc3HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc3HistoryLogs((data as any).items || []);
      onShowToast('Production QC History loaded.', 'success');
    } else {
      onShowToast('No matching Production QC records found.', 'info');
    }
  };


  const handleLoadHistoricalQc3 = (item: any) => {
    if (item) {
      const mapped = {
        date: item.date_time ? item.date_time.split(' ')[0] : '',
        product_name: item.product_name || '',
        batch_no: item.batch_no || '',
        party_name: item.party_name || '',
        settling: item.settling_test || '',
        shade_variation: item.shade_variation_test || '',
        adhesion: item.adhesion_test || '',
        perfume: item.perfume_test || '',
        water: item.water_test || '',
        color_bleeding: item.color_bleeding_test || '',
        observation: item.observation_test || '',
        remarks: item.remarks || ''
      };
      const newRows = Array.from({ length: 25 }, () => ({
        date: '',
        product_name: '',
        batch_no: '',
        party_name: '',
        settling: '',
        shade_variation: '',
        adhesion: '',
        perfume: '',
        water: '',
        color_bleeding: '',
        observation: '',
        remarks: ''
      }));
      newRows[0] = mapped;
      setQc3Rows(newRows);
      setActiveTab('entry');
      onShowToast(`Record for batch ${item.batch_no} loaded into the sheet.`, 'success');
    } else {
      onShowToast('Could not load details for this record.', 'error');
    }
  };

  const handleQc3SaveAndExport = async () => {
    const entriesToSave = qc3Rows.filter(r => r.batch_no || r.product_name).map(r => ({
      date_time: parseAndFormatDateTimeDb(r.date),
      product_name: r.product_name || '',
      batch_no: r.batch_no || '',
      party_name: r.party_name || '',
      settling_test: r.settling || '',
      shade_variation_test: r.shade_variation || '',
      adhesion_test: r.adhesion || '',
      perfume_test: r.perfume || '',
      water_test: r.water || '',
      color_bleeding_test: r.color_bleeding || '',
      observation_test: r.observation || '',
      remarks: r.remarks || ''
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please fill in at least one production batch QC row.', 'warning');
      return;
    }

    setLoading(true);
    const [success, response] = await ProductionBatchAPI.saveEntries(productName, entriesToSave);
    setLoading(false);

    if (success) {
      onShowToast('Production batch QC records saved successfully! Generating PDF...', 'success');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("PRODUCTION BATCHES QC AUDIT LEDGER", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("QC PARAMETERS CHECKLIST", 15, 29);

      const headers = [
        "Sr", "Date", "Product Name", "Batch No.", "Party Name", 
        "Settling", "Shade Var.", "Adhesion", "Perfume", "Water", "Color Bleed", "Observation", "Remarks"
      ];

      const body = entriesToSave.map((e, idx) => [
        idx + 1,
        e.date_time ? e.date_time.split(' ')[0] : '',
        e.product_name,
        e.batch_no,
        e.party_name,
        e.settling_test,
        e.shade_variation_test,
        e.adhesion_test,
        e.perfume_test,
        e.water_test,
        e.color_bleeding_test,
        e.observation_test,
        e.remarks
      ]);

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 20 },
          2: { cellWidth: 45, halign: 'left' },
          3: { cellWidth: 18 },
          4: { cellWidth: 35, halign: 'left' },
          5: { cellWidth: 14 },
          6: { cellWidth: 14 },
          7: { cellWidth: 14 },
          8: { cellWidth: 14 },
          9: { cellWidth: 14 },
          10: { cellWidth: 14 },
          11: { cellWidth: 30, halign: 'left' },
          12: { cellWidth: 35, halign: 'left' }
        }
      });

      doc.save("Production_Batches_QC_Report.pdf");
      
      setQc3Rows(Array.from({ length: 25 }, () => ({
        date: '',
        product_name: '',
        batch_no: '',
        party_name: '',
        settling: '',
        shade_variation: '',
        adhesion: '',
        perfume: '',
        water: '',
        color_bleeding: '',
        observation: '',
        remarks: ''
      })));
    } else {
      onShowToast(`Failed to save QC entries: ${response}`, 'error');
    }
  };

  // ==========================================================================
  // 4. RAW MATERIAL ENTRY QC (QC2 - qc2.py)
  // ==========================================================================
  const [qc2Rows, setQc2Rows] = useState<any[]>(() => {
    return Array.from({ length: 20 }, () => ({
      date_time: '',
      material_name: '',
      mr_no: '',
      lot_batch_no: '',
      internal_batch_no: '',
      report_date: '',
      lab_approval: '',
      checked_by_reporter: '',
      head_sign: '',
      rnd_sign: '',
      qc_approval: ''
    }));
  });

  const padQc2Rows = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 20) {
      padded.push({
        entry_id: '',
        date_time: '',
        material_name: '',
        mr_no: '',
        lot_batch_no: '',
        internal_batch_no: '',
        report_date: '',
        lab_approval: '',
        checked_by_reporter: '',
        head_sign: '',
        rnd_sign: '',
        qc_approval: ''
      });
    }
    return padded.slice(0, 20);
  };

  const updateQc2Row = (idx: number, field: string, val: string) => {
    setQc2Rows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleQc2Clear = () => {
    setQc2Rows(Array.from({ length: 20 }, () => ({
      entry_id: '',
      date_time: '',
      material_name: '',
      mr_no: '',
      lot_batch_no: '',
      internal_batch_no: '',
      report_date: '',
      lab_approval: '',
      checked_by_reporter: '',
      head_sign: '',
      rnd_sign: '',
      qc_approval: ''
    })));
    onShowToast('Raw Material QC sheet cleared.', 'info');
  };

  const handleQc2Load = async () => {
    setLoading(true);
    const [success, data] = await RawMaterialAPI.getEntries(productName);
    setLoading(false);
    
    if (success && Array.isArray(data) && data.length > 0) {
      const mapped = data.map((item: any) => ({
        entry_id: item.entry_id || '',
        date_time: item.date_time ? item.date_time.split(' ')[0] : '',
        material_name: item.material_name || '',
        mr_no: item.mr_no || '',
        lot_batch_no: item.lot_no_batch_no || '',
        internal_batch_no: item.internal_batch_no || '',
        report_date: item.report_date ? item.report_date.split(' ')[0] : '',
        lab_approval: item.lab_approval || '',
        checked_by_reporter: item.checked_by_reporter_sign || '',
        head_sign: item.head_sign || '',
        rnd_sign: item.rd_sign || '',
        qc_approval: item.qc_approval || ''
      }));
      setQc2Rows(padQc2Rows(mapped));
      onShowToast('Raw Material QC records loaded successfully.', 'success');
    } else {
      setLoading(true);
      const [pastSuccess, pastData] = await RawMaterialAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 20);
      setLoading(false);
      if (pastSuccess && pastData && typeof pastData !== 'string' && (pastData as any).items?.length > 0) {
        const mapped = (pastData as any).items.map((item: any) => ({
          entry_id: item.entry_id || '',
          date_time: item.date_time ? item.date_time.split(' ')[0] : '',
          material_name: item.material_name || '',
          mr_no: item.mr_no || '',
          lot_batch_no: item.lot_no_batch_no || '',
          internal_batch_no: item.internal_batch_no || '',
          report_date: item.report_date ? item.report_date.split(' ')[0] : '',
          lab_approval: item.lab_approval || '',
          checked_by_reporter: item.checked_by_reporter_sign || '',
          head_sign: item.head_sign || '',
          rnd_sign: item.rd_sign || '',
          qc_approval: item.qc_approval || ''
        }));
        setQc2Rows(padQc2Rows(mapped));
        onShowToast('Raw Material QC records loaded from history.', 'success');
      } else {
        onShowToast('No Raw Material QC records found.', 'info');
      }
    }
  };

  const handleQc2HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await RawMaterialAPI.getPastEntries(productName, qc2HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc2HistoryLogs((data as any).items || []);
      onShowToast('Raw Material QC History loaded.', 'success');
    } else {
      onShowToast('No matching Raw Material QC records found.', 'info');
    }
  };

  const handleLoadHistoricalQc2 = (item: any) => {
    if (item) {
      const mapped = {
        entry_id: item.entry_id || '',
        date_time: item.date_time ? item.date_time.split(' ')[0] : '',
        material_name: item.material_name || '',
        mr_no: item.mr_no || '',
        lot_batch_no: item.lot_no_batch_no || '',
        internal_batch_no: item.internal_batch_no || '',
        report_date: item.report_date ? item.report_date.split(' ')[0] : '',
        lab_approval: item.lab_approval || '',
        checked_by_reporter: item.checked_by_reporter_sign || '',
        head_sign: item.head_sign || '',
        rnd_sign: item.rd_sign || '',
        qc_approval: item.qc_approval || ''
      };
      const newRows = Array.from({ length: 20 }, () => ({
        entry_id: '',
        date_time: '',
        material_name: '',
        mr_no: '',
        lot_batch_no: '',
        internal_batch_no: '',
        report_date: '',
        lab_approval: '',
        checked_by_reporter: '',
        head_sign: '',
        rnd_sign: '',
        qc_approval: ''
      }));
      newRows[0] = mapped;
      setQc2Rows(newRows);
      setActiveTab('entry');
      onShowToast(`Record for lot ${item.lot_no_batch_no} loaded into the sheet.`, 'success');
    } else {
      onShowToast('Could not load details for this record.', 'error');
    }
  };

  const handleQc2Save = async () => {
    const entriesToSave = qc2Rows.filter(r => r.material_name || r.lot_batch_no).map(r => ({
      entry_id: r.entry_id || crypto.randomUUID(),
      date_time: r.date_time ? parseAndFormatDateTimeDb(r.date_time) : '',
      material_name: r.material_name || '',
      mr_no: r.mr_no || '',
      lot_no_batch_no: r.lot_batch_no || '',
      internal_batch_no: r.internal_batch_no || '',
      report_date: r.report_date ? parseAndFormatDateTimeDb(r.report_date) : '',
      lab_approval: r.lab_approval || '',
      checked_by_reporter_sign: r.checked_by_reporter || '',
      head_sign: r.head_sign || '',
      rd_sign: r.rnd_sign || '',
      qc_approval: r.qc_approval || '',
      product_name: productName
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please populate raw material check-in QC rows.', 'warning');
      return;
    }

    setLoading(true);
    const [success, response] = await RawMaterialAPI.saveEntries(productName, entriesToSave);
    setLoading(false);

    if (success) {
      onShowToast('Raw Material QC saved successfully! Generating PDF...', 'success');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("INCOMING RAW MATERIAL LABORATORY APPROVALS", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("RAW MATERIAL LABORATORY LEDGER", 15, 29);

      const headers = [
        "Sr", "Date & Time", "Material Name", "MR No", "Lot / Batch No", 
        "Internal Batch No", "Report Date", "Lab Approval", "Checked By", "Head Sign", "R&D Sign", "QC Approval"
      ];

      const body = entriesToSave.map((e, idx) => [
        idx + 1,
        e.date_time ? e.date_time.split(' ')[0] : '',
        e.material_name,
        e.mr_no,
        e.lot_no_batch_no,
        e.internal_batch_no,
        e.report_date ? e.report_date.split(' ')[0] : '',
        e.lab_approval,
        e.checked_by_reporter_sign,
        e.head_sign,
        e.rd_sign,
        e.qc_approval
      ]);

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 32,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 22 },
          2: { cellWidth: 45, halign: 'left' },
          3: { cellWidth: 15 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 22 },
          7: { cellWidth: 15 },
          8: { cellWidth: 20 },
          9: { cellWidth: 20 },
          10: { cellWidth: 20 },
          11: { cellWidth: 15 }
        }
      });

      doc.save("Raw_Material_QC_Report.pdf");
      
      setQc2Rows(Array.from({ length: 20 }, () => ({
        entry_id: '',
        date_time: '',
        material_name: '',
        mr_no: '',
        lot_batch_no: '',
        internal_batch_no: '',
        report_date: '',
        lab_approval: '',
        checked_by_reporter: '',
        head_sign: '',
        rnd_sign: '',
        qc_approval: ''
      })));
    } else {
      onShowToast(`Failed to save Raw Material QC: ${response}`, 'error');
    }
  };

  // ==========================================================================
  // 5. W-56 RND BATCHES ENTRY (QC5 - qc5.py)
  // ==========================================================================
  const padQc5Rows = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 20) {
      padded.push({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      });
    }
    return padded.slice(0, 20);
  };

  const handleQc5Load = async () => {
    setLoading(true);
    const [success, data] = await W56RndAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 20);
    setLoading(false);
    
    if (success && data && typeof data !== 'string') {
      const items = (data as any).items || [];
      if (items.length > 0) {
        const mapped = items.map((item: any) => ({
          date_time: item.date_time ? item.date_time.split(' ')[0] : '',
          product_name: item.product_name_field || item.product_name || '',
          batch_no: item.batch_no || '',
          qty: item.qty || '',
          given_by: item.given_by || '',
          given_to: item.given_to || '',
          lab_person_sign: item.lab_person_sign || ''
        }));
        setQc5Rows(padQc5Rows(mapped));
        onShowToast('W-56 RND QC records loaded successfully.', 'success');
      } else {
        onShowToast('No active W-56 RND QC records found.', 'info');
      }
    } else {
      onShowToast('Failed to load past W-56 RND records.', 'error');
    }
  };

  const handleQc5Clear = () => {
    setQc5Rows(Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      qty: '',
      given_by: '',
      given_to: '',
      lab_person_sign: ''
    })));
    onShowToast('W-56 RND trials sheet cleared.', 'info');
  };

  const handleQc5HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await W56RndAPI.getPastEntries(productName, qc5HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc5HistoryLogs((data as any).items || []);
      onShowToast('W-56 RND Trial History loaded.', 'success');
    } else {
      onShowToast('No matching W-56 RND trial records found.', 'info');
    }
  };

  const handleLoadHistoricalQc5 = (item: any) => {
    if (item) {
      const mapped = {
        date_time: item.date_time ? item.date_time.split(' ')[0] : '',
        product_name: item.product_name_field || item.product_name || '',
        batch_no: item.batch_no || '',
        qty: item.qty || '',
        given_by: item.given_by || '',
        given_to: item.given_to || '',
        lab_person_sign: item.lab_person_sign || ''
      };
      const newRows = Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      }));
      newRows[0] = mapped;
      setQc5Rows(newRows);
      setActiveTab('entry');
      onShowToast(`Record for batch ${item.batch_no} loaded into the sheet.`, 'success');
    } else {
      onShowToast('Could not load details for this record.', 'error');
    }
  };

  const handleQc5Save = async () => {
    const entriesToSave = qc5Rows.filter(r => r.batch_no || r.product_name).map(r => ({
      date_time: r.date_time ? parseAndFormatDateTimeDb(r.date_time) : '',
      product_name: r.product_name || '',
      batch_no: r.batch_no || '',
      qty: r.qty || '',
      given_by: r.given_by || '',
      given_to: r.given_to || '',
      lab_person_sign: r.lab_person_sign || ''
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please fill in R&D trial assignment rows.', 'warning');
      return;
    }

    setLoading(true);
    const [success, response] = await W56RndAPI.saveEntries(productName, entriesToSave);
    setLoading(false);

    if (success) {
      onShowToast('W-56 RND trial log saved successfully! Generating PDF...', 'success');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("W-56 RND TECHNICAL LABORATORY BATCHES", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("TECHNICAL TRIAL RECORD", 15, 29);

      const headers = ["Sr", "Date & Time", "Product Name", "Batch No.", "Qty", "Given By", "Given To", "Lab Person Sign"];
      const body = entriesToSave.map((e, idx) => [
        idx + 1,
        e.date_time ? e.date_time.split(' ')[0] : '',
        e.product_name,
        e.batch_no,
        e.qty,
        e.given_by,
        e.given_to,
        e.lab_person_sign
      ]);

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 32,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 60, halign: 'left' },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 35, halign: 'left' },
          6: { cellWidth: 35, halign: 'left' },
          7: { cellWidth: 35 }
        }
      });

      doc.save("W56_RND_Batches_Report.pdf");
      
      setQc5Rows(Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      })));
    } else {
      onShowToast(`Failed to save W-56 R&D trial: ${response}`, 'error');
    }
  };

  // ==========================================================================
  // 6. PRODUCTION BATCHES FILTER (QC6 - qc6.py)
  // ==========================================================================
  const padQc6Rows = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 20) {
      padded.push({
        date_time: '',
        product_name: '',
        batch_no: '',
        customer_name: '',
        viscosity: '',
        rt_50: '',
        report_given_50: '',
        rt_100: '',
        report_given_100: '',
        approval: '',
        received_by: '',
        given_by: '',
        remarks: ''
      });
    }
    return padded.slice(0, 20);
  };

  const handleQc6Load = async () => {
    setLoading(true);
    const [success, data] = await ProductionBatchEntryAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 20);
    setLoading(false);
    
    if (success && data && typeof data !== 'string') {
      const items = (data as any).items || [];
      if (items.length > 0) {
        const mapped = items.map((item: any) => ({
          date_time: item.date_time ? item.date_time.split(' ')[0] : '',
          product_name: item.product_name || '',
          batch_no: item.batch_no || '',
          customer_name: item.customer_name || '',
          viscosity: item.viscosity || '',
          rt_50: item.rt_50 || '',
          report_given_50: item.report_given_50 || '',
          rt_100: item.rt_100 || '',
          report_given_100: item.report_given_100 || '',
          approval: item.app || '',
          received_by: item.received_by_sign || '',
          given_by: item.given_by_sign || '',
          remarks: item.remarks || ''
        }));
        setQc6Rows(padQc6Rows(mapped));
        onShowToast('Production filtration records loaded successfully.', 'success');
      } else {
        onShowToast('No active Production filtration records found.', 'info');
      }
    } else {
      onShowToast('Failed to load past filtration records.', 'error');
    }
  };

  const handleQc6Clear = () => {
    setQc6Rows(Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      customer_name: '',
      viscosity: '',
      rt_50: '',
      report_given_50: '',
      rt_100: '',
      report_given_100: '',
      approval: '',
      received_by: '',
      given_by: '',
      remarks: ''
    })));
    onShowToast('Production filtration sheet cleared.', 'info');
  };

  const handleQc6HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await ProductionBatchEntryAPI.getPastEntries(productName, qc6HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc6HistoryLogs((data as any).items || []);
      onShowToast('Production Filtration History loaded.', 'success');
    } else {
      onShowToast('No matching Production filtration records found.', 'info');
    }
  };

  const handleLoadHistoricalQc6 = (item: any) => {
    if (item) {
      const mapped = {
        date_time: item.date_time ? item.date_time.split(' ')[0] : '',
        product_name: item.product_name || '',
        batch_no: item.batch_no || '',
        customer_name: item.customer_name || '',
        viscosity: item.viscosity || '',
        rt_50: item.rt_50 || '',
        report_given_50: item.report_given_50 || '',
        rt_100: item.rt_100 || '',
        report_given_100: item.report_given_100 || '',
        approval: item.app || '',
        received_by: item.received_by_sign || '',
        given_by: item.given_by_sign || '',
        remarks: item.remarks || ''
      };
      const newRows = Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        customer_name: '',
        viscosity: '',
        rt_50: '',
        report_given_50: '',
        rt_100: '',
        report_given_100: '',
        approval: '',
        received_by: '',
        given_by: '',
        remarks: ''
      }));
      newRows[0] = mapped;
      setQc6Rows(newRows);
      setActiveTab('entry');
      onShowToast(`Record for batch ${item.batch_no} loaded into the sheet.`, 'success');
    } else {
      onShowToast('Could not load details for this record.', 'error');
    }
  };

  const handleQc6Save = async () => {
    const entriesToSave = qc6Rows.filter(r => r.batch_no || r.product_name).map(r => ({
      date_time: r.date_time ? parseAndFormatDateTimeDb(r.date_time) : '',
      product_name: r.product_name || '',
      batch_no: r.batch_no || '',
      customer_name: r.customer_name || '',
      viscosity: r.viscosity || '',
      rt_50: r.rt_50 || '',
      report_given_50: r.report_given_50 || '',
      rt_100: r.rt_100 || '',
      report_given_100: r.report_given_100 || '',
      app: r.approval || '',
      received_by_sign: r.received_by || '',
      given_by_sign: r.given_by || '',
      remarks: r.remarks || ''
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please fill in production filtration QC rows.', 'warning');
      return;
    }

    setLoading(true);
    const [success, response] = await ProductionBatchEntryAPI.saveEntries(productName, entriesToSave);
    setLoading(false);

    if (success) {
      onShowToast('Filtration check-off log saved successfully! Generating PDF...', 'success');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("PRODUCTION BATCHES FILTRATION AUDITS", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("FILTRATION RECORD", 15, 29);

      const headers = [
        "Sr", "Date & Time", "Product Name", "Batch No.", "Customer Name", 
        "Viscosity", "50% R/T", "Report Given (50%)", "100% R/T", "Report Given (100%)", "Approval", "Received By", "Given By", "Remarks"
      ];
      const body = entriesToSave.map((e, idx) => [
        idx + 1,
        e.date_time ? e.date_time.split(' ')[0] : '',
        e.product_name,
        e.batch_no,
        e.customer_name,
        e.viscosity,
        e.rt_50,
        e.report_given_50,
        e.rt_100,
        e.report_given_100,
        e.app,
        e.received_by_sign,
        e.given_by_sign,
        e.remarks
      ]);

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 32,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 6 },
          1: { cellWidth: 18 },
          2: { cellWidth: 30, halign: 'left' },
          3: { cellWidth: 15 },
          4: { cellWidth: 25, halign: 'left' },
          5: { cellWidth: 12 },
          6: { cellWidth: 12 },
          7: { cellWidth: 15 },
          8: { cellWidth: 12 },
          9: { cellWidth: 15 },
          10: { cellWidth: 15 },
          11: { cellWidth: 15, halign: 'left' },
          12: { cellWidth: 15, halign: 'left' },
          13: { cellWidth: 25, halign: 'left' }
        }
      });

      doc.save("QC_Filtration_Report.pdf");
      
      setQc6Rows(Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        customer_name: '',
        viscosity: '',
        rt_50: '',
        report_given_50: '',
        rt_100: '',
        report_given_100: '',
        approval: '',
        received_by: '',
        given_by: '',
        remarks: ''
      })));
    } else {
      onShowToast(`Failed to save filtration QC checks: ${response}`, 'error');
    }
  };

  // ==========================================================================
  // 7. LAB RETURN BATCHES ENTRY (QC7 - qc7.py)
  // ==========================================================================
  const padQc7Rows = (data: any[]): any[] => {
    const padded = [...data];
    while (padded.length < 20) {
      padded.push({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      });
    }
    return padded.slice(0, 20);
  };

  const handleQc7Load = async () => {
    setLoading(true);
    const [success, data] = await LabReturnAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 20);
    setLoading(false);
    
    if (success && data && typeof data !== 'string') {
      const items = (data as any).items || [];
      if (items.length > 0) {
        const mapped = items.map((item: any) => ({
          date_time: item.date_time ? item.date_time.split(' ')[0] : '',
          product_name: item.product_name_field || item.product_name || '',
          batch_no: item.batch_no || '',
          qty: item.qty || '',
          given_by: item.given_by || '',
          given_to: item.given_to || '',
          lab_person_sign: item.lab_person_sign || ''
        }));
        setQc7Rows(padQc7Rows(mapped));
        onShowToast('Lab return batch QC records loaded successfully.', 'success');
      } else {
        onShowToast('No active Lab return batches found.', 'info');
      }
    } else {
      onShowToast('Failed to load past lab return batches.', 'error');
    }
  };

  const handleQc7Clear = () => {
    setQc7Rows(Array.from({ length: 20 }, () => ({
      date_time: '',
      product_name: '',
      batch_no: '',
      qty: '',
      given_by: '',
      given_to: '',
      lab_person_sign: ''
    })));
    onShowToast('Lab return batches sheet cleared.', 'info');
  };

  const handleQc7HistorySearch = async () => {
    setLoading(true);
    const [success, data] = await LabReturnAPI.getPastEntries(productName, qc7HistoryQuery);
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      setQc7HistoryLogs((data as any).items || []);
      onShowToast('Lab Return History loaded.', 'success');
    } else {
      onShowToast('No matching Lab return records found.', 'info');
    }
  };

  const handleLoadHistoricalQc7 = (item: any) => {
    if (item) {
      const mapped = {
        date_time: item.date_time ? item.date_time.split(' ')[0] : '',
        product_name: item.product_name_field || item.product_name || '',
        batch_no: item.batch_no || '',
        qty: item.qty || '',
        given_by: item.given_by || '',
        given_to: item.given_to || '',
        lab_person_sign: item.lab_person_sign || ''
      };
      const newRows = Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      }));
      newRows[0] = mapped;
      setQc7Rows(newRows);
      setActiveTab('entry');
      onShowToast(`Record for batch ${item.batch_no} loaded into the sheet.`, 'success');
    } else {
      onShowToast('Could not load details for this record.', 'error');
    }
  };

  const handleQc7Save = async () => {
    const entriesToSave = qc7Rows.filter(r => r.batch_no || r.product_name).map(r => ({
      date_time: r.date_time ? parseAndFormatDateTimeDb(r.date_time) : '',
      product_name: r.product_name || '',
      batch_no: r.batch_no || '',
      qty: r.qty || '',
      given_by: r.given_by || '',
      given_to: r.given_to || '',
      lab_person_sign: r.lab_person_sign || ''
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please fill in returned batches log rows.', 'warning');
      return;
    }

    setLoading(true);
    const [success, response] = await LabReturnAPI.saveEntries(productName, entriesToSave);
    setLoading(false);

    if (success) {
      onShowToast('Lab return batch QC record saved successfully! Generating PDF...', 'success');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const todayStr = new Date().toLocaleDateString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("LAB RETURN BATCHES LEDGER", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${todayStr}`, 282, 23, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("RETURNED TRIAL RECORD", 15, 29);

      const headers = ["Sr", "Date & Time", "Product Name", "Batch No.", "Qty", "Given By", "Given To", "Lab Person Sign"];
      const body = entriesToSave.map((e, idx) => [
        idx + 1,
        e.date_time ? e.date_time.split(' ')[0] : '',
        e.product_name,
        e.batch_no,
        e.qty,
        e.given_by,
        e.given_to,
        e.lab_person_sign
      ]);

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 32,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 60, halign: 'left' },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 35, halign: 'left' },
          6: { cellWidth: 35, halign: 'left' },
          7: { cellWidth: 35 }
        }
      });

      doc.save("Lab_Returns_Report.pdf");
      
      setQc7Rows(Array.from({ length: 20 }, () => ({
        date_time: '',
        product_name: '',
        batch_no: '',
        qty: '',
        given_by: '',
        given_to: '',
        lab_person_sign: ''
      })));
    } else {
      onShowToast(`Failed to save returns QC log: ${response}`, 'error');
    }
  };

  useEffect(() => {
    if (activeSubView === 'past_production_batches') {
      setActiveTab('history');
      handleQc3HistorySearch();
    } else if (activeSubView === 'past_rm_entries') {
      setActiveTab('history');
      handleQc2HistorySearch();
    } else if (activeSubView === 'past_w-56_rnd_batches') {
      setActiveTab('history');
      handleQc5HistorySearch();
    } else if (activeSubView === 'past_batches_filter') {
      setActiveTab('history');
      handleQc6HistorySearch();
    } else if (activeSubView === 'past_lab_return_batches') {
      setActiveTab('history');
      handleQc7HistorySearch();
    } else if (
      activeSubView === 'production_batches_entry' ||
      activeSubView === 'raw_material_entry' ||
      activeSubView === 'w-56_rnd_batches_entry' ||
      activeSubView === 'production_batches_filter' ||
      activeSubView === 'lab_return_batches_entry'
    ) {
      setActiveTab('entry');
    }
  }, [activeSubView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - 120px)' }}>
      
      {/* Loading Loader Overlay */}
      {loading && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'white' }}>
            <RefreshCw size={40} className="spin-loader" />
            <span style={{ fontWeight: 600 }}>Loading...</span>
          </div>
        </div>
      )}

      {/* ======================================================================
          LIVE QC RELEASE APPROVALS BOARD
          ====================================================================== */}
      {activeSubView === 'live_qc_approval' && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={28} color="var(--primary-color)" />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>QC Live Release & Approvals</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Approve or reject active cooked manufacturing batches waiting for laboratory release.
                </p>
              </div>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <input type="text" className="field-input" value={liveSearchQuery} onChange={e => setLiveSearchQuery(e.target.value)} placeholder="Filter live batch..." style={{ paddingLeft: '32px' }} />
              <Search size={14} color="var(--text-light)" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            </div>
          </div>

          <div className="table-scroll-container">
            <table className="table-locked-header">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product Scope</th>
                  <th>Batch Number</th>
                  <th>Current Approval Status</th>
                  <th style={{ textAlign: 'center' }}>Release Approvals</th>
                </tr>
              </thead>
              <tbody>
                {liveBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>
                      No pending active batches awaiting laboratory QC release.
                    </td>
                  </tr>
                ) : (
                  liveBatches.map((b) => (
                    <tr key={b.batch_no}>
                      <td>{b.customer_name}</td>
                      <td style={{ fontWeight: 600 }}>{b.product_name}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{b.batch_no}</td>
                      <td>
                        <span style={{
                          backgroundColor: b.qc_status === 'ok' 
                            ? 'var(--color-success-light)' 
                            : b.qc_status === 'not_ok' 
                              ? 'var(--color-danger-light)' 
                              : 'var(--color-warning-light)',
                          color: b.qc_status === 'ok' 
                            ? 'var(--color-success)' 
                            : b.qc_status === 'not_ok' 
                              ? 'var(--color-danger)' 
                              : 'var(--color-warning)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {b.qc_status === 'ok' ? 'Approved' : b.qc_status === 'not_ok' ? 'Rejected' : 'Awaiting Review'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            onClick={() => handleSignOffBatch(b.batch_no, 'ok')} 
                            className="btn-primary" 
                            style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '4px 10px', fontSize: '0.75rem', gap: '4px', boxShadow: 'none' }}
                          >
                            <CheckCircle2 size={12} /> Approve Release
                          </button>
                          <button 
                            onClick={() => handleSignOffBatch(b.batch_no, 'not_ok')} 
                            className="btn-danger" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                          >
                            <XCircle size={12} /> Reject Batch
                          </button>
                          <button 
                            onClick={() => handleDeleteBatch(b.batch_no)} 
                            className="btn-danger" 
                            style={{ padding: '4px 8px', height: '26px', width: '26px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete Batch"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          QC LAB REPORT REPLICA (QC1)
          ====================================================================== */}
      {activeSubView === 'lab_report' && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              QC Report Data Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('history')}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {qc1SaveStatus !== 'ready' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid',
                      backgroundColor: 
                        qc1SaveStatus === 'saving' ? '#eff6ff' :
                        qc1SaveStatus === 'success' ? '#f0fdf4' :
                        qc1SaveStatus === 'warning' ? '#fffbeb' : '#fef2f2',
                      borderColor: 
                        qc1SaveStatus === 'saving' ? '#bfdbfe' :
                        qc1SaveStatus === 'success' ? '#bbf7d0' :
                        qc1SaveStatus === 'warning' ? '#fde68a' : '#fecaca',
                      color: 
                        qc1SaveStatus === 'saving' ? '#2563eb' :
                        qc1SaveStatus === 'success' ? '#15803d' :
                        qc1SaveStatus === 'warning' ? '#b45309' : '#b91c1c',
                      transition: 'all 0.2s ease'
                    }}>
                      {qc1SaveStatus === 'saving' && <RefreshCw size={14} className="animate-spin" />}
                      {qc1SaveStatus === 'success' && <Check size={14} />}
                      {qc1SaveStatus === 'warning' && <AlertTriangle size={14} />}
                      {qc1SaveStatus === 'error' && <XCircle size={14} />}
                      <span>
                        {qc1SaveStatus === 'saving' ? 'Saving...' :
                         qc1SaveStatus === 'success' ? `Saved ${qc1LastSavedTime}` :
                         qc1SaveStatus === 'warning' ? (qc1SaveMessage || 'Enter Batch No') :
                         (qc1SaveMessage || 'Save Error')}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc1Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc1Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc1SubmitAndExport} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              {/* Table A: Main QC parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', borderLeft: '4px solid #3b82f6', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section A: QC Parameters</h4>
                <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="table-locked-header" style={{ minWidth: '1350px', tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '35px' }} />
                      <col style={{ width: '90px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '95px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '85px' }} />
                      <col style={{ width: '85px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '70px' }} />
                      <col style={{ width: '70px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>S.No</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Batch No</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Date & Time</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Viscosity @ 25°C</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Coverage</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Levelling</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Wetting</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Adhesion Test</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>MEK Rub Test</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Hardness</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Recoating</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Abrasion</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Gloss Finish</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>% Matt Finish</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'left' }}>Product Name</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b' }}></th>
                        <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {qc1Params.map((r, idx) => (
                        <tr key={idx} style={{ height: '36px' }}>
                          <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no || ''} onChange={e => updateQc1Param(idx, 'batch_no', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 0)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time || ''} onChange={e => updateQc1Param(idx, 'date_time', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 1)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-viscosity`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.viscosity || ''} onChange={e => updateQc1Param(idx, 'viscosity', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 2)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-coverage`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.coverage || ''} onChange={e => updateQc1Param(idx, 'coverage', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 3)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-levelling_test`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.levelling_test || ''} onChange={e => updateQc1Param(idx, 'levelling_test', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 4)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-wetting_test`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.wetting_test || ''} onChange={e => updateQc1Param(idx, 'wetting_test', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 5)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-adhesion_test`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.adhesion_test || ''} onChange={e => updateQc1Param(idx, 'adhesion_test', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 6)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-mek_rub_test`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.mek_rub_test || ''} onChange={e => updateQc1Param(idx, 'mek_rub_test', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 7)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-hardness`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.hardness || ''} onChange={e => updateQc1Param(idx, 'hardness', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 8)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-recoating`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.recoating || ''} onChange={e => updateQc1Param(idx, 'recoating', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 9)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-abrasion`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.abrasion || ''} onChange={e => updateQc1Param(idx, 'abrasion', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 10)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-gloss_finish`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.gloss_finish || ''} onChange={e => updateQc1Param(idx, 'gloss_finish', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 11)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-matt_finish`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.matt_finish || ''} onChange={e => updateQc1Param(idx, 'matt_finish', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 12)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-product_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.product_name || ''} onChange={e => updateQc1Param(idx, 'product_name', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 13)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-extra_1`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.extra_1 || ''} onChange={e => updateQc1Param(idx, 'extra_1', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 14)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1-input-${idx}-extra_2`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.extra_2 || ''} onChange={e => updateQc1Param(idx, 'extra_2', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'a', idx, 15)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table B: Stability Observations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#059669', borderLeft: '4px solid #10b981', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section B: Stability Observations</h4>
                <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="table-locked-header" style={{ minWidth: '1205px', tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '35px' }} />
                      {Array.from({ length: 18 }).map((_, i) => <col key={i} style={{ width: '65px' }} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={qcHeaderRow1Style}>S.No</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 1 Day</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 2 Days</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 7 Days</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 15 Days</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 30 Days</th>
                        <th colSpan={3} style={qcHeaderRow1Style}>after 180 Days</th>
                      </tr>
                      <tr>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                        <th style={qcHeaderRow2Style}>% H2O</th>
                        <th style={qcHeaderRow2Style}>% Perf.</th>
                        <th style={qcHeaderRow2Style}>Dip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 25 }).map((_, idx) => (
                        <tr key={idx} style={{ height: '36px' }}>
                          <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>{idx + 1}</td>
                          {["day_1", "day_2", "day_7", "day_15", "day_30", "day_180"].map((day, dIdx) => {
                            const r = qc1Obs[day][idx] || {};
                            return (
                              <React.Fragment key={day}>
                                <td style={{ border: '1px solid #e2e8f0' }}>
                                  <input id={`qc1obs-input-${idx}-${dIdx * 3 + 0}`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.water || ''} onChange={e => updateQc1Obs(day, idx, 'water', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'b', idx, dIdx * 3 + 0)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                                </td>
                                <td style={{ border: '1px solid #e2e8f0' }}>
                                  <input id={`qc1obs-input-${idx}-${dIdx * 3 + 1}`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.perfume || ''} onChange={e => updateQc1Obs(day, idx, 'perfume', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'b', idx, dIdx * 3 + 1)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                                </td>
                                <td style={{ border: '1px solid #e2e8f0' }}>
                                  <input id={`qc1obs-input-${idx}-${dIdx * 3 + 2}`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.dip_test || ''} onChange={e => updateQc1Obs(day, idx, 'dip_test', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'b', idx, dIdx * 3 + 2)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table C: Footer Verification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#7c3aed', borderLeft: '4px solid #8b5cf6', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section C: Verification sign-offs</h4>
                <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="table-locked-header" style={{ minWidth: '805px', tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '35px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '180px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'center' }}>S.No</th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'center' }}>Batch No.</th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'left' }}>Checked by (1)</th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'left' }}>Checked by (2)</th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'center' }}>Date & Time</th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9' }}></th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9' }}></th>
                        <th style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #6d28d9', textAlign: 'left' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qc1Footer.map((r, idx) => (
                        <tr key={idx} style={{ height: '36px' }}>
                          <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no || ''} onChange={e => updateQc1Footer(idx, 'batch_no', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 0)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-checked_by_1`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.checked_by_1 || ''} onChange={e => updateQc1Footer(idx, 'checked_by_1', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 1)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-checked_by_2`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.checked_by_2 || ''} onChange={e => updateQc1Footer(idx, 'checked_by_2', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 2)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time || ''} onChange={e => updateQc1Footer(idx, 'date_time', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 3)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-extra_1`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.extra_1 || ''} onChange={e => updateQc1Footer(idx, 'extra_1', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 4)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-extra_2`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.extra_2 || ''} onChange={e => updateQc1Footer(idx, 'extra_2', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 5)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                          <td style={{ border: '1px solid #e2e8f0' }}>
                            <input id={`qc1f-input-${idx}-remarks`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.remarks || ''} onChange={e => updateQc1Footer(idx, 'remarks', e.target.value)} onKeyDown={e => handleQc1GridKeyDown(e, 'c', idx, 6)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by batch number..." value={qc1HistoryQuery} onChange={e => setQc1HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc1HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px' }}>
                <table className="table-locked-header" style={{ minWidth: '1300px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>Sr</th>
                      <th>Batch No</th>
                      <th>Logged Date</th>
                      <th>Viscosity @ 25°C</th>
                      <th>Coverage</th>
                      <th>Levelling</th>
                      <th>Wetting</th>
                      <th>Adhesion</th>
                      <th>MEK Rubs</th>
                      <th>Gloss</th>
                      <th>Matt</th>
                      <th>Product Name</th>
                      <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc1HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                          No matching QC parameters reports found.
                        </td>
                      </tr>
                    ) : (
                      qc1HistoryLogs.map((log, idx) => {
                        const firstParam = log.full_data?.main_qc_params?.[0] || {};
                        return (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{log.batch_no}</td>
                            <td>{log.test_date || log.created_at}</td>
                            <td>{firstParam.viscosity || '-'}</td>
                            <td>{firstParam.coverage || '-'}</td>
                            <td>{firstParam.levelling_test || '-'}</td>
                            <td>{firstParam.wetting_test || '-'}</td>
                            <td>{firstParam.adhesion_test || '-'}</td>
                            <td>{firstParam.mek_rub_test || '-'}</td>
                            <td>{firstParam.gloss_finish || '-'}</td>
                            <td>{firstParam.matt_finish || '-'}</td>
                            <td style={{ fontWeight: 600 }}>{firstParam.product_name || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '4px' }}>
                              <button 
                                onClick={() => handleLoadHistoricalReport(log)} 
                                className="flet-btn flet-btn-blue" 
                                style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={12} /> View & Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          RAW MATERIAL QC ENTRY (QC2 - qc2.py)
          ====================================================================== */}
      {(activeSubView === 'raw_material_entry' || activeSubView === 'past_rm_entries') && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              Raw Material QC Data Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => {
                setActiveTab('history');
                handleQc2HistorySearch();
              }}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc2Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc2Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc2Save} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #000000 !important', borderRadius: '4px' }}>
                <table className="table-locked-header" style={{ minWidth: '1600px', tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '110px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Sr</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Date & Time</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Material Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>MR No</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Lot / Batch No</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Internal Batch No</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Report Date</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Lab Approval</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Checked By</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Head Sign</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>R&D Sign</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>QC Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc2Rows.map((r, idx) => (
                      <tr key={idx} style={{ height: '36px' }}>
                        <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #000000', fontSize: '0.75rem' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time} onChange={e => updateQc2Row(idx, 'date_time', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 0, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-material_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.material_name} onChange={e => updateQc2Row(idx, 'material_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 1, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-mr_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.mr_no} onChange={e => updateQc2Row(idx, 'mr_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 2, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-lot_batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.lot_batch_no} onChange={e => updateQc2Row(idx, 'lot_batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 3, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-internal_batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.internal_batch_no} onChange={e => updateQc2Row(idx, 'internal_batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 4, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-report_date`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.report_date} onChange={e => updateQc2Row(idx, 'report_date', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 5, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-lab_approval`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.lab_approval} onChange={e => updateQc2Row(idx, 'lab_approval', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 6, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-checked_by_reporter`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.checked_by_reporter} onChange={e => updateQc2Row(idx, 'checked_by_reporter', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 7, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-head_sign`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.head_sign} onChange={e => updateQc2Row(idx, 'head_sign', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 8, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-rnd_sign`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.rnd_sign} onChange={e => updateQc2Row(idx, 'rnd_sign', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 9, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc2-input-${idx}-qc_approval`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.qc_approval} onChange={e => updateQc2Row(idx, 'qc_approval', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 10, ['date_time', 'material_name', 'mr_no', 'lot_batch_no', 'internal_batch_no', 'report_date', 'lab_approval', 'checked_by_reporter', 'head_sign', 'rnd_sign', 'qc_approval'], 20, 'qc2')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by lot number or material name..." value={qc2HistoryQuery} onChange={e => setQc2HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc2HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px', border: '1px solid #000000 !important' }}>
                <table className="table-locked-header" style={{ minWidth: '1500px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center', border: '1px solid #000000' }}>Sr</th>
                      <th style={{ border: '1px solid #000000' }}>Date & Time</th>
                      <th style={{ border: '1px solid #000000' }}>Material Name</th>
                      <th style={{ border: '1px solid #000000' }}>MR No</th>
                      <th style={{ border: '1px solid #000000' }}>Lot / Batch No</th>
                      <th style={{ border: '1px solid #000000' }}>Internal Batch No</th>
                      <th style={{ border: '1px solid #000000' }}>Report Date</th>
                      <th style={{ border: '1px solid #000000' }}>Lab Approval</th>
                      <th style={{ border: '1px solid #000000' }}>Checked By</th>
                      <th style={{ border: '1px solid #000000' }}>Head Sign</th>
                      <th style={{ border: '1px solid #000000' }}>R&D Sign</th>
                      <th style={{ border: '1px solid #000000' }}>QC Approval</th>
                      <th style={{ textAlign: 'center', width: '130px', border: '1px solid #000000' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc2HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', border: '1px solid #000000' }}>
                          No matching Raw Material QC records found.
                        </td>
                      </tr>
                    ) : (
                      qc2HistoryLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', border: '1px solid #000000' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.date_time ? log.date_time.split(' ')[0] : ''}</td>
                          <td style={{ fontWeight: 600, border: '1px solid #000000' }}>{log.material_name}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.mr_no}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-color)', border: '1px solid #000000' }}>{log.lot_no_batch_no}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.internal_batch_no}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.report_date ? log.report_date.split(' ')[0] : ''}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.lab_approval}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.checked_by_reporter_sign}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.head_sign}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.rd_sign}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.qc_approval}</td>
                          <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000000' }}>
                            <button 
                              onClick={() => handleLoadHistoricalQc2(log)} 
                              className="flet-btn flet-btn-blue" 
                              style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View & Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          PRODUCTION BATCHES ENTRY (QC3)
          ====================================================================== */}
      {(activeSubView === 'production_batches_entry' || activeSubView === 'past_production_batches') && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              Production QC Data Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => {
                setActiveTab('history');
                handleQc3HistorySearch();
              }}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc3Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc3Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc3SaveAndExport} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <table className="table-locked-header" style={{ minWidth: '1600px', tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '95px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '200px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Sr</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Date</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'left' }}>Product Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Batch No.</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'left' }}>Party Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Settling</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Shade Var.</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Adhesion</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Perfume</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Water</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'center' }}>Color Bleed</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'left' }}>Observation</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #1e293b', textAlign: 'left' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc3Rows.map((r, idx) => (
                      <tr key={idx} style={{ height: '36px' }}>
                        <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-date`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date} onChange={e => updateQc3Row(idx, 'date', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 0, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-product_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.product_name} onChange={e => updateQc3Row(idx, 'product_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 1, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no} onChange={e => updateQc3Row(idx, 'batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 2, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-party_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.party_name} onChange={e => updateQc3Row(idx, 'party_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 3, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-settling`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.settling} onChange={e => updateQc3Row(idx, 'settling', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 4, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-shade_variation`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.shade_variation} onChange={e => updateQc3Row(idx, 'shade_variation', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 5, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-adhesion`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.adhesion} onChange={e => updateQc3Row(idx, 'adhesion', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 6, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-perfume`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.perfume} onChange={e => updateQc3Row(idx, 'perfume', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 7, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-water`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.water} onChange={e => updateQc3Row(idx, 'water', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 8, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-color_bleeding`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.color_bleeding} onChange={e => updateQc3Row(idx, 'color_bleeding', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 9, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-observation`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.observation} onChange={e => updateQc3Row(idx, 'observation', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 10, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #e2e8f0' }}>
                          <input id={`qc3-input-${idx}-remarks`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.remarks} onChange={e => updateQc3Row(idx, 'remarks', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 11, ['date', 'product_name', 'batch_no', 'party_name', 'settling', 'shade_variation', 'adhesion', 'perfume', 'water', 'color_bleeding', 'observation', 'remarks'], 25, 'qc3')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by batch number or product name..." value={qc3HistoryQuery} onChange={e => setQc3HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc3HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px' }}>
                <table className="table-locked-header" style={{ minWidth: '1500px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>Sr</th>
                      <th>Batch No</th>
                      <th>Logged Date</th>
                      <th>Product Name</th>
                      <th>Party Name</th>
                      <th>Settling</th>
                      <th>Shade Var.</th>
                      <th>Adhesion</th>
                      <th>Perfume</th>
                      <th>Water</th>
                      <th>Color Bleed</th>
                      <th>Observation</th>
                      <th>Remarks</th>
                      <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc3HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                          No matching Production QC reports found.
                        </td>
                      </tr>
                    ) : (
                      qc3HistoryLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{log.batch_no}</td>
                          <td>{log.date_time ? log.date_time.split(' ')[0] : ''}</td>
                          <td style={{ fontWeight: 600 }}>{log.product_name}</td>
                          <td>{log.party_name}</td>
                          <td>{log.settling_test || '-'}</td>
                          <td>{log.shade_variation_test || '-'}</td>
                          <td>{log.adhesion_test || '-'}</td>
                          <td>{log.perfume_test || '-'}</td>
                          <td>{log.water_test || '-'}</td>
                          <td>{log.color_bleeding_test || '-'}</td>
                          <td>{log.observation_test || '-'}</td>
                          <td>{log.remarks}</td>
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            <button 
                              onClick={() => handleLoadHistoricalQc3(log)} 
                              className="flet-btn flet-btn-blue" 
                              style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View & Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          W-56 RND BATCHES ENTRY (QC5)
          ====================================================================== */}
      {(activeSubView === 'w-56_rnd_batches_entry' || activeSubView === 'past_w-56_rnd_batches') && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              W-56 RND Technical Lab Batches Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => {
                setActiveTab('history');
                handleQc5HistorySearch();
              }}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc5Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc5Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc5Save} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #000000 !important', borderRadius: '4px' }}>
                <table className="table-locked-header" style={{ minWidth: '1300px', tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '320px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '200px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Sr</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Date & Time</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Product Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Batch No.</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Qty (kg/ltr)</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Given By</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Given To</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Lab Person Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc5Rows.map((r, idx) => (
                      <tr key={idx} style={{ height: '36px' }}>
                        <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #000000', fontSize: '0.75rem' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time} onChange={e => updateQc5Row(idx, 'date_time', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 0, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-product_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.product_name} onChange={e => updateQc5Row(idx, 'product_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 1, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no} onChange={e => updateQc5Row(idx, 'batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 2, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-qty`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.qty} onChange={e => updateQc5Row(idx, 'qty', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 3, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-given_by`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.given_by} onChange={e => updateQc5Row(idx, 'given_by', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 4, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-given_to`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.given_to} onChange={e => updateQc5Row(idx, 'given_to', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 5, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc5-input-${idx}-lab_person_sign`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.lab_person_sign} onChange={e => updateQc5Row(idx, 'lab_person_sign', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 6, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc5')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by batch number or product name..." value={qc5HistoryQuery} onChange={e => setQc5HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc5HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px', border: '1px solid #000000 !important' }}>
                <table className="table-locked-header" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center', border: '1px solid #000000' }}>Sr</th>
                      <th style={{ border: '1px solid #000000' }}>Date & Time</th>
                      <th style={{ border: '1px solid #000000' }}>Product Name</th>
                      <th style={{ border: '1px solid #000000' }}>Batch No.</th>
                      <th style={{ border: '1px solid #000000' }}>Qty (kg/ltr)</th>
                      <th style={{ border: '1px solid #000000' }}>Given By</th>
                      <th style={{ border: '1px solid #000000' }}>Given To</th>
                      <th style={{ border: '1px solid #000000' }}>Lab Person Sign</th>
                      <th style={{ textAlign: 'center', width: '130px', border: '1px solid #000000' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc5HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', border: '1px solid #000000' }}>
                          No matching W-56 RND Technical Laboratory records found.
                        </td>
                      </tr>
                    ) : (
                      qc5HistoryLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', border: '1px solid #000000' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.date_time ? log.date_time.split(' ')[0] : ''}</td>
                          <td style={{ fontWeight: 600, border: '1px solid #000000' }}>{log.product_name_field || log.product_name || '-'}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-color)', border: '1px solid #000000' }}>{log.batch_no}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.qty}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.given_by}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.given_to}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.lab_person_sign}</td>
                          <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000000' }}>
                            <button 
                              onClick={() => handleLoadHistoricalQc5(log)} 
                              className="flet-btn flet-btn-blue" 
                              style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View & Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          PRODUCTION BATCHES FILTER (QC6)
          ====================================================================== */}
      {/* ======================================================================
          PRODUCTION BATCHES FILTER (QC6)
          ====================================================================== */}
      {(activeSubView === 'production_batches_filter' || activeSubView === 'past_batches_filter') && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              Filtration QC Audit Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => {
                setActiveTab('history');
                handleQc6HistorySearch();
              }}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc6Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc6Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc6Save} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #000000 !important', borderRadius: '4px' }}>
                <table className="table-locked-header" style={{ minWidth: '1600px', tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '200px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Sr</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Date & Time</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Product Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Batch No.</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Customer Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Viscosity</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>50% R/T</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Report Given (50)</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>100% R/T</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Report Given (100)</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Approval</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Received By</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Given By</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc6Rows.map((r, idx) => (
                      <tr key={idx} style={{ height: '36px' }}>
                        <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #000000', fontSize: '0.75rem' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time} onChange={e => updateQc6Row(idx, 'date_time', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 0, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-product_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.product_name} onChange={e => updateQc6Row(idx, 'product_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 1, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no} onChange={e => updateQc6Row(idx, 'batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 2, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-customer_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.customer_name} onChange={e => updateQc6Row(idx, 'customer_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 3, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-viscosity`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.viscosity} onChange={e => updateQc6Row(idx, 'viscosity', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 4, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-rt_50`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.rt_50} onChange={e => updateQc6Row(idx, 'rt_50', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 5, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-report_given_50`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.report_given_50} onChange={e => updateQc6Row(idx, 'report_given_50', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 6, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-rt_100`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.rt_100} onChange={e => updateQc6Row(idx, 'rt_100', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 7, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-report_given_100`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.report_given_100} onChange={e => updateQc6Row(idx, 'report_given_100', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 8, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-approval`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.approval} onChange={e => updateQc6Row(idx, 'approval', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 9, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-received_by`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.received_by} onChange={e => updateQc6Row(idx, 'received_by', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 10, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-given_by`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.given_by} onChange={e => updateQc6Row(idx, 'given_by', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 11, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc6-input-${idx}-remarks`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.remarks} onChange={e => updateQc6Row(idx, 'remarks', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 12, ['date_time', 'product_name', 'batch_no', 'customer_name', 'viscosity', 'rt_50', 'report_given_50', 'rt_100', 'report_given_100', 'approval', 'received_by', 'given_by', 'remarks'], 20, 'qc6')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by batch number or customer name..." value={qc6HistoryQuery} onChange={e => setQc6HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc6HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px', border: '1px solid #000000 !important' }}>
                <table className="table-locked-header" style={{ minWidth: '1600px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center', border: '1px solid #000000' }}>Sr</th>
                      <th style={{ border: '1px solid #000000' }}>Date & Time</th>
                      <th style={{ border: '1px solid #000000' }}>Product Name</th>
                      <th style={{ border: '1px solid #000000' }}>Batch No.</th>
                      <th style={{ border: '1px solid #000000' }}>Customer Name</th>
                      <th style={{ border: '1px solid #000000' }}>Viscosity</th>
                      <th style={{ border: '1px solid #000000' }}>50% R/T</th>
                      <th style={{ border: '1px solid #000000' }}>Report Given (50%)</th>
                      <th style={{ border: '1px solid #000000' }}>100% R/T</th>
                      <th style={{ border: '1px solid #000000' }}>Report Given (100%)</th>
                      <th style={{ border: '1px solid #000000' }}>Approval</th>
                      <th style={{ border: '1px solid #000000' }}>Received By</th>
                      <th style={{ border: '1px solid #000000' }}>Given By</th>
                      <th style={{ border: '1px solid #000000' }}>Remarks</th>
                      <th style={{ textAlign: 'center', width: '130px', border: '1px solid #000000' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc6HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={15} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', border: '1px solid #000000' }}>
                          No matching Filtration audit records found.
                        </td>
                      </tr>
                    ) : (
                      qc6HistoryLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', border: '1px solid #000000' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.date_time ? log.date_time.split(' ')[0] : ''}</td>
                          <td style={{ fontWeight: 600, border: '1px solid #000000' }}>{log.product_name}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-color)', border: '1px solid #000000' }}>{log.batch_no}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.customer_name}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.viscosity}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.rt_50}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.report_given_50}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.rt_100}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.report_given_100}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.app}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.received_by_sign}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.given_by_sign}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.remarks}</td>
                          <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000000' }}>
                            <button 
                              onClick={() => handleLoadHistoricalQc6(log)} 
                              className="flet-btn flet-btn-blue" 
                              style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View & Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          LAB RETURN BATCHES ENTRY (QC7)
          ====================================================================== */}
      {/* ======================================================================
          LAB RETURN BATCHES ENTRY (QC7)
          ====================================================================== */}
      {(activeSubView === 'lab_return_batches_entry' || activeSubView === 'past_lab_return_batches') && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', flexShrink: 0 }}>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'entry' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'entry' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'entry' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => setActiveTab('entry')}
            >
              Lab Return Batches QC Entry
            </button>
            <button 
              style={{ 
                padding: '10px 20px', 
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'history' ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }} 
              onClick={() => {
                setActiveTab('history');
                handleQc7HistorySearch();
              }}
            >
              Archive History Logs
            </button>
          </div>

          {activeTab === 'entry' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={handleQc7Load} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Load
                  </button>
                  <button 
                    onClick={handleQc7Clear} 
                    className="flet-btn flet-btn-red" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Clear Sheet
                  </button>
                  <button 
                    onClick={handleQc7Save} 
                    className="flet-btn flet-btn-green" 
                    style={{ height: '38px', padding: '0 18px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={14} /> Save & Download PDF
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid #000000 !important', borderRadius: '4px' }}>
                <table className="table-locked-header" style={{ minWidth: '1300px', tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '320px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '200px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Sr</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Date & Time</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Product Name</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Batch No.</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'center' }}>Qty (kg/ltr)</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Given By</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Given To</th>
                      <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', padding: '8px 4px', border: '1px solid #000000', textAlign: 'left' }}>Lab Person Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc7Rows.map((r, idx) => (
                      <tr key={idx} style={{ height: '36px' }}>
                        <td style={{ textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 500, border: '1px solid #000000', fontSize: '0.75rem' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-date_time`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.date_time} onChange={e => updateQc7Row(idx, 'date_time', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 0, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-product_name`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.product_name} onChange={e => updateQc7Row(idx, 'product_name', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 1, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-batch_no`} type="text" className="cell-input" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }} value={r.batch_no} onChange={e => updateQc7Row(idx, 'batch_no', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 2, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-qty`} type="text" className="cell-input" style={{ textAlign: 'center', fontSize: '0.75rem' }} value={r.qty} onChange={e => updateQc7Row(idx, 'qty', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 3, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-given_by`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.given_by} onChange={e => updateQc7Row(idx, 'given_by', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 4, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-given_to`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.given_to} onChange={e => updateQc7Row(idx, 'given_to', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 5, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                        <td style={{ border: '1px solid #000000' }}>
                          <input id={`qc7-input-${idx}-lab_person_sign`} type="text" className="cell-input" style={{ fontSize: '0.75rem' }} value={r.lab_person_sign} onChange={e => updateQc7Row(idx, 'lab_person_sign', e.target.value)} onKeyDown={e => handleGridKeyDown(e, idx, 6, ['date_time', 'product_name', 'batch_no', 'qty', 'given_by', 'given_to', 'lab_person_sign'], 20, 'qc7')} autoComplete="off" autoCorrect="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // Search Archive Tab
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div className="form-input-container" style={{ flexGrow: 1 }}>
                  <span className="form-label">Search QC Batches</span>
                  <input type="text" className="field-input" placeholder="Search by batch number or product name..." value={qc7HistoryQuery} onChange={e => setQc7HistoryQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={handleQc7HistorySearch} 
                    className="flet-btn flet-btn-blue" 
                    style={{ height: '38px', padding: '0 24px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={16} /> Search logs
                  </button>
                </div>
              </div>

              <div className="table-scroll-container" style={{ maxHeight: '420px', border: '1px solid #000000 !important' }}>
                <table className="table-locked-header" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center', border: '1px solid #000000' }}>Sr</th>
                      <th style={{ border: '1px solid #000000' }}>Date & Time</th>
                      <th style={{ border: '1px solid #000000' }}>Product Name</th>
                      <th style={{ border: '1px solid #000000' }}>Batch No.</th>
                      <th style={{ border: '1px solid #000000' }}>Qty (kg/ltr)</th>
                      <th style={{ border: '1px solid #000000' }}>Given By</th>
                      <th style={{ border: '1px solid #000000' }}>Given To</th>
                      <th style={{ border: '1px solid #000000' }}>Lab Person Sign</th>
                      <th style={{ textAlign: 'center', width: '130px', border: '1px solid #000000' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc7HistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', border: '1px solid #000000' }}>
                          No matching Lab Return Batches records found.
                        </td>
                      </tr>
                    ) : (
                      qc7HistoryLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', border: '1px solid #000000' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.date_time ? log.date_time.split(' ')[0] : ''}</td>
                          <td style={{ fontWeight: 600, border: '1px solid #000000' }}>{log.product_name_field || log.product_name || '-'}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-color)', border: '1px solid #000000' }}>{log.batch_no}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.qty}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.given_by}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.given_to}</td>
                          <td style={{ border: '1px solid #000000' }}>{log.lab_person_sign}</td>
                          <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000000' }}>
                            <button 
                              onClick={() => handleLoadHistoricalQc7(log)} 
                              className="flet-btn flet-btn-blue" 
                              style={{ padding: '4px 10px', height: '24px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View & Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* fallback default view */}
      {activeSubView !== 'live_qc_approval' && 
       activeSubView !== 'lab_report' && 
       activeSubView !== 'raw_material_entry' && 
       activeSubView !== 'past_rm_entries' && 
       activeSubView !== 'production_batches_entry' && 
       activeSubView !== 'past_production_batches' && 
       activeSubView !== 'w-56_rnd_batches_entry' && 
       activeSubView !== 'past_w-56_rnd_batches' && 
       activeSubView !== 'production_batches_filter' && 
       activeSubView !== 'past_batches_filter' && 
       activeSubView !== 'lab_return_batches_entry' && 
       activeSubView !== 'past_lab_return_batches' && (
        <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', gap: '20px' }}>
          <AlertTriangle size={36} color="var(--color-warning)" />
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Quality Control Section Fallback</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '4px auto' }}>
              The module <strong>{activeSubView.split('_').join(' ').toUpperCase()}</strong> interfaces directly with Render cloud database. Please select an active QC folder in the sidebar.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .spin-loader {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .table-scroll-container {
          border: 1px solid #000000 !important;
        }
        .table-scroll-container table th,
        .table-scroll-container table td {
          border: 1px solid #000000 !important;
        }
        .table-scroll-container table input.cell-input {
          border: none;
          background: transparent;
          width: 100%;
          height: 100%;
          padding: 8px;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.85rem;
          transition: background-color var(--transition-fast);
        }
        .table-scroll-container table input.cell-input:focus {
          outline: none;
          background-color: var(--bg-card-hover);
        }
      `}</style>

    </div>
  );
};
export default QcMain;
