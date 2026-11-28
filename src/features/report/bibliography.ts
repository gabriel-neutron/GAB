// The bibliography of the report: one entry for each source. A note of the report text cites an
// entry with `@key`, and the page, the PDF and the source list read the entry from here.

export const GROUPS = {
  law: 'Legal acts, official lists and official notices',
  data: 'Official statistics and datasets',
  institutes: 'Reports of institutes and research centres',
  press: 'Press',
  gur: 'Ukrainian military intelligence (GUR), a party to the conflict',
  other: 'Other sources',
} as const;
export type Group = keyof typeof GROUPS;

export interface Entry {
  readonly key: string;
  readonly group: Group;
  /** The short reference in the text, in the parenthesis. */
  readonly cite: string;
  readonly issuer: string;
  readonly date: string;
  readonly title: string;
  /** The address of the source. */
  readonly url: string;
  /** Words after the title: the kind of source, the publisher, a licence. */
  readonly detail?: string;
  /** Parts of the addresses of the stored documents of this source, when they differ from `url`. */
  readonly stored?: readonly string[];
}

const eu = (
  key: string,
  celex: string,
  cite: string,
  title: string,
  date: string,
  stored: string,
  issuer = 'Council of the European Union',
): Entry => ({
  key,
  group: 'law',
  cite,
  issuer: celex.startsWith('0') ? 'Publications Office of the European Union, EUR-Lex' : issuer,
  date,
  title: `${title} (CELEX ${celex})`,
  url: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`,
  detail: celex.startsWith('0') ? 'Consolidated version' : 'Official Journal of the European Union',
  stored: [`cellar/${stored}`, `CELEX:${celex}`],
});

const treasury = (
  key: string,
  number: string,
  date: string,
  title: string,
  group: Group = 'law',
): Entry => ({
  key,
  group,
  cite: `US Treasury, ${number}`,
  issuer: 'U.S. Department of the Treasury',
  date,
  title,
  url: `https://home.treasury.gov/news/press-releases/${number}`,
  detail: `Press release ${number}`,
});

