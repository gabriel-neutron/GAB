/** A day of the release, YYYY-MM-DD, as DD/MM/YYYY. */
export const releaseDay = (date: string): string => {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${day}/${month}/${year}`;
};
