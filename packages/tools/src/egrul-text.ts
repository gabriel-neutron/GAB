// What code reads in the text of an extract of the Russian register (EGRUL): the subject, the owner
// section, and the refusal of an excerpt that can name a natural person. The extract names directors
// and founders, and the panel ruling keeps the file internal and allows excerpts on legal persons
// only. No function here returns the name of a natural person.

/** One entry of the owner section. A natural person is counted, and no field of that person is kept. */
export interface OwnerEntry {
  readonly kind: 'legal_person' | 'natural_person' | 'hidden' | 'other';
  readonly name: string | null;
  readonly ogrn: string | null;
  readonly inn: string | null;
  readonly country: string | null;
  readonly registrationNumber: string | null;
  /** The words of the extract, because a share can have more decimals than a JSON number. */
  readonly sharePercent: string | null;
  readonly nominalRub: string | null;
  /** The day of the register entry on this owner, written as 2026-01-31. It is not a deal date. */
  readonly enteredOn: string | null;
}

export interface OwnerSection {
  /** `unread` is a section with no end that code knows: the caller reads the pages itself. */
  readonly state: 'listed' | 'absent' | 'unread';
  readonly entries: readonly OwnerEntry[];
  /** The pages of the document that hold the section. */
  readonly pages: readonly number[];
}

export interface ExtractSubject {
  readonly name: string | null;
  readonly ogrn: string | null;
  readonly inn: string | null;
  readonly endedOn: string | null;
}

interface Line {
  readonly text: string;
  readonly page: number;
}

// External constraint: the lines that the register prints at the foot of each page. Assumption,
// read on the stored extracts of October 2026.
const FOOT = [
  /^Страница \d+ из(?: \d+)?$/u,
  /^Выписка из ЕГРЮЛ$/u,
  /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2} ОГРН \d+$/u,
];

const SECTION_START = /^Сведения об? (?:участниках|учредителях)/u;

// The next section of the extract. A heading inside an owner entry, such as the holder of a pledge
// on a share, is not on this list.
const SECTION_END =
  /^Сведения (?:об учете в налоговом|о регистрации в качестве страхователя|о видах экономической|о держателе реестра|о лицензиях|о филиалах|о представительствах|о записях|о правопреемнике|о правопредшественнике|об участии|о реорганизации|о ликвидации)/u;

// A part of an entry that describes another party, such as the holder of a pledge.
const INNER_HEADING = /^(?:Сведения |Обременение)/u;

const ROW = /^\d+ /u;
const ENTRY_NUMBER = /^\d{1,4}$/u;
const HIDDEN = 'Доступ к сведениям ограничен';

const linesOf = (pages: readonly string[]): Line[] =>
  pages.flatMap((text, index) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !FOOT.some((foot) => foot.test(line)))
      .map((line) => ({ text: line, page: index + 1 })),
  );

const isoDay = (written: string | undefined): string | null => {
  const found = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(written ?? '');
  return found === null ? null : `${found[3] ?? ''}-${found[2] ?? ''}-${found[1] ?? ''}`;
};

// The value of a row: the words after the label, and each next line up to the next row.
const valueOf = (lines: readonly string[], label: RegExp): string | null => {
  const start = lines.findIndex((line) => label.test(line));
  if (start === -1) return null;
  const parts = [(lines[start] ?? '').replace(label, '').trim()];
  for (const line of lines.slice(start + 1)) {
    if (ROW.test(line) || INNER_HEADING.test(line)) break;
    parts.push(line);
  }
  const value = parts.filter((part) => part !== '').join(' ');
  return value === '' ? null : value;
};

const FULL_NAME = /^\d+ Полное наименование(?: на русском языке)?(?= |$)/u;

const entryOf = (lines: readonly string[]): OwnerEntry => {
  const end = lines.findIndex((line) => INNER_HEADING.test(line));
  const head = end === -1 ? lines : lines.slice(0, end);
  const text = head.join('\n');
  const empty = {
    name: null,
    ogrn: null,
    inn: null,
    country: null,
    registrationNumber: null,
    sharePercent: null,
    nominalRub: null,
    enteredOn: null,
  };
  // A person is found first, so a field of a person never reaches a field of the entry.
  if (text.includes('Фамилия') || /^\d+ ИНН \d{12}$/mu.test(text))
    return { kind: 'natural_person', ...empty };
  const name = valueOf(head, FULL_NAME);
  if (name === null)
    return { kind: lines.some((line) => line.includes(HIDDEN)) ? 'hidden' : 'other', ...empty };
  return {
    kind: 'legal_person',
    name,
    ogrn: /^\d+ ОГРН (\d{13})$/mu.exec(text)?.[1] ?? null,
    inn: /^\d+ ИНН (\d{10})$/mu.exec(text)?.[1] ?? null,
    country: valueOf(head, /^\d+ Страна происхождения(?= |$)/u),
    registrationNumber: valueOf(head, /^\d+ Регистрационный номер(?= |$)/u),
    sharePercent: /^\d+ Размер доли \(в процентах\) ([\d.,]+)$/mu.exec(text)?.[1] ?? null,
    nominalRub: /^\d+ Номинальная стоимость доли \(в рублях\) ([\d.,]+)$/mu.exec(text)?.[1] ?? null,
    enteredOn: isoDay(
      /ГРН и дата внесения в ЕГРЮЛ сведений о\s+данном лице\s+\d{13}\s+(\d{2}\.\d{2}\.\d{4})/u.exec(
        text,
      )?.[1],
    ),
  };
};