const listed: readonly Entry[] = [
  // Legal acts of the European Union.
  eu(
    'eu-269-2014',
    '32014R0269',
    'Reg. (EU) No 269/2014',
    'Council Regulation (EU) No 269/2014 of 17 March 2014 concerning restrictive measures in respect of actions undermining or threatening the territorial integrity, sovereignty and independence of Ukraine',
    '2014, March 17',
    '4295095e',
  ),
  eu(
    'eu-269-2014-cons',
    '02014R0269-20260928',
    'Reg. (EU) No 269/2014, consolidated 28.09.2026',
    'Council Regulation (EU) No 269/2014, consolidated text of 28 September 2026',
    '2026, September 28',
    '11208c18',
  ),
  eu(
    'eu-833-2014',
    '32014R0833',
    'Reg. (EU) No 833/2014',
    "Council Regulation (EU) No 833/2014 of 31 July 2014 concerning restrictive measures in view of Russia's actions destabilising the situation in Ukraine",
    '2014, July 31',
    'caa17d37',
  ),
  eu(
    'eu-833-2014-cons-2025',
    '02014R0833-20250720',
    'Reg. (EU) No 833/2014, consolidated 20.07.2025',
    'Council Regulation (EU) No 833/2014, consolidated text of 20 July 2025',
    '2025, July 20',
    'caa17d37',
  ),
  eu(
    'eu-833-2014-cons-2026',
    '02014R0833-20260724',
    'Reg. (EU) No 833/2014, consolidated 24.07.2026',
    'Council Regulation (EU) No 833/2014, consolidated text of 24 July 2026',
    '2026, July 24',
    '0492ea31',
  ),
  eu(
    'eu-2022-345',
    '32022R0345',
    'Reg. (EU) 2022/345',
    'Council Regulation (EU) 2022/345 of 1 March 2022 amending Regulation (EU) No 833/2014',
    '2022, March 1',
    '9c6f9186',
  ),
  eu(
    'eu-2022-879',
    '32022R0879',
    'Reg. (EU) 2022/879',
    'Council Regulation (EU) 2022/879 of 3 June 2022 amending Regulation (EU) No 833/2014',
    '2022, June 3',
    'a71561fd',
  ),
  eu(
    'eu-2022-2367',
    '32022R2367',
    'Reg. (EU) 2022/2367',
    'Council Regulation (EU) 2022/2367 of 3 December 2022 amending Regulation (EU) No 833/2014',
    '2022, December 3',
    '75a2e29c',
  ),
  eu(
    'eu-2022-2368',
    '32022R2368',
    'Impl. Reg. (EU) 2022/2368',
    'Commission Implementing Regulation (EU) 2022/2368 of 3 December 2022 amending Council Regulation (EU) No 833/2014',
    '2022, December 3',
    'e7927a1b',
    'European Commission',
  ),
  eu(
    'eu-2023-250',
    '32023R0250',
    'Reg. (EU) 2023/250',
    'Council Regulation (EU) 2023/250 of 4 February 2023 amending Regulation (EU) No 833/2014',
    '2023, February 4',
    '38cd25ff',
  ),
  eu(
    'eu-2023-251',
    '32023R0251',
    'Impl. Reg. (EU) 2023/251',
    'Commission Implementing Regulation (EU) 2023/251 of 4 February 2023 amending Council Regulation (EU) No 833/2014 concerning restrictive measures in view of Russia’s actions destabilising the situation in Ukraine',
    '2023, February 4',
    'cd24922e',
    'European Commission',
  ),
  eu(
    'eu-2025-395',
    '32025R0395',
    'Reg. (EU) 2025/395',
    'Council Regulation (EU) 2025/395 of 24 February 2025 amending Regulation (EU) No 833/2014',
    '2025, February 24',
    '6cb19759',
  ),
  eu(
    'eu-2025-1476',
    '32025R1476',
    'Impl. Reg. (EU) 2025/1476',
    'Council Implementing Regulation (EU) 2025/1476 of 18 July 2025 implementing Regulation (EU) No 269/2014',
    '2025, July 18',
    '92d7d609',
  ),
  eu(
    'eu-2025-1494',
    '32025R1494',
    'Reg. (EU) 2025/1494',
    'Council Regulation (EU) 2025/1494 of 18 July 2025 amending Regulation (EU) No 833/2014',
    '2025, July 18',
    '8e9a2c55',
  ),
  eu(
    'eu-2025-2033',
    '32025R2033',
    'Reg. (EU) 2025/2033',
    'Council Regulation (EU) 2025/2033 of 23 October 2025 amending Regulation (EU) No 833/2014',
    '2025, October 23',
    '784dd911',
  ),
  eu(
    'eu-2026-124',
    '32026R0124',
    'Impl. Reg. (EU) 2026/124',
    'Commission Implementing Regulation (EU) 2026/124 of 14 January 2026 amending Council Regulation (EU) No 833/2014',
    '2026, January 14',
    '6ef36f48',
    'European Commission',
  ),
  eu(
    'eu-2026-261',
    '32026R0261',
    'Reg. (EU) 2026/261',
    'Regulation (EU) 2026/261 of the European Parliament and of the Council of 26 January 2026 on phasing out Russian natural gas imports',
    '2026, January 26',
    '0c94b1b3',
    'European Parliament and Council of the European Union',
  ),
  eu(
    'eu-2026-506',
    '32026R0506',
    'Reg. (EU) 2026/506',
    'Council Regulation (EU) 2026/506 of 23 April 2026 amending Regulation (EU) No 833/2014',
    '2026, April 23',
    'b87e7fd7',
  ),
  eu(
    'eu-2026-1848',
    '32026R1848',
    'Reg. (EU) 2026/1848',
    'Council Regulation (EU) 2026/1848 of 23 July 2026 amending Regulation (EU) No 833/2014',
    '2026, July 23',
    '67350bea',
  ),
  {
    key: 'eu-council-best-practices',
    group: 'law',
    cite: 'Council of the EU, doc. 11623/24',
    issuer: 'Council of the European Union',
    date: '2024, July 3',
    title:
      'Update of the EU Best Practices for the effective implementation of restrictive measures (doc. 11623/24)',
    url: 'https://data.consilium.europa.eu/doc/document/ST-11623-2024-INIT/en/pdf',
  },
  {
    key: 'ec-chp-list',
    group: 'law',
    cite: 'European Commission, 2024',
    issuer: 'European Commission',
    date: '2024, February',
    title: 'List of common high priority items',
    url: 'https://finance.ec.europa.eu/system/files/2023-09/list-common-high-priority-items_en.pdf',
  },
  // Official lists and notices of the United States and the United Kingdom.
  {
    key: 'ofac-sdn',
    group: 'law',
    cite: 'OFAC SDN list, 2026',
    issuer: 'Office of Foreign Assets Control, U.S. Department of the Treasury',
    date: '2026',
    title: 'Specially Designated Nationals and Blocked Persons List (SDN.CSV)',
    url: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV',
    detail: 'Official list, data file',
  },
  {
    key: 'uk-list',
    group: 'law',
    cite: 'UK Sanctions List, 2026',
    issuer: 'Foreign, Commonwealth and Development Office (FCDO)',
    date: '2026',
    title: 'UK Sanctions List (UK-Sanctions-List.csv)',
    url: 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
    detail: 'Official list, data file',
  },
  {
    key: 'ofac-20251022',
    group: 'law',
    cite: 'OFAC, Recent Actions 20251022',
    issuer: 'Office of Foreign Assets Control',
    date: '2025, October 22',
    title:
      'Russia-related Designations; Issuance of New and Amended Russia-related General Licenses',
    url: 'https://ofac.treasury.gov/recent-actions/20251022',
    detail: 'Recent Actions 20251022',
  },
  {
    key: 'ofac-guidance-2014',
    group: 'law',
    cite: 'OFAC, 2014',
    issuer: 'Office of Foreign Assets Control',
    date: '2014, August 13',
    title:
      'Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked',
    url: 'https://ofac.treasury.gov',
  },
  {
    key: 'ofac-faq-401',
    group: 'law',
    cite: 'OFAC, FAQ 401',
    issuer: 'Office of Foreign Assets Control',
    date: 'n.d.',
    title: 'FAQ 401',
    url: 'https://ofac.treasury.gov/faqs/401',
  },
  {
    key: 'ofac-spfs',
    group: 'law',
    cite: 'OFAC, 2024',
    issuer: 'Office of Foreign Assets Control',
    date: '2024',
    title:
      'Sanctions Risk for Foreign Financial Institutions that Join Russian Financial Messaging System, System for Transfer of Financial Messages',
    url: 'https://ofac.treasury.gov/media/933656/download?inline',
  },
  {
    key: 'fincen-a7',
    group: 'law',
    cite: 'FinCEN, FIN-2026-Alert007',
    issuer: 'Financial Crimes Enforcement Network',
    date: '2026, October 1',
    title: 'FinCEN Alert on the A7 Network (FIN-2026-Alert007)',
    url: 'https://www.fincen.gov/system/files/2026-10/FinCEN-Alert-A7-Network.pdf',
  },
  {
    key: 'hmt-ofsi-guidance',
    group: 'law',
    cite: 'HM Treasury OFSI, n.d.',
    issuer: 'HM Treasury, Office of Financial Sanctions Implementation',
    date: 'n.d.',
    title: 'UK financial sanctions general guidance',
    url: 'https://www.gov.uk/government/publications/financial-sanctions-general-guidance/uk-financial-sanctions-general-guidance',
  },
  treasury(
    'ust-jl0688',
    'jl0688',
    '2016, December 20',
    "Treasury Sanctions Individuals and Entities In Connection with Russia's Occupation of Crimea and the Conflict in Ukraine",
  ),
  treasury('ust-jl2369', 'jl2369', '2014, April 28', 'Press release jl2369'),
  treasury('ust-sm0312', 'sm0312', '2018', 'Press release sm0312'),
  treasury('ust-jy0608', 'jy0608', '2022', 'Press release jy0608'),
  treasury('ust-jy0705', 'jy0705', '2022', 'Press release jy0705'),
  treasury(
    'ust-jy1795',
    'jy1795',
    '2023, October 12',
    "Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia's War Machine",
  ),
  treasury(
    'ust-jy2008',
    'jy2008',
    '2023, December 20',
    'Treasury Tightens the Price Cap with New Sanctions and Updated Guidance',
  ),
  treasury('ust-jy2011', 'jy2011', '2023, December 22', 'Press release jy2011'),
  treasury(
    'ust-jy2318',
    'jy2318',
    '2024, May 1',
    "U.S. Continues to Degrade Russia's Military-Industrial Base and Target Third-Country Support with Nearly 300 New Sanctions",
  ),
  treasury('ust-jy2404', 'jy2404', '2024, June 12', 'Press release jy2404'),
  treasury(
    'ust-jy2651',
    'jy2651',
    '2024, October 17',
    "Treasury Targets Actors Involved in Drone Production for Russia's War Against Ukraine",
  ),
  treasury(
    'ust-jy2777',
    'jy2777',
    '2025, January 10',
    "Treasury Intensifies Sanctions Against Russia by Targeting Russia's Oil Production and Exports",
  ),
  treasury(
    'ust-sb0225',
    'sb0225',
    '2025, August 14',
    'Treasury Sanctions Cryptocurrency Exchange and Network Enabling Sanctions Evasion and Cyber Criminals',
  ),
  {
    key: 'state-2025-01-15',
    group: 'law',
    cite: 'US State Department, 2025',
    issuer: 'U.S. Department of State',
    date: '2025, January 15',
    title: "Sanctions to Disrupt Russia's Military Industrial Base and Sanctions Evasion",
    url: 'https://2021-2025.state.gov/office-of-the-spokesperson/releases/2025/01/sanctions-to-disrupt-russias-military-industrial-base-and-sanctions-evasion/',
  },
  // Acts and statements of other states.
  {
    key: 'ru-tax-code',
    group: 'law',
    cite: 'Tax Code of the Russian Federation',
    issuer: 'Russian Federation',
    date: 'n.d.',
    title: 'Tax Code of the Russian Federation',
    url: 'https://base.garant.ru/10900200/189ee55699895a58d35d70784cf7bcb9/',
    detail: 'Garant',
  },
  {
    key: 'kremlin-veb-2018',
    group: 'law',
    cite: 'President of Russia, 2018',
    issuer: 'President of Russia',
    date: '2018, May 24',
    title: 'Executive order on the chairman of VEB',
    url: 'http://en.kremlin.ru/events/president/news/57542',
  },
  {
    key: 'kremlin-usc-2023',
    group: 'law',
    cite: 'President of Russia, 2023',
    issuer: 'President of Russia',
    date: '2023, October 9',
    title: 'Executive order on the shares of the United Shipbuilding Corporation',
    url: 'http://en.special.kremlin.ru/acts/news/72465',
  },
  {
    key: 'hk-lcq2-2019',
    group: 'law',
    cite: 'Government of Hong Kong SAR, 2019',
    issuer: 'Government of the Hong Kong Special Administrative Region',
    date: '2019, January 23',
    title: 'LCQ2: Implementation of sanctions imposed by United Nations Security Council',
    url: 'https://www.info.gov.hk/gia/general/201901/23/P2019012300436.htm',
  },
  // Official statistics and datasets.
  {
    key: 'bruegel-tracker',
    group: 'data',
    cite: 'Bahí Esteba et al., 2026',
    issuer: 'Bahí Esteba, A. et al.',
    date: '2026, September 21',
    title: 'Russian foreign trade tracker (35th ed.)',
    url: 'https://www.bruegel.org/dataset/russian-foreign-trade-tracker',
    detail: 'Dataset. Bruegel',
    stored: ['bruegel.org/'],
  },
  {
    key: 'minfin-annual',
    group: 'data',
    cite: 'Minfin, 2026a',
    issuer: 'Ministry of Finance of the Russian Federation',
    date: '2026',
    title:
      'Приложение 3.1. Краткая информация об исполнении федерального бюджета (млрд руб.) [Annex 3.1. Short information on the execution of the federal budget (billion roubles)]',
    url: 'https://minfin.gov.ru/ru/document?id_4=80041-kratkaya_ezhegodnaya_informatsiya_ob_ispolnenii_federalnogo_byudzheta_mlrd_rub',
    detail: 'Data table',
    stored: ['minfin.gov.ru/ru/document?id_4=80041', 'minfin.gov.ru/common/upload/library/2026/'],
  },
  {
    key: 'minfin-2026-09',
    group: 'data',
    cite: 'Minfin, 2026b',
    issuer: 'Ministry of Finance of the Russian Federation',
    date: '2026',
    title:
      'Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года [Preliminary estimate of the execution of the federal budget for January–September 2026]',
    url: 'https://minfin.gov.ru/ru/press-center/?id_4=40677',
  },
  {
    key: 'minfin-2025-09',
    group: 'data',
    cite: 'Minfin, 2025a',
    issuer: 'Ministry of Finance of the Russian Federation',
    date: '2025, October 9',
    title:
      'Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2025 года [Preliminary estimate of the execution of the federal budget for January–September 2025]',
    url: 'https://minfin.gov.ru/ru/press-center/?id_4=39967-predvaritelnaya_otsenka_ispolneniya_federalnogo_byudzheta_za_yanvar-sentyabr_2025_goda',
  },
  {
    key: 'minfin-urals',
    group: 'data',
    cite: 'Minfin, 2023',
    issuer: 'Ministry of Finance of the Russian Federation',
    date: '2023',
    title: 'О средней цене на нефть марки Urals [On the average price of Urals oil]',
    url: 'https://minfin.gov.ru/ru/press-center/?id_4=38813-o_srednei_tsene_na_neft_marki_urals',
    detail: 'Monthly releases',
    stored: ['o_srednei_tsene_na_neft_marki_urals'],
  },
  {
    key: 'minfin-guidelines',
    group: 'data',
    cite: 'Minfin, 2025b',
    issuer: 'Ministry of Finance of the Russian Federation',
    date: '2025, October 3',
    title:
      'Основные направления бюджетной, налоговой и таможенно-тарифной политики на 2026 год и на плановый период 2027 и 2028 годов [Main directions of budget, tax and customs tariff policy for 2026 and for the planning period 2027 and 2028]',
    url: 'https://base.garant.ru/412797173/',
    detail: 'Garant',
  },
  {
    key: 'cbr-currency',
    group: 'data',
    cite: 'Bank of Russia, 2026a',
    issuer: 'Central Bank of Russia',
    date: '2026, October 15',
    title: 'Currency composition of settlements',
    url: 'https://cbr.ru/vfs/eng/statistics/credit_statistics/cur_str_new_e.xlsx',
    detail: 'Dataset',
  },
  {
    key: 'cbr-risks-2024',
    group: 'data',
    cite: 'Bank of Russia, 2024',
    issuer: 'Central Bank of Russia',
    date: '2024, January',
    title: 'Обзор рисков финансовых рынков [Review of financial market risks] (No. 1)',
    url: 'https://www.cbr.ru/collection/collection/file/48852/orfr_2024-01.pdf',
  },
  {
    key: 'cbr-annual-2025',
    group: 'data',
    cite: 'Bank of Russia, 2026b',
    issuer: 'Central Bank of Russia',
    date: '2026',
    title: 'Bank of Russia Annual Report for 2025',
    url: 'https://www.cbr.ru/collection/collection/file/59814/ar_2025_e.pdf',
  },
  {
    key: 'comtrade',
    group: 'data',
    cite: 'UN Comtrade, 2026',
    issuer: 'United Nations Statistics Division',
    date: '2026, October 25',
    title: 'UN Comtrade database',
    url: 'https://comtradeplus.un.org/',
    detail: 'Dataset. Queries by reporter, partner Russia (643), flow and HS code',
    stored: ['comtradeplus.un.org/', 'comtradeapi.un.org/'],
  },
  {
    key: 'wb-deflator',
    group: 'data',
    cite: 'World Bank, NY.GDP.DEFL.KD.ZG',
    issuer: 'World Bank',
    date: '2026',
    title: 'Inflation, GDP deflator (annual %) – Russian Federation (NY.GDP.DEFL.KD.ZG)',
    url: 'https://api.worldbank.org/v2/country/RUS/indicator/NY.GDP.DEFL.KD.ZG',
    detail: 'Dataset',
  },
  {
    key: 'wb-oil-rents',
    group: 'data',
    cite: 'World Bank, NY.GDP.PETR.RT.ZS',
    issuer: 'World Bank',
    date: '2026',
    title: 'Oil rents (% of GDP) – Russian Federation (NY.GDP.PETR.RT.ZS)',
    url: 'https://api.worldbank.org/v2/country/RUS/indicator/NY.GDP.PETR.RT.ZS',
    detail: 'Dataset',
  },
  {
    key: 'wb-gas-rents',
    group: 'data',
    cite: 'World Bank, NY.GDP.NGAS.RT.ZS',
    issuer: 'World Bank',
    date: '2026',
    title: 'Natural gas rents (% of GDP) – Russian Federation (NY.GDP.NGAS.RT.ZS)',
    url: 'https://api.worldbank.org/v2/country/RUS/indicator/NY.GDP.NGAS.RT.ZS',
    detail: 'Dataset',
  },
  {
    key: 'wb-fuel-exports',
    group: 'data',
    cite: 'World Bank, TX.VAL.FUEL.ZS.UN',
    issuer: 'World Bank',
    date: '2026, October 8',
    title: 'Fuel exports (% of merchandise exports) – Russian Federation (TX.VAL.FUEL.ZS.UN)',
    url: 'https://api.worldbank.org/v2/country/RUS/indicator/TX.VAL.FUEL.ZS.UN',
    detail: 'Dataset',
  },
  {
    key: 'wb-pink-sheet',
    group: 'data',
    cite: 'World Bank, Pink Sheet',
    issuer: 'World Bank',
    date: '2026, October 2',
    title: 'Commodity Price Data (The Pink Sheet), monthly prices',
    url: 'https://www.worldbank.org/en/research/commodity-markets',
    detail: 'Dataset',
    stored: ['worldbank.org/en/research/commodity-markets', 'thedocs.worldbank.org/'],
  },
  {
    key: 'fts-mineral-tax',
    group: 'data',
    cite: 'Federal Tax Service, 2024–2026',
    issuer: 'Federal Tax Service of Russia',
    date: '2024–2026',
    title:
      'Data for the calculation of the mineral extraction tax, monthly releases (for example: Опубликованы данные для расчёта НДПИ и НДД, а также акциза на нефтяное сырье за июль 2026 года [Data published for the calculation of the mineral extraction tax and the additional income tax, and of the excise on crude, for July 2026], https://www.nalog.gov.ru/rn77/news/activities_fts/16643613/)',
    url: 'https://www.nalog.gov.ru/rn77/news/activities_fts/',
    detail: 'One page for each month',
    stored: ['nalog.gov.ru/rn77/news/activities_fts/', 'https://www.nalog.gov.ru/'],
  },
  {
    key: 'fts-profit-tax',
    group: 'data',
    cite: 'Federal Tax Service, 2025a',
    issuer: 'Federal Tax Service of Russia',
    date: '2025, January 20',
    title:
      'Ставка налога на прибыль организаций изменилась с 2025 года [The corporate profit tax rate changed from 2025]',
    url: 'https://www.nalog.gov.ru/rn27/news/tax_doc_news/15617353/',
  },
  {
    key: 'fts-vat',
    group: 'data',
    cite: 'Federal Tax Service, 2025b',
    issuer: 'Federal Tax Service of Russia',
    date: '2025, December 17',
    title:
      'Как исчислять НДС по новым правилам с 2026 года [How to calculate VAT under the new rules from 2026]',
    url: 'https://www.nalog.gov.ru/rn25/news/activities_fts/16590316/',
    stored: ['nalog.gov.ru/rn25/news/activities_fts/16590316', 'nalog.gov.ru/rn91/'],
  },
  {
    key: 'mined-urals',
    group: 'data',
    cite: 'Ministry of Economic Development, 2026',
    issuer: 'Ministry of Economic Development of the Russian Federation',
    date: '2026, October 2',
    title:
      'О среднем уровне цен нефти сорта «Юралс» за сентябрь 2026 года [On the average price level of Urals oil for September 2026]',
    url: 'https://www.economy.gov.ru/material/departments/d12/konyunktura_mirovyh_tovarnyh_rynkov/o_srednem_urovne_cen_nefti_sorta_yurals_za_sentyabr_2026_goda.html',
    detail: 'Monthly releases',
  },
  {
    key: 'eurostat-comext',
    group: 'data',
    cite: 'Eurostat, 2026',
    issuer: 'Eurostat',
    date: '2026',
    title: 'International trade of EU and non-EU countries since 2002 by HS2-4-6 (DS-059341)',
    url: 'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/DS-059341',
    detail: 'Dataset',
    stored: ['ec.europa.eu/eurostat/'],
  },
  {
    key: 'crea-tracker',
    group: 'data',
    cite: 'CREA, 2026',
    issuer: 'Centre for Research on Energy and Clean Air (CREA)',
    date: '2026',
    title: 'Russia Fossil Tracker',
    url: 'https://api.russiafossiltracker.com/',
    detail: 'Dataset',
    stored: ['api.russiafossiltracker.com/'],
  },
  {
    key: 'gfw-port-visits',
    group: 'data',
    cite: 'Global Fishing Watch, 2026',
    issuer: 'Global Fishing Watch',
    date: '2026',
    title: 'Port visit events (public-global-port-visits-events)',
    url: 'https://globalfishingwatch.org',
    detail: 'Dataset, CC BY-NC 4.0, non-commercial use',
    stored: ['gateway.api.globalfishingwatch.org/'],
  },
  {
    key: 'asop',
    group: 'data',
    cite: 'ASOP, 2022–2026',
    issuer: 'Association of Commercial Sea Ports of Russia (ASOP)',
    date: '2022–2026',
    title:
      'Грузооборот морских портов России [Cargo turnover of the seaports of Russia], annual releases for 2021 to 2025 and January–April 2026',
    url: 'https://www.morport.com/rus/news/gruzooborot-morskih-portov-rossii-za-2025-god',
    stored: ['morport.com/'],
  },
  {
    key: 'portnews',
    group: 'press',
    cite: 'PortNews, 2018–2021',
    issuer: 'PortNews',
    date: '2018; 2019; 2021',
    title: 'Port traffic news items 251806, 270776 and 307541',
    url: 'https://portnews.ru/news/307541/',
    stored: ['portnews.ru/news/'],
  },
  {
    key: 'nmtp-2017',
    group: 'other',
    cite: 'NMTP, 2017',
    issuer: 'Novorossiysk Commercial Sea Port (NMTP)',
    date: '2017',
    title: 'Annual report 2016',
    url: 'https://portnews.ru/upload/basefiles/1552_ncsp_ar_2016_rus_28_04.pdf',
  },
  {
    key: 'nmtp-2020',
    group: 'other',
    cite: 'NMTP, 2020',
    issuer: 'Novorossiysk Commercial Sea Port (NMTP)',
    date: '2020, April 30',
    title: 'Annual report 2019',
    url: 'https://fs.moex.com/f/13354/nmtp-report-rus-30-04-2020.pdf',
  },
  // Reports of institutes and research centres.
  {
    key: 'sipri-2023',
    group: 'institutes',
    cite: 'Cooper, 2023',
    issuer: 'Cooper, J.',
    date: '2023, December',
    title:
      'Another budget for a country at war: Military expenditure in Russia’s federal budget for 2024 and beyond',
    url: 'https://www.sipri.org/sites/default/files/2023-12/sipriinsights_2312_11_russian_milex_for_2024_0.pdf',
    detail:
      'SIPRI Insights on Peace and Security, No. 2023/11. Estimate of 2023 from nine months of data',
  },
  {
    key: 'sipri-2025',
    group: 'institutes',
    cite: 'Cooper, 2025',
    issuer: 'Cooper, J.',
    date: '2025, April',
    title: 'Preparing for a fourth year of war: Military spending in Russia’s budget for 2025',
    url: 'https://www.sipri.org/sites/default/files/2025-04/preparing_for_a_fourth_year_of_war-military_spending_in_russias_budget_for_2025.pdf',
    detail: 'SIPRI Insights on Peace and Security, No. 2025/04. Estimate of 2024 in brackets',
  },
  {
    key: 'kse-rot-feb26',
    group: 'institutes',
    cite: 'Dodonov et al., 2026',
    issuer: 'Dodonov, B., Hilgenstock, B. et al.',
    date: '2026, March 2',
    title: 'Russian Oil Tracker',
    url: 'https://sanctions.kse.ua/wp-content/uploads/2026/03/ROT_FEB26.pdf',
    detail: 'KSE Institute',
  },
  {
    key: 'crea-jan26',
    group: 'institutes',
    cite: 'Raghunandan et al., 2026',
    issuer: 'Raghunandan, V. et al.',
    date: '2026, February 18',
    title: 'January 2026 — Monthly analysis of Russian fossil fuel exports and sanctions',
    url: 'https://energyandcleanair.org/january-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/',
    detail: 'Centre for Research on Energy and Clean Air, based on Kpler',
    stored: ['energyandcleanair.org/'],
  },
  {
    key: 'econ4ua-china',
    group: 'institutes',
    cite: 'Deryugina & Shepotylo, 2026',
    issuer: 'Deryugina, T., & Shepotylo, O.',
    date: '2026, September',
    title: 'China’s Support for Russia (Policy Brief No. 4)',
    url: 'https://econ4ua.org/wp-content/uploads/2026/09/Chinas-Support-for-Russia-Final.pdf',
    detail: 'econ4ua',
  },
  {
    key: 'carnegie-pos2',
    group: 'institutes',
    cite: 'Vakulenko, 2025',
    issuer: 'Vakulenko, S.',
    date: '2025, September 22',
    title: 'Why Can’t Russia and China Agree on the Power of Siberia 2 Gas Pipeline?',
    url: 'https://carnegieendowment.org/russia-eurasia/politika/2025/09/russia-china-gas-deals',
    detail: 'Carnegie Politika, Carnegie Endowment for International Peace',
  },
  {
    key: 'osw-gas-2021',
    group: 'institutes',
    cite: 'OSW, 2022',
    issuer: 'Centre for Eastern Studies (OSW)',
    date: '2022, January 27',
    title: 'Russia: the major gas sector indices of 2021',
    url: 'https://www.osw.waw.pl/en/publikacje/analyses/2022-01-27/russia-major-gas-sector-indices-2021',
  },
  {
    key: 'uscc-2025',
    group: 'institutes',
    cite: 'USCC, 2025',
    issuer: 'U.S.-China Economic and Security Review Commission',
    date: '2025, November 14',
    title: "China's Facilitation of Sanctions and Export Control Evasion",
    url: 'https://www.uscc.gov/research/chinas-facilitation-sanctions-and-export-control-evasion',
  },
  {
    key: 'ecfr-uae',
    group: 'institutes',
    cite: 'Bianco, 2026',
    issuer: 'Bianco, C.',
    date: '2026',
    title: 'Little Venice, little Sparta',
    url: 'https://ecfr.eu/publication/little-venice-little-sparta-the-uaes-statecraft-meets-the-war-on-iran/',
    detail: 'European Council on Foreign Relations',
  },
  {
    key: 'ifi-aug-2026',
    group: 'institutes',
    cite: 'Institute for Financial Integrity, 2026',
    issuer: 'Institute for Financial Integrity',
    date: '2026',
    title: 'August monthly sanctions and export controls report',
    url: 'https://finintegrity.org/?p=11370',
  },
  {
    key: 'elliptic-a7a5',
    group: 'institutes',
    cite: 'Elliptic, 2026',
    issuer: 'Elliptic',
    date: '2026, July 29',
    title: 'The fall of A7A5',
    url: 'https://www.elliptic.co/insights/the-fall-of-a7a5-how-sanctions-strangled-the-ruble-stablecoin/',
  },
  {
    key: 'kse-chp-q1',
    group: 'institutes',
    cite: 'Risinger et al., 2026',
    issuer: 'Risinger, L. et al.',
    date: '2026, April',
    title: 'Russian CHP Imports Tracker',
    url: 'https://sanctions.kse.ua/wp-content/uploads/2026/04/KSE_CHP_tracker_Q1_2026-1.pdf',
    detail: 'KSE Institute',
  },
  {
    key: 'kse-chp-q2',
    group: 'institutes',
    cite: 'Risinger & Hilgenstock, 2026',
    issuer: 'Risinger, L., & Hilgenstock, B.',
    date: '2026, July',
    title: 'Russian CHP Imports Tracker: Q2 2026',
    url: 'https://sanctions.kse.ua/wp-content/uploads/2026/07/CHP-Q2-2026-Report.pdf',
    detail: 'KSE Institute',
  },
  {
    key: 'kse-export-controls',
    group: 'institutes',
    cite: 'Bilousova et al., 2024',
    issuer: 'Bilousova, O., Hilgenstock, B. et al.',
    date: '2024, January',
    title: 'Challenges of Export Controls Enforcement',
    url: 'https://kse-ua-prod-media.fra1.digitaloceanspaces.com/wp-content/uploads/2024/01/Challenges-of-Export-Controls-Enforcement.pdf',
    detail: 'KSE Institute',
    stored: ['kse-ua-prod-media.fra1.digitaloceanspaces.com/', 'kse.ua/en/news/challenges'],
  },
  {
    key: 'carnegie-hk',
    group: 'institutes',
    cite: 'Kot, 2023',
    issuer: 'Kot, B.',
    date: '2023, May 17',
    title: "Hong Kong's Technology Lifeline to Russia",
    url: 'https://carnegieendowment.org/research/2023/05/hong-kongs-technology-lifeline-to-russia',
    detail: 'Carnegie Endowment for International Peace',
  },
  {
    key: 'cepii-2025',
    group: 'institutes',
    cite: 'Emlinger & Lefebvre, 2025',
    issuer: 'Emlinger, C., & Lefebvre, K.',
    date: '2025, February',
    title: 'Working Around Sanctions. What Cost to Russia? (Policy Brief No. 50)',
    url: 'https://www.cepii.fr/PDF_PUB/pb/2025/pb2025-50.pdf',
    detail: 'CEPII',
  },
  {
    key: 'rusi-silicon',
    group: 'institutes',
    cite: 'Byrne et al., 2022',
    issuer: 'Byrne, J. et al.',
    date: '2022, August',
    title: 'Silicon Lifeline',
    url: 'https://static.rusi.org/RUSI-Silicon-Lifeline-final-updated-web_1.pdf',
    detail: 'Royal United Services Institute',
  },
  {
    key: 'car-components',
    group: 'institutes',
    cite: 'Conflict Armament Research, 2023a',
    issuer: 'Conflict Armament Research',
    date: '2023, April',
    title: 'Identifying post-invasion components in Russian weapons',
    url: 'https://storymaps.arcgis.com/stories/00594bef40bc4148b16dc7267172d033',
  },
  {
    key: 'car-shahed',
    group: 'institutes',
    cite: 'Conflict Armament Research, 2023b',
    issuer: 'Conflict Armament Research',
    date: '2023, August',
    title: 'Documenting the domestic Russian variant of the Shahed UAV',
    url: 'https://storymaps.arcgis.com/stories/d3be20c31acd4112b0aecece5b2a283c',
  },
  {
    key: 'carnegie-elites',
    group: 'institutes',
    cite: 'Stanovaya, 2020',
    issuer: 'Stanovaya, T.',
    date: '2020, February 11',
    title: 'Unconsolidated: The five Russian elites shaping Putin’s transition',
    url: 'https://carnegieendowment.org/russia-eurasia/posts/2020/02/unconsolidated-the-five-russian-elites-shaping-putins-transition',
    detail: 'Carnegie Endowment for International Peace',
  },
  {
    key: 'bell-middlemen',
    group: 'institutes',
    cite: 'Prokopenko & Kolyandr, 2024',
    issuer: 'Prokopenko, A., & Kolyandr, A.',
    date: '2024, November 2',
    title: "The rise of Russia's foreign trade middlemen",
    url: 'https://en.thebell.io/the-rise-of-russias-foreign-trade-middlemen/',
    detail: 'Inside the Russian Economy. The Bell',
  },
  {
    key: 'kpler-rosneft',
    group: 'institutes',
    cite: 'Kpler, 2025',
    issuer: 'Kpler',
    date: '2025, December 2',
    title:
      'Rosneft and Lukoil sanctions are live: how India, China and Turkey adapt rather than exit',
    url: 'https://www.kpler.com/blog/rosneft-and-lukoil-sanctions-are-live-how-india-china-and-turkey-adapt-rather-than-exit',
  },
  // Press.
  {
    key: 'korsunskaya-2024',
    group: 'press',
    cite: 'Korsunskaya, 2024',
    issuer: 'Korsunskaya, D.',
    date: '2024, September 30',
    title:
      'Траты России на оборону в 25г вырастут до 13,5 трлн р, более чем вдвое обогнав социальные расходы [Russian defence spending in 2025 will rise to 13.5 trillion roubles, more than twice social spending]',
    url: 'https://ru.themoscowtimes.com/2024/09/30/update-1-traty-rossii-na-oboronu-v-25g-vyrastut-do-135-trln-r-bolee-chem-vdvoe-obognav-sotsialnye-raskhody-a143572',
    detail: 'Reuters, in The Moscow Times (Russian service)',
  },
  {
    key: 'interfax-gazprom-china',
    group: 'press',
    cite: 'Interfax, 2026a',
    issuer: 'Interfax',
    date: '2026, January 13',
    title:
      'Gazprom supplies 38.8 bcm of gas to China in 2025, for first time more than towards west – company',
    url: 'https://interfax.com/newsroom/top-stories/115552/',
  },
  {
    key: 'interfax-gas-forecast',
    group: 'press',
    cite: 'Interfax, 2026b',
    issuer: 'Interfax',
    date: '2026, May 12',
    title:
      'Russian govt gives cautious 2026 gas production forecast of 688.4 bcm despite strong start to year',
    url: 'https://interfax.com/newsroom/top-stories/117527/',
  },
  {
    key: 'interfax-mir-kz',
    group: 'press',
    cite: 'Interfax, 2024',
    issuer: 'Interfax',
    date: '2024, April 3',
    title: 'Most Kazakh banks not servicing Russian Mir cards due to sanctions',
    url: 'https://interfax.com/newsroom/top-stories/101016/',
  },
  {
    key: 'reuters-lng',
    group: 'press',
    cite: 'Reuters, 2025a',
    issuer: 'Reuters',
    date: '2025, December 30',
    title: 'Russian LNG exports dip in 2025 as sanctions squeeze logistics',
    url: 'https://www.bairdmaritime.com/shipping/tankers/gas/russian-lng-exports-dip-in-2025-as-sanctions-squeeze-logistics',
    detail: 'Reprinted by Baird Maritime',
    stored: ['bairdmaritime.com/'],
  },
  {
    key: 'nv-gazprom-2025',
    group: 'press',
    cite: 'NV, 2026',
    issuer: 'The New Voice of Ukraine',
    date: '2026, March 23',
    title: 'Gazprom gas output falls to 405 bcm in 2025',
    url: 'https://english.nv.ua/business/gazprom-gas-output-falls-to-405-bcm-in-2025-50594119.html',
  },
  {
    key: 'reuters-urals-2019',
    group: 'press',
    cite: 'Yagova & Gorodyankin, 2019',
    issuer: 'Yagova, O., & Gorodyankin, G.',
    date: '2019, October 11',
    title: 'IMO 2020 regulations challenge Russian Urals crude',
    url: 'https://www.hydrocarbonprocessing.com/news/2019/10/imo-2020-regulations-challenge-russian-urals-crude',
    detail: 'Reuters, reprinted by Hydrocarbon Processing',
  },
  {
    key: 'ng-damper',
    group: 'press',
    cite: 'Nezavisimaya Gazeta, 2026',
    issuer: 'Nezavisimaya Gazeta',
    date: '2026, October 6',
    title:
      'Выплаты нефтяникам установили очередной рекорд [Payments to oil companies set a new record]',
    url: 'https://www.ng.ru/economics/2026-10-06/1_9597_price.html',
  },
  {
    key: 'sp-kozmino',
    group: 'press',
    cite: 'S&P Global, 2024',
    issuer: 'S&P Global Commodity Insights',
    date: '2024, January 10',
    title: 'Russian Kozmino crude exports jump 9.4% in 2023 amid sanctions: reports',
    url: 'https://www.spglobal.com/energy/en/news-research/latest-news/crude-oil/011024-russian-kozmino-crude-exports-jump-94-in-2023-amid-sanctions-reports',
  },
  {
    key: 'tass-yuan',
    group: 'press',
    cite: 'TASS, 2026',
    issuer: 'TASS',
    date: '2026, October 23',
    title: 'National currencies account for nearly 100% of Russia-China settlements',
    url: 'https://tass.com/economy/2206739',
  },
  {
    key: 'tass-gazpromneft',
    group: 'press',
    cite: 'TASS, 2024',
    issuer: 'TASS',
    date: '2024',
    title: 'Gazprom Neft to pay out record 2023 dividends',
    url: 'https://tass.com/economy/1810035',
  },
  {
    key: 'mt-chinese-bank',
    group: 'press',
    cite: 'The Moscow Times, 2024a',
    issuer: 'The Moscow Times',
    date: '2024, February 7',
    title: 'Major Chinese Bank Halts All Settlements With Russia – Vedomosti',
    url: 'https://www.themoscowtimes.com/2024/02/07/major-chinese-bank-halts-all-settlements-with-russia-vedomosti-a84001',
  },
  {
    key: 'mt-uae-banks',
    group: 'press',
    cite: 'The Moscow Times, 2024b',
    issuer: 'The Moscow Times',
    date: '2024, February 19',
    title: 'UAE Banks Limit Payments With Russia Over Secondary Sanctions Threat – Vedomosti',
    url: 'https://www.themoscowtimes.com/2024/02/19/uae-banks-limit-payments-with-russia-over-secondary-sanctions-threat-vedomosti-a84143',
  },
  {
    key: 'bell-china',
    group: 'press',
    cite: 'The Bell, 2024',
    issuer: 'The Bell',
    date: '2024, February 20',
    title: 'How Russia uses China to get round sanctions',
    url: 'https://en.thebell.io/how-russia-uses-china-to-get-round-sanctions/',
  },
  {
    key: 'bloomberg-turkish-banks',
    group: 'press',
    cite: 'Bloomberg, 2024',
    issuer: 'Bloomberg',
    date: '2024, January 17',
    title: 'Turkish Banks Tighten Screws on Russia Over Fear of US Sanctions',
    url: 'https://www.bloomberg.com/news/articles/2024-01-17/turkish-banks-tighten-screws-on-russia-over-fear-of-us-sanctions',
  },
  {
    key: 'reuters-payment-hurdles',
    group: 'press',
    cite: 'Reuters, 2024a',
    issuer: 'Reuters',
    date: '2024, August 30',
    title: 'Russia payment hurdles with China partners intensified in August, sources say',
    url: 'https://www.thestandard.com.hk/china/article/219959/Russia-payment-hurdles-with-China-partners-intensified-in-August-sources-say',
    detail: 'The Standard (Hong Kong)',
  },
  {
    key: 'reuters-workaround',
    group: 'press',
    cite: 'Reuters, 2024b',
    issuer: 'Reuters',
    date: '2024, June',
    title: 'Russia, China find payments workaround as US sanctions net widens, sources say',
    url: 'https://www.yahoo.com/news/russia-china-payments-workaround-us-150733803.html',
    detail: 'Yahoo News',
  },
  {
    key: 'scmp-banks',
    group: 'press',
    cite: 'South China Morning Post, 2025',
    issuer: 'South China Morning Post',
    date: '2025, July 18',
    title: 'European Union sanctions 2 Chinese banks over aid to Russia',
    url: 'https://www.scmp.com/news/china/diplomacy/article/3318793/european-union-sanctions-2-chinese-banks-over-aid-russia',
  },
  {
    key: 'rferl-armenia',
    group: 'press',
    cite: 'RFE/RL, 2024',
    issuer: 'Radio Free Europe/Radio Liberty',
    date: '2024, March 29',
    title: 'Armenian Banks To Ditch Russian Cards Over U.S. Sanctions',
    url: 'https://www.rferl.org/a/armenian-banks-to-ditch-russian-cards-over-u-s-sanctions/32882489.html',
  },
  {
    key: '24kg-ruble',
    group: 'press',
    cite: '24.kg, 2025a',
    issuer: '24.kg',
    date: '2025, April',
    title: 'New procedure for Russian ruble transactions to be introduced in Kyrgyzstan',
    url: 'https://24.kg/english/325722_New_procedure_for_Russian_ruble_transactions_to_be_introduced_in_Kyrgyzstan/',
  },
  {
    key: '24kg-capital',
    group: 'press',
    cite: '24.kg, 2025b',
    issuer: '24.kg',
    date: '2025, April',
    title: '«Капитал Банк» сменил владельца [Capital Bank changed its owner]',
    url: 'https://24.kg/ekonomika/324879_kapital_bank_smenil_vladeltsa_reshenie_aktsionerov/',
  },
  {
    key: 'timesca-president',
    group: 'press',
    cite: 'The Times of Central Asia, 2025',
    issuer: 'The Times of Central Asia',
    date: '2025, August',
    title: 'Kyrgyz President Denounces "Politicized" Sanctions on Banks',
    url: 'https://timesca.com/kyrgyz-president-denounces-politicized-sanctions-on-banks/',
  },
  {
    key: 'timesca-eu',
    group: 'press',
    cite: 'The Times of Central Asia, 2026',
    issuer: 'The Times of Central Asia',
    date: '2026',
    title: 'EU Targets Kyrgyz Financial Sector Over Russia Sanctions Evasion',
    url: 'https://timesca.com/eu-targets-kyrgyz-financial-sector-over-russia-sanctions-evasion/',
  },
  {
    key: 'akchabar-keremet',
    group: 'press',
    cite: 'Akchabar, 2024',
    issuer: 'Akchabar',
    date: '2024, December 26',
    title:
      'Минфин продал контрольный пакет «Керемет Банка» люксембургской компании [The Ministry of Finance sold a controlling stake of Keremet Bank to a Luxembourg company]',
    url: 'https://www.akchabar.kg/article/elektronnie-dengi-igvepnpgkpdmhynm/minfin-prodal-kontrolnij-paket-keremet-banka-lyuksemburgskoj-kompanii-dgdjjrdvmdbzapbe',
  },
  {
    key: 'vedomosti-nmtp',
    group: 'press',
    cite: 'Vedomosti, 2018',
    issuer: 'Vedomosti',
    date: '2018, October 9',
    title:
      '«Транснефть» консолидировала 62% акций НМТП [Transneft consolidates 62% of NMTP shares]',
    url: 'https://www.vedomosti.ru/business/news/2018/10/09/783225-transneft',
  },
  {
    key: 'bbc-yukos-timeline',
    group: 'press',
    cite: 'BBC News, 2005',
    issuer: 'BBC News',
    date: '2005, May 31',
    title: 'Timeline: The rise and fall of Yukos',
    url: 'http://news.bbc.co.uk/2/hi/business/4041551.stm',
  },
  {
    key: 'bbc-yukos-grab',
    group: 'press',
    cite: 'BBC News, 2004',
    issuer: 'BBC News',
    date: '2004, December 23',
    title: 'Putin backs state grab for Yukos',
    url: 'http://news.bbc.co.uk/2/hi/business/4120339.stm',
  },
  {
    key: 'npr-oligarchy',
    group: 'press',
    cite: 'NPR Planet Money, 2022',
    issuer: 'NPR Planet Money',
    date: '2022, March 29',
    title: 'How Putin conquered Russia’s oligarchy',
    url: 'https://www.kpbs.org/news/international/2022/03/29/how-putin-conquered-russias-oligarchy',
    detail: 'KPBS Public Media',
  },
  {
    key: 'bbc-prigozhin',
    group: 'press',
    cite: 'Shevchenko, 2023',
    issuer: 'Shevchenko, V.',
    date: '2023, June 25',
    title: "Yevgeny Prigozhin: From Putin's chef to rebel in chief",
    url: 'https://www.bbc.com/news/world-europe-64976080',
    detail: 'BBC News',
  },
  {
    key: 'reuters-wagner-link',
    group: 'press',
    cite: 'Reuters, 2022',
    issuer: 'Reuters',
    date: '2022, September 26',
    title: 'Russia’s Prigozhin admits link to Wagner mercenaries for first time',
    url: 'https://www.reuters.com/world/europe/russias-prigozhin-admits-link-wagner-mercenaries-first-time-2022-09-26/',
  },
  // Ukrainian military intelligence.
  {
    key: 'gur-fleet',
    group: 'gur',
    cite: 'GUR, 2026a',
    issuer: 'Main Directorate of Intelligence of the Ministry of Defence of Ukraine (GUR)',
    date: '2026',
    title: 'War & Sanctions: Shadow fleet',
    url: 'https://war-sanctions.gur.gov.ua/en/transport/shadow-fleet',
    detail: 'A party to the conflict',
  },
  {
    key: 'gur-components',
    group: 'gur',
    cite: 'GUR, 2026b',
    issuer: 'Main Directorate of Intelligence of the Ministry of Defence of Ukraine (GUR)',
    date: '2026, October 28',
    title: "War & Sanctions: Components in the aggressor's weapon",
    url: 'https://war-sanctions.gur.gov.ua/en/components',
    detail: 'A party to the conflict',
    stored: ['war-sanctions.gur.gov.ua/en/components'],
  },
  // Other sources: companies, a doctrine, a working dataset.
  {
    key: 'rosneft-shareholders',
    group: 'other',
    cite: 'Rosneft, 2021',
    issuer: 'Rosneft',
    date: '2021',
    title: 'Shareholder structure',
    url: 'https://www.rosneft.com/Investors/Equity/Shareholder_structure/',
  },
  {
    key: 'gazprom-equity',
    group: 'other',
    cite: 'Gazprom, 2024',
    issuer: 'Gazprom',
    date: '2024',
    title: 'Equity capital structure',
    url: 'https://www.gazprom.com/investors/stock/structure/',
    detail:
      'Archived copy: https://web.archive.org/web/20250518165637/https://www.gazprom.com/investors/stock/structure/',
    stored: ['gazprom.com/investors/stock/structure'],
  },
  {
    key: 'gazprombank-shareholders',
    group: 'other',
    cite: 'Gazprombank, 2022',
    issuer: 'Gazprombank',
    date: '2022',
    title: '[Gazprombank shareholders]',
    url: 'https://www.gazprombank.ru/about/shareholders/',
    detail:
      'Archived copy: https://web.archive.org/web/20220613220804/https://www.gazprombank.ru/about/shareholders/',
    stored: ['gazprombank.ru/about/shareholders'],
  },
  {
    key: 'transneft-company',
    group: 'other',
    cite: 'Transneft, 2022',
    issuer: 'Transneft',
    date: '2022, January 13',
    title: 'Company',
    url: 'https://en.transneft.ru/about/',
    detail:
      'Archived copy: https://web.archive.org/web/20220113152812/https://en.transneft.ru/about/',
    stored: ['en.transneft.ru/about'],
  },
  {
    key: 'uk-mod-jdp',
    group: 'other',
    cite: 'UK Ministry of Defence, 2023',
    issuer: 'Ministry of Defence (United Kingdom)',
    date: '2023',
    title:
      'JDP 2-00 Intelligence, Counter-intelligence and Security Support to Joint Operations (4th ed.)',
    url: 'https://assets.publishing.service.gov.uk/media/653a4b0780884d0013f71bb0/JDP_2_00_Ed_4_web.pdf',
  },
];

