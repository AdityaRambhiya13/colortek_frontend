import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import React from 'react';
import { ProductionBatchesEntry } from '../components/qc/ProductionBatchesEntry';
import { Sidebar } from '../components/Sidebar';
import {
  incrementBatchNumber,
  formatTodayDDMMYYYY,
  createInitialQc3Rows,
  isQc3RowEntered,
  getBatchOverallStatus,
  computeQc3Insights,
  getDraftStorageKey,
} from '../utils/qcBatchHelpers';

const mockPdfSave = vi.fn();
const mockPdfText = vi.fn();
const mockAutoTable = vi.fn();

vi.mock('jspdf', () => {
  return {
    jsPDF: vi.fn(function MockJsPDF() {
      return {
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        text: mockPdfText,
        save: mockPdfSave,
      };
    }),
  };
});

vi.mock('jspdf-autotable', () => ({
  default: (...args: unknown[]) => mockAutoTable(...args),
}));

const mockGetDropdownOptions = vi.fn();
const mockGetPastEntries = vi.fn();
const mockSaveEntries = vi.fn();
const mockGetProductsList = vi.fn();
const mockGetProdCompletedBatches = vi.fn();

vi.mock('../services/api', () => ({
  ProductionBatchAPI: {
    getDropdownOptions: (...args: unknown[]) => mockGetDropdownOptions(...args),
    getPastEntries: (...args: unknown[]) => mockGetPastEntries(...args),
    saveEntries: (...args: unknown[]) => mockSaveEntries(...args),
  },
  ProductMasterAPI: {
    getProductsList: (...args: unknown[]) => mockGetProductsList(...args),
  },
  LiveProductionAPI: {
    getProdCompletedBatches: (...args: unknown[]) => mockGetProdCompletedBatches(...args),
  },
}));

describe('qcBatchHelpers', () => {
  it('increments batch numbers while preserving prefixes and zero padding', () => {
    expect(incrementBatchNumber('')).toBe('B-001');
    expect(incrementBatchNumber('B-001')).toBe('B-002');
    expect(incrementBatchNumber('B-099')).toBe('B-100');
    expect(incrementBatchNumber('CT2026-09')).toBe('CT2026-10');
    expect(incrementBatchNumber('1042')).toBe('1043');
    expect(incrementBatchNumber('ALPHA')).toBe('ALPHA-1');
  });

  it('auto-populates today date and sequential batch in row 0 without counting it as entered', () => {
    const rows = createInitialQc3Rows('B-009', 10);
    expect(rows).toHaveLength(10);
    expect(rows[0].date).toBe(formatTodayDDMMYYYY());
    expect(rows[0].batch_no).toBe('B-010');
    expect(rows[0]._isDefaultAutoBatch).toBe(true);
    expect(isQc3RowEntered(rows[0])).toBe(false);

    const edited = { ...rows[0], product_name: 'Red Oxide - Base' };
    expect(isQc3RowEntered(edited)).toBe(true);
  });

  it('evaluates overall batch status and KPI summary metrics accurately', () => {
    const rows = createInitialQc3Rows('B-001', 5);
    rows[0] = {
      ...rows[0],
      product_name: 'Enamel - Gloss',
      settling: 'Pass',
      shade_variation: 'Pass',
      adhesion: 'Pass',
    };
    rows[1] = {
      ...rows[1],
      date: formatTodayDDMMYYYY(),
      batch_no: 'B-003',
      product_name: 'Primer - Grey',
      settling: 'Pass',
      shade_variation: 'Review',
      adhesion: 'Pass',
    };
    rows[2] = {
      ...rows[2],
      date: formatTodayDDMMYYYY(),
      batch_no: 'B-004',
      product_name: 'Topcoat - Matte',
      settling: 'Pass',
      shade_variation: 'Fail',
      adhesion: 'Pass',
    };

    expect(getBatchOverallStatus(rows[0])).toBe('pass');
    expect(getBatchOverallStatus(rows[1])).toBe('review');
    expect(getBatchOverallStatus(rows[2])).toBe('fail');

    const insights = computeQc3Insights(rows);
    expect(insights).toEqual({
      totalEntered: 3,
      passedCount: 1,
      pendingReviewCount: 1,
      failedCount: 1,
      passRatePct: 33,
    });
  });
});

