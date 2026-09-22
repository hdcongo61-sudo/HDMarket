import ExcelJS from 'exceljs';

export const createSpreadsheet = ({ rows, widths = [], sheetName = 'Données' }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  const keys = Object.keys(rows[0] || {});
  sheet.columns = keys.map((key, index) => ({ header: key, key, width: widths[index] || 20 }));
  // User-supplied strings are cells, never executable spreadsheet formulas.
  sheet.addRows(rows);
  return workbook;
};

export const downloadSpreadsheet = async ({ filename, ...options }) => {
  const buffer = await createSpreadsheet(options).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
