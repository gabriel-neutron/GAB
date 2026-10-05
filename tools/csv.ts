// A semicolon-separated file, UTF-8, with a BOM allowed. A field in double quotes may hold a
// semicolon, a line break or a doubled quote.
export const rowsOfCsv = (text: string): readonly Record<string, string>[] => {
  const body = text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let at = 0; at < body.length; at += 1) {
    const char = body[at] ?? '';
    if (quoted) {
      if (char === '"' && body[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[at + 1] === '\n') at += 1;
      row.push(field);
      table.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    table.push(row);
  }
  const [header = [], ...lines] = table.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  const names = header.map((name) => name.trim());
  return lines.map((cells) =>
    Object.fromEntries(names.map((name, index) => [name, (cells[index] ?? '').trim()])),
  );
};

const NEEDS_QUOTES = /[;"\r\n]/;

const cellOf = (value: string): string =>
  NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

// The inverse of rowsOfCsv: the header line and one line for each row, each ended by a line feed.
export const csvOfRows = (
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string =>
  [header, ...rows].map((cells) => `${cells.map((cell) => cellOf(cell)).join(';')}\n`).join('');
