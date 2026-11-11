export type QcMetricStatus = 'pass' | 'review' | 'fail' | 'custom' | 'empty';
export type BatchOverallStatus = 'pass' | 'review' | 'fail';

export type QcMetricField =
  | 'settling'
  | 'shade_variation'
  | 'adhesion'
  | 'perfume'
  | 'water'
  | 'color_bleeding';

export const QC3_METRIC_FIELDS: Array<{ key: QcMetricField; label: string; shortLabel: string }> = [
  { key: 'settling', label: 'Settling', shortLabel: 'Settling' },
  { key: 'shade_variation', label: 'Shade Var.', shortLabel: 'Shade Var.' },
  { key: 'adhesion', label: 'Adhesion', shortLabel: 'Adhesion' },
  { key: 'perfume', label: 'Perfume', shortLabel: 'Perfume' },
  { key: 'water', label: 'Water', shortLabel: 'Water' },
  { key: 'color_bleeding', label: 'Color Bleed', shortLabel: 'Color Bleed' },
];

export const QC3_COLUMN_KEYS = [
  'date',
  'product_name',
  'batch_no',
  'party_name',
  'settling',
  'shade_variation',
  'adhesion',
  'perfume',
  'water',
  'color_bleeding',
  'observation',
  'remarks',
] as const;

export type Qc3ColumnKey = (typeof QC3_COLUMN_KEYS)[number];

export interface Qc3BatchRow {
  date: string;
  product_name: string;
  batch_no: string;
  party_name: string;
  settling: string;
  shade_variation: string;
  adhesion: string;
  perfume: string;
  water: string;
  color_bleeding: string;
  observation: string;
  remarks: string;
  _isDefaultAutoBatch?: boolean;
}

export interface Qc3Insights {
  totalEntered: number;
  passedCount: number;
  pendingReviewCount: number;
  failedCount: number;
  passRatePct: number;
}

export const formatTodayDDMMYYYY = (now: Date = new Date()): string => {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}-${month}-${year}`;
};

export const parseAndFormatDate = (dateStr: string): string => {
  if (!dateStr || !dateStr.trim()) {
    return new Date().toISOString().split('T')[0];
  }
  const cleanStr = dateStr.trim();

  const ddMmYyyyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const matchDmy = cleanStr.match(ddMmYyyyPattern);
  if (matchDmy) {
    const day = matchDmy[1].padStart(2, '0');
    const month = matchDmy[2].padStart(2, '0');
    const year = matchDmy[3];
    return `${year}-${month}-${day}`;
  }

  const yyyyMmDdPattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const matchYmd = cleanStr.match(yyyyMmDdPattern);
  if (matchYmd) {
    const year = matchYmd[1];
    const month = matchYmd[2].padStart(2, '0');
    const day = matchYmd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Fallback to today
  }

  return new Date().toISOString().split('T')[0];
};

export const parseAndFormatDateTimeDb = (dateStr: string): string => {
  return `${parseAndFormatDate(dateStr)} 00:00:00`;
};

/**
 * Increments a batch code while preserving prefix and zero-padding width.
 * Examples:
 * - "B-001" -> "B-002"
 * - "B-099" -> "B-100"
 * - "CT2026-09" -> "CT2026-10"
 * - "1042" -> "1043"
 * - "" -> "B-001"
 */
export const incrementBatchNumber = (prevBatch: string): string => {
  const trimmed = (prevBatch || '').trim();
  if (!trimmed) {
    return 'B-001';
  }
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${trimmed}-1`;
  }
  const prefix = match[1];
  const digits = match[2];
  const nextNum = parseInt(digits, 10) + 1;
  const padded = String(nextNum).padStart(digits.length, '0');
  return `${prefix}${padded}`;
};

export const createEmptyQc3Row = (): Qc3BatchRow => ({
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
  remarks: '',
  _isDefaultAutoBatch: false,
});

export const createInitialQc3Rows = (latestDbBatch = '', count = 25): Qc3BatchRow[] => {
  const rows = Array.from({ length: count }, () => createEmptyQc3Row());
  if (rows.length > 0) {
    rows[0] = {
      ...rows[0],
      date: formatTodayDDMMYYYY(),
      batch_no: latestDbBatch.trim() ? incrementBatchNumber(latestDbBatch) : 'B-001',
      _isDefaultAutoBatch: true,
    };
  }
  return rows;
};

