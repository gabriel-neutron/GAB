import { expect, test } from 'vitest';

import { scriptOf, transliterationKey } from './transliteration-key.ts';

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
] as const)('the script of %s is %s', (name, script) => {
  expect(scriptOf(name)).toBe(script);
});