// The short author of an issuer whose entry has no author-year reference (APA 7).
const AUTHORS: Readonly<Record<string, string>> = {
  'Council of the European Union': 'Council of the EU',
  'European Commission': 'European Commission',
  'European Parliament and Council of the European Union': 'European Parliament & Council',
  'Publications Office of the European Union, EUR-Lex': 'Council of the EU',
  'U.S. Department of the Treasury': 'US Treasury',
  'Office of Foreign Assets Control': 'OFAC',
  'Financial Crimes Enforcement Network': 'FinCEN',
  'World Bank': 'World Bank',
  'Russian Federation': 'Russian Federation',
};
const YEAR = /^(?:\d{4}(?:[–-]\d{4})?|n\.d\.)[a-z]?$/u;

/** The words of a reference before its year, and its year, when the reference ends with a year. */
const splitCite = (cite: string): [string, string] | undefined => {
  const at = cite.lastIndexOf(', ');
  const tail = at > 0 ? cite.slice(at + 2) : '';
  return YEAR.test(tail) ? [cite.slice(0, at), tail.replace(/[a-z]$/u, '')] : undefined;
};

/** The author and the year of an entry: from its reference, or the short name of its issuer and
 * the year of its date when the reference holds no year. */
const authorYearOf = (entry: Entry): [string, string] => {
  const split = splitCite(entry.cite);
  if (split !== undefined) return split;
  const author = AUTHORS[entry.issuer];
  if (author === undefined) throw new Error(`No short author for ${entry.key}`);
  return [author, /\d{4}/u.exec(entry.date)?.[0] ?? 'n.d.'];
};
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const dateKey = (entry: Entry): string => {
  const [year = '', rest = ''] = entry.date.split(', ');
  const [month = '', day = ''] = rest.split(' ');
  const number = String(MONTHS.indexOf(month) + 1).padStart(2, '0');
  return `${year}-${number}-${day.padStart(2, '0')}-${entry.key}`;
};

