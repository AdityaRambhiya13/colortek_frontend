import { describe, it, expect, vi } from 'vitest';
import { useExports } from '../pages/Cms/hooks/useExports';

// Mock jsPDF with proper constructor
const textCalls: string[] = [];
vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      setFillColor = vi.fn();
      rect = vi.fn();
      line = vi.fn();
      text = vi.fn((txt: any) => {
        if (typeof txt === 'string') textCalls.push(txt);
        else if (Array.isArray(txt)) textCalls.push(...txt);
      });
      splitTextToSize = vi.fn((txt: string) => [txt]);
      addPage = vi.fn();
      save = vi.fn();
    },
  };
});

describe('useExports - Complete Cards PDF Generation', () => {
  it('renders all 20 tests without truncating into "+ X more tests..."', () => {
    textCalls.length = 0;

    const mockProps = {
      leftForm: {},
      rightForm: {},
      leftRows: [],
      rightRows: [],
      leftTestRows: [],
      rightTestRows: [],
      leftRemarks: '',
      rightRemarks: '',
      activeSubView: 'past_lab_formulations',
      calculateTotalWeight: () => 0,
      productName: 'TEST PRODUCT',
      onShowToast: vi.fn(),
      setLoading: vi.fn(),
      selectedPastBatches: ['B123'],
      setSelectedPastBatches: vi.fn(),
      printSlot: 'top-left',
    };

    const { generateMultiFormulationsPrintPDF } = useExports(mockProps);

    // 20 test specifications
    const twentyTests = [
      { method: 'RM VISCOSITY', standard: 'GTP-06', result: '12.5' },
      { method: 'RM SOLID', standard: 'IR', result: '45%' },
      { method: 'LACQUER VISC.', standard: 'GTP-06', result: '15.0' },
      { method: 'PH VALUE', standard: 'WI-QC-03', result: '7.2' },
      { method: 'ACID VALUE', standard: 'WI-R&D-01', result: '2.1' },
      { method: 'AMINE VALUE', standard: 'WI-R&D-02', result: '1.8' },
      { method: 'LACQUER CLARITY', standard: 'STP-01', result: 'CLEAR' },
      { method: 'LEVEL', standard: 'STP-08', result: 'PASS' },
      { method: 'COVERAGE', standard: 'STP-04', result: 'GOOD' },
      { method: 'WETTING', standard: 'STP-17', result: 'PASS' },
      { method: 'ADHESION', standard: 'GTP-01', result: '100%' },
      { method: 'MEK', standard: 'STP-09', result: '>100' },
      { method: 'HARDNESS', standard: 'GTP-04', result: '2H' },
      { method: 'GLASS EFFECT', standard: 'GTP-02', result: 'PASS' },
      { method: 'YELLOWING TEST', standard: 'STP-18', result: 'NONE' },
      { method: 'HAZINESS', standard: 'STP-01', result: 'NIL' },
      { method: 'RECOATING', standard: 'STP-15', result: 'PASS' },
      { method: 'PERFUME/ALCOHOL', standard: 'STP-05/STP-02', result: 'PASS' },
      { method: 'COLORBLEEDING', standard: 'STP-03', result: 'PASS' },
      { method: 'WATER TEST', standard: 'GTP-03', result: 'PASS' },
    ];

    const sampleBatchData = [
      {
        batch_no: 'B123',
        ref_no: 'REF001',
        product: 'Industrial Coating Red',
        test_date: '2026-11-03',
        formula_date: '2026-11-01',
        report_date: '2026-11-03',
        inventory: [
          { sr_no: '1', material: 'Epoxy Resin', qty: '500.00' },
          { sr_no: '2', material: 'Solvent Xylene', qty: '200.00' },
        ],
        tests: twentyTests,
        remarks: 'Sample passed all quality tests.',
      },
    ];

    generateMultiFormulationsPrintPDF(sampleBatchData);

    // Verify no truncated test text exists
    const hasTruncatedTests = textCalls.some((t) => t.includes('more tests...'));
    expect(hasTruncatedTests).toBe(false);

    // Verify all 20 test methods are rendered in the PDF text calls
    twentyTests.forEach((t) => {
      const found = textCalls.some((call) => call.includes(t.method.substring(0, 20)));
      expect(found).toBe(true);
    });

    // Verify raw materials are also rendered without truncation
    expect(textCalls.some((call) => call.includes('Epoxy Resin'))).toBe(true);
    expect(textCalls.some((call) => call.includes('Solvent Xylene'))).toBe(true);
    expect(textCalls.some((call) => call.includes('more materials...'))).toBe(false);
  });
});