/** The owner section of an extract. A joint-stock company often has none: that is no statement that
 * the company has no owner. */
export const ownerSection = (pages: readonly string[]): OwnerSection => {
  const lines = linesOf(pages);
  const start = lines.findIndex((line) => SECTION_START.test(line.text));
  if (start === -1) return { state: 'absent', entries: [], pages: [] };
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => SECTION_END.test(line.text));
  if (end === -1) return { state: 'unread', entries: [], pages: [] };
  const body = rest.slice(0, end);
  const groups: string[][] = [[]];
  for (const line of body) {
    if (ENTRY_NUMBER.test(line.text)) groups.push([]);
    else groups.at(-1)?.push(line.text);
  }
  return {
    state: 'listed',
    entries: groups.filter((group) => group.length > 0).map(entryOf),
    pages: [...new Set([lines[start]?.page ?? 1, ...body.map((line) => line.page)])],
  };
};

/** The company that the extract is about. */
export const extractSubject = (pages: readonly string[]): ExtractSubject => {
  const lines = linesOf(pages).map((line) => line.text);
  const text = lines.join('\n');
  return {
    name: valueOf(lines, FULL_NAME),
    ogrn: /^\d+ ОГРН (\d{13})$/mu.exec(text)?.[1] ?? null,
    inn: /^\d+ ИНН юридического лица (\d{10})$/mu.exec(text)?.[1] ?? null,
    endedOn: isoDay(/^\d+ Дата прекращения (\d{2}\.\d{2}\.\d{4})$/mu.exec(text)?.[1]),
  };
};

/** True for a document that the register gave: the rule on natural persons applies to it, also
 * when another tool stored it. */
export const isEgrulAddress = (uri: string | null): boolean =>
  uri !== null && URL.parse(uri)?.hostname === 'egrul.nalog.ru';

const PERSON_WORD =
  /(?<![\p{L}])(?:ФАМИЛИЯ|ИМЯ|ОТЧЕСТВО|ДОЛЖНОСТЬ|ПОЛ|ГРАЖДАНСТВО|ДИРЕКТОР|ГЕНЕРАЛЬНЫЙ|ПРЕЗИДЕНТ|ЛИКВИДАТОР|ИП|ИНДИВИДУАЛЬНЫЙ)(?![\p{L}])/u;
const PATRONYMIC =
  /\p{L}{2,}(?:ОВИЧ|ЕВИЧ|ЬИЧ|ОВНА|ЕВНА|ИЧНА|ИНИЧНА|ОГЛЫ|КЫЗЫ|ГЫЗЫ|УУЛУ)(?![\p{L}])/u;
const PERSON_TAX_NUMBER = /(?<!\d)\d{12}(?!\d)/u;
const COMPANY_NUMBER = /(?<!\d)(?:\d{10}|\d{13})(?!\d)/u;
const COMPANY_WORD =
  /(?<![\p{L}])(?:ОБЩЕСТВО|ООО|АО|ПАО|ОАО|ЗАО|НАО|ТОВАРИЩЕСТВО|КООПЕРАТИВ|КОМПАНИЯ|КОРПОРАЦИЯ|ПРЕДПРИЯТИЕ|УЧРЕЖДЕНИЕ|ПРАВИТЕЛЬСТВО|МИНИСТЕРСТВО|АГЕНТСТВО|ФЕДЕРАЦИЯ|ФЕДЕРАЦИИ|ФОНД|БАНК|ХОЛДИНГ|ЛИМИТЕД|ЛТД|LIMITED|LTD|LLC|INC|GMBH|CORP)(?![\p{L}])/u;

// The values of each block of a natural person in the extract. They stay in this function and its
// caller: no message repeats them.
const personValues = (pages: readonly string[]): readonly string[] => {
  const lines = linesOf(pages).map((line) => line.text);
  const values: string[] = [];
  lines.forEach((line, index) => {
    if (!/^\d+ Фамилия$/u.test(line)) return;
    let labels = 1;
    while (['Имя', 'Отчество'].includes(lines[index + labels] ?? '')) labels += 1;
    values.push(...lines.slice(index + labels, index + labels + labels));
  });
  return values.map((value) => value.toUpperCase()).filter((value) => value.length >= 2);
};

const holdsWord = (text: string, word: string): boolean => {
  const at = text.indexOf(word);
  if (at === -1) return false;
  const before = text.slice(0, at).at(-1) ?? ' ';
  const after = text[at + word.length] ?? ' ';
  return !/\p{L}/u.test(before) && !/\p{L}/u.test(after);
};

/** The sentence that refuses an excerpt of an extract, or null. The rule fails closed: an excerpt
 * passes only when it holds the form of a legal person and no sign of a natural person. The
 * sentence repeats no word of the excerpt, because the excerpt can hold a name. */
export const egrulExcerptRefusal = (excerpt: string, pages: readonly string[]): string | null => {
  const text = excerpt.replace(/\s+/gu, ' ').toUpperCase();
  const person =
    PERSON_WORD.test(text) ||
    PATRONYMIC.test(text) ||
    PERSON_TAX_NUMBER.test(text) ||
    personValues(pages).some((value) => holdsWord(text, value));
  if (person)
    return 'an excerpt of a register extract can name a legal person only, and this excerpt holds the sign of a natural person';
  if (!COMPANY_NUMBER.test(text) && !COMPANY_WORD.test(text))
    return 'an excerpt of a register extract must hold the form of a legal person: its full name, its OGRN or its 10-digit INN';
  return null;
};