/** Each entry with its APA 7 author-year reference: two entries of the same author and year get
 * a letter, in the order of their dates. */
export const entries: readonly Entry[] = (() => {
  const groups = new Map<string, Entry[]>();
  for (const entry of listed) {
    const label = authorYearOf(entry).join(', ');
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }
  const cites = new Map<string, string>();
  for (const [label, group] of groups)
    [...group]
      .sort((a, b) => dateKey(a).localeCompare(dateKey(b)))
      .forEach((entry, index) =>
        cites.set(
          entry.key,
          group.length === 1 ? label : `${label}${'abcdefghijklmnopqrstuvwxyz'.charAt(index)}`,
        ),
      );
  return listed.map((entry) => ({ ...entry, cite: cites.get(entry.key) ?? entry.cite }));
})();

const byKey = new Map(entries.map((entry) => [entry.key, entry]));

/** The entry of one key. A key with no entry is a fault of the text. */
export function entryOf(key: string): Entry {
  const entry = byKey.get(key);
  if (entry === undefined) throw new Error(`Unknown bibliography key ${key}`);
  return entry;
}

// `@key` cites an entry; ` | ` opens the short note of a note line.
export const KEY = /@([a-z0-9][a-z0-9-]*)/g;
const SPLIT = ' | ';
// The longest reference in the text, with its parenthesis, and its most items: one line of the
// page. A longer list of sources is the source line of a figure, which names its sources itself.
export const MAX_CITE = 100;
const MAX_ITEMS = 5;
const PAGE = /^pp?\. [\d–-]+$/u;
const CALCULATION = /authors' calculations/iu;

