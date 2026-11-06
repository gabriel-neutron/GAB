// What code reads in the text of an extract of the Russian register (EGRUL): the subject, the owner
// section, and the refusal of an excerpt that can name a natural person. The extract names directors
// and founders, and the panel ruling keeps the file internal and allows excerpts on legal persons
// only. No function here returns the name of a natural person.

/** One entry of the owner section. A natural person is counted, and no field of that person is kept. */
export interface OwnerEntry {
  /** `state_body` is a state founder with the state body that acts for it: the fields name the body. */
  readonly kind: 'legal_person' | 'natural_person' | 'state_body' | 'hidden' | 'other';
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

const SECTION_START = /^Сведения об? (?:участниках|учредителях|единственном акционере)/u;

// The next section of the extract. A heading inside an owner entry, such as the holder of a pledge
// on a share, is not on this list.
const SECTION_END =
  /^Сведения (?:об учете в налоговом|о регистрации в качестве страхователя|о видах экономической|о держателе реестра|о лицензиях|о филиалах|о представительствах|о записях|о правопреемнике|о правопредшественнике|об участии|о реорганизации|о ликвидации)/u;

// A part of an entry that describes another party, such as the holder of a pledge.
const INNER_HEADING = /^(?:Сведения |Обременение)/u;
const STATE_BODY = 'Сведения об органе';

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
  // A line that ends in a hyphen goes on in the same word of the next line.
  const value = parts
    .filter((part) => part !== '')
    .join(' ')
    .replace(/(\p{L})- (?=\p{L})/gu, '$1-');
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
  if (name === null) {
    // A state founder has no name of its own in this layout, and a state body acts for it.
    const body = lines.findIndex((line) => line.startsWith(STATE_BODY));
    if (body !== -1) {
      const inner = entryOf(lines.slice(body + 1));
      if (inner.kind === 'legal_person') return { ...inner, kind: 'state_body' };
    }
    return { kind: lines.some((line) => line.includes(HIDDEN)) ? 'hidden' : 'other', ...empty };
  }
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

const decoded = (uri: string): string => {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
};

/** True for a document that the register gave: the rule on natural persons applies to it, also
 * when another tool stored it, and also for a copy in a web archive, whose address holds the first.
 * The test is wide on purpose: a wrong true refuses an excerpt, and a wrong false can let a name out. */
export const isEgrulAddress = (uri: string | null): boolean =>
  uri !== null && /(?:^|[/@.])egrul\.nalog\.ru\.?(?:[:/#?]|$)/iu.test(decoded(uri));

// One form for each compare: a soft hyphen and a line break do not hide a word, and a letter with a
// separate mark is one letter.
const normal = (text: string): string =>
  text
    .normalize('NFC')
    .replace(/\u00AD/gu, '')
    .replace(/\s+/gu, ' ')
    .toUpperCase();

const PERSON_WORD =
  /(?<![\p{L}])(?:ФАМИЛИЯ|ИМЯ|ОТЧЕСТВО|ДОЛЖНОСТЬ|ПОЛ|ГРАЖДАНСТВО|ДИРЕКТОР|ГЕНЕРАЛЬНЫЙ|ПРЕЗИДЕНТ|ЛИКВИДАТОР|ИП|ИНДИВИДУАЛЬНЫЙ)(?![\p{L}])/u;
const PATRONYMIC =
  /\p{L}{2,}(?:(?:ОВИЧ|ЕВИЧ|ЬИЧ)(?:А|У|ЕМ|Е)?|(?:ОВН|ЕВН|ИЧН|ИНИЧН)(?:А|Ы|Е|У|ОЙ)|ОГЛЫ|КЫЗЫ|ГЫЗЫ|УУЛУ)(?![\p{L}])/u;
const PERSON_TAX_NUMBER = /(?<!\d)\d{12}(?!\d)/u;
const COMPANY_NUMBER = /(?<!\d)(?:\d{10}|\d{13})(?!\d)/u;
const COMPANY_WORD =
  /(?<![\p{L}])(?:ОБЩЕСТВО|ООО|АО|ПАО|ОАО|ЗАО|НАО|ТОВАРИЩЕСТВО|КООПЕРАТИВ|КОМПАНИЯ|КОРПОРАЦИЯ|ПРЕДПРИЯТИЕ|УЧРЕЖДЕНИЕ|ПРАВИТЕЛЬСТВО|МИНИСТЕРСТВО|АГЕНТСТВО|ФЕДЕРАЦИЯ|ФЕДЕРАЦИИ|ФОНД|БАНК|ХОЛДИНГ|ЛИМИТЕД|ЛТД|LIMITED|LTD|LLC|INC|GMBH|CORP)(?![\p{L}])/u;

// The values of each block of a natural person in the extract, and whether code read each block.
// The values stay in this function and its caller: no message repeats them.
const personValues = (pages: readonly string[]): { values: readonly string[]; read: boolean } => {
  const lines = linesOf(pages).map((line) => line.text);
  const values: string[] = [];
  let blocks = 0;
  lines.forEach((line, index) => {
    if (!/^\d+ Фамилия$/iu.test(line)) return;
    blocks += 1;
    let labels = 1;
    while (['ИМЯ', 'ОТЧЕСТВО'].includes((lines[index + labels] ?? '').toUpperCase())) labels += 1;
    values.push(...lines.slice(index + labels, index + labels + labels));
  });
  const labelled = lines.filter((line) => /фамилия/iu.test(line)).length;
  return {
    values: values.map(normal).filter((value) => value.length >= 2),
    read: labelled === blocks,
  };
};

const holdsWord = (text: string, word: string): boolean => {
  let at = text.indexOf(word);
  while (at !== -1) {
    const before = text.slice(0, at).at(-1) ?? ' ';
    const after = text[at + word.length] ?? ' ';
    if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) return true;
    at = text.indexOf(word, at + 1);
  }
  return false;
};

/** The sentence that refuses an excerpt of an extract, or null. The rule fails closed: an excerpt
 * passes only when code read each person block of the extract, and the excerpt holds the form of a
 * legal person and no sign of a natural person. A caller gives the words of the excerpt and the
 * words of the page that the excerpt found, because the search of an excerpt ignores some marks.
 * The sentence repeats no word of the excerpt, because the excerpt can hold a name. */
export const egrulExcerptRefusal = (excerpt: string, pages: readonly string[]): string | null => {
  const text = normal(excerpt);
  const persons = personValues(pages);
  if (!persons.read)
    return 'an excerpt of this register extract is refused, because code could not read its blocks of natural persons';
  const person =
    PERSON_WORD.test(text) ||
    PATRONYMIC.test(text) ||
    PERSON_TAX_NUMBER.test(text) ||
    persons.values.some((value) => holdsWord(text, value));
  if (person)
    return 'an excerpt of a register extract can name a legal person only, and this excerpt holds the sign of a natural person';
  if (!COMPANY_NUMBER.test(text) && !COMPANY_WORD.test(text))
    return 'an excerpt of a register extract must hold the form of a legal person: its full name, its OGRN or its 10-digit INN';
  return null;
};

// A legal person in the words of an excerpt: a form with its name in quotes, or a run of Latin capital
// words on one line before a Latin form. A comma or a small word ends a run.
const FORM_FIRST =
  /(?<![\p{L}])(?:ООО|АО|ПАО|ОАО|ЗАО|НАО|Общество с ограниченной ответственностью|Акционерное общество|Публичное акционерное общество)(?:\s*["«“][^"»”\n]{1,80}["»”])?/giu;
const FORM_LAST =
  /(?:(?<![\p{L}])\p{Lu}[\p{Script=Latin}&'-]* ){0,5}(?<![\p{L}])(?:LLC|LTD|Ltd|Limited|Inc|GmbH|Corp|Corporation|Bank|JSC|PJSC)(?![\p{L}])/gu;
const NUMBER_LABEL = /(?<![\p{L}])(?:ОГРН|ИНН|КПП|OGRN|INN|LEI)(?![\p{L}])/gu;
const PERSON_TITLE =
  /(?<![\p{L}])(?:Mr|Mrs|Ms|Dr|Judge|mr|mrs|ms|judge|судья|гражданин|гражданка)(?![\p{L}])/iu;

/** The sentence that refuses an excerpt of a restricted document with no person blocks to read (a
 * court act, a bank statement), or null. The rule fails closed: a capital letter outside the name
 * of a legal person can start the name of a person, and code reads no name in a script with no
 * capitals, so both are refused, also at the start of the excerpt. Cut the excerpt to the name of
 * the firm and to words with no capital. A person that an act designates is refused too, because
 * the signed list allows legal persons only.
 * shortcut: a name in small letters only passes, and a name directly before a Latin form joins the
 * run of the firm. An excerpt is a verbatim copy, so such a page is rare. The reviewer and the closer
 * read each person. A tool that knows the names of a page is the upgrade. */
export const restrictedExcerptRefusal = (excerpt: string): string | null => {
  const text = normal(excerpt);
  const rest = excerpt
    .normalize('NFC')
    .replace(FORM_FIRST, ' ')
    .replace(FORM_LAST, ' ')
    .replace(NUMBER_LABEL, ' ');
  if (
    PERSON_WORD.test(text) ||
    PATRONYMIC.test(text) ||
    PERSON_TAX_NUMBER.test(text) ||
    PERSON_TITLE.test(excerpt) ||
    /\p{Lu}/u.test(rest) ||
    /(?![\p{Script=Latin}\p{Script=Cyrillic}])\p{L}/u.test(rest)
  )
    return 'an excerpt of a restricted document can name a legal person only, and this excerpt holds the sign of a natural person or a capital letter outside the name of a firm';
  if (!COMPANY_NUMBER.test(text) && !COMPANY_WORD.test(text))
    return 'an excerpt of a restricted document must hold the form of a legal person: its full name or its number';
  return null;
};