export const getNextSequentialBatchForRow = (
  rows: Qc3BatchRow[],
  targetIdx: number,
  latestDbBatch = ''
): string => {
  for (let i = targetIdx - 1; i >= 0; i -= 1) {
    const candidate = (rows[i]?.batch_no || '').trim();
    if (candidate) {
      let next = candidate;
      const steps = targetIdx - i;
      for (let s = 0; s < steps; s += 1) {
        next = incrementBatchNumber(next);
      }
      return next;
    }
  }
  let base = latestDbBatch.trim() ? incrementBatchNumber(latestDbBatch) : 'B-001';
  for (let s = 0; s < targetIdx; s += 1) {
    base = incrementBatchNumber(base);
  }
  return base;
};

export const isQc3RowEntered = (row: Qc3BatchRow): boolean => {
  if (!row) return false;
  const hasContentFields = Boolean(
    row.product_name.trim() ||
      row.party_name.trim() ||
      row.settling.trim() ||
      row.shade_variation.trim() ||
      row.adhesion.trim() ||
      row.perfume.trim() ||
      row.water.trim() ||
      row.color_bleeding.trim() ||
      row.observation.trim() ||
      row.remarks.trim()
  );
  if (hasContentFields) return true;
  return Boolean(row.batch_no.trim() && !row._isDefaultAutoBatch);
};

const PASS_TOKENS = new Set(['pass', 'ok', 'passed', 'good', 'clear', 'nil', 'yes', 'approved']);
const REVIEW_TOKENS = new Set(['review', 'hold', 'pending', 'recheck', 'check', 'marginal', 'slight']);
const FAIL_TOKENS = new Set(['fail', 'failed', 'not ok', 'not_ok', 'reject', 'rejected', 'bad', 'poor', 'issue', 'bleed']);

export const normalizeQcMetricStatus = (value: string): QcMetricStatus => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'empty';
  if (PASS_TOKENS.has(normalized)) return 'pass';
  if (REVIEW_TOKENS.has(normalized)) return 'review';
  if (FAIL_TOKENS.has(normalized)) return 'fail';
  return 'custom';
};

export const getCellPastelBackground = (status: QcMetricStatus): string => {
  switch (status) {
    case 'pass':
      return '#ECFDF5';
    case 'review':
      return '#FFFBEB';
    case 'fail':
      return '#FFF1F2';
    case 'custom':
      return '#FFFBEB';
    default:
      return 'transparent';
  }
};

export const getBatchOverallStatus = (row: Qc3BatchRow): BatchOverallStatus => {
  const allStatuses = QC3_METRIC_FIELDS.map(f => normalizeQcMetricStatus(row[f.key]));
  if (allStatuses.some(s => s === 'fail')) return 'fail';
  if (allStatuses.some(s => s === 'review' || s === 'custom')) return 'review';

  const corePass =
    normalizeQcMetricStatus(row.settling) === 'pass' &&
    normalizeQcMetricStatus(row.shade_variation) === 'pass' &&
    normalizeQcMetricStatus(row.adhesion) === 'pass';

  return corePass ? 'pass' : 'review';
};

export const computeQc3Insights = (rows: Qc3BatchRow[]): Qc3Insights => {
  const entered = rows.filter(isQc3RowEntered);
  let passedCount = 0;
  let pendingReviewCount = 0;
  let failedCount = 0;

  for (const row of entered) {
    const status = getBatchOverallStatus(row);
    if (status === 'pass') passedCount += 1;
    else if (status === 'fail') failedCount += 1;
    else pendingReviewCount += 1;
  }

  const totalEntered = entered.length;
  const passRatePct = totalEntered > 0 ? Math.round((passedCount / totalEntered) * 100) : 0;

  return {
    totalEntered,
    passedCount,
    pendingReviewCount,
    failedCount,
    passRatePct,
  };
};

export const getDraftStorageKey = (productName: string, username: string): string => {
  const prod = (productName || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const user = (username || 'operator').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `colortek_qc3_draft_${prod}_${user}`;
};

export const mergeUniqueOptions = (...lists: Array<Array<string | undefined | null>>): string[] => {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const val = (raw || '').trim();
      if (!val) continue;
      const key = val.toLowerCase();
      if (!map.has(key)) {
        map.set(key, val);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};