/** A note line in two parts: the reference of the note line, and the short note (the
 * explanation, the caveat or the counting rule). */
export function splitNote(text: string): { readonly cite: string; readonly note: string } {
  const at = text.indexOf(SPLIT);
  return at < 0
    ? { cite: text, note: '' }
    : { cite: text.slice(0, at), note: text.slice(at + SPLIT.length) };
}

/** The keys that one note line cites, in their order, each one once. */
export const keysOf = (text: string): readonly string[] => [
  ...new Set([...text.matchAll(KEY)].map((match) => match[1] ?? '')),
];

/** The parts of a reference: each `@key`, the words before it, and its pinpoint (the words
 * after it up to the next `;`). */
const piecesOf = (text: string): { lead: string; key: string; locator: string }[] =>
  splitNote(text)
    .cite.split(';')
    .flatMap((segment) => {
      const match = /^(.*?)@([a-z0-9][a-z0-9-]*)(.*)$/su.exec(segment.trim());
      if (match === null) return [];
      const [, lead = '', key = '', rest = ''] = match;
      return [{ lead, key, locator: rest.replace(/^[,\s]+/u, '').trim() }];
    });

/** The items of the reference in the text, each with the key of its first entry: the entries of
 * one author go in one item, and only a page stays as a pinpoint. A calculation of the authors
 * cites its sources in the same way (Annex A.4 says that the counts are calculations of the
 * authors). No item when the reference is longer than one line: only the source line of a figure
 * is that long. */
