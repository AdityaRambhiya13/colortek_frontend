import ExcelJS from 'exceljs';

export const utils = {
    book_new: () => {
        return new ExcelJS.Workbook();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aoa_to_sheet: (data: any[][]): any => {
        return data; 
    },
    book_append_sheet: (wb: ExcelJS.Workbook, wsData: unknown[][], sheetName: string) => {
        const sheet = wb.addWorksheet(sheetName);
        sheet.addRows(wsData);
    }
};

export const writeFile = (wb: ExcelJS.Workbook, filename: string) => {
    wb.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
    });
};
