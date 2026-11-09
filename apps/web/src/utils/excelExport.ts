/**
 * Genuine OpenXML (.xlsx) Spreadsheet Exporter
 * Produces standards-compliant Excel .xlsx workbooks (ZIP container with OpenXML worksheets)
 * that open natively in Microsoft Excel, Google Sheets, Apple Numbers, and LibreOffice Calc.
 * Supports multiple worksheets, typed numeric/currency/date/text cells, auto-sized columns,
 * bold header styling, and summary totals rows.
 */

export type ExcelCellType = 'string' | 'number' | 'currency' | 'date';

export interface ExcelColumnSpec<T = any> {
  header: string;
  key: keyof T | string;
  type?: ExcelCellType;
  width?: number;
  /** Optional custom value extractor */
  getValue?: (row: T, index: number) => string | number | Date | null | undefined;
  /** If true, numeric values in this column are summed in the bottom Totals row */
  sumInTotals?: boolean;
  /** Optional static text in the Totals row (e.g. 'TOTAL') */
  totalsLabel?: string;
}

export interface ExcelSheetSpec<T = any> {
  name: string;
  columns: ExcelColumnSpec<T>[];
  rows: T[];
  includeTotalsRow?: boolean;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip invalid XML control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

/**
 * Style indices in xl/styles.xml:
 * 0 = Default normal cell
 * 1 = Header cell (bold white text on slate fill, thin border)
 * 2 = Normal text cell with border
 * 3 = Integer / Number cell (#,##0)
 * 4 = Currency cell ("₹"#,##0)
 * 5 = Totals label cell (bold, top/bottom border, light slate fill)
 * 6 = Totals number cell (bold #,##0)
 * 7 = Totals currency cell (bold "₹"#,##0)
 */
function buildWorksheetXml<T>(sheet: ExcelSheetSpec<T>): string {
  const { columns, rows, includeTotalsRow = true } = sheet;

  // Compute optimal column widths
  const colWidths = columns.map((col) => {
    if (col.width && col.width > 0) return col.width;
    let maxLen = col.header.length + 4;
    rows.forEach((row, idx) => {
      const raw = col.getValue ? col.getValue(row, idx) : (row as Record<string, unknown>)?.[col.key as string];
      const strLen = raw !== null && raw !== undefined ? String(raw).length : 0;
      if (strLen + 4 > maxLen) maxLen = strLen + 4;
    });
    return Math.min(48, Math.max(12, maxLen));
  });

  const colsXml =
    columns.length > 0
      ? `<cols>${colWidths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join('')}</cols>`
      : '';

  const sheetRowsXml: string[] = [];

  // 1. Header Row (Row 1)
  const headerCells = columns
    .map((col, colIdx) => {
      const ref = `${colIndexToLetter(colIdx)}1`;
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(col.header)}</t></is></c>`;
    })
    .join('');
  sheetRowsXml.push(`<row r="1" ht="22" customHeight="1">${headerCells}</row>`);

  // Track totals for numeric columns
  const columnTotals = new Array<number>(columns.length).fill(0);
  const hasAnyTotals = includeTotalsRow && columns.some((c) => c.sumInTotals || c.totalsLabel);

  // 2. Data Rows
  rows.forEach((row, rowIdx) => {
    const excelRowNum = rowIdx + 2;
    const cellsXml = columns
      .map((col, colIdx) => {
        const ref = `${colIndexToLetter(colIdx)}${excelRowNum}`;
        const rawVal = col.getValue
          ? col.getValue(row, rowIdx)
          : (row as Record<string, unknown>)?.[col.key as string];

        const cellType = col.type || (typeof rawVal === 'number' ? 'number' : 'string');

        if (rawVal === null || rawVal === undefined || rawVal === '') return `<c r="${ref}"/>`;
        if (cellType === 'date') {
          const date = rawVal instanceof Date ? rawVal : new Date(String(rawVal));
          if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${sheet.name}: ${col.header}`);
          if (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawVal) && date.toISOString().slice(0, 10) !== rawVal) throw new Error(`Invalid calendar date in ${sheet.name}: ${col.header}`);
          return `<c r="${ref}" t="d" s="8"><v>${date.toISOString()}</v></c>`;
        }

        if (cellType === 'number' || cellType === 'currency') {
          const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
          if (!Number.isFinite(numVal)) throw new Error(`Invalid numeric value in ${sheet.name}: ${col.header}`);
          if (col.sumInTotals) {
            columnTotals[colIdx] += numVal;
          }
          const styleId = cellType === 'currency' ? 4 : 3;
          return `<c r="${ref}" s="${styleId}"><v>${numVal}</v></c>`;
        }

        const strVal = rawVal === null || rawVal === undefined ? '' : String(rawVal);
        return `<c r="${ref}" t="inlineStr" s="2"><is><t>${escapeXml(strVal)}</t></is></c>`;
      })
      .join('');

    sheetRowsXml.push(`<row r="${excelRowNum}" ht="19">${cellsXml}</row>`);
  });

  // 3. Summary Totals Row
  if (hasAnyTotals && rows.length > 0) {
    const totalsRowNum = rows.length + 2;
    const totalCellsXml = columns
      .map((col, colIdx) => {
        const ref = `${colIndexToLetter(colIdx)}${totalsRowNum}`;
        if (col.totalsLabel) {
          return `<c r="${ref}" t="inlineStr" s="5"><is><t>${escapeXml(col.totalsLabel)}</t></is></c>`;
        }
        if (colIdx === 0 && !col.sumInTotals) {
          return `<c r="${ref}" t="inlineStr" s="5"><is><t>TOTAL (${rows.length} rows)</t></is></c>`;
        }
        if (col.sumInTotals) {
          const styleId = col.type === 'currency' ? 7 : 6;
          const val = Math.round((columnTotals[colIdx] + Number.EPSILON) * 100) / 100;
          return `<c r="${ref}" s="${styleId}"><v>${val}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr" s="5"><is><t></t></is></c>`;
      })
      .join('');
    sheetRowsXml.push(`<row r="${totalsRowNum}" ht="22" customHeight="1">${totalCellsXml}</row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  ${colsXml}
  <sheetData>${sheetRowsXml.join('')}</sheetData>
  ${columns.length ? `<autoFilter ref="A1:${colIndexToLetter(columns.length - 1)}${rows.length + 1}"/>` : ''}
</worksheet>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.##"/>
    <numFmt numFmtId="165" formatCode="&quot;₹&quot;#,##0.00"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="medium"><color rgb="FF0F172A"/></top>
      <bottom style="double"><color rgb="FF0F172A"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="0"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="2" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="165" fontId="2" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;
}

/**
 * Pure TypeScript CRC32 & Store ZIP builder for .xlsx packaging
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipArchive(files: Array<{ path: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // compression: 0 (store)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, arr) => acc + arr.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);
  return result;
}

/**
 * Generates and downloads an OpenXML .xlsx workbook with one or more sheets.
 */
export function buildExcelWorkbook(sheets: ExcelSheetSpec<any>[]): Uint8Array {
  if (!sheets.length || !sheets.some(sheet => sheet.rows.length)) throw new Error('No matching records to export.');
  if (sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) > 10000) throw new Error('Export exceeds 10,000 rows. Narrow your filters.');
  const scope: ExcelSheetSpec = { name: 'Export scope', includeTotalsRow: false, columns: [{ header: 'Dataset', key: 'dataset' }, { header: 'Rows', key: 'rows', type: 'number' }, { header: 'Exported at (UTC)', key: 'at' }], rows: sheets.map(sheet => ({ dataset: sheet.name, rows: sheet.rows.length, at: new Date().toISOString() })) };
  const used = new Set<string>();
  const validSheets = [...sheets, scope].map((s, idx) => {
    const base = sanitizeSheetName(s.name, idx); let safeName = base; let suffix = 1;
    while (used.has(safeName.toLowerCase())) { const tail = ` (${suffix++})`; safeName = base.slice(0, 31-tail.length) + tail; }
    used.add(safeName.toLowerCase()); return { ...s, safeName };
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${validSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${validSheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.safeName)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${validSheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${validSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const archiveEntries: Array<{ path: string; content: string }> = [
    { path: '[Content_Types].xml', content: contentTypesXml },
    { path: '_rels/.rels', content: rootRelsXml },
    { path: 'xl/workbook.xml', content: workbookXml },
    { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { path: 'xl/styles.xml', content: buildStylesXml() },
  ];

  validSheets.forEach((sheet, idx) => {
    archiveEntries.push({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      content: buildWorksheetXml(sheet),
    });
  });

  return buildZipArchive(archiveEntries);
}

export function exportWorkbookToExcel(filenameBase: string, sheets: ExcelSheetSpec<any>[]): void {
  if (typeof window === 'undefined') throw new Error('Downloads require a browser.');
  let zipBytes: Uint8Array;
  try { zipBytes = buildExcelWorkbook(sheets); }
  catch (error) { window.alert(error instanceof Error ? error.message : 'Export failed.'); return; }
  const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const cleanFilename = filenameBase
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const finalName = `${cleanFilename || 'Report'}_${dateStamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Convenience helper to export a single table to .xlsx
 */
export function exportTableToExcel<T = any>(
  filenameBase: string,
  sheetName: string,
  columns: ExcelColumnSpec<T>[],
  rows: T[],
  includeTotalsRow = true
): void {
  exportWorkbookToExcel(filenameBase, [
    {
      name: sheetName,
      columns,
      rows,
      includeTotalsRow,
    },
  ]);
}