export function citeParts(text: string): readonly { label: string; key: string }[] {
  const pieces = piecesOf(text);
  const items: { author: string; years: string[]; key: string }[] = [];
  for (const { key } of pieces) {
    // The reference of each entry is "author, year" with its letter.
    const { cite } = entryOf(key);
    const at = cite.lastIndexOf(', ');
    const [author, year] = [cite.slice(0, at), cite.slice(at + 2)];
    const item = items.find((one) => one.author === author);
    if (item === undefined) items.push({ author, years: [year], key });
    else if (!item.years.includes(year)) item.years.push(year);
  }
  const parts = items.map(({ author, years, key }) => ({
    label: `${author}, ${[...years].sort().join(', ')}`,
    key,
  }));
  const only = pieces.length === 1 ? pieces[0] : undefined;
  const first = parts[0];
  if (only !== undefined && first !== undefined && PAGE.test(only.locator)) {
    const label = `${first.label}, ${only.locator}`;
    if (label.length + 2 <= MAX_CITE) return [{ label, key: first.key }];
  }
  const length = parts.map((part) => part.label).join('; ').length + 2;
  return parts.length > MAX_ITEMS || length > MAX_CITE ? [] : parts;
}

/** The reference of a note line as the reader sees it, with no parenthesis; empty when the text
 * shows only the number of the note. */
