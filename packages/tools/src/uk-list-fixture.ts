// A small copy of the official UK Sanctions List for the tests. The header and the line of
// KOROLEV PROSPECT are copied from the file of 8 October 2026. The other lines are made up.

/** The header of the official file, with its 58 columns. */
export const UK_HEADER =
  'Last Updated,Unique ID,OFSI Group ID,UN Reference Number,Name 6,Name 1,Name 2,Name 3,Name ' +
  '4,Name 5,Name type,Alias strength,Title,Name non-latin script,Non-latin script type,Non-la' +
  'tin script language,Regime Name,Designation Type,Designation source,Sanctions Imposed,Othe' +
  'r Information,UK Statement of Reasons,Address Line 1,Address Line 2,Address Line 3,Address' +
  ' Line 4,Address Line 5,Address Line 6,Address Postal Code,Address Country,Phone number,Web' +
  'site,Email address,Date Designated,D.O.B,Nationality(/ies),National Identifier number,Nati' +
  'onal Identifier additional information,Passport number,Passport additional information,Pos' +
  'ition,Gender,Town of birth,Country of birth,Type of entity,Subsidiaries,Parent company,Bus' +
  'iness registration number (s),IMO number,Current owner/operator (s),Previous owner/operato' +
  'r (s),Current believed flag of ship,Previous flags,Type of ship,Tonnage of ship,Length of ' +
  'ship,Year Built,Hull identification number (HIN)';

/** A real line of a ship, longer than the cap of an excerpt. */
export const KOROLEV_PROSPECT =
  '31/07/2024,RUS2176,,,KOROLEV PROSPECT,,,,,,Primary Name,,,,,,The Russia (Sanctions) (EU Ex' +
  "it) Regulations 2019,Ship,UK,Shipping sanctions: (see 'Other information')|Shipping sancti" +
  "ons: (see 'Other information'),\"Shipping sanctions: a specified ship is prohibited from be" +
  'ing provided with access to or having its master or pilot cause it to enter a port in the ' +
  'UK, may have its registration on the UK Ship Register terminated, and a master or pilot of' +
  ' a specified ship may be given a port barring direction, a detention direction, and a port' +
  ' entry direction or a movement direction. "," KOROLEV PROSPECT (IMO 9826902) is involved i' +
  'n activity whose object or effect is to destabilise Ukraine or undermine or threaten the t' +
  'erritorial integrity, sovereignty or independence of Ukraine or to obtain a benefit from o' +
  'r support the Government of Russia. Namely, KOROLEV PROSPECT is involved in carrying oil o' +
  'r oil related products that originated in Russia from Russia to a third country. ",,,,,,,,' +
  ',,,,31/07/2024,,,,,,,,,,,,,,,IMO9826902,Stream Ship Management FZCO,,Gabon,,Oil Tanker,,,2' +
  '019,';

const COLUMNS = UK_HEADER.split(',');

const quoted = (value: string): string =>
  /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/** One line of the file, with the values of the named columns and an empty value elsewhere. */
export const ukRow = (values: Readonly<Record<string, string>>): string =>
  COLUMNS.map((column) => quoted(values[column] ?? '')).join(',');
