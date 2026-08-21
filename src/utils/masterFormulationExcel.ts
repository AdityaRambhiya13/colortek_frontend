import ExcelJS from 'exceljs';

export interface MasterExcelParams {
  docNo?: string;
  reviewNo?: string;
  reviewDate?: string;
  issueNo?: string;
  issueDate?: string;
  formulaDate?: string;
  customerName?: string;
  productName?: string;
  batchNo?: string;
  refNo?: string;
  refBookNo?: string;
  grams?: number | string;
  packaging?: string;
  viscosity?: string;
  density?: string;
  ratio?: string;
  filtration?: string;
  remarks?: string;
  sender?: string;
  approval?: string;
  date?: string;
  time?: string;
  isLab?: boolean;
  inventory?: Array<{
    material?: string;
    raw_material?: string;
    qty?: number | string;
    percent?: number | string;
    final_qty?: number | string;
    rounded_qty?: number | string;
    remarks?: string;
  }>;
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const headerFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

/**
 * Applies borders and default font to a merged rectangle or individual cell range
 */
const styleRange = (
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  options?: {
    font?: Partial<ExcelJS.Font>;
    alignment?: Partial<ExcelJS.Alignment>;
    fill?: ExcelJS.Fill;
    border?: Partial<ExcelJS.Borders>;
    numFmt?: string;
  }
) => {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      cell.border = options?.border || thinBorder;
      if (options?.font) cell.font = { name: 'Arial', size: 10, ...options.font };
      if (options?.alignment) cell.alignment = { vertical: 'middle', ...options.alignment };
      if (options?.fill) cell.fill = options.fill;
      if (options?.numFmt) cell.numFmt = options.numFmt;
    }
  }
};

const formatDate = (val?: string) => {
  if (!val) return '';
  const clean = val.split(' ')[0].trim();
  try {
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  } catch {
    return clean;
  }
};