describe('ProductionBatchesEntry UI & Workflow', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    mockGetDropdownOptions.mockResolvedValue([
      true,
      {
        products: ['Master Gloss - Clear', 'Satin Binder - White'],
        parties: ['Apex Paints Pvt Ltd', 'ColorCraft Traders'],
        latest_batch_no: 'B-009',
      },
    ]);
    mockGetProductsList.mockResolvedValue([true, { products: [] }]);
    mockGetPastEntries.mockResolvedValue([true, { items: [], total_count: 0, page: 1, limit: 50 }]);
    mockGetProdCompletedBatches.mockResolvedValue([true, { items: [] }]);
    mockSaveEntries.mockResolvedValue([true, { status: 'success' }]);
  });

  afterEach(() => {
    cleanup();
  });

  const renderEntry = (activeSubView = 'production_batches_entry') =>
    render(
      <ProductionBatchesEntry
        activeSubView={activeSubView}
        productName="test_unit"
        username="qc_operator"
        onShowToast={mockToast}
      />
    );

  it('auto-fills today date & sequential batch, freezes core columns, and anchors sticky action bar', async () => {
    renderEntry();

    await waitFor(() => {
      const dateInput = document.getElementById('qc3-input-0-date') as HTMLInputElement;
      expect(dateInput?.value).toBe(formatTodayDDMMYYYY());
      const batchInput = document.getElementById('qc3-input-0-batch_no') as HTMLInputElement;
      expect(batchInput?.value).toBe('B-010');
    });

    // Untouched default row should NOT inflate KPI total
    expect(screen.getByTestId('kpi-total-entered')).toHaveTextContent('0');

    // Verify 4 frozen context column headers (Sr, Date, Product Name, Batch No.)
    const frozenHeaders = document.querySelectorAll('thead th.qc3-frozen-col');
    expect(frozenHeaders).toHaveLength(4);
    expect(Array.from(frozenHeaders).map(h => h.textContent?.trim())).toEqual([
      'Sr',
      'Date',
      'Product Name',
      'Batch No.',
    ]);
    expect((frozenHeaders[0] as HTMLElement).style.position).toBe('sticky');
    expect((frozenHeaders[0] as HTMLElement).style.left).toBe('0px');
    expect((frozenHeaders[1] as HTMLElement).style.left).toBe('56px');
    expect((frozenHeaders[2] as HTMLElement).style.left).toBe('184px');
    expect((frozenHeaders[3] as HTMLElement).style.left).toBe('410px');

    // Sticky action bar + hero emerald Save & Download PDF button
    const actionBar = screen.getByTestId('qc3-sticky-action-bar');
    expect(actionBar.style.position).toBe('sticky');

    const saveBtn = screen.getByText(/Save & Download PDF/i).closest('button') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.style.backgroundColor).toBe('rgb(5, 150, 105)');
  }, 15000);

  it('supports database smart autocomplete, Enter/Tab keyboard navigation, QC pill status updates, and KPI refresh', async () => {
    renderEntry();

    await waitFor(() => {
      expect(mockGetDropdownOptions).toHaveBeenCalledWith('test_unit');
    });

    const row0Product = document.getElementById('qc3-input-0-product_name') as HTMLInputElement;
    fireEvent.click(row0Product);

    const productOpt = await screen.findByText('Master Gloss - Clear');
    fireEvent.mouseDown(productOpt);
    expect(row0Product.value).toBe('Master Gloss - Clear');

    // Tab moves right to Batch No., Enter on Date drops to row 1 Date
    const row0Date = document.getElementById('qc3-input-0-date') as HTMLInputElement;
    row0Date.focus();
    fireEvent.keyDown(row0Date, { key: 'Tab' });
    expect(document.activeElement?.id).toBe('qc3-input-0-product_name');

    row0Date.focus();
    fireEvent.keyDown(row0Date, { key: 'Enter' });
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('qc3-input-1-date');
    });

    // Select Party Name from DB autocomplete
    const row0Party = document.getElementById('qc3-input-0-party_name') as HTMLInputElement;
    fireEvent.click(row0Party);
    const partyOpt = await screen.findByText('Apex Paints Pvt Ltd');
    fireEvent.mouseDown(partyOpt);
    expect(row0Party.value).toBe('Apex Paints Pvt Ltd');

    // Toggle QC metric pills for core checks: Pass -> KPI Passed becomes 1
    const settlingGroup = document.getElementById('qc3-input-0-settling') as HTMLElement;
    const shadeGroup = document.getElementById('qc3-input-0-shade_variation') as HTMLElement;
    const adhesionGroup = document.getElementById('qc3-input-0-adhesion') as HTMLElement;

    fireEvent.click(within(settlingGroup).getByText('Pass'));
    expect(settlingGroup).toHaveAttribute('data-qc-status', 'pass');
    expect(settlingGroup.style.backgroundColor).toBe('rgb(236, 253, 245)'); // #ECFDF5 soft sage

    // Before Shade Var & Adhesion pass, batch is pending review
    expect(screen.getByTestId('kpi-total-entered')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-pending-review')).toHaveTextContent('1');

    fireEvent.click(within(shadeGroup).getByText('Pass'));
    fireEvent.click(within(adhesionGroup).getByText('Pass'));
    expect(screen.getByTestId('kpi-passed-qc')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-pending-review')).toHaveTextContent('0');

    // Switching Shade Var to Fail highlights muted rose (#FFF1F2) & increments Failed KPI
    fireEvent.click(within(shadeGroup).getByText('Fail'));
    expect(shadeGroup).toHaveAttribute('data-qc-status', 'fail');
    expect(shadeGroup.style.backgroundColor).toBe('rgb(255, 241, 242)');
    expect(screen.getByTestId('kpi-failed-qc')).toHaveTextContent('1');
  }, 15000);

  it('switches between dense Sheet View and manager Cards View', async () => {
    renderEntry();
    await waitFor(() => expect(mockGetDropdownOptions).toHaveBeenCalled());

    const row0Product = document.getElementById('qc3-input-0-product_name') as HTMLInputElement;
    fireEvent.change(row0Product, { target: { value: 'Satin Binder - White' } });

    const cardsBtn = screen.getByText(/Cards View/i).closest('button') as HTMLButtonElement;
    fireEvent.click(cardsBtn);

    const card0 = await screen.findByTestId('batch-summary-card-0');
    const cardProductInput = within(card0).getByLabelText('Card 1 Product Name') as HTMLInputElement;
    expect(cardProductInput.value).toBe('Satin Binder - White');

    const sheetBtn = screen.getByText(/Sheet View/i).closest('button') as HTMLButtonElement;
    fireEvent.click(sheetBtn);
    expect(document.getElementById('qc3-input-0-product_name')).toBeInTheDocument();
  }, 15000);

  it('requires Clear Sheet confirmation modal before wiping entered batches', async () => {
    renderEntry();
    await waitFor(() => expect(mockGetDropdownOptions).toHaveBeenCalled());

    const row0Product = document.getElementById('qc3-input-0-product_name') as HTMLInputElement;
    fireEvent.change(row0Product, { target: { value: 'Master Gloss - Clear' } });
    expect(screen.getByTestId('kpi-total-entered')).toHaveTextContent('1');

    // Clicking Clear Sheet opens confirmation modal without immediate data wipe
    fireEvent.click(screen.getByText(/^Clear Sheet$/i).closest('button') as HTMLButtonElement);
    const confirmBtn = (await screen.findByText(/Yes, Clear Sheet/i)).closest('button') as HTMLButtonElement;
    expect(confirmBtn).toBeInTheDocument();
    expect(row0Product.value).toBe('Master Gloss - Clear');

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect((document.getElementById('qc3-input-0-product_name') as HTMLInputElement).value).toBe('');
    });
    expect(screen.getByTestId('kpi-total-entered')).toHaveTextContent('0');
  }, 15000);

  it('auto-saves draft buffer to localStorage, guards beforeunload, and saves/exports PDF', async () => {
    const view = renderEntry();
    await waitFor(() => expect(mockGetDropdownOptions).toHaveBeenCalled());

    const row0Product = document.getElementById('qc3-input-0-product_name') as HTMLInputElement;
    fireEvent.change(row0Product, { target: { value: 'Master Gloss - Clear' } });

    const settlingGroup = document.getElementById('qc3-input-0-settling') as HTMLElement;
    fireEvent.click(within(settlingGroup).getByText('Pass'));

    const draftKey = getDraftStorageKey('test_unit', 'qc_operator');
    await waitFor(() => {
      const savedDraft = localStorage.getItem(draftKey);
      expect(savedDraft).not.toBeNull();
      expect(savedDraft).toContain('Master Gloss - Clear');
    });

    // Unsaved changes warning prevents accidental unload
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);
    expect(beforeUnloadEvent.defaultPrevented).toBe(true);

    // Unmount and remount verifies draft restoration from localStorage
    view.unmount();
    renderEntry();
    await waitFor(() => {
      expect((document.getElementById('qc3-input-0-product_name') as HTMLInputElement)?.value).toBe(
        'Master Gloss - Clear'
      );
    });

    // Save & Download PDF sends normalized DB payload and invokes jsPDF.save
    fireEvent.click(screen.getByText(/Save & Download PDF/i).closest('button') as HTMLButtonElement);
    await waitFor(() => {
      expect(mockSaveEntries).toHaveBeenCalledTimes(1);
    });
    expect(mockSaveEntries).toHaveBeenCalledWith(
      'test_unit',
      expect.arrayContaining([
        expect.objectContaining({
          product_name: 'Master Gloss - Clear',
          settling_test: 'Pass',
        }),
      ])
    );
    expect(mockPdfSave).toHaveBeenCalledWith('Production_Batches_QC_Report.pdf');
  }, 25000);
});

describe('Sidebar Industrial Slate Redesign', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('uses matte carbon-slate (#0F172A) industrial styling', () => {
    sessionStorage.setItem('user_roles', 'qc');
    const { container } = render(
      <Sidebar
        currentView="production_batches_entry"
        onChangeView={vi.fn()}
        miniMode={false}
        onToggleMiniMode={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.style.backgroundColor).toBe('rgb(15, 23, 42)');
  });
});
