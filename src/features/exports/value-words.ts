const NUMBER = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

const THIN_SPACE = String.fromCodePoint(0x202f);

/** A value with its unit. A percentage takes a thin space before the sign. */
export const valueWords = (value: number, unit: string): string =>
  unit === '%'
    ? `${NUMBER.format(value)}${THIN_SPACE}%`
    : `${NUMBER.format(value)}${unit === '' ? '' : ` ${unit}`}`;
