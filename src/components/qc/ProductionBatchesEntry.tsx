import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Download,
  Search,
  Eye,
  Table2,
  LayoutGrid,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  RotateCcw,
  CheckCheck,
  Database,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ProductionBatchAPI,
  ProductMasterAPI,
  LiveProductionAPI,
} from '../../services/api';
import {
  type Qc3BatchRow,
  type Qc3ColumnKey,
  QC3_COLUMN_KEYS,
  QC3_METRIC_FIELDS,
  type BatchOverallStatus,
  formatTodayDDMMYYYY,
  parseAndFormatDateTimeDb,
  incrementBatchNumber,
  createEmptyQc3Row,
  createInitialQc3Rows,
  getNextSequentialBatchForRow,
  isQc3RowEntered,
  normalizeQcMetricStatus,
  getBatchOverallStatus,
  computeQc3Insights,
  getDraftStorageKey,
  mergeUniqueOptions,
  getCellPastelBackground,
} from '../../utils/qcBatchHelpers';
import { SmartAutocompleteInput } from './SmartAutocompleteInput';
import { QcMetricPillSelector, QcMetricStatusBadge } from './QcMetricPillSelector';

interface ProductionBatchesEntryProps {
  activeSubView: string;
  productName: string;
  username: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const FROZEN_LEFT_OFFSETS = {
  sr: 0,
  date: 56,
  product_name: 184,
  batch_no: 410,
} as const;

const COLUMN_WIDTHS = {
  sr: 56,
  date: 128,
  product_name: 226,
  batch_no: 140,
  party_name: 210,
  settling: 164,
  shade_variation: 164,
  adhesion: 164,
  perfume: 164,
  water: 164,
  color_bleeding: 164,
  observation: 215,
  remarks: 225,
} as const;

const OVERALL_STATUS_STYLES: Record<
  BatchOverallStatus,
  { label: string; bg: string; border: string; text: string; bar: string }
> = {
  pass: {
    label: 'Passed QC',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    bar: '#059669',
  },
  review: {
    label: 'Pending Review',
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    bar: '#D97706',
  },
  fail: {
    label: 'Failed QC',
    bg: '#FFF1F2',
    border: '#FECDD3',
    text: '#9F1239',
    bar: '#E11D48',
  },
};

interface InitialQc3Draft {
  rows: Qc3BatchRow[];
  hasDraft: boolean;
  timeLabel: string;
}

const readInitialQc3Draft = (draftKey: string): InitialQc3Draft => {
  try {
    const rawDraft = localStorage.getItem(draftKey);
    if (rawDraft) {
      const parsed = JSON.parse(rawDraft);
      if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        const hasDraft = parsed.rows.some(isQc3RowEntered);
        const timeLabel =
          hasDraft && parsed.savedAt
            ? new Date(parsed.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : hasDraft
              ? 'previous session'
              : '';
        return { rows: parsed.rows, hasDraft, timeLabel };
      }
    }
  } catch {
    // Ignore storage parsing issues
  }
  return { rows: createInitialQc3Rows('', 25), hasDraft: false, timeLabel: '' };
};

export const ProductionBatchesEntry: React.FC<ProductionBatchesEntryProps> = props => {
  const draftKey = useMemo(
    () => getDraftStorageKey(props.productName, props.username),
    [props.productName, props.username]
  );
  return <ProductionBatchesEntryInner key={draftKey} draftKey={draftKey} {...props} />;
};

const ProductionBatchesEntryInner: React.FC<ProductionBatchesEntryProps & { draftKey: string }> = ({
  draftKey,
  activeSubView,
  productName,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>(() =>
    activeSubView === 'past_production_batches' ? 'history' : 'entry'
  );
  const [prevSubView, setPrevSubView] = useState(activeSubView);
  if (activeSubView !== prevSubView) {
    setPrevSubView(activeSubView);
    if (activeSubView === 'past_production_batches') {
      setActiveTab('history');
    } else if (activeSubView === 'production_batches_entry') {
      setActiveTab('entry');
    }
  }

  const [viewMode, setViewMode] = useState<'sheet' | 'cards'>('sheet');
  const [loading, setLoading] = useState(false);

  const [latestDbBatch, setLatestDbBatch] = useState('');
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [partyOptions, setPartyOptions] = useState<string[]>([]);

  const [initialDraft] = useState<InitialQc3Draft>(() => readInitialQc3Draft(draftKey));
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(() =>
    initialDraft.hasDraft ? initialDraft.timeLabel : null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(() => initialDraft.hasDraft);
  const [lastLocalSaveTime, setLastLocalSaveTime] = useState<string>(() => initialDraft.timeLabel);

  const [qc3Rows, setQc3Rows] = useState<Qc3BatchRow[]>(() => initialDraft.rows);

  // Card view filters
  const [cardStatusFilter, setCardStatusFilter] = useState<'all' | BatchOverallStatus>('all');
  const [cardSearchQuery, setCardSearchQuery] = useState('');

  // History view states
  const [qc3HistoryQuery, setQc3HistoryQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [qc3HistoryLogs, setQc3HistoryLogs] = useState<any[]>([]);

  // Confirmation modals
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showLoadConfirmModal, setShowLoadConfirmModal] = useState(false);
  const [isSavingExporting, setIsSavingExporting] = useState(false);

  const latestRowsRef = useRef(qc3Rows);
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    latestRowsRef.current = qc3Rows;
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [qc3Rows, hasUnsavedChanges]);

  // Fetch database dropdown options (Product Name, Party Name) and latest sequential batch number
  useEffect(() => {
    let active = true;
    const loadSuggestions = async () => {
      const prodList: string[] = [];
      const partyList: string[] = [];
      let latestBatch = '';

      const [dropdownRes, masterProdRes, pastEntriesRes, liveCompletedRes] = await Promise.allSettled([
        ProductionBatchAPI.getDropdownOptions(productName),
        ProductMasterAPI.getProductsList(),
        ProductionBatchAPI.getPastEntries(productName, undefined, undefined, undefined, 1, 50),
        LiveProductionAPI.getProdCompletedBatches(productName),
      ]);
      if (!active) return;

      if (dropdownRes.status === 'fulfilled') {
        const [ok, data] = dropdownRes.value;
        if (ok && data && typeof data !== 'string') {
          if (Array.isArray(data.products)) prodList.push(...data.products);
          if (Array.isArray(data.parties)) partyList.push(...data.parties);
          if (data.latest_batch_no) latestBatch = String(data.latest_batch_no).trim();
        }
      }

      if (masterProdRes.status === 'fulfilled') {
        const [ok, data] = masterProdRes.value;
        if (ok && data && typeof data !== 'string' && Array.isArray((data as { products?: unknown[] }).products)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const item of (data as { products: any[] }).products) {
            const p = (item?.product || '').trim();
            const sp = (item?.sub_product || '').trim();
            if (p && sp) prodList.push(`${p} - ${sp}`);
            else if (p) prodList.push(p);
          }
        }
      }

      if (pastEntriesRes.status === 'fulfilled') {
        const [ok, data] = pastEntriesRes.value;
        if (ok && data && typeof data !== 'string' && Array.isArray((data as { items?: unknown[] }).items)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const item of (data as { items: any[] }).items) {
            if (item?.product_name) prodList.push(String(item.product_name));
            if (item?.party_name) partyList.push(String(item.party_name));
            if (!latestBatch && item?.batch_no) latestBatch = String(item.batch_no).trim();
          }
        }
      }

      if (liveCompletedRes.status === 'fulfilled') {
        const [ok, data] = liveCompletedRes.value;
        if (ok && data && typeof data !== 'string' && Array.isArray((data as { batches?: unknown[] }).batches)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const b of (data as { batches: any[] }).batches) {
            if (b?.product_name) prodList.push(String(b.product_name));
            if (b?.customer_name) partyList.push(String(b.customer_name));
            if (!latestBatch && b?.batch_no) latestBatch = String(b.batch_no).trim();
          }
        }
      }

      setProductOptions(prev => mergeUniqueOptions(prev, prodList));
      setPartyOptions(prev => mergeUniqueOptions(prev, partyList));
      if (latestBatch) {
        setLatestDbBatch(latestBatch);
        // Update untouched row 0 default batch number if user hasn't edited yet
        setQc3Rows(prev => {
          if (prev.length === 0) return prev;
          const first = prev[0];
          if (first._isDefaultAutoBatch && !isQc3RowEntered(first)) {
            const updated = [...prev];
            updated[0] = {
              ...first,
              date: first.date || formatTodayDDMMYYYY(),
              batch_no: incrementBatchNumber(latestBatch),
            };
            return updated;
          }
          return prev;
        });
      }
    };

    void loadSuggestions();
    return () => {
      active = false;
    };
  }, [productName]);

  // History search handler
  const handleQc3HistorySearch = useCallback(async () => {
    setLoading(true);
    const [success, data] = await ProductionBatchAPI.getPastEntries(
      productName,
      undefined,
      undefined,
      qc3HistoryQuery
    );
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQc3HistoryLogs((data as any).items || []);
    } else {
      onShowToast('No matching Production QC records found.', 'info');
    }
  }, [productName, qc3HistoryQuery, onShowToast]);

  // Auto-load archive logs when navigated directly to past_production_batches
  useEffect(() => {
    if (activeSubView !== 'past_production_batches') return;
    let active = true;
    ProductionBatchAPI.getPastEntries(productName, undefined, undefined, '').then(
      ([success, data]) => {
        if (!active) return;
        if (success && data && typeof data !== 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setQc3HistoryLogs((data as any).items || []);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [activeSubView, productName]);

  // Auto-save buffer to localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (hasUnsavedChanges && qc3Rows.some(isQc3RowEntered)) {
          const now = new Date();
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              rows: qc3Rows,
              savedAt: now.toISOString(),
            })
          );
          setLastLocalSaveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } else if (!hasUnsavedChanges) {
          localStorage.removeItem(draftKey);
        }
      } catch {
        // Ignore storage quota errors
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [qc3Rows, hasUnsavedChanges, draftKey]);

  // Flush localStorage immediately on unmount/pagehide
  useEffect(() => {
    const flushDraft = () => {
      try {
        if (hasUnsavedRef.current && latestRowsRef.current.some(isQc3RowEntered)) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              rows: latestRowsRef.current,
              savedAt: new Date().toISOString(),
            })
          );
        }
      } catch {
        // Ignore
      }
    };
    window.addEventListener('pagehide', flushDraft);
    return () => {
      flushDraft();
      window.removeEventListener('pagehide', flushDraft);
    };
  }, [draftKey]);

  // Warn user on tab close / refresh if unsaved changes exist
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Pad loaded data to at least 25 rows
  const padQc3Rows = (data: Qc3BatchRow[]): Qc3BatchRow[] => {
    const padded = [...data];
    while (padded.length < 25) {
      padded.push(createEmptyQc3Row());
    }
    return padded;
  };

  // Update a single cell with intelligent auto-fill defaults for date & sequential batch number
  const updateQc3Row = useCallback(
    (idx: number, field: Qc3ColumnKey, val: string) => {
      setQc3Rows(prev => {
        const updated = [...prev];
        const current = updated[idx] || createEmptyQc3Row();
        const nextRow: Qc3BatchRow = {
          ...current,
          [field]: val,
        };

        if (field === 'batch_no') {
          nextRow._isDefaultAutoBatch = false;
        } else if (val.trim() !== '') {
          // Auto-populate current date & sequential batch number if blank when user enters data
          if (!nextRow.date.trim()) {
            nextRow.date = formatTodayDDMMYYYY();
          }
          if (!nextRow.batch_no.trim()) {
            nextRow.batch_no = getNextSequentialBatchForRow(prev, idx, latestDbBatch);
          }
          nextRow._isDefaultAutoBatch = false;
        }

        updated[idx] = nextRow;
        return updated;
      });
      setHasUnsavedChanges(true);
    },
    [latestDbBatch]
  );

  // Mark all 6 QC metrics as Pass for a row (quick manager / operator helper)
  const handleMarkRowAllPass = (idx: number) => {
    setQc3Rows(prev => {
      const updated = [...prev];
      const current = updated[idx] || createEmptyQc3Row();
      updated[idx] = {
        ...current,
        date: current.date.trim() ? current.date : formatTodayDDMMYYYY(),
        batch_no: current.batch_no.trim()
          ? current.batch_no
          : getNextSequentialBatchForRow(prev, idx, latestDbBatch),
        _isDefaultAutoBatch: false,
        settling: 'Pass',
        shade_variation: 'Pass',
        adhesion: 'Pass',
        perfume: 'Pass',
        water: 'Pass',
        color_bleeding: 'Pass',
      };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const focusCell = (targetRow: number, targetCol: number) => {
    const colKey = QC3_COLUMN_KEYS[targetCol];
    if (!colKey) return;
    const id = `qc3-input-${targetRow}-${colKey}`;
    const element = document.getElementById(id);
    if (element) {
      element.focus();
      if (element instanceof HTMLInputElement) {
        element.select();
      }
    }
  };

  const prepareRowDefaultsForNextEntry = (targetRowIdx: number) => {
    setQc3Rows(prev => {
      if (targetRowIdx >= prev.length) return prev;
      const prevRow = prev[targetRowIdx - 1];
      const targetRow = prev[targetRowIdx];
      if (!prevRow || !isQc3RowEntered(prevRow)) return prev;
      if (targetRow.date.trim() || targetRow.batch_no.trim()) return prev;

      const updated = [...prev];
      updated[targetRowIdx] = {
        ...targetRow,
        date: formatTodayDDMMYYYY(),
        batch_no: getNextSequentialBatchForRow(prev, targetRowIdx, latestDbBatch),
        _isDefaultAutoBatch: true,
      };
      return updated;
    });
  };

  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const totalCols = QC3_COLUMN_KEYS.length;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        const targetRow = Math.max(0, rowIndex - 1);
        focusCell(targetRow, colIndex);
        return;
      }

      const targetRow = rowIndex + 1;
      if (targetRow >= qc3Rows.length) {
        setQc3Rows(prev => {
          const nextBatch = getNextSequentialBatchForRow(prev, prev.length, latestDbBatch);
          return [
            ...prev,
            {
              ...createEmptyQc3Row(),
              date: formatTodayDDMMYYYY(),
              batch_no: nextBatch,
              _isDefaultAutoBatch: true,
            },
          ];
        });
        window.setTimeout(() => focusCell(targetRow, colIndex), 20);
      } else {
        prepareRowDefaultsForNextEntry(targetRow);
        window.setTimeout(() => focusCell(targetRow, colIndex), 0);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (colIndex > 0) {
          focusCell(rowIndex, colIndex - 1);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, totalCols - 1);
        }
        return;
      }

      if (colIndex < totalCols - 1) {
        focusCell(rowIndex, colIndex + 1);
      } else {
        const nextRow = rowIndex + 1;
        if (nextRow >= qc3Rows.length) {
          setQc3Rows(prev => [
            ...prev,
            {
              ...createEmptyQc3Row(),
              date: formatTodayDDMMYYYY(),
              batch_no: getNextSequentialBatchForRow(prev, prev.length, latestDbBatch),
              _isDefaultAutoBatch: true,
            },
          ]);
          window.setTimeout(() => focusCell(nextRow, 0), 20);
        } else {
          prepareRowDefaultsForNextEntry(nextRow);
          window.setTimeout(() => focusCell(nextRow, 0), 0);
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(Math.max(0, rowIndex - 1), colIndex);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(Math.min(qc3Rows.length - 1, rowIndex + 1), colIndex);
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (e.currentTarget instanceof HTMLInputElement) {
        const input = e.currentTarget;
        const atStart = (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
        if (!atStart && input.value !== '') return;
      }
      e.preventDefault();
      if (colIndex > 0) focusCell(rowIndex, colIndex - 1);
      return;
    }

    if (e.key === 'ArrowRight') {
      if (e.currentTarget instanceof HTMLInputElement) {
        const input = e.currentTarget;
        const len = input.value.length;
        const atEnd = (input.selectionStart ?? len) === len && (input.selectionEnd ?? len) === len;
        if (!atEnd && input.value !== '') return;
      }
      e.preventDefault();
      if (colIndex < totalCols - 1) focusCell(rowIndex, colIndex + 1);
    }
  };

  // Add / Auto-Fill next batch row
  const handleAddOrAutoFillNext = () => {
    const firstEmptyIdx = qc3Rows.findIndex(r => !isQc3RowEntered(r) && !r._isDefaultAutoBatch);
    if (firstEmptyIdx !== -1) {
      const nextBatch = getNextSequentialBatchForRow(qc3Rows, firstEmptyIdx, latestDbBatch);
      setQc3Rows(prev => {
        const updated = [...prev];
        updated[firstEmptyIdx] = {
          ...updated[firstEmptyIdx],
          date: updated[firstEmptyIdx].date || formatTodayDDMMYYYY(),
          batch_no: updated[firstEmptyIdx].batch_no || nextBatch,
          _isDefaultAutoBatch: true,
        };
        return updated;
      });
      if (viewMode === 'sheet') {
        window.setTimeout(() => focusCell(firstEmptyIdx, 1), 15);
      }
      onShowToast(`Row ${firstEmptyIdx + 1} auto-filled with today's date & batch ${nextBatch}.`, 'info');
      return;
    }

    // All rows are active -> append a new row
    const newIndex = qc3Rows.length;
    const nextBatch = getNextSequentialBatchForRow(qc3Rows, newIndex, latestDbBatch);
    setQc3Rows(prev => [
      ...prev,
      {
        ...createEmptyQc3Row(),
        date: formatTodayDDMMYYYY(),
        batch_no: nextBatch,
        _isDefaultAutoBatch: true,
      },
    ]);
    if (viewMode === 'sheet') {
      window.setTimeout(() => focusCell(newIndex, 1), 20);
    }
    onShowToast(`Added row ${newIndex + 1} with batch ${nextBatch}.`, 'info');
  };

  // Add batch card from Card View
  const handleAddBatchCard = () => {
    let targetIdx = qc3Rows.findIndex(r => !isQc3RowEntered(r));
    if (targetIdx === -1) {
      targetIdx = qc3Rows.length;
    }
    const nextBatch = getNextSequentialBatchForRow(qc3Rows, targetIdx, latestDbBatch);
    setQc3Rows(prev => {
      const updated = [...prev];
      const baseRow: Qc3BatchRow = {
        ...(updated[targetIdx] || createEmptyQc3Row()),
        date: updated[targetIdx]?.date || formatTodayDDMMYYYY(),
        batch_no: updated[targetIdx]?.batch_no || nextBatch,
        _isDefaultAutoBatch: false,
      };
      if (targetIdx >= updated.length) {
        updated.push(baseRow);
      } else {
        updated[targetIdx] = baseRow;
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    setCardStatusFilter('all');
  };

  // Load saved entries from backend
  const executeQc3Load = async () => {
    setShowLoadConfirmModal(false);
    setLoading(true);
    const [success, data] = await ProductionBatchAPI.getPastEntries(
      productName,
      undefined,
      undefined,
      undefined,
      1,
      25
    );
    setLoading(false);

    if (success && data && typeof data !== 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (data as any).items || [];
      if (items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: Qc3BatchRow[] = items.map((item: any) => ({
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
          remarks: item.remarks || '',
          _isDefaultAutoBatch: false,
        }));

        setQc3Rows(padQc3Rows(mapped));
        setHasUnsavedChanges(false);
        setRestoredDraftAt(null);
        localStorage.removeItem(draftKey);
        if (mapped[0]?.batch_no) {
          setLatestDbBatch(mapped[0].batch_no);
        }
        onShowToast('Production QC records loaded successfully.', 'success');
      } else {
        onShowToast('No active Production QC records found.', 'info');
      }
    } else {
      onShowToast('Failed to load past production records.', 'error');
    }
  };

  const handleRequestLoad = () => {
    if (hasUnsavedChanges) {
      setShowLoadConfirmModal(true);
    } else {
      executeQc3Load();
    }
  };

  // Clear sheet (requires confirmation modal)
  const executeQc3Clear = () => {
    setShowClearConfirmModal(false);
    setQc3Rows(createInitialQc3Rows(latestDbBatch, 25));
    setHasUnsavedChanges(false);
    setRestoredDraftAt(null);
    setLastLocalSaveTime('');
    localStorage.removeItem(draftKey);
    onShowToast('Production batches QC sheet cleared.', 'info');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLoadHistoricalQc3 = (item: any) => {
    if (!item) {
      onShowToast('Could not load details for this record.', 'error');
      return;
    }
    const mapped: Qc3BatchRow = {
      date: item.date_time ? item.date_time.split(' ')[0] : formatTodayDDMMYYYY(),
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
      remarks: item.remarks || '',
      _isDefaultAutoBatch: false,
    };
    const newRows = createInitialQc3Rows(latestDbBatch, 25);
    newRows[0] = mapped;
    setQc3Rows(newRows);
    setHasUnsavedChanges(false);
    setRestoredDraftAt(null);
    setActiveTab('entry');
    onShowToast(`Record for batch ${item.batch_no} loaded into the sheet.`, 'success');
  };

  // Save to database & download PDF
  const handleQc3SaveAndExport = async () => {
    const activeRows = qc3Rows.filter(isQc3RowEntered);
    const entriesToSave = activeRows.map(r => ({
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
      remarks: r.remarks || '',
    }));

    if (entriesToSave.length === 0) {
      onShowToast('Please fill in at least one production batch QC row.', 'warning');
      return;
    }

    setIsSavingExporting(true);
    setLoading(true);
    const [success, response] = await ProductionBatchAPI.saveEntries(productName, entriesToSave);
    setLoading(false);
    setIsSavingExporting(false);

    if (success) {
      onShowToast('Production batch QC records saved successfully! Generating PDF...', 'success');

      // Learn newly saved options immediately for future autocomplete
      setProductOptions(prev => mergeUniqueOptions(prev, entriesToSave.map(e => e.product_name)));
      setPartyOptions(prev => mergeUniqueOptions(prev, entriesToSave.map(e => e.party_name)));

      const lastSavedBatch = [...entriesToSave]
        .reverse()
        .find(e => e.batch_no.trim() !== '')?.batch_no || latestDbBatch;
      if (lastSavedBatch) {
        setLatestDbBatch(lastSavedBatch);
      }

      try {
        const doc = new jsPDF('l', 'mm', 'a4');
        const todayStr = new Date().toLocaleDateString();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('PRODUCTION BATCHES QC AUDIT LEDGER', 148, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${todayStr}`, 282, 23, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('QC PARAMETERS CHECKLIST', 15, 29);

        const headers = [
          'Sr',
          'Date',
          'Product Name',
          'Batch No.',
          'Party Name',
          'Settling',
          'Shade Var.',
          'Adhesion',
          'Perfume',
          'Water',
          'Color Bleed',
          'Observation',
          'Remarks',
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
          e.remarks,
        ]);

        autoTable(doc, {
          head: [headers],
          body,
          startY: 32,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
          headStyles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
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
            12: { cellWidth: 35, halign: 'left' },
          },
        });

        doc.save('Production_Batches_QC_Report.pdf');
      } catch (err) {
        console.error('PDF generation failed:', err);
      }

      localStorage.removeItem(draftKey);
      setHasUnsavedChanges(false);
      setRestoredDraftAt(null);
      setLastLocalSaveTime('');
      setQc3Rows(createInitialQc3Rows(lastSavedBatch, 25));
    } else {
      onShowToast(`Failed to save QC entries: ${response}`, 'error');
    }
  };

  // Close confirmation modal on Escape
  useEffect(() => {
    if (!showClearConfirmModal && !showLoadConfirmModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowClearConfirmModal(false);
        setShowLoadConfirmModal(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showClearConfirmModal, showLoadConfirmModal]);

  const insights = useMemo(() => computeQc3Insights(qc3Rows), [qc3Rows]);

  const cardViewItems = useMemo(() => {
    const query = cardSearchQuery.trim().toLowerCase();
    return qc3Rows
      .map((row, idx) => ({ row, idx, status: getBatchOverallStatus(row) }))
      .filter(({ row, status }) => {
        if (!isQc3RowEntered(row)) return false;
        if (cardStatusFilter !== 'all' && status !== cardStatusFilter) return false;
        if (query) {
          const matchesQuery =
            row.batch_no.toLowerCase().includes(query) ||
            row.product_name.toLowerCase().includes(query) ||
            row.party_name.toLowerCase().includes(query) ||
            row.observation.toLowerCase().includes(query);
          if (!matchesQuery) return false;
        }
        return true;
      });
  }, [qc3Rows, cardStatusFilter, cardSearchQuery]);

  // Combined live autocomplete options (DB options + values currently typed in sheet)
  const effectiveProductOptions = useMemo(
    () => mergeUniqueOptions(productOptions, qc3Rows.map(r => r.product_name)),
    [productOptions, qc3Rows]
  );

  const effectivePartyOptions = useMemo(
    () => mergeUniqueOptions(partyOptions, qc3Rows.map(r => r.party_name)),
    [partyOptions, qc3Rows]
  );

  return (
    <div
      className="qc3-workspace animated-fade"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        minHeight: 'calc(100vh - 94px)',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '16px 20px 0 20px',
        position: 'relative',
      }}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'white' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#059669',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }}
            />
            <span style={{ fontWeight: 600 }}>Syncing with database...</span>
          </div>
        </div>
      )}

      {/* Top Navigation Tabs + View Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'entry' ? '#FFFFFF' : 'transparent',
              border: activeTab === 'entry' ? '1px solid #E2E8F0' : '1px solid transparent',
              borderBottom: activeTab === 'entry' ? '2px solid #059669' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'entry' ? '#0F172A' : '#64748B',
              fontWeight: activeTab === 'entry' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FileSpreadsheet size={15} color={activeTab === 'entry' ? '#059669' : '#64748B'} />
            Production QC Data Entry
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              handleQc3HistorySearch();
            }}
            style={{
              padding: '8px 16px',
              background: activeTab === 'history' ? '#FFFFFF' : 'transparent',
              border: activeTab === 'history' ? '1px solid #E2E8F0' : '1px solid transparent',
              borderBottom: activeTab === 'history' ? '2px solid #059669' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'history' ? '#0F172A' : '#64748B',
              fontWeight: activeTab === 'history' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Archive History Logs
          </button>
        </div>

        {/* Right Controls: DB Sync Indicator + View Mode Switcher */}
        {activeTab === 'entry' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {restoredDraftAt && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#92400E',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
              >
                <Clock size={12} />
                <span>Draft restored ({restoredDraftAt})</span>
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#B45309',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: 0,
                  }}
                >
                  Discard
                </button>
              </div>
            )}

            <div
              title={`Loaded ${effectiveProductOptions.length} products and ${effectivePartyOptions.length} parties from database`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Database size={12} color="#059669" />
              <span>
                {effectiveProductOptions.length} Products · {effectivePartyOptions.length} Parties
              </span>
            </div>

            {/* View Toggle */}
            <div
              role="group"
              aria-label="View mode toggle"
              style={{
                display: 'inline-flex',
                backgroundColor: '#E2E8F0',
                padding: '3px',
                borderRadius: '8px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                aria-pressed={viewMode === 'sheet'}
                onClick={() => setViewMode('sheet')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: viewMode === 'sheet' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'sheet' ? '#0F172A' : '#475569',
                  boxShadow: viewMode === 'sheet' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                }}
              >
                <Table2 size={14} />
                Sheet View
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'cards'}
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: viewMode === 'cards' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'cards' ? '#0F172A' : '#475569',
                  boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                }}
              >
                <LayoutGrid size={14} />
                Cards View
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'entry' ? (
        <>
          {/* Quick Batch Insights Header (Mini KPI Dashboard) */}
          <div
            aria-label="Quick Batch Insights"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            {/* Total Batches Entered */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Batches Entered
                </div>
                <div data-testid="kpi-total-entered" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginTop: '2px' }}>
                  {insights.totalEntered}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
                  of {qc3Rows.length} sheet rows
                </div>
              </div>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#F1F5F9',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={18} />
              </div>
            </div>

            {/* Passed QC */}
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Passed QC
                </div>
                <div data-testid="kpi-passed-qc" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065F46', lineHeight: 1.2, marginTop: '2px' }}>
                  {insights.passedCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '2px' }}>
                  {insights.totalEntered > 0 ? `${insights.passRatePct}% pass rate` : 'No batches yet'}
                </div>
              </div>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#D1FAE5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={18} />
              </div>
            </div>

            {/* Pending Review */}
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pending Review
                </div>
                <div data-testid="kpi-pending-review" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#92400E', lineHeight: 1.2, marginTop: '2px' }}>
                  {insights.pendingReviewCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#B45309', marginTop: '2px' }}>
                  Incomplete or review flagged
                </div>
              </div>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={18} />
              </div>
            </div>

            {/* Failed QC */}
            <div
              style={{
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9F1239', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Failed / Hold
                </div>
                <div data-testid="kpi-failed-qc" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#9F1239', lineHeight: 1.2, marginTop: '2px' }}>
                  {insights.failedCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#BE123C', marginTop: '2px' }}>
                  Requires QC action
                </div>
              </div>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#FFE4E6',
                  color: '#E11D48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <XCircle size={18} />
              </div>
            </div>
          </div>

          {/* VIEW 1: DENSE SPREADSHEET VIEW */}
          {viewMode === 'sheet' ? (
            <div
              className="qc3-table-scroll-container"
              style={{
                flex: 1,
                minHeight: '340px',
                maxHeight: 'calc(100vh - 320px)',
                overflow: 'auto',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
              }}
            >
              <table
                className="qc3-sheet-table"
                style={{
                  minWidth: '2172px',
                  width: '100%',
                  tableLayout: 'fixed',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: '0.76rem',
                }}
              >
                <colgroup>
                  <col style={{ width: `${COLUMN_WIDTHS.sr}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.date}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.product_name}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.batch_no}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.party_name}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.settling}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.shade_variation}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.adhesion}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.perfume}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.water}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.color_bleeding}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.observation}px` }} />
                  <col style={{ width: `${COLUMN_WIDTHS.remarks}px` }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className="qc3-frozen-col"
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: `${FROZEN_LEFT_OFFSETS.sr}px`,
                        zIndex: 30,
                        backgroundColor: '#0F172A',
                        color: '#F8FAFC',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        padding: '10px 4px',
                        borderRight: '1px solid #1E293B',
                        borderBottom: '1px solid #334155',
                        textAlign: 'center',
                      }}
                    >
                      Sr
                    </th>
                    <th
                      className="qc3-frozen-col"
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: `${FROZEN_LEFT_OFFSETS.date}px`,
                        zIndex: 30,
                        backgroundColor: '#0F172A',
                        color: '#F8FAFC',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        padding: '10px 6px',
                        borderRight: '1px solid #1E293B',
                        borderBottom: '1px solid #334155',
                        textAlign: 'center',
                      }}
                    >
                      Date
                    </th>
                    <th
                      className="qc3-frozen-col"
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: `${FROZEN_LEFT_OFFSETS.product_name}px`,
                        zIndex: 30,
                        backgroundColor: '#0F172A',
                        color: '#F8FAFC',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        padding: '10px 8px',
                        borderRight: '1px solid #1E293B',
                        borderBottom: '1px solid #334155',
                        textAlign: 'left',
                      }}
                    >
                      Product Name
                    </th>
                    <th
                      className="qc3-frozen-col qc3-frozen-edge"
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: `${FROZEN_LEFT_OFFSETS.batch_no}px`,
                        zIndex: 30,
                        backgroundColor: '#0F172A',
                        color: '#F8FAFC',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        padding: '10px 6px',
                        borderRight: '2px solid #475569',
                        borderBottom: '1px solid #334155',
                        boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.35)',
                        textAlign: 'center',
                      }}
                    >
                      Batch No.
                    </th>
                    <th style={nonFrozenHeaderStyle}>Party Name</th>
                    <th style={nonFrozenHeaderStyle}>Settling</th>
                    <th style={nonFrozenHeaderStyle}>Shade Var.</th>
                    <th style={nonFrozenHeaderStyle}>Adhesion</th>
                    <th style={nonFrozenHeaderStyle}>Perfume</th>
                    <th style={nonFrozenHeaderStyle}>Water</th>
                    <th style={nonFrozenHeaderStyle}>Color Bleed</th>
                    <th style={{ ...nonFrozenHeaderStyle, textAlign: 'left', paddingLeft: '8px' }}>Observation</th>
                    <th style={{ ...nonFrozenHeaderStyle, textAlign: 'left', paddingLeft: '8px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {qc3Rows.map((r, idx) => {
                    const entered = isQc3RowEntered(r);
                    const overall = entered ? getBatchOverallStatus(r) : null;
                    const srDotColor =
                      overall === 'pass'
                        ? '#059669'
                        : overall === 'fail'
                          ? '#E11D48'
                          : overall === 'review'
                            ? '#D97706'
                            : 'transparent';
                    const frozenRowBg =
                      overall === 'pass'
                        ? '#F6FEF9'
                        : overall === 'fail'
                          ? '#FFF8F9'
                          : overall === 'review'
                            ? '#FFFCF2'
                            : '#FFFFFF';

                    return (
                      <tr key={idx} className="qc3-grid-row" style={{ height: '38px' }}>
                        {/* Col 0: Frozen Sr */}
                        <td
                          className="qc3-frozen-col"
                          style={{
                            position: 'sticky',
                            left: `${FROZEN_LEFT_OFFSETS.sr}px`,
                            zIndex: 10,
                            backgroundColor: '#F8FAFC',
                            borderRight: '1px solid #E2E8F0',
                            borderBottom: '1px solid #E2E8F0',
                            textAlign: 'center',
                            fontWeight: 600,
                            color: '#475569',
                            padding: '0 4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: srDotColor,
                                flexShrink: 0,
                              }}
                            />
                            <span>{idx + 1}</span>
                          </div>
                        </td>

                        {/* Col 1: Frozen Date */}
                        <td
                          className="qc3-frozen-col"
                          style={{
                            position: 'sticky',
                            left: `${FROZEN_LEFT_OFFSETS.date}px`,
                            zIndex: 10,
                            backgroundColor: frozenRowBg,
                            borderRight: '1px solid #E2E8F0',
                            borderBottom: '1px solid #E2E8F0',
                            padding: 0,
                          }}
                        >
                          <input
                            id={`qc3-input-${idx}-date`}
                            type="text"
                            className="qc3-inline-input"
                            style={{ textAlign: 'center', color: r._isDefaultAutoBatch && !entered ? '#64748B' : '#0F172A' }}
                            value={r.date}
                            onChange={e => updateQc3Row(idx, 'date', e.target.value)}
                            onKeyDown={e => handleGridKeyDown(e, idx, 0)}
                            aria-label={`Row ${idx + 1} Date`}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </td>

                        {/* Col 2: Frozen Product Name (Smart Autocomplete) */}
                        <td
                          className="qc3-frozen-col"
                          style={{
                            position: 'sticky',
                            left: `${FROZEN_LEFT_OFFSETS.product_name}px`,
                            zIndex: 10,
                            backgroundColor: frozenRowBg,
                            borderRight: '1px solid #E2E8F0',
                            borderBottom: '1px solid #E2E8F0',
                            padding: 0,
                          }}
                        >
                          <SmartAutocompleteInput
                            id={`qc3-input-${idx}-product_name`}
                            value={r.product_name}
                            options={effectiveProductOptions}
                            emptyLabel="No matching products in database"
                            ariaLabel={`Row ${idx + 1} Product Name`}
                            onChange={val => updateQc3Row(idx, 'product_name', val)}
                            onGridKeyDown={e => handleGridKeyDown(e, idx, 1)}
                            style={{ fontWeight: 500, color: '#0F172A' }}
                          />
                        </td>

                        {/* Col 3: Frozen Batch No. */}
                        <td
                          className="qc3-frozen-col qc3-frozen-edge"
                          style={{
                            position: 'sticky',
                            left: `${FROZEN_LEFT_OFFSETS.batch_no}px`,
                            zIndex: 10,
                            backgroundColor: frozenRowBg,
                            borderRight: '2px solid #CBD5E1',
                            borderBottom: '1px solid #E2E8F0',
                            boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.12)',
                            padding: 0,
                          }}
                        >
                          <input
                            id={`qc3-input-${idx}-batch_no`}
                            type="text"
                            className="qc3-inline-input"
                            style={{
                              textAlign: 'center',
                              fontWeight: 700,
                              color: r._isDefaultAutoBatch && !entered ? '#64748B' : '#0F172A',
                            }}
                            value={r.batch_no}
                            onChange={e => updateQc3Row(idx, 'batch_no', e.target.value)}
                            onKeyDown={e => handleGridKeyDown(e, idx, 2)}
                            aria-label={`Row ${idx + 1} Batch No`}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </td>

                        {/* Col 4: Party Name (Smart Autocomplete) */}
                        <td style={bodyCellStyle}>
                          <SmartAutocompleteInput
                            id={`qc3-input-${idx}-party_name`}
                            value={r.party_name}
                            options={effectivePartyOptions}
                            emptyLabel="No matching parties in database"
                            ariaLabel={`Row ${idx + 1} Party Name`}
                            onChange={val => updateQc3Row(idx, 'party_name', val)}
                            onGridKeyDown={e => handleGridKeyDown(e, idx, 3)}
                          />
                        </td>

                        {/* Cols 5..10: Context-Aware QC Metric Pill Selectors */}
                        {QC3_METRIC_FIELDS.map((metric, mOffset) => {
                          const colIdx = 4 + mOffset;
                          const metricVal = r[metric.key];
                          const status = normalizeQcMetricStatus(metricVal);
                          return (
                            <td
                              key={metric.key}
                              style={{
                                ...bodyCellStyle,
                                backgroundColor: getCellPastelBackground(status),
                              }}
                            >
                              <QcMetricPillSelector
                                id={`qc3-input-${idx}-${metric.key}`}
                                value={metricVal}
                                ariaLabel={`Row ${idx + 1} ${metric.label}`}
                                onChange={val => updateQc3Row(idx, metric.key, val)}
                                onGridKeyDown={e => handleGridKeyDown(e, idx, colIdx)}
                              />
                            </td>
                          );
                        })}

                        {/* Col 11: Observation */}
                        <td style={bodyCellStyle}>
                          <input
                            id={`qc3-input-${idx}-observation`}
                            type="text"
                            className="qc3-inline-input"
                            value={r.observation}
                            onChange={e => updateQc3Row(idx, 'observation', e.target.value)}
                            onKeyDown={e => handleGridKeyDown(e, idx, 10)}
                            aria-label={`Row ${idx + 1} Observation`}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </td>

                        {/* Col 12: Remarks */}
                        <td style={bodyCellStyle}>
                          <input
                            id={`qc3-input-${idx}-remarks`}
                            type="text"
                            className="qc3-inline-input"
                            value={r.remarks}
                            onChange={e => updateQc3Row(idx, 'remarks', e.target.value)}
                            onKeyDown={e => handleGridKeyDown(e, idx, 11)}
                            aria-label={`Row ${idx + 1} Remarks`}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW 2: CARD-BASED VISUAL SUMMARY (MANAGER REVIEWS) */
            <div
              style={{
                flex: 1,
                minHeight: '340px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Card Filter Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {(
                    [
                      { key: 'all', label: `All (${insights.totalEntered})`, bg: '#F1F5F9', text: '#0F172A', border: '#CBD5E1' },
                      { key: 'pass', label: `Passed (${insights.passedCount})`, bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
                      { key: 'review', label: `Pending Review (${insights.pendingReviewCount})`, bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
                      { key: 'fail', label: `Failed (${insights.failedCount})`, bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
                    ] as const
                  ).map(f => {
                    const active = cardStatusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setCardStatusFilter(f.key)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '999px',
                          border: `1px solid ${active ? f.border : '#E2E8F0'}`,
                          backgroundColor: active ? f.bg : '#FFFFFF',
                          color: active ? f.text : '#64748B',
                          fontSize: '0.76rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                    <input
                      type="text"
                      value={cardSearchQuery}
                      onChange={e => setCardSearchQuery(e.target.value)}
                      placeholder="Filter batch, product, party..."
                      style={{
                        width: '100%',
                        height: '32px',
                        paddingLeft: '30px',
                        paddingRight: '10px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        fontSize: '0.78rem',
                        color: '#0F172A',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBatchCard}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '32px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} />
                    Add Batch Card
                  </button>
                </div>
              </div>

              {cardViewItems.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '10px',
                    padding: '48px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <LayoutGrid size={32} color="#94A3B8" />
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                      {insights.totalEntered === 0
                        ? 'No batches entered yet'
                        : 'No batches match the selected filter'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                      {insights.totalEntered === 0
                        ? 'Start typing in Sheet View or click "Add Batch Card" to log a production batch.'
                        : 'Clear your search query or switch to "All" to inspect all active batches.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('sheet')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Open Sheet View
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBatchCard}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #047857',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Add Batch Card
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                    gap: '14px',
                    paddingBottom: '12px',
                  }}
                >
                  {cardViewItems.map(({ row, idx, status }) => {
                    const badgeStyle = OVERALL_STATUS_STYLES[status];
                    const completedCount = QC3_METRIC_FIELDS.filter(
                      m => normalizeQcMetricStatus(row[m.key]) !== 'empty'
                    ).length;

                    return (
                      <div
                        key={idx}
                        data-testid={`batch-summary-card-${idx}`}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderTop: `3px solid ${badgeStyle.bar}`,
                          borderRadius: '10px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                        }}
                      >
                        {/* Card Top Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#475569',
                                backgroundColor: '#F1F5F9',
                                padding: '2px 7px',
                                borderRadius: '6px',
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={row.batch_no}
                              onChange={e => updateQc3Row(idx, 'batch_no', e.target.value)}
                              placeholder="Batch No."
                              aria-label={`Card ${idx + 1} Batch No`}
                              style={{
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                color: '#0F172A',
                                border: '1px solid transparent',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                width: '120px',
                                backgroundColor: '#F8FAFC',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={row.date}
                              onChange={e => updateQc3Row(idx, 'date', e.target.value)}
                              placeholder={formatTodayDDMMYYYY()}
                              aria-label={`Card ${idx + 1} Date`}
                              style={{
                                fontSize: '0.74rem',
                                color: '#475569',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                width: '92px',
                                textAlign: 'center',
                                backgroundColor: '#FFFFFF',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: badgeStyle.bg,
                                border: `1px solid ${badgeStyle.border}`,
                                color: badgeStyle.text,
                                padding: '3px 9px',
                                borderRadius: '999px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {badgeStyle.label}
                            </span>
                          </div>
                        </div>

                        {/* Product & Party Inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                              Product Name
                            </span>
                            <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', height: '32px' }}>
                              <SmartAutocompleteInput
                                value={row.product_name}
                                options={effectiveProductOptions}
                                placeholder="Product Name..."
                                onChange={val => updateQc3Row(idx, 'product_name', val)}
                                ariaLabel={`Card ${idx + 1} Product Name`}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                              Party Name
                            </span>
                            <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', height: '32px' }}>
                              <SmartAutocompleteInput
                                value={row.party_name}
                                options={effectivePartyOptions}
                                placeholder="Party Name..."
                                onChange={val => updateQc3Row(idx, 'party_name', val)}
                                ariaLabel={`Card ${idx + 1} Party Name`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2x3 QC Metrics Visual Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                          {QC3_METRIC_FIELDS.map(metric => {
                            const mStatus = normalizeQcMetricStatus(row[metric.key]);
                            return (
                              <div
                                key={metric.key}
                                style={{
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  backgroundColor: getCellPastelBackground(mStatus) || '#F8FAFC',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#475569',
                                    borderBottom: '1px solid #E2E8F0',
                                    backgroundColor: '#F8FAFC',
                                  }}
                                >
                                  {metric.label}
                                </div>
                                <QcMetricPillSelector
                                  compact
                                  value={row[metric.key]}
                                  ariaLabel={`Card ${idx + 1} ${metric.label}`}
                                  onChange={val => updateQc3Row(idx, metric.key, val)}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Observation & Remarks */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            value={row.observation}
                            onChange={e => updateQc3Row(idx, 'observation', e.target.value)}
                            placeholder="Observation..."
                            style={{
                              height: '30px',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              padding: '0 8px',
                              fontSize: '0.75rem',
                              color: '#0F172A',
                              backgroundColor: '#F8FAFC',
                            }}
                          />
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={e => updateQc3Row(idx, 'remarks', e.target.value)}
                            placeholder="Remarks..."
                            style={{
                              height: '30px',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              padding: '0 8px',
                              fontSize: '0.75rem',
                              color: '#0F172A',
                              backgroundColor: '#F8FAFC',
                            }}
                          />
                        </div>

                        {/* Card Footer */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid #F1F5F9',
                            paddingTop: '8px',
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
                            {completedCount}/6 QC checks recorded
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleMarkRowAllPass(idx)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #A7F3D0',
                                backgroundColor: '#ECFDF5',
                                color: '#065F46',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <CheckCheck size={12} />
                              Mark All Pass
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode('sheet');
                                window.setTimeout(() => focusCell(idx, 1), 40);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#334155',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Edit in Sheet
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STICKY ACTION BAR */}
          <div
            data-testid="qc3-sticky-action-bar"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 40,
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)',
              padding: '12px 20px',
              margin: '0 -20px',
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            {/* Left status & quick-entry helpers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 11px',
                  borderRadius: '999px',
                  backgroundColor: hasUnsavedChanges ? '#FFFBEB' : '#ECFDF5',
                  border: `1px solid ${hasUnsavedChanges ? '#FDE68A' : '#A7F3D0'}`,
                  color: hasUnsavedChanges ? '#92400E' : '#065F46',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: hasUnsavedChanges ? '#D97706' : '#059669',
                  }}
                />
                {hasUnsavedChanges
                  ? `Unsaved changes${lastLocalSaveTime ? ` · Auto-saved ${lastLocalSaveTime}` : ''}`
                  : 'All changes synced · Auto-save ready'}
              </div>

              <button
                type="button"
                onClick={handleAddOrAutoFillNext}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Populate today's date and sequential batch number on the next row"
              >
                <Sparkles size={14} color="#059669" />
                Auto-Fill Next
              </button>
            </div>

            {/* Right Calibrated Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRequestLoad}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={14} />
                Load
              </button>

              {/* Muted Terracotta Outline Clear Sheet Button */}
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2A998',
                  backgroundColor: '#FFFFFF',
                  color: '#B85035',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#FDF4F1';
                  e.currentTarget.style.borderColor = '#C25E44';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#E2A998';
                }}
              >
                <Trash2 size={14} />
                Clear Sheet
              </button>

              {/* Hero Emerald Save & Download PDF Button */}
              <button
                type="button"
                onClick={handleQc3SaveAndExport}
                disabled={isSavingExporting}
                style={{
                  height: '40px',
                  padding: '0 22px',
                  borderRadius: '8px',
                  border: '1px solid #047857',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: isSavingExporting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.28)',
                  opacity: isSavingExporting ? 0.75 : 1,
                }}
                onMouseEnter={e => {
                  if (!isSavingExporting) e.currentTarget.style.backgroundColor = '#047857';
                }}
                onMouseLeave={e => {
                  if (!isSavingExporting) e.currentTarget.style.backgroundColor = '#059669';
                }}
              >
                <Download size={15} />
                Save & Download PDF
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ARCHIVE HISTORY LOGS TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, paddingBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              padding: '14px',
              borderRadius: '10px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div className="form-input-container" style={{ flexGrow: 1, minWidth: '240px' }}>
              <span className="form-label" style={{ color: '#475569' }}>
                Search QC Batches
              </span>
              <input
                type="text"
                className="field-input"
                style={{
                  height: '36px',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                }}
                placeholder="Search by batch number or product name..."
                value={qc3HistoryQuery}
                onChange={e => setQc3HistoryQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleQc3HistorySearch();
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleQc3HistorySearch}
              style={{
                height: '36px',
                padding: '0 20px',
                borderRadius: '8px',
                border: '1px solid #0F172A',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.84rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <Search size={15} /> Search logs
            </button>
          </div>

          <div
            className="qc3-table-scroll-container"
            style={{
              flex: 1,
              maxHeight: 'calc(100vh - 300px)',
              overflow: 'auto',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
            }}
          >
            <table
              className="qc3-sheet-table"
              style={{
                minWidth: '1920px',
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '0.78rem',
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...frozenHistoryHeaderStyle, left: '0px', width: '64px' }}>Sr</th>
                  <th style={{ ...frozenHistoryHeaderStyle, left: '64px', width: '130px' }}>Batch No</th>
                  <th style={{ ...frozenHistoryHeaderStyle, left: '194px', width: '130px' }}>Logged Date</th>
                  <th
                    style={{
                      ...frozenHistoryHeaderStyle,
                      left: '324px',
                      width: '220px',
                      borderRight: '2px solid #475569',
                      boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.35)',
                    }}
                  >
                    Product Name
                  </th>
                  <th style={nonFrozenHeaderStyle}>Party Name</th>
                  <th style={nonFrozenHeaderStyle}>Settling</th>
                  <th style={nonFrozenHeaderStyle}>Shade Var.</th>
                  <th style={nonFrozenHeaderStyle}>Adhesion</th>
                  <th style={nonFrozenHeaderStyle}>Perfume</th>
                  <th style={nonFrozenHeaderStyle}>Water</th>
                  <th style={nonFrozenHeaderStyle}>Color Bleed</th>
                  <th style={nonFrozenHeaderStyle}>Observation</th>
                  <th style={nonFrozenHeaderStyle}>Remarks</th>
                  <th style={{ ...nonFrozenHeaderStyle, width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {qc3HistoryLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      style={{
                        textAlign: 'center',
                        padding: '32px',
                        color: '#64748B',
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      No matching Production QC reports found.
                    </td>
                  </tr>
                ) : (
                  qc3HistoryLogs.map((log, idx) => (
                    <tr key={idx} style={{ height: '40px' }}>
                      <td style={{ ...frozenHistoryCellStyle, left: '0px', backgroundColor: '#F8FAFC', textAlign: 'center' }}>
                        {idx + 1}
                      </td>
                      <td style={{ ...frozenHistoryCellStyle, left: '64px', fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
                        {log.batch_no}
                      </td>
                      <td style={{ ...frozenHistoryCellStyle, left: '194px', textAlign: 'center', color: '#475569' }}>
                        {log.date_time ? log.date_time.split(' ')[0] : ''}
                      </td>
                      <td
                        style={{
                          ...frozenHistoryCellStyle,
                          left: '324px',
                          fontWeight: 600,
                          color: '#0F172A',
                          borderRight: '2px solid #CBD5E1',
                          boxShadow: '4px 0 8px -4px rgba(15, 23, 42, 0.12)',
                        }}
                      >
                        {log.product_name}
                      </td>
                      <td style={historyBodyCellStyle}>{log.party_name || '—'}</td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.settling_test || ''} />
                      </td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.shade_variation_test || ''} />
                      </td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.adhesion_test || ''} />
                      </td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.perfume_test || ''} />
                      </td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.water_test || ''} />
                      </td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <QcMetricStatusBadge value={log.color_bleeding_test || ''} />
                      </td>
                      <td style={historyBodyCellStyle}>{log.observation_test || '—'}</td>
                      <td style={historyBodyCellStyle}>{log.remarks || '—'}</td>
                      <td style={{ ...historyBodyCellStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleLoadHistoricalQc3(log)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F172A',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={13} color="#059669" /> View & Edit
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

      {/* CLEAR SHEET CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qc3-clear-modal-title"
          onClick={() => setShowClearConfirmModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              margin: '16px',
            }}
          >
            <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FDF4F1',
                  border: '1px solid #E2A998',
                  color: '#B85035',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 id="qc3-clear-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                  Clear Production Batches Sheet?
                </h4>
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                  This will wipe <strong>{insights.totalEntered}</strong> entered batch row(s) and discard your local
                  auto-saved draft buffer. This action cannot be undone.
                </p>
              </div>
            </div>
            <div
              style={{
                padding: '12px 20px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeQc3Clear}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #C25E44',
                  backgroundColor: '#B85035',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Yes, Clear Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOAD OVER UNSAVED CHANGES CONFIRMATION MODAL */}
      {showLoadConfirmModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qc3-load-modal-title"
          onClick={() => setShowLoadConfirmModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              margin: '16px',
            }}
          >
            <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 id="qc3-load-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                  Replace Unsaved Changes?
                </h4>
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                  Loading saved records from the database will replace your current unsaved sheet edits.
                </p>
              </div>
            </div>
            <div
              style={{
                padding: '12px 20px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowLoadConfirmModal(false)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={executeQc3Load}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #0F172A',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Load From Database
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .qc3-table-scroll-container {
          border: 1px solid #E2E8F0 !important;
          background-color: #FFFFFF;
        }
        .qc3-table-scroll-container .qc3-sheet-table th,
        .qc3-table-scroll-container .qc3-sheet-table td {
          border-color: #E2E8F0 !important;
        }
        .qc3-table-scroll-container .qc3-sheet-table thead th {
          border-right: 1px solid #1E293B !important;
          border-bottom: 1px solid #334155 !important;
        }
        .qc3-table-scroll-container .qc3-sheet-table thead th.qc3-frozen-edge {
          border-right: 2px solid #475569 !important;
        }
        .qc3-table-scroll-container .qc3-sheet-table tbody td.qc3-frozen-edge {
          border-right: 2px solid #CBD5E1 !important;
        }
        .qc3-grid-row:hover td {
          background-color: #F8FAFC;
        }
        .qc3-inline-input {
          width: 100%;
          height: 36px;
          border: none;
          background: transparent;
          padding: 0 8px;
          color: #0F172A;
          font-family: inherit;
          font-size: 0.76rem;
          outline: none;
          transition: background-color 0.12s ease, box-shadow 0.12s ease;
        }
        .qc3-inline-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
        }
        .qc3-inline-input:hover {
          background-color: rgba(241, 245, 249, 0.7);
        }
        .qc3-inline-input:focus {
          background-color: #ECFDF5;
          box-shadow: inset 0 0 0 2px #059669;
        }
        .qc3-pill-group:focus {
          box-shadow: inset 0 0 0 2px #059669;
        }
      `}</style>
    </div>
  );
};

const nonFrozenHeaderStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  backgroundColor: '#0F172A',
  color: '#F8FAFC',
  fontWeight: 600,
  fontSize: '0.74rem',
  padding: '10px 6px',
  borderRight: '1px solid #1E293B',
  borderBottom: '1px solid #334155',
  textAlign: 'center',
};

const bodyCellStyle: React.CSSProperties = {
  borderRight: '1px solid #E2E8F0',
  borderBottom: '1px solid #E2E8F0',
  padding: 0,
  verticalAlign: 'middle',
};

const frozenHistoryHeaderStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 30,
  backgroundColor: '#0F172A',
  color: '#F8FAFC',
  fontWeight: 600,
  fontSize: '0.74rem',
  padding: '10px 8px',
  borderRight: '1px solid #1E293B',
  borderBottom: '1px solid #334155',
  textAlign: 'center',
};

const frozenHistoryCellStyle: React.CSSProperties = {
  position: 'sticky',
  zIndex: 10,
  backgroundColor: '#FFFFFF',
  borderRight: '1px solid #E2E8F0',
  borderBottom: '1px solid #E2E8F0',
  padding: '6px 8px',
  verticalAlign: 'middle',
};

const historyBodyCellStyle: React.CSSProperties = {
  borderRight: '1px solid #E2E8F0',
  borderBottom: '1px solid #E2E8F0',
  padding: '6px 8px',
  verticalAlign: 'middle',
  color: '#334155',
};
