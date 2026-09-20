import { jsPDF } from 'jspdf';
import { LabFormulationsAPI } from '../../../services/api';
import * as XLSX from '../../../xlsxWrapper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useExports = (props: any) => {
  const {
    leftForm, rightForm,
    leftRows, rightRows,
    leftTestRows, rightTestRows,
    leftRemarks, rightRemarks,
    activeSubView,
    calculateTotalWeight,
    productName,
    onShowToast,
    setLoading,
    selectedPastBatches,
    setSelectedPastBatches,
    printSlot
  } = props;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    rows.filter((r: any) => r.material.trim() !== '').forEach((r: any) => {
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
    const activeTests = tests.filter((t: any) => t.method.trim() !== '');
    if (activeTests.length > 0) {
      activeTests.forEach((t: any) => {
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
    doc.setFontSize(20);
    doc.text('Colortek CMS - Formulation Report', 14, 20, { charSpace: 0.3 });
    
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Active Product Workspace: ${productName}`, 14, 28, { charSpace: 0.15 });
    doc.text(`Ref No: ${form.refNo}`, 14, 35, { charSpace: 0.15 });
    doc.text(`Batch No: ${form.batchNo}`, 14, 42, { charSpace: 0.15 });
    doc.text(`Product Name: ${form.product}`, 14, 49, { charSpace: 0.15 });
    doc.text(`Total Weight: ${total} grams`, 14, 56, { charSpace: 0.15 });

    let y = 66;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ingredients List:', 14, y, { charSpace: 0.2 });
    
    y += 8;
    doc.setFontSize(11);
    // Draw columns manually
    doc.text('Sr', 14, y, { charSpace: 0.2 });
    doc.text('MR No', 24, y, { charSpace: 0.2 });
    doc.text('Raw Material', 54, y, { charSpace: 0.2 });
    doc.text('Quantity (g)', 124, y, { charSpace: 0.2 });
    doc.line(14, y + 2.5, 180, y + 2.5);

    y += 10;
    doc.setFont('Helvetica', 'normal');
    rows.filter((r: any) => r.material !== '').forEach((r: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Ingredients List (Continued):', 14, y, { charSpace: 0.2 });
        y += 10;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
      }
      doc.text(r.sr, 14, y, { charSpace: 0.1 });
      doc.text(r.mr || '-', 24, y, { charSpace: 0.1 });
      doc.text(r.material, 54, y, { charSpace: 0.1 });
      doc.text(r.qty || '0', 124, y, { charSpace: 0.1 });
      y += 8;
    });

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.line(14, y, 180, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Test Specifications:', 14, y, { charSpace: 0.2 });

    y += 8;
    doc.setFontSize(11);
    doc.text('Test Method', 14, y, { charSpace: 0.2 });
    doc.text('Standard', 84, y, { charSpace: 0.2 });
    doc.text('Result', 144, y, { charSpace: 0.2 });
    doc.line(14, y + 2.5, 180, y + 2.5);

    y += 10;
    doc.setFont('Helvetica', 'normal');
    const activeTests = tests.filter((t: any) => t.method.trim() !== '');
    if (activeTests.length > 0) {
      activeTests.forEach((t: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(12);
          doc.text('Test Specifications (Continued):', 14, y, { charSpace: 0.2 });
          y += 10;
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(11);
        }
        doc.text(t.method, 14, y, { charSpace: 0.1 });
        doc.text(t.standard || '-', 84, y, { charSpace: 0.1 });
        doc.text(t.result || '-', 144, y, { charSpace: 0.1 });
        y += 8;
      });
    } else {
      doc.setFontSize(11);
      doc.text('No test specifications recorded.', 14, y, { charSpace: 0.1 });
      y += 8;
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
      doc.setFontSize(12);
      doc.text('Remarks:', 14, y, { charSpace: 0.2 });
      y += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(remarks, 14, y, { charSpace: 0.1 });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateFormulationPrintPDF = (data: any) => {
    const fd = data.form_data || [];
    const refNo = data.ref_no || fd[0] || 'N/A';
    const batchNo = data.batch_no || fd[1] || 'N/A';
    
    const isLab = fd.length === 6 || activeSubView.includes('lab');
    const productNameField = data.product_name_field || fd[2] || data.product || 'N/A';
    const testDate = data.test_date || (isLab ? (fd[3] || 'N/A') : (fd.length === 8 ? (fd[5] || 'N/A') : (fd[4] || 'N/A')));
    const reportDate = data.report_date || (isLab ? (fd[4] || 'N/A') : (fd.length === 8 ? (fd[6] || 'N/A') : (fd[5] || 'N/A')));
    const formulaDate = data.formula_date || (isLab ? (fd[5] || 'N/A') : (fd.length === 8 ? (fd[7] || 'N/A') : (fd[6] || 'N/A')));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((item: any) => item.material.trim() !== '');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text('COLORTEK CMS - LABORATORY FORMULATION CARD', 105, 18, { align: 'center', charSpace: 0.4 });
    doc.line(12, 22, 198, 22);

    // Metadata details block
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    // Column 1
    doc.setFont('Helvetica', 'bold'); doc.text('Product Name:', 15, 32, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(productNameField, 48, 32, { charSpace: 0.15 });
    
    doc.setFont('Helvetica', 'bold'); doc.text('Batch No:', 15, 41, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(batchNo, 48, 41, { charSpace: 0.15 });
    
    doc.setFont('Helvetica', 'bold'); doc.text('Formula Date:', 15, 50, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(formulaDate !== 'N/A' ? formulaDate : '-', 48, 50, { charSpace: 0.15 });

    // Column 2
    doc.setFont('Helvetica', 'bold'); doc.text('Ref No:', 115, 32, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(refNo !== 'N/A' ? refNo : '-', 145, 32, { charSpace: 0.15 });
    
    doc.setFont('Helvetica', 'bold'); doc.text('Test Date:', 115, 41, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(testDate !== 'N/A' ? testDate : '-', 145, 41, { charSpace: 0.15 });
    
    doc.setFont('Helvetica', 'bold'); doc.text('Report Date:', 115, 50, { charSpace: 0.15 });
    doc.setFont('Helvetica', 'normal'); doc.text(reportDate !== 'N/A' ? reportDate : '-', 145, 50, { charSpace: 0.15 });

    doc.setDrawColor(209, 213, 219);
    doc.line(12, 56, 198, 56);

    // Ingredients Section
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('INGREDIENTS FORMULA', 15, 63, { charSpace: 0.3 });

    let y = 70;
    doc.setFontSize(11.5);
    doc.setFillColor(245, 245, 245);
    doc.rect(12, y, 186, 9, 'F');
    doc.rect(12, y, 186, 9, 'S');

    doc.text('Sr', 16, y + 6, { charSpace: 0.2 });
    doc.text('MR No', 28, y + 6, { charSpace: 0.2 });
    doc.text('Raw Material Description', 62, y + 6, { charSpace: 0.2 });
    doc.text('Quantity (Grams)', 194, y + 6, { align: 'right', charSpace: 0.2 });

    y += 9;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);

    let totalQty = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inventory.forEach((item: any, index: number) => {
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(12, y, 186, 9, 'F');
      }
      doc.rect(12, y, 186, 9, 'S');

      doc.text(item.sr || String(index + 1), 16, y + 6, { charSpace: 0.15 });
      doc.text(item.mr || '-', 28, y + 6, { charSpace: 0.15 });
      doc.text(item.material, 62, y + 6, { charSpace: 0.15 });
      
      const qtyVal = parseFloat(item.qty);
      if (!isNaN(qtyVal)) {
        totalQty += qtyVal;
        doc.text(qtyVal.toFixed(2), 194, y + 6, { align: 'right', charSpace: 0.15 });
      } else {
        doc.text(item.qty || '0.00', 194, y + 6, { align: 'right', charSpace: 0.15 });
      }
      y += 9;
    });

    // Total Row
    doc.setFillColor(245, 245, 245);
    doc.rect(12, y, 186, 10, 'F');
    doc.rect(12, y, 186, 10, 'S');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL FORMULATION WEIGHT:', 62, y + 6.5, { charSpace: 0.2 });
    doc.text(`${totalQty.toFixed(2)} g`, 194, y + 6.5, { align: 'right', charSpace: 0.2 });

    y += 15;

    if (tests.length === 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Remarks & Comments:', 15, y, { charSpace: 0.3 });

      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      
      doc.rect(12, y, 186, 45);
      const splitRemarks = doc.splitTextToSize(remarks || 'No additional remarks.', 178);
      doc.text(splitRemarks, 16, y + 7, { charSpace: 0.1 });
    } else {
      // PAGE 2: Back Side
      doc.addPage();
      doc.setDrawColor(128, 128, 128);
      doc.setLineWidth(0.5);
      doc.rect(8, 8, 194, 281);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text('QUALITY CONTROL TEST SPECIFICATIONS', 105, 18, { align: 'center', charSpace: 0.4 });
      doc.line(12, 22, 198, 22);

      y = 30;
      doc.setFontSize(11.5);
      doc.setFillColor(245, 245, 245);
      doc.rect(12, y, 186, 9, 'F');
      doc.rect(12, y, 186, 9, 'S');

      doc.setTextColor(0, 0, 0);
      doc.text('Test Method / Parameter', 16, y + 6, { charSpace: 0.2 });
      doc.text('Standard Range / Spec', 96, y + 6, { charSpace: 0.2 });
      doc.text('Observed Result', 194, y + 6, { align: 'right', charSpace: 0.2 });

      y += 9;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tests.forEach((t: any, index: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(12, y, 186, 9, 'F');
        }
        doc.rect(12, y, 186, 9, 'S');

        doc.text(t.method, 16, y + 6, { charSpace: 0.15 });
        doc.text(t.standard || '-', 96, y + 6, { charSpace: 0.15 });
        doc.text(t.result || '-', 194, y + 6, { align: 'right', charSpace: 0.15 });
        y += 9;
      });

      y += 12;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Remarks & Comments:', 15, y, { charSpace: 0.3 });

      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      
      doc.rect(12, y, 186, 50);
      const splitRemarks = doc.splitTextToSize(remarks || 'No additional remarks.', 178);
      doc.text(splitRemarks, 16, y + 7, { charSpace: 0.1 });
    }



    // Save
    doc.save(`Lab_Formulation_${batchNo}_Card.pdf`);
    onShowToast(`Printable 2-page Card for Batch ${batchNo} downloaded!`, 'success');
  };

  const printSelectedIngredientsOnly = async () => {
    if (selectedPastBatches.length === 0) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateIngredientsOnlyPDF = (fetchedData: any[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const pageHeight = 297; 
    const margin = 8;
    const cardWidth = 94; 
    const gapX = 6; 
    const fixedCardHeight = 281; 
    const tableRowHeight = 8.5;

    const formatDateDMY = (dateStr: string) => {
      if (!dateStr || dateStr === 'N/A' || dateStr.trim() === '-' || dateStr.trim() === '') return '-';
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
      return dateStr;
    };

    // Flatten data into individual printable card blocks (handling chunks of max 20 items per card)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const printableCards: any[] = [];

    fetchedData.forEach((data) => {
      const fd = data.form_data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inventory = (data.inventory || []).map((i: any) => {
        if (Array.isArray(i)) {
          return {
            sr: i[0] ? i[0].toString() : '',
            material: i[1] || '',
            qty: i[2] !== undefined ? i[2].toString() : '',
          };
        } else {
          return {
            sr: i.sr_no ? i.sr_no.toString() : (i.sr ? i.sr.toString() : ''),
            material: i.raw_material || i.material || '',
            qty: i.qty !== undefined ? i.qty.toString() : '',
          };
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).filter((item: any) => item.material.trim() !== '');

      const maxItemsPerCard = 20;
      
      if (inventory.length <= 18) {
        // Fits normally on one card block
        printableCards.push({ ...data, inventory, isContinuation: false, isFinalChunk: true });
      } else {
        // Split into chunks of 20
        for (let i = 0; i < inventory.length; i += maxItemsPerCard) {
          const chunk = inventory.slice(i, i + maxItemsPerCard);
          const isFirst = (i === 0);
          const isFinal = (i + maxItemsPerCard >= inventory.length);
          
          printableCards.push({
            ...data,
            inventory: chunk,
            isContinuation: !isFirst,
            isFinalChunk: isFinal,
            fullInventoryRef: inventory // kept to calculate overall total on the final chunk card
          });
        }
      }
    });

    // Render the generated card blocks side-by-side
    printableCards.forEach((cardData, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        doc.addPage();
      }

      const positionOnPage = idx % 2; 
      const startY = margin;
      const slotX = margin + (positionOnPage * (cardWidth + gapX));

      const fd = cardData.form_data || [];
      const refNo = cardData.ref_no || fd[0] || 'N/A';
      const batchNo = cardData.batch_no || fd[1] || 'N/A';
      
      const isLab = fd.length === 6 || activeSubView.includes('lab');
      const productNameField = cardData.product_name_field || fd[2] || cardData.product || 'N/A';
      
      const testDate = formatDateDMY(cardData.test_date || (isLab ? (fd[3] || 'N/A') : (fd.length === 8 ? (fd[5] || 'N/A') : (fd[4] || 'N/A'))));
      const reportDate = formatDateDMY(cardData.report_date || (isLab ? (fd[4] || 'N/A') : (fd.length === 8 ? (fd[6] || 'N/A') : (fd[5] || 'N/A'))));
      const formulaDate = formatDateDMY(cardData.formula_date || (isLab ? (fd[5] || 'N/A') : (fd.length === 8 ? (fd[7] || 'N/A') : (fd[6] || 'N/A'))));

      // --- 1. CARD HEADER ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14); 
      doc.setTextColor(29, 78, 216);
      
      const titleText = cardData.isContinuation ? `Batch: ${batchNo.substring(0, 10)} (Cont.)` : `Batch: ${batchNo.substring(0, 16)}`;
      doc.text(titleText, slotX + 4, startY + 8);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11.5); 
      doc.setTextColor(107, 114, 128);
      doc.text(`Ref: ${refNo !== 'N/A' ? refNo.substring(0, 12) : '-'}`, slotX + cardWidth - 4, startY + 8, { align: 'right' });

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.4);
      doc.line(slotX + 4, startY + 10, slotX + cardWidth - 4, startY + 10);

      let currentSectionsY = startY + 12;

      // --- 2. BATCH DETAILS SECTION (Only draw on the first card page) ---
      if (!cardData.isContinuation) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12); 
        doc.setTextColor(29, 78, 216);
        doc.text('BATCH DETAILS', slotX + 4, currentSectionsY + 4);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11); 
        const containerInnerWidth = cardWidth - 8;
        const labelWidth = 18;
        const allowedTextWidth = containerInnerWidth - labelWidth - 2;

        const wrappedProductLines = doc.splitTextToSize(productNameField, allowedTextWidth);
        const productRowHeight = wrappedProductLines.length > 1 ? 7 + (wrappedProductLines.length - 1) * 5 : 7;
        const datesRowHeight = 11; 
        const batchDetailsContainerHeight = productRowHeight + datesRowHeight;

        doc.setDrawColor(209, 213, 219);
        doc.setFillColor(249, 250, 251);
        doc.rect(slotX + 4, currentSectionsY + 6, containerInnerWidth, batchDetailsContainerHeight, 'DF');
        
        doc.line(slotX + 4, currentSectionsY + 6 + productRowHeight, slotX + cardWidth - 4, currentSectionsY + 6 + productRowHeight);

        doc.setFont('Helvetica', 'bold');
        doc.text('Product:', slotX + 6, currentSectionsY + 11);
        doc.setFont('Helvetica', 'normal');
        doc.text(wrappedProductLines, slotX + 24, currentSectionsY + 11);

        const halfWidth = containerInnerWidth / 2;
        const bottomRowStartY = currentSectionsY + 6 + productRowHeight;
        
        doc.line(slotX + 4 + halfWidth, bottomRowStartY, slotX + 4 + halfWidth, bottomRowStartY + datesRowHeight);

        doc.setFontSize(9.5); 
        doc.setFont('Helvetica', 'bold'); doc.text('Form Dt:', slotX + 6, bottomRowStartY + 6.5);
        doc.setFont('Helvetica', 'normal'); doc.text(formulaDate, slotX + 24, bottomRowStartY + 6.5);

        doc.setFont('Helvetica', 'bold'); doc.text('Test Dt:', slotX + 6 + halfWidth, bottomRowStartY + 4.5);
        doc.setFont('Helvetica', 'normal'); doc.text(testDate, slotX + 22 + halfWidth, bottomRowStartY + 4.5);

        doc.setFont('Helvetica', 'bold'); doc.text('Rep Dt:', slotX + 6 + halfWidth, bottomRowStartY + 9);
        doc.setFont('Helvetica', 'normal'); doc.text(reportDate, slotX + 22 + halfWidth, bottomRowStartY + 9);

        currentSectionsY += 6 + batchDetailsContainerHeight + 4;
      }

      // --- 3. RAW MATERIALS TABLE ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12); 
      doc.setTextColor(29, 78, 216);
      doc.text(cardData.isContinuation ? 'RAW MATERIALS (CONTINUED)' : 'RAW MATERIALS', slotX + 4, currentSectionsY);

      let tableY = currentSectionsY + 2;
      const containerInnerWidth = cardWidth - 8;

      // Header row
      doc.setFillColor(245, 248, 250);
      doc.rect(slotX + 4, tableY, containerInnerWidth, tableRowHeight, 'DF');

      doc.setFontSize(11); 
      doc.setTextColor(0, 0, 0);
      doc.text('Sr', slotX + 6, tableY + 5.8);
      doc.text('Material Description', slotX + 14, tableY + 5.8);
      doc.text('Qty (g)', slotX + cardWidth - 6, tableY + 5.8, { align: 'right' });

      tableY += tableRowHeight;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(13); 

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cardData.inventory.forEach((item: any, index: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(slotX + 4, tableY, containerInnerWidth, tableRowHeight, 'F');
        }
        doc.rect(slotX + 4, tableY, containerInnerWidth, tableRowHeight, 'S');

        doc.text(item.sr || String(index + 1), slotX + 6, tableY + 5.8);
        doc.text(item.material.substring(0, 18), slotX + 14, tableY + 5.8);
        
        const qtyVal = parseFloat(item.qty);
        doc.text(!isNaN(qtyVal) ? qtyVal.toFixed(2) : (item.qty || '0.00'), slotX + cardWidth - 6, tableY + 5.8, { align: 'right' });
        
        tableY += tableRowHeight;
      });

      // Total data row (Only print at the end of the final chunk data table block)
      if (cardData.isFinalChunk) {
        let totalQty = 0;
        const itemsToSum = cardData.fullInventoryRef || cardData.inventory;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        itemsToSum.forEach((item: any) => {
          const qtyVal = parseFloat(item.qty);
          if (!isNaN(qtyVal)) totalQty += qtyVal;
        });

        doc.setFillColor(243, 244, 246);
        doc.rect(slotX + 4, tableY, containerInnerWidth, tableRowHeight, 'DF');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Total:', slotX + 14, tableY + 5.8);
        doc.text(`${totalQty.toFixed(2)} g`, slotX + cardWidth - 6, tableY + 5.8, { align: 'right' });

        tableY += tableRowHeight;
      }

      // --- 4. REPORT NOTES AREA (Only drawn on the final page chunk layout) ---
      if (cardData.isFinalChunk) {
        const remainingSpaceHeaderY = tableY + 6;
        const absoluteCardBottomBoundary = startY + fixedCardHeight - 4; 

        if (remainingSpaceHeaderY < absoluteCardBottomBoundary - 6) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(11); 
          doc.setTextColor(29, 78, 216);
          doc.text('REPORT NOTES', slotX + 4, remainingSpaceHeaderY);

          doc.setDrawColor(210, 215, 220);
          doc.setLineWidth(0.2);

          let noteLineY = remainingSpaceHeaderY + 6;
          while (noteLineY < absoluteCardBottomBoundary) {
            doc.line(slotX + 4, noteLineY, slotX + cardWidth - 4, noteLineY);
            noteLineY += 7.5; 
          }
        }
      }

      // Draw the Outer Border Layout Frame Box
      doc.setDrawColor(180, 185, 190);
      doc.setLineWidth(0.4);
      doc.rect(slotX, startY, cardWidth, fixedCardHeight, 'S');
    });

    doc.save(`Lab_Raw_Materials_${Date.now()}.pdf`);
    onShowToast(`Printable sheets downloaded successfully!`, 'success');
    setSelectedPastBatches([]);
  };

  const printSelectedCompleteCards = async () => {
    if (selectedPastBatches.length === 0) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateMultiFormulationsPrintPDF = (fetchedData: any[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const cardWidth = 94;

    const getSlotCoords = (slotName: string) => {
      switch (slotName) {
        case 'top-left': return { x: 8, y: 8 };
        case 'top-right': return { x: 108, y: 8 };
        case 'middle-left': return { x: 8, y: 101 };
        case 'middle-right': return { x: 108, y: 101 };
        case 'bottom-left': return { x: 8, y: 194 };
        case 'bottom-right': return { x: 108, y: 194 };
        default: return { x: 8, y: 8 };
      }
    };

    fetchedData.forEach((data, idx) => {
      const fd = data.form_data || [];
      const refNo = data.ref_no || fd[0] || 'N/A';
      const batchNo = data.batch_no || fd[1] || 'N/A';
      
      const isLab = fd.length === 6 || activeSubView.includes('lab');
      const productNameField = data.product_name_field || fd[2] || data.product || 'N/A';
      const testDate = data.test_date || (isLab ? (fd[3] || 'N/A') : (fd.length === 8 ? (fd[5] || 'N/A') : (fd[4] || 'N/A')));
      const reportDate = data.report_date || (isLab ? (fd[4] || 'N/A') : (fd.length === 8 ? (fd[6] || 'N/A') : (fd[5] || 'N/A')));
      const formulaDate = data.formula_date || (isLab ? (fd[5] || 'N/A') : (fd.length === 8 ? (fd[7] || 'N/A') : (fd[6] || 'N/A')));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).filter((item: any) => item.material.trim() !== '');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Determine slot coordinates
      let slotX = 8;
      let slotY = 8;
      
      if (fetchedData.length === 1) {
        const coords = getSlotCoords(printSlot);
        slotX = coords.x;
        slotY = coords.y;
      } else {
        const pageIndex = idx % 6;
        const pageNum = Math.floor(idx / 6);
        if (pageNum > 0 && pageIndex === 0) {
          doc.addPage();
        }
        if (pageIndex === 0) { slotX = 8; slotY = 8; }
        else if (pageIndex === 1) { slotX = 108; slotY = 8; }
        else if (pageIndex === 2) { slotX = 8; slotY = 101; }
        else if (pageIndex === 3) { slotX = 108; slotY = 101; }
        else if (pageIndex === 4) { slotX = 8; slotY = 194; }
        else if (pageIndex === 5) { slotX = 108; slotY = 194; }
      }

      const startY = slotY;
      const cardHeight = 88;

      // Card Border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(slotX, startY, cardWidth, cardHeight, 'S');

      // Card Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(29, 78, 216); // Blue-700
      doc.text(`Batch: ${batchNo.substring(0, 18)}`, slotX + 4, startY + 5.5, { charSpace: 0.2 });
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Ref: ${refNo !== 'N/A' ? refNo.substring(0, 14) : '-'}`, slotX + cardWidth - 4, startY + 5.5, { align: 'right', charSpace: 0.1 });

      doc.setDrawColor(229, 231, 235);
      doc.line(slotX + 4, startY + 6.5, slotX + cardWidth - 4, startY + 6.5);

      // BATCH DETAILS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 78, 216);
      doc.text('BATCH DETAILS', slotX + 4, startY + 10.5, { charSpace: 0.2 });

      doc.setDrawColor(209, 213, 219);
      doc.setFillColor(249, 250, 251);
      doc.rect(slotX + 4, startY + 12, cardWidth - 8, 9);
      doc.line(slotX + 4, startY + 16.5, slotX + cardWidth - 4, startY + 16.5); // Horizontal Divider
      doc.line(slotX + 4 + (cardWidth - 8) / 2, startY + 12, slotX + 4 + (cardWidth - 8) / 2, startY + 21); // Vertical Divider

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      doc.setFont('Helvetica', 'bold'); doc.text('Product:', slotX + 6, startY + 15.5, { charSpace: 0.1 });
      doc.setFont('Helvetica', 'normal'); doc.text(productNameField.substring(0, 15), slotX + 17, startY + 15.5, { charSpace: 0.08 });
      
      doc.setFont('Helvetica', 'bold'); doc.text('Formula Dt:', slotX + 4 + (cardWidth - 8) / 2 + 2, startY + 15.5, { charSpace: 0.1 });
      doc.setFont('Helvetica', 'normal'); doc.text(formulaDate !== 'N/A' ? formulaDate : '-', slotX + 4 + (cardWidth - 8) / 2 + 20, startY + 15.5, { charSpace: 0.08 });

      doc.setFont('Helvetica', 'bold'); doc.text('Test Dt:', slotX + 6, startY + 20, { charSpace: 0.1 });
      doc.setFont('Helvetica', 'normal'); doc.text(testDate !== 'N/A' ? testDate : '-', slotX + 17, startY + 20, { charSpace: 0.08 });
      
      doc.setFont('Helvetica', 'bold'); doc.text('Report Dt:', slotX + 4 + (cardWidth - 8) / 2 + 2, startY + 20, { charSpace: 0.1 });
      doc.setFont('Helvetica', 'normal'); doc.text(reportDate !== 'N/A' ? reportDate : '-', slotX + 4 + (cardWidth - 8) / 2 + 20, startY + 20, { charSpace: 0.08 });

      // RAW MATERIALS Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 78, 216);
      doc.text('RAW MATERIALS', slotX + 4, startY + 24.5, { charSpace: 0.2 });

      let tableY = startY + 26;
      doc.setFillColor(245, 248, 250);
      doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'S');

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('Sr', slotX + 6, tableY + 3.2, { charSpace: 0.1 });
      doc.text('Material Description', slotX + 14, tableY + 3.2, { charSpace: 0.1 });
      doc.text('Qty (g)', slotX + cardWidth - 6, tableY + 3.2, { align: 'right', charSpace: 0.1 });

      tableY += 4.5;
      doc.setFont('Helvetica', 'normal');

      let totalQty = 0;
      const maxRawMaterials = 5;
      const displayInventory = inventory.slice(0, maxRawMaterials);
      const remainingRMCount = inventory.length - maxRawMaterials;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      displayInventory.forEach((item: any, index: number) => {
        const isLastRow = index === maxRawMaterials - 1 && remainingRMCount > 0;
        
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'F');
        }
        doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'S');

        if (isLastRow) {
          doc.setFont('Helvetica', 'bold');
          doc.text('', slotX + 6, tableY + 3.2);
          doc.text(`+ ${remainingRMCount + 1} more materials...`, slotX + 14, tableY + 3.2, { charSpace: 0.08 });
          doc.text('-', slotX + cardWidth - 6, tableY + 3.2, { align: 'right', charSpace: 0.08 });
          doc.setFont('Helvetica', 'normal');
        } else {
          doc.text(item.sr || String(index + 1), slotX + 6, tableY + 3.2, { charSpace: 0.08 });
          doc.text(item.material.substring(0, 24), slotX + 14, tableY + 3.2, { charSpace: 0.08 });
          
          const qtyVal = parseFloat(item.qty);
          if (!isNaN(qtyVal)) {
            totalQty += qtyVal;
            doc.text(qtyVal.toFixed(2), slotX + cardWidth - 6, tableY + 3.2, { align: 'right', charSpace: 0.08 });
          } else {
            doc.text(item.qty || '0.00', slotX + cardWidth - 6, tableY + 3.2, { align: 'right', charSpace: 0.08 });
          }
        }
        tableY += 4.5;
      });

      if (remainingRMCount > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inventory.slice(maxRawMaterials - 1).forEach((item: any) => {
          const qtyVal = parseFloat(item.qty);
          if (!isNaN(qtyVal)) totalQty += qtyVal;
        });
      }

      // Total Row
      doc.setFillColor(243, 244, 246);
      doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'F');
      doc.rect(slotX + 4, tableY, cardWidth - 8, 4.5, 'S');
      doc.setFont('Helvetica', 'bold');
      doc.text('Total:', slotX + 14, tableY + 3.2, { charSpace: 0.1 });
      doc.text(`${totalQty.toFixed(2)} g`, slotX + cardWidth - 6, tableY + 3.2, { align: 'right', charSpace: 0.1 });

      let nextY = tableY + 4.5;

      // TEST RESULTS (if exist)
      if (tests.length > 0) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(29, 78, 216);
        doc.text('TEST RESULTS', slotX + 4, nextY + 2.5, { charSpace: 0.2 });

        let testTableY = nextY + 4;
        doc.setFillColor(245, 248, 250);
        doc.rect(slotX + 4, testTableY, cardWidth - 8, 4.5, 'F');
        doc.rect(slotX + 4, testTableY, cardWidth - 8, 4.5, 'S');

        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('Test Method', slotX + 6, testTableY + 3.2, { charSpace: 0.1 });
        doc.text('Std / Result', slotX + cardWidth - 6, testTableY + 3.2, { align: 'right', charSpace: 0.1 });

        testTableY += 4.5;
        doc.setFont('Helvetica', 'normal');

        const maxTests = 2;
        const displayTests = tests.slice(0, maxTests);
        const remainingTestsCount = tests.length - maxTests;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        displayTests.forEach((t: any, index: number) => {
          const isLastRow = index === maxTests - 1 && remainingTestsCount > 0;
          
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(slotX + 4, testTableY, cardWidth - 8, 4.5, 'F');
          }
          doc.rect(slotX + 4, testTableY, cardWidth - 8, 4.5, 'S');

          if (isLastRow) {
            doc.setFont('Helvetica', 'bold');
            doc.text(`+ ${remainingTestsCount + 1} more tests...`, slotX + 6, testTableY + 3.2, { charSpace: 0.08 });
            doc.text('-', slotX + cardWidth - 6, testTableY + 3.2, { align: 'right', charSpace: 0.08 });
            doc.setFont('Helvetica', 'normal');
          } else {
            doc.text(t.method.substring(0, 20), slotX + 6, testTableY + 3.2, { charSpace: 0.08 });
            const resStr = `${t.standard || '-'} / ${t.result || '-'}`;
            doc.text(resStr.substring(0, 20), slotX + cardWidth - 6, testTableY + 3.2, { align: 'right', charSpace: 0.08 });
          }
          testTableY += 4.5;
        });

        nextY = testTableY;
      }

      // Remarks & Comments (if exist)
      if (remarks) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(29, 78, 216);
        doc.text('Remarks & Comments:', slotX + 4, nextY + 2.5, { charSpace: 0.2 });

        const remarksBoxY = nextY + 4;
        const remarksBoxHeight = 6;
        doc.setDrawColor(209, 213, 219);
        doc.rect(slotX + 4, remarksBoxY, cardWidth - 8, remarksBoxHeight);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(remarks.substring(0, 52), slotX + 6, remarksBoxY + 4.2, { charSpace: 0.05 });
      }
    });

    doc.save(`Lab_Complete_Cards_${Date.now()}.pdf`);
    onShowToast(`Printable Complete Cards downloaded successfully!`, 'success');
    setSelectedPastBatches([]); // Reset selection after printing
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  return {
    exportToExcel,
    exportToPDF,
    generateFormulationPrintPDF,
    generateIngredientsOnlyPDF,
    generateMultiFormulationsPrintPDF,
    printSelectedIngredientsOnly,
    printSelectedCompleteCards
  };
};
