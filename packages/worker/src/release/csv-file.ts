// External constraint: a spreadsheet reads a UTF-8 file as UTF-8 only when it starts with a byte
// order mark, and the record holds Cyrillic names.
const BOM = '\uFEFF';

// RFC 4180 ends each record with CR LF.
const END = '\r\n';

// External constraint: a spreadsheet runs a cell that starts with one of these signs as a formula,
// and a value of the record comes from untrusted pages. A leading quote keeps it as text.
const FORMULA = /^[=+\-@\t\r]/u;
const NUMBER = /^-?\d+(\.\d+)?$/u;

const cell = (value: string): string => {
  const text = FORMULA.test(value) && !NUMBER.test(value) ? `'${value}` : value;
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** A CSV file: the preamble as lines that start with `#`, then the header and one record for each
 * row. */
export const csvFile = (
  preamble: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string => {
  const comments =
    preamble === '' ? [] : preamble.split('\n').map((line) => (line === '' ? '#' : `# ${line}`));
  const records = [header, ...rows].map((row) => row.map(cell).join(','));
  return `${BOM}${[...comments, ...records].join(END)}${END}`;
};
