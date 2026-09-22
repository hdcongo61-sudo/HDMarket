import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createSpreadsheet } from './downloadSpreadsheet';
describe('admin order spreadsheet export', () => {
  it('keeps French headers, Unicode data, numbers and widths in a readable XLSX file', async () => {
    const workbook = createSpreadsheet({ rows: [{ 'Client': 'Élodie', 'Articles': '=HYPERLINK("https://example.invalid")', 'Quantité': 2 }], widths: [20, 50, 15], sheetName: 'Commandes' });
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = restored.getWorksheet('Commandes');
    expect(sheet.getCell('A2').value).toBe('Élodie');
    expect(sheet.getCell('C2').value).toBe(2);
    expect(sheet.getCell('B2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getColumn(2).width).toBe(50);
  });
});