export const generateAndDownloadMasterFormulationExcel = async (params: MasterExcelParams) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Colortek CMS';
  wb.lastModifiedBy = 'Colortek CMS';
  wb.created = new Date();
  wb.modified = new Date();

  const titleText = params.isLab 
    ? 'Master Formulation Book - Lab' 
    : 'Master Formulation Book - Production';

  const sheetName = params.isLab ? 'Lab Master Formulation' : 'Master Formulation';
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }
    }
  });

  // Set 7 column widths matching the reference layout
  ws.columns = [
    { key: 'sr', width: 9 },         // A: Sr. No.
    { key: 'steps', width: 16 },      // B: STEPS
    { key: 'material', width: 34 },   // C: RAW MATERIAL
    { key: 'qty', width: 14 },        // D: QUANTITY
    { key: 'pct', width: 12 },        // E: %
    { key: 'finalQty', width: 16 },   // F: FINAL QUANTITY
    { key: 'roundQty', width: 18 }    // G: ROUND QUANTITY
  ];

  // -------------------------------------------------------------
  // ROW 1: Title Row (A1:G1)
  // -------------------------------------------------------------
  ws.getRow(1).height = 28;
  ws.mergeCells(1, 1, 1, 7);
  const titleCell = ws.getCell('A1');
  titleCell.value = titleText;
  styleRange(ws, 1, 1, 1, 7, {
    font: { name: 'Arial', size: 13, bold: true, color: { argb: 'FF000000' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    fill: headerFill
  });

  // -------------------------------------------------------------
  // DOCUMENT CONTROL HEADER (ROWS 2 to 4)
  // -------------------------------------------------------------
  const docNoVal = params.docNo || '';
  const reviewNoVal = params.reviewNo || '03';
  const reviewDateVal = params.reviewDate || '01.04.2025';
  const issueNoVal = params.issueNo || '01';
  const issueDateVal = params.issueDate || '01.04.2025';

  // Row 2: Doc # / Issue 01
  ws.getRow(2).height = 20;
  ws.mergeCells(2, 1, 2, 2); // A2:B2
  ws.getCell('A2').value = '';
  styleRange(ws, 2, 1, 2, 2);

  ws.mergeCells(2, 3, 2, 4); // C2:D2
  ws.getCell('C2').value = `DOC # ${docNoVal}`.trim();
  styleRange(ws, 2, 3, 2, 4, {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  });

  ws.mergeCells(2, 5, 2, 7); // E2:G2
  ws.getCell('E2').value = `ISSUE ${issueNoVal}`.trim();
  styleRange(ws, 2, 5, 2, 7, {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  });

  // Row 3: Review / Issue Date
  ws.getRow(3).height = 20;
  ws.mergeCells(3, 1, 3, 2); // A3:B3
  ws.getCell('A3').value = '';
  styleRange(ws, 3, 1, 3, 2);

  ws.mergeCells(3, 3, 3, 4); // C3:D3
  ws.getCell('C3').value = `REVIEW ${reviewNoVal}`.trim();
  styleRange(ws, 3, 3, 3, 4, {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  });

  ws.mergeCells(3, 5, 3, 7); // E3:G3
  ws.getCell('E3').value = `ISSUE DATE: ${issueDateVal ? formatDate(issueDateVal) : '01.04.2025'}`.trim();
  styleRange(ws, 3, 5, 3, 7, {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  });

  // Row 4: Review Date
  ws.getRow(4).height = 20;
  ws.mergeCells(4, 1, 4, 2); // A4:B4
  ws.getCell('A4').value = '';
  styleRange(ws, 4, 1, 4, 2);

  ws.mergeCells(4, 3, 4, 7); // C4:G4
  ws.getCell('C4').value = `REVIEW DATE: ${formatDate(reviewDateVal)}`.trim();
  styleRange(ws, 4, 3, 4, 7, {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  });

  // -------------------------------------------------------------
  // SPECIFICATION METADATA ROWS (ROWS 5 to 11)
  // -------------------------------------------------------------
  const metadataRows = [
    { label: 'FORMULA DATE:', value: formatDate(params.formulaDate || params.date || '') },
    { label: 'CUSTOMER NAME:', value: (params.customerName || '').toUpperCase() },
    { label: 'PRODUCT NAME:', value: (params.productName || '').toUpperCase() },
    { label: 'BATCH NO:', value: (params.batchNo || '').toUpperCase() },
    { label: 'REF NO:', value: (params.refNo || '').toUpperCase() },
    { label: 'REF BOOK NO :', value: (params.refBookNo || '').toUpperCase() },
    { label: 'QUANTITY (Grams):', value: Number(params.grams) || (params.grams ? String(params.grams) : 100) },
  ];

  metadataRows.forEach((item, idx) => {
    const rowIdx = 5 + idx; // Rows 5 to 11
    ws.getRow(rowIdx).height = 20;
    
    // Label: Columns A:B (1..2)
    ws.mergeCells(rowIdx, 1, rowIdx, 2);
    ws.getCell(rowIdx, 1).value = item.label;
    styleRange(ws, rowIdx, 1, rowIdx, 2, {
      font: { bold: true, size: 10 },
      alignment: { vertical: 'middle', horizontal: 'left' }
    });

    // Value: Columns C:G (3..7)
    ws.mergeCells(rowIdx, 3, rowIdx, 7);
    ws.getCell(rowIdx, 3).value = item.value;
    styleRange(ws, rowIdx, 3, rowIdx, 7, {
      font: { bold: idx === 1 || idx === 2 || idx === 3 || idx === 6, size: 10 },
      alignment: { vertical: 'middle', horizontal: 'left' }
    });
  });

  // -------------------------------------------------------------
  // ROW 12: Main Table Headers
  // -------------------------------------------------------------
  ws.getRow(12).height = 24;
  const headers = [
    { col: 1, text: 'Sr. No.', align: 'center' },
    { col: 2, text: 'STEPS', align: 'center' },
    { col: 3, text: 'RAW MATERIAL', align: 'center' },
    { col: 4, text: 'QUANTITY', align: 'center' },
    { col: 5, text: '%', align: 'center' },
    { col: 6, text: 'FINAL\nQUANTITY', align: 'center' },
    { col: 7, text: 'ROUND QUANTITY', align: 'center' }
  ];

  headers.forEach(h => {
    const cell = ws.getCell(12, h.col);
    cell.value = h.text;
    cell.border = thinBorder;
    cell.fill = headerFill;
    cell.font = { name: 'Arial', size: 9.5, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: h.align as any, wrapText: true };
  });

  // -------------------------------------------------------------
  // ROWS 13 to 36: Exactly 24 Data Rows
  // -------------------------------------------------------------
  const inventory = params.inventory || [];
  const totalBaseQty = inventory.reduce((sum, item) => sum + (parseFloat(String(item.qty || 0)) || 0), 0);
  const targetGrams = parseFloat(String(params.grams || 100)) || 100;

  let calcTotalQty = 0;
  let calcTotalFinal = 0;
  let calcTotalRounded = 0;

  for (let i = 0; i < 24; i++) {
    const rowIdx = 13 + i;
    ws.getRow(rowIdx).height = 19;

    const item = i < inventory.length ? inventory[i] : null;
    const matName = item ? (item.material || item.raw_material || '').trim() : '';
    const rawQty = item && item.qty !== undefined && item.qty !== '' ? parseFloat(String(item.qty)) : null;

    let pctVal: number | null = null;
    let finalQtyVal: number | null = null;
    let roundQtyVal: number | string | null = null;

    if (rawQty !== null && !isNaN(rawQty)) {
      calcTotalQty += rawQty;
      pctVal = totalBaseQty > 0 ? (rawQty / totalBaseQty) * 100 : 0;
      finalQtyVal = totalBaseQty > 0 ? (rawQty / totalBaseQty) * targetGrams : 0;
      calcTotalFinal += finalQtyVal;
      
      const defaultRound = Math.round(finalQtyVal);
      const parsedRound = item?.rounded_qty !== undefined && item.rounded_qty !== '' 
        ? parseFloat(String(item.rounded_qty)) 
        : defaultRound;
      roundQtyVal = !isNaN(parsedRound) ? parsedRound : defaultRound;
      calcTotalRounded += typeof roundQtyVal === 'number' ? roundQtyVal : defaultRound;
    }

    // Col A: Sr. No.
    const cellA = ws.getCell(rowIdx, 1);
    cellA.value = i + 1;
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.font = { name: 'Arial', size: 9.5 };
    cellA.border = thinBorder;

    // Col B: STEPS (Remarks)
    const cellB = ws.getCell(rowIdx, 2);
    cellB.value = item?.remarks || '';
    cellB.alignment = { vertical: 'middle', horizontal: 'left' };
    cellB.font = { name: 'Arial', size: 9.5 };
    cellB.border = thinBorder;

    // Col C: RAW MATERIAL
    const cellC = ws.getCell(rowIdx, 3);
    cellC.value = matName;
    cellC.alignment = { vertical: 'middle', horizontal: 'left' };
    cellC.font = { name: 'Arial', size: 9.5, bold: Boolean(matName) };
    cellC.border = thinBorder;

    // Col D: QUANTITY
    const cellD = ws.getCell(rowIdx, 4);
    if (rawQty !== null && !isNaN(rawQty)) {
      cellD.value = Number(rawQty.toFixed(2));
      cellD.numFmt = '0.00';
    } else {
      cellD.value = '';
    }
    cellD.alignment = { vertical: 'middle', horizontal: 'right' };
    cellD.font = { name: 'Arial', size: 9.5 };
    cellD.border = thinBorder;

    // Col E: % (Shows 0.00 if row is blank, matching the physical reference sheet)
    const cellE = ws.getCell(rowIdx, 5);
    if (pctVal !== null) {
      cellE.value = Number(pctVal.toFixed(2));
    } else {
      cellE.value = 0.00;
    }
    cellE.numFmt = '0.00';
    cellE.alignment = { vertical: 'middle', horizontal: 'right' };
    cellE.font = { name: 'Arial', size: 9.5 };
    cellE.border = thinBorder;

    // Col F: FINAL QUANTITY (Shows 0.00 if blank, matching the reference sheet)
    const cellF = ws.getCell(rowIdx, 6);
    if (finalQtyVal !== null) {
      cellF.value = Number(finalQtyVal.toFixed(2));
    } else {
      cellF.value = 0.00;
    }
    cellF.numFmt = '0.00';
    cellF.alignment = { vertical: 'middle', horizontal: 'right' };
    cellF.font = { name: 'Arial', size: 9.5 };
    cellF.border = thinBorder;

    // Col G: ROUND QUANTITY
    const cellG = ws.getCell(rowIdx, 7);
    if (roundQtyVal !== null && String(roundQtyVal).trim() !== '') {
      cellG.value = typeof roundQtyVal === 'number' ? roundQtyVal : Number(roundQtyVal);
    } else {
      cellG.value = '';
    }
    cellG.alignment = { vertical: 'middle', horizontal: 'right' };
    cellG.font = { name: 'Arial', size: 9.5 };
    cellG.border = thinBorder;
  }

  // -------------------------------------------------------------
  // ROW 37: TOTAL ROW
  // -------------------------------------------------------------
  ws.getRow(37).height = 22;

  // A37:B37 Empty
  ws.getCell(37, 1).value = '';
  ws.getCell(37, 1).border = thinBorder;
  ws.getCell(37, 2).value = '';
  ws.getCell(37, 2).border = thinBorder;

  // C37: 'TOTAL'
  const cellC37 = ws.getCell(37, 3);
  cellC37.value = 'TOTAL';
  cellC37.alignment = { vertical: 'middle', horizontal: 'center' };
  cellC37.font = { name: 'Arial', size: 10, bold: true };
  cellC37.border = thinBorder;
  cellC37.fill = headerFill;

  // D37: Total Qty
  const cellD37 = ws.getCell(37, 4);
  cellD37.value = Number(calcTotalQty.toFixed(2));
  cellD37.numFmt = '0.00';
  cellD37.alignment = { vertical: 'middle', horizontal: 'right' };
  cellD37.font = { name: 'Arial', size: 10, bold: true };
  cellD37.border = thinBorder;
  cellD37.fill = headerFill;

  // E37: 100%
  const cellE37 = ws.getCell(37, 5);
  cellE37.value = calcTotalQty > 0 ? 100.00 : 0.00;
  cellE37.numFmt = '0.00';
  cellE37.alignment = { vertical: 'middle', horizontal: 'right' };
  cellE37.font = { name: 'Arial', size: 10, bold: true };
  cellE37.border = thinBorder;
  cellE37.fill = headerFill;

  // F37: Total Final Qty
  const cellF37 = ws.getCell(37, 6);
  cellF37.value = Number(calcTotalFinal.toFixed(2));
  cellF37.numFmt = '0.00';
  cellF37.alignment = { vertical: 'middle', horizontal: 'right' };
  cellF37.font = { name: 'Arial', size: 10, bold: true };
  cellF37.border = thinBorder;
  cellF37.fill = headerFill;

  // G37: Total Rounded Qty
  const cellG37 = ws.getCell(37, 7);
  cellG37.value = calcTotalRounded;
  cellG37.alignment = { vertical: 'middle', horizontal: 'right' };
  cellG37.font = { name: 'Arial', size: 10, bold: true };
  cellG37.border = thinBorder;
  cellG37.fill = headerFill;

  // -------------------------------------------------------------
  // FOOTER PARAMETERS & METADATA (ROWS 38 to 44)
  // -------------------------------------------------------------

  // Row 38: PACKING & VISCOSITY
  ws.getRow(38).height = 20;
  ws.mergeCells(38, 1, 38, 2);
  ws.getCell(38, 1).value = 'PACKING :-';
  styleRange(ws, 38, 1, 38, 2, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(38, 3, 38, 4);
  ws.getCell(38, 3).value = params.packaging || '';
  styleRange(ws, 38, 3, 38, 4, { font: { size: 9.5 } });

  ws.getCell(38, 5).value = 'VISCOSITY :-';
  styleRange(ws, 38, 5, 38, 5, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(38, 6, 38, 7);
  ws.getCell(38, 6).value = params.viscosity || '';
  styleRange(ws, 38, 6, 38, 7, { font: { size: 9.5 } });

  // Row 39: FILTERATION & DENSITY
  ws.getRow(39).height = 20;
  ws.mergeCells(39, 1, 39, 2);
  ws.getCell(39, 1).value = 'FILTERATION :-';
  styleRange(ws, 39, 1, 39, 2, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(39, 3, 39, 4);
  ws.getCell(39, 3).value = params.filtration || '';
  styleRange(ws, 39, 3, 39, 4, { font: { size: 9.5 } });

  ws.getCell(39, 5).value = 'DENSITY :-';
  styleRange(ws, 39, 5, 39, 5, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(39, 6, 39, 7);
  ws.getCell(39, 6).value = params.density || '';
  styleRange(ws, 39, 6, 39, 7, { font: { size: 9.5 } });

  // Row 40: RATIO
  ws.getRow(40).height = 20;
  ws.mergeCells(40, 1, 40, 4);
  ws.getCell(40, 1).value = '';
  styleRange(ws, 40, 1, 40, 4);

  ws.getCell(40, 5).value = 'RATIO';
  styleRange(ws, 40, 5, 40, 5, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(40, 6, 40, 7);
  ws.getCell(40, 6).value = params.ratio || '';
  styleRange(ws, 40, 6, 40, 7, { font: { size: 9.5 } });

  // Row 41: REMARK :-
  ws.getRow(41).height = 20;
  ws.mergeCells(41, 1, 41, 2);
  ws.getCell(41, 1).value = 'REMARK :-';
  styleRange(ws, 41, 1, 41, 2, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(41, 3, 41, 7);
  ws.getCell(41, 3).value = params.remarks || '';
  styleRange(ws, 41, 3, 41, 7, { font: { bold: true, size: 9.5 } });

  // Row 42: SENDER
  ws.getRow(42).height = 20;
  ws.mergeCells(42, 1, 42, 2);
  ws.getCell(42, 1).value = '';
  styleRange(ws, 42, 1, 42, 2);

  ws.mergeCells(42, 3, 42, 4);
  ws.getCell(42, 3).value = 'SENDER';
  styleRange(ws, 42, 3, 42, 4, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(42, 5, 42, 7);
  ws.getCell(42, 5).value = (params.sender || '').toUpperCase();
  styleRange(ws, 42, 5, 42, 7, { font: { bold: true, size: 9.5 } });

  // Row 43: APPROVAL
  ws.getRow(43).height = 20;
  ws.mergeCells(43, 1, 43, 2);
  ws.getCell(43, 1).value = '';
  styleRange(ws, 43, 1, 43, 2);

  ws.mergeCells(43, 3, 43, 4);
  ws.getCell(43, 3).value = 'APPROVAL';
  styleRange(ws, 43, 3, 43, 4, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(43, 5, 43, 7);
  ws.getCell(43, 5).value = (params.approval || '').toUpperCase();
  styleRange(ws, 43, 5, 43, 7, { font: { bold: true, size: 9.5 } });

  // Row 44: DATE & TIME
  ws.getRow(44).height = 20;
  ws.mergeCells(44, 1, 44, 2);
  ws.getCell(44, 1).value = '';
  styleRange(ws, 44, 1, 44, 2);

  ws.getCell(44, 3).value = 'DATE';
  styleRange(ws, 44, 3, 44, 3, { font: { bold: true, size: 9.5 } });

  ws.getCell(44, 4).value = formatDate(params.date || params.formulaDate || '');
  styleRange(ws, 44, 4, 44, 4, { font: { size: 9.5 } });

  ws.getCell(44, 5).value = 'TIME';
  styleRange(ws, 44, 5, 44, 5, { font: { bold: true, size: 9.5 } });

  ws.mergeCells(44, 6, 44, 7);
  ws.getCell(44, 6).value = params.time || '';
  styleRange(ws, 44, 6, 44, 7, { font: { size: 9.5 } });

  // -------------------------------------------------------------
  // SIGNATURE SECTION (ROWS 45 to 48)
  // -------------------------------------------------------------
  const sigDeptHeader = params.isLab ? 'LAB SIGNATURE' : 'PRODUCTION SIGNATURE';

  // Row 45: Signature Titles
  ws.getRow(45).height = 22;
  ws.mergeCells(45, 1, 45, 2); // Incharge
  ws.getCell(45, 1).value = 'INCHARGE SIGNATURE';
  styleRange(ws, 45, 1, 45, 2, {
    font: { bold: true, size: 9.5 },
    alignment: { vertical: 'middle', horizontal: 'center' },
    fill: headerFill
  });

  ws.mergeCells(45, 3, 45, 4); // Approver
  ws.getCell(45, 3).value = 'APPROVER SIGNATURE';
  styleRange(ws, 45, 3, 45, 4, {
    font: { bold: true, size: 9.5 },
    alignment: { vertical: 'middle', horizontal: 'center' },
    fill: headerFill
  });

  ws.mergeCells(45, 5, 45, 7); // Production / Lab
  ws.getCell(45, 5).value = sigDeptHeader;
  styleRange(ws, 45, 5, 45, 7, {
    font: { bold: true, size: 9.5 },
    alignment: { vertical: 'middle', horizontal: 'center' },
    fill: headerFill
  });

  // Rows 46 to 48: Merged Tall Signature Boxes (~54pt height)
  ws.getRow(46).height = 20;
  ws.getRow(47).height = 20;
  ws.getRow(48).height = 20;

  ws.mergeCells(46, 1, 48, 2); // Box 1
  styleRange(ws, 46, 1, 48, 2);

  ws.mergeCells(46, 3, 48, 4); // Box 2
  styleRange(ws, 46, 3, 48, 4);

  ws.mergeCells(46, 5, 48, 7); // Box 3
  styleRange(ws, 46, 5, 48, 7);

  // -------------------------------------------------------------
  // TRIGGER DOWNLOAD IN BROWSER
  // -------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const filePrefix = (params.batchNo || 'FORMULATION').replace(/[/\\?%*:|"<>]/g, '_');
  const fileSuffix = params.isLab ? '_LAB_MASTER.xlsx' : '_MASTER.xlsx';
  anchor.download = `${filePrefix}${fileSuffix}`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
