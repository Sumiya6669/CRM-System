/**
 * Выгрузка в Excel.
 *
 * Библиотека xlsx подключается динамическим import() — она весит порядка 400 КБ
 * и не должна попадать в основной бандл: код загружается только в момент,
 * когда пользователь нажал «Скачать в Excel».
 */

const columnWidths = (rows) => {
  const widths = [];
  rows.forEach((row) => {
    row.forEach((cell, index) => {
      const length = cell === null || cell === undefined ? 0 : String(cell).length;
      widths[index] = Math.min(42, Math.max(widths[index] || 10, length + 2));
    });
  });
  return widths.map((width) => ({ wch: width }));
};

/** Безопасное имя листа: Excel запрещает : \ / ? * [ ] и больше 31 символа. */
const safeSheetName = (name, index) => {
  const cleaned = String(name || `Лист${index + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim();
  return cleaned.slice(0, 31) || `Лист${index + 1}`;
};

const timestamp = () => new Date().toISOString().slice(0, 10);

/**
 * @param {string} fileName        имя файла без расширения
 * @param {Array<{name: string, rows: Array<Array>}>} sheets листы в формате «массив строк»
 */
export const downloadExcel = async (fileName, sheets) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet, index) => {
    const rows = sheet.rows || [];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = columnWidths(rows);
    if (rows.length > 1) {
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: Math.max(0, (rows[0] || []).length - 1) },
      }) };
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name, index));
  });

  // Формируем массив байтов и отдаём через Blob.
  // XLSX.writeFile в ESM-сборке рассчитан на Node и его файловую систему,
  // поэтому в браузере используем явную загрузку.
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}-${timestamp()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
