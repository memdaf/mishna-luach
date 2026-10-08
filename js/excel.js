// ייצוא הלוח ל-Excel בעזרת ExcelJS: כותרת ממורכזת, שורת כותרות מודגשת,
// עמודות "נלמד" עם רשימת בחירה (✔), ובסוף שורה אחת: מימין "מוגש ע"י", משמאל הסבר הכוכבית.
(function (root) {
  'use strict';

  const COLS = 9;
  const WIDTHS = [11, 16, 20, 7, 24, 18, 7, 36, 7];
  const HEAD = ['תאריך', 'תאריך עברי', 'חג', 'יום', 'פרשה', 'לימוד החק', 'נלמד', 'משנה לחק', 'נלמד'];
  const TICK_COLS = [7, 9];
  const FONT = 'Arial';
  const TECHELET = 'FF23408E', HEAD_FILL = 'FFE9EEF9', SHABBAT_FILL = 'FFF1F4FB', LINE = 'FFC9CFDA';

  // סימן "נלמד": ✔ אמיתי (U+2714), גדול וירוק. מופיע כך גם ברשימת הבחירה
  const CHECK = '✔';
  const CHECK_FONT = { name: 'Segoe UI Symbol', size: 14, bold: true, color: { argb: 'FF1E8E3E' } };

  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = { style: 'thin', color: { argb: LINE } };

  // c: הלוח הנוכחי (current מ-app.js). ticked(r, col): האם סומן "נלמד"
  function buildExcel(ExcelJS, c, ticked) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('לוח', {
      views: [{ rightToLeft: true }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = WIDTHS.map(width => ({ width }));

    let row = 0;
    // שורה ממוזגת על כל הרוחב
    const banner = (text, font, align) => {
      row++;
      ws.mergeCells(row, 1, row, COLS);
      const cell = ws.getCell(row, 1);
      cell.value = text;
      cell.font = Object.assign({ name: FONT }, font);
      cell.alignment = { horizontal: align || 'center', vertical: 'middle', readingOrder: 'rtl' };
      return cell;
    };

    banner(c.title, { size: 22, bold: true, color: { argb: TECHELET } });
    ws.getRow(row).height = 36;
    // "לט"נ" רק כשהוזן שם
    if (c.dedication) {
      banner(c.dedication, { size: 13, bold: true, color: { argb: TECHELET } });
      ws.getRow(row).height = 20;
    }
    row++; // שורה ריקה

    // שורת הכותרות
    row++;
    const headRow = row;
    HEAD.forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = h;
      cell.font = { name: FONT, bold: true };
      cell.fill = fill(HEAD_FILL);
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
      cell.border = { bottom: { style: 'medium', color: { argb: TECHELET } } };
    });
    ws.getRow(row).height = 20;
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: headRow }];
    ws.pageSetup.printTitlesRow = headRow + ':' + headRow;

    // השורות
    c.rows.forEach((r, i) => {
      row++;
      const values = [r.greg, r.heb, r.chag, r.day, r.parsha,
        r.limud1, ticked(r, 1) ? CHECK : '', r.limud2, ticked(r, 2) ? CHECK : ''];
      const weekStart = i === 0 || r.dow === 0;
      values.forEach((v, j) => {
        const cell = ws.getCell(row, j + 1);
        const tickCol = TICK_COLS.includes(j + 1);
        cell.value = v || null;
        cell.font = tickCol ? CHECK_FONT : { name: FONT, bold: j === 4 };
        cell.alignment = { horizontal: tickCol ? 'center' : 'right', vertical: 'middle', readingOrder: 'rtl' };
        cell.border = { bottom: thin, top: weekStart ? { style: 'medium', color: { argb: 'FF8A93A3' } } : thin };
        if (r.dow === 6) cell.fill = fill(SHABBAT_FILL);
      });
      // רשימת בחירה עם סימן ✔ רק כשיש מה ללמוד באותו יום
      [[7, r.limud1], [9, r.limud2]].forEach(([col, text]) => {
        if (!text) return;
        ws.getCell(row, col).dataValidation = {
          type: 'list', allowBlank: true, formulae: ['"' + CHECK + '"'],
          showErrorMessage: true, errorTitle: 'נלמד', error: 'אפשר רק לבחור ' + CHECK + ' מהרשימה, או להשאיר ריק',
        };
      });
    });
    ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: row, column: COLS } };

    // סוף הלוח
    row++;
    if (c.end) banner(c.end, { size: 12, bold: true });
    // שורה אחת: מימין "מוגש ע"י", משמאל הסבר הכוכבית
    row++;
    ws.mergeCells(row, 1, row, 4);
    ws.mergeCells(row, 5, row, COLS);
    const right = ws.getCell(row, 1), left = ws.getCell(row, 5);
    right.value = c.footer;
    right.font = { name: FONT, bold: true, color: { argb: TECHELET } };
    right.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
    left.value = c.note || null;
    left.font = { name: FONT, size: 10 };
    left.alignment = { horizontal: 'left', vertical: 'middle', readingOrder: 'rtl' };

    return wb;
  }

  async function downloadExcel(ExcelJS, c, ticked, fileName) {
    const buf = await buildExcel(ExcelJS, c, ticked).xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  root.LuachExcel = { buildExcel, downloadExcel };
})(typeof window !== 'undefined' ? window : globalThis);
