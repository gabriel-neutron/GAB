import { expect, test } from 'vitest';

import { readName } from './transliteration-key.ts';

const transliterationKey = (name: string) => readName(name).key;
const scriptOf = (name: string) => readName(name).script;

// Each row: a Latin spelling, a Cyrillic spelling of the same name, and the key of both.
test.each([
  // A refinery, with and without its legal form.
  ['Kirishinefteorgsintez', 'Киришинефтеоргсинтез', 'kirishinefteorgsintez'],
  ['KINEF LLC', 'ООО «КИНЕФ»', 'kinef'],
  ['Antipinsky NPZ', 'Антипинский НПЗ', 'antipinski npz'],
  // A port.
  ['Novorossiysk', 'Новороссийск', 'novorosisk'],
  ['Ust-Luga', 'Усть-Луга', 'ust luga'],
  ['Primorsk', 'Приморск', 'primorsk'],
  // A shipping company: a Latin brand with c for к, and a legal form in each script.
  ['PJSC Sovcomflot', 'ПАО «Совкомфлот»', 'sovkomflot'],
  ['Sovkomflot', 'Совкомфлот', 'sovkomflot'],
  // An oil company: the soft sign has no letter, and an apostrophe of the Latin spelling neither.
  ["Rosneft'", 'Роснефть', 'rosneft'],
  ['Transneft', 'Транснефть', 'transneft'],
  // The letters with common variants: х, ц, щ, ю, я, е at the start, й, ё, кс.
  ['Khabarovsk', 'Хабаровск', 'habarovsk'],
  ['Habarovsk', 'Хабаровск', 'habarovsk'],
  ['Tsentr', 'Центр', 'tsentr'],
  ['Tzentr', 'Центр', 'tsentr'],
  ['Tcentr', 'Центр', 'tsentr'],
  ['Shchelkovo', 'Щёлково', 'shchelkovo'],
  ['Schelkovo', 'Щелково', 'shchelkovo'],
  ['Yuzhny', 'Южный', 'iuzhni'],
  ['Iuzhnyi', 'Южный', 'iuzhni'],
  ['Juzhnyj', 'Южный', 'iuzhni'],
  ['Yaroslavl', 'Ярославль', 'iaroslavl'],
  ['Iaroslavl', 'Ярославль', 'iaroslavl'],
  ['Yenisei', 'Енисей', 'enisei'],
  ['Yeniseysk Shipping', 'Енисейск Шиппинг', 'eniseisk shiping'],
  ['Maxima', 'Максима', 'maksima'],
])('the key of %s and of %s is %s', (latin, cyrillic, key) => {
  expect(transliterationKey(latin)).toBe(key);
  expect(transliterationKey(cyrillic)).toBe(key);
});

// The full legal forms, as a register (EGRUL) or a list writes them, in each script and in the
// spellings of other tables.
test.each([
  'Публичное акционерное общество «Совкомфлот»',
  'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "СОВКОМФЛОТ"',
  'Общество с ограниченной ответственностью «Совкомфлот»',
  'Акционерное общество Совкомфлот',
  'Закрытое акционерное общество «Совкомфлот»',
  'Открытое акционерное общество «Совкомфлот»',
  'Publichnoye Aktsionernoye Obshchestvo Sovcomflot',
  "Obshchestvo s ogranichennoy otvetstvennost'yu Sovkomflot",
  'Public Joint Stock Company Sovcomflot',
  'Public Joint-Stock Company "Sovcomflot"',
  'Sovcomflot Limited Liability Company',
  'Joint Stock Company Sovcomflot',
  'Sovcomflot Company',
  // A legal form in the other script.
  'ООО Sovcomflot',
  'LLC Совкомфлот',
])('the key of %s is sovkomflot', (name) => {
  expect(transliterationKey(name)).toBe('sovkomflot');
});

test('a name in Unicode NFD gives the key of the same name in NFC', () => {
  for (const name of ['Щёлково', 'Южный', 'Подъёмник', 'Новороссийск'])
    expect(transliterationKey(name.normalize('NFD'))).toBe(transliterationKey(name));
  expect(transliterationKey('Щёлково'.normalize('NFD'))).toBe('shchelkovo');
});

// The known limits of the folds: ё written yo or io, ч written tch, and ц written cz give a key of
// their own. A change of a fold changes these rows on purpose.
test.each([
  ['Pyotr', 'Пётр', 'piotr', 'petr'],
  ['Tchaika', 'Чайка', 'tchaika', 'chaika'],
  ['Czar', 'Царь', 'kzar', 'tsar'],
])('%s and %s give two keys, %s and %s', (latin, cyrillic, latinKey, cyrillicKey) => {
  expect(transliterationKey(latin)).toBe(latinKey);
  expect(transliterationKey(cyrillic)).toBe(cyrillicKey);
});

test('the words of the key of a person are in order, so the order of the names does not count', () => {
  expect(readName('Ivanov Ivan Petrovich', { sortWords: true }).key).toBe('ivan ivanov petrovich');
  expect(readName('Иван Петрович Иванов', { sortWords: true }).key).toBe('ivan ivanov petrovich');
  expect(readName('Ivanov Ivan').key).toBe('ivanov ivan');
});

test('two different names give two different keys', () => {
  expect(transliterationKey('Lukoil')).not.toBe(transliterationKey('Роснефть'));
  expect(transliterationKey('Primorsk')).not.toBe(transliterationKey('Приморье'));
});

test('a name with fewer than three letters or digits once the legal form is off gives no key', () => {
  expect(transliterationKey('ООО')).toBeNull();
  expect(transliterationKey('AO «Я»')).toBeNull();
  expect(transliterationKey('  ')).toBeNull();
  expect(transliterationKey('Ust')).toBe('ust');
});

test.each([
  ['Sovcomflot', 'latin'],
  ['Совкомфлот', 'cyrillic'],
  ['ООО «КИНЕФ» 2', 'cyrillic'],
  ['Sovcomflot Совкомфлот', 'mixed'],
  ['2024', 'none'],
  // The legal form does not count, and the script of most letters wins.
  ['ООО Sovcomflot', 'latin'],
  ['LLC Совкомфлот', 'cyrillic'],
  ['S\u043evcomflot', 'latin'],
  ['Совкомфлот Shipping', 'mixed'],
  ['Совкомфлот Шиппинг Ltd', 'cyrillic'],
] as const)('the script of %s is %s', (name, script) => {
  expect(scriptOf(name)).toBe(script);
});