export const citeText = (text: string): string =>
  citeParts(text)
    .map((part) => part.label)
    .join('; ');

/** The numbered note of a note line: its short note only (an explanation, a caveat or a
 * counting rule). A reference is never a numbered note. Empty when the note line has no short
 * note. */
export const noteText = (text: string): string => splitNote(text).note;

/** The pinpoints (annex, article, line, page, entry) of each entry, from all note lines: the
 * bibliography gives them, and the text does not. */
export function locatorsOf(
  notes: readonly { readonly text: string }[],
): ReadonlyMap<string, readonly string[]> {
  const by = new Map<string, string[]>();
  for (const note of notes)
    for (const { key, locator } of piecesOf(note.text)) {
      if (locator === '' || CALCULATION.test(locator)) continue;
      const list = by.get(key) ?? [];
      if (!list.includes(locator)) by.set(key, [...list, locator]);
    }
  return by;
}

/** The number of each numbered note, in the order of the notes of the report. A note line with
 * no numbered note has no number. */
export function shortNoteNumbers(
  notes: readonly { readonly id: string; readonly text: string }[],
): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>();
  for (const note of notes) if (noteText(note.text) !== '') numbers.set(note.id, numbers.size + 1);
  return numbers;
}

/** The ids of the notes that cite each key. */
export function citingNotes(
  notes: readonly { readonly id: string; readonly text: string }[],
): ReadonlyMap<string, readonly string[]> {
  const by = new Map<string, string[]>();
  for (const note of notes)
    for (const key of keysOf(note.text)) by.set(key, [...(by.get(key) ?? []), note.id]);
  return by;
}

/** The entries of each group, in the order of the groups, each group sorted by its reference. */
export const groupedEntries = (): readonly (readonly [Group, readonly Entry[]])[] =>
  (Object.keys(GROUPS) as Group[]).map((group) => [
    group,
    entries
      .filter((entry) => entry.group === group)
      .sort((a, b) => a.cite.localeCompare(b.cite, 'en', { numeric: true })),
  ]);
