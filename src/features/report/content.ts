export const report = {
  title: 'The nodes that sustain Russia’s war in 2026',
  subtitle: 'What keeps it running in 2026',
  summary:
    'Russia has found new buyers, new shipping arrangements and new payment channels. The report argues that this adaptation keeps trade moving, but gives its remaining partners more power over prices.',
  sea: [
    'Crude oil that does not leave Russia by pipeline passes through a small number of ports: Primorsk and Ust-Luga on the Baltic, Novorossiysk on the Black Sea, and Kozmino on the Pacific.',
    'The report links the resilience of these exports to the shadow fleet: tankers associated with countries outside the coalition and without Western insurance, as classified by the KSE Institute. In January 2026, they carried 79% of Russia’s seaborne crude exports.',
    'This does not make every shadow-fleet tanker a designated vessel. Insurance, flag and sanctions status describe different things. The report keeps these categories separate.',
  ],
  price: [
    'The Urals discount widened after the October 2025 US designations of Rosneft and Lukoil. The report considers a sanctions effect plausible, but the timing alone cannot establish causation.',
    'Buyers that stay in the market gain bargaining power. According to Kpler, refiners in India, China and Türkiye continue buying through intermediaries, while the pressure on Russian oil prices improves their margins.',
    'Urals is also the reference price used to calculate Russia’s mineral extraction tax. A deeper discount reduces what the state receives from each barrel. Continued exports and unchanged revenues are not the same thing.',
  ],
  limit:
    'The flows shown here describe loading basins only. No published source in the report links a fleet category to an individual buyer. The underlying research has not yet been reviewed by a human; the English translation awaits editorial review.',
};
export const basins = [
  { name: 'Baltic', crude: 1460, products: 1551 },
  { name: 'Black Sea', crude: 391, products: 686 },
  { name: 'Pacific', crude: 1167, products: 175 },
  { name: 'Arctic', crude: 439, products: 3 },
];
export const caps = [
  {
    date: '2022-12-05',
    value: '60',
    note: 'Initial coalition price cap',
    href: 'https://eur-lex.europa.eu/eli/reg/2022/2367/oj',
  },
  {
    date: '2025-09-03',
    value: '47.6',
    note: 'Lower EU price cap',
    href: 'https://eur-lex.europa.eu/eli/reg/2025/1494/oj',
  },
  {
    date: '2026-02-01',
    value: '44.1',
    note: 'Further EU adjustment',
    href: 'https://eur-lex.europa.eu/eli/reg_impl/2026/124/oj',
  },
];
export const media = {
  src: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-in-port-arthur-texas.jpg',
  alt: 'The tanker Eagle Kinabalu passing an LNG construction site in Port Arthur, Texas.',
  caption: 'Eagle Kinabalu, Port Arthur, Texas · 2025-04-15',
  credit: 'Quintin Soloviev / Wikimedia Commons · CC0',
  href: 'https://commons.wikimedia.org/wiki/File:Crude_Oil_Tanker_in_Port_Arthur,_Texas.jpg',
};
export const secondMedia = {
  src: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-eagle-san-diego.jpg',
  alt: 'The oil tanker Eagle San Diego, viewed from the bow.',
  caption: 'Eagle San Diego · 2024-12-30',
  credit: 'Jordanroderick / Wikimedia Commons · CC0',
  href: 'https://commons.wikimedia.org/wiki/File:Crude_oil_tanker_Eagle_San_Diego.jpg',
};

// The parts of the report, in the order of the French publication (October 2026).
// Text marks: [[node_id|text]] is a reference to a node of nodes-data.ts; [^id] is a note of the part.
export interface ReportBlock {
  kind: 'p' | 'h3' | 'li' | 'figure';
  text: string;
  figure?: { number: number; title: string; unit?: string; period?: string; sources: string };
}
export interface ReportPart {
  source: string;
  slug: string;
  title: string;
  blocks: ReportBlock[];
  notes: { id: string; text: string }[];
  nodeIds: string[];
}
export const parts: ReportPart[] = [
  {
    source: 'report-en.md, Summary',
    slug: 'summary',
    title: 'Summary',
    blocks: [
      {
        kind: 'p',
        text: '**The problem.** Since 2022, the European Union, the United States, the United Kingdom and their allies have imposed wide-ranging sanctions on Russia, from oil and gas to military technology. Yet the war goes on, and it costs more and more: at constant prices, the defence budget planned for 2025 is 2.6 times the spending of 2021. Where do the money and the technology that let Russia fight come from?',
      },
      {
        kind: 'p',
        text: '**The method.** The report searches a database of nearly 5,200 entities, where every fact points to an archived document. It looks for the nodes (companies, ports, fleets, banks, payment channels) that are exposed to sanctions, active in 2024-2026 and tied to a country that does not apply them.',
      },
      {
        kind: 'p',
        text: '**The result.** Russia holds out, and the report explains this by new trade relations with countries that are not aligned with the coalition. These countries use their strategic autonomy and, at the same time, take advantage of their strong position in negotiations with Russia.',
      },
      {
        kind: 'li',
        text: "**Customers:** From 2021 to 2025, EU purchases from Russia fell by 84%;[^1] China became Russia's first customer, and India bought twenty times as much Russian crude.",
      },
      {
        kind: 'li',
        text: '**Ships:** The tankers of the so-called "shadow fleet", tied to a country outside the coalition and with no Western insurance, carried 79% of the crude exported by sea in January 2026.[^2]',
      },
      {
        kind: 'li',
        text: "**Price:** Since November 2025, the discount of Russian crude to Brent has almost doubled. The report links this, as a hypothesis, to the American sanctions on [[N-P026|Rosneft]] and [[N-P030|Lukoil]]. Russia's partners benefit: China buys Russian crude at a discount and sells the components of weapons at a high premium.",
      },
      {
        kind: 'li',
        text: '**Budget:** The share of oil and gas in federal revenue falls from one half in 2014 to less than one fifth in 2026, partly because that revenue is shrinking.[^3]',
      },
      {
        kind: 'li',
        text: '**Currency:** The rouble settled 53% of Russian exports in 2025, against 14% in 2021,[^4] and the rouble and the yuan settle almost all payments with China.',
      },
      {
        kind: 'li',
        text: '**Components:** Finally, China supplied 77% of the priority goods for weapons sold to Russia in 2025, and Hong Kong 11%.[^5]',
      },
      {
        kind: 'p',
        text: 'The sources of the other figures are given in the body of the report.',
      },
      {
        kind: 'p',
        text: '*This investigation was supported by FNF through the OSINT+ Investigation Competition 2026. The author(s) are solely responsible for the content and conclusions presented.*',
      },
    ],
    notes: [
      {
        id: '1',
        text: "Author's calculations based on Bahí Esteba, A. et al. (2026, September 21). *Russian foreign trade tracker* (35th ed.) [Data]. Bruegel. https://www.bruegel.org, fig. 2.",
      },
      {
        id: '2',
        text: 'Dodonov, B., Hilgenstock, B. et al. (2026, March 2). *Russian Oil Tracker*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/03/ROT_FEB26.pdf, p. 3.',
      },
      {
        id: '3',
        text: "Author's calculations based on Ministry of Finance of the Russian Federation. (2026a). *Приложение 3.1. Краткая информация об исполнении федерального бюджета (млрд руб.)* [Annex 3.1. Short information on the execution of the federal budget (billion roubles)]. https://minfin.gov.ru/ru/document?id_4=80041-kratkaya_ezhegodnaya_informatsiya_ob_ispolnenii_federalnogo_byudzheta_mlrd_rub, lines 1, 1.1 and 1.2; Ministry of Finance of the Russian Federation. (2026b). *Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года* [Preliminary estimate of the execution of the federal budget for January–September 2026]. https://minfin.gov.ru/ru/press-center/?id_4=40677.",
      },
      {
        id: '4',
        text: 'Central Bank of Russia. (2026, October 15). *Currency composition of settlements* [Data]. https://cbr.ru/vfs/eng/statistics/credit_statistics/cur_str_new_e.xlsx.',
      },
      {
        id: '5',
        text: "Author's calculations based on UN Comtrade. (2026, October 25). *UN Comtrade database* [Data]. https://comtradeplus.un.org/.",
      },
    ],
    nodeIds: ['N-P026', 'N-P030'],
  },
  {
    source: 'report-en.md, Introduction',
    slug: 'introduction',
    title: 'Introduction',
    blocks: [
      {
        kind: 'p',
        text: 'Sanctions against Russia did not begin in 2022. As early as 2014, when Russia annexed Crimea, the European Union froze the assets of 21 Russian and Crimean officials. It then barred the five largest Russian state banks from raising debt on its markets with a maturity above 90 days. It also restricted sales of oil technology and of dual-use goods meant for the army.[^6] Later, in December 2016, the United States kept its sanctions in place until Russia implemented the Minsk agreements, signed in 2014 and 2015 to stop the fighting in eastern Ukraine.[^7] By contrast, after the invasion of Ukraine on 24 February 2022, the measures changed scale: an embargo on Russian oil, a price cap on Russian oil sold elsewhere, and bans on ports and banks (figure 1).',
      },
      {
        kind: 'p',
        text: 'Yet the war goes on in 2026, and the Russian state manages to pay for it. At constant prices, the defence budget planned for 2025 is 2.6 times the spending of 2021,[^8] while over the same period oil and gas revenue falls by 36%.[^9] If that revenue shrinks while war spending rises, which channels carry the money and the goods of the war?',
      },
      {
        kind: 'li',
        text: 'Which nodes (companies, ports, fleets, banks) make it possible to finance the war?',
      },
      { kind: 'li', text: 'Who owns them?' },
      { kind: 'li', text: 'How do they get around the sanctions?' },
    ],
    notes: [
      {
        id: '6',
        text: 'Council Regulation (EU) No 269/2014, Annex I (CELEX 32014R0269); Council Regulation (EU) No 833/2014, Arts. 2–5 (CELEX 32014R0833). https://eur-lex.europa.eu.',
      },
      {
        id: '7',
        text: "U.S. Department of the Treasury. (2016, December 20). *Treasury Sanctions Individuals and Entities In Connection with Russia's Occupation of Crimea and the Conflict in Ukraine* (press release jl0688). https://home.treasury.gov/news/press-releases/jl0688.",
      },
      {
        id: '8',
        text: 'Author\'s calculations based on Ministry of Finance of the Russian Federation (2026a), op. cit., n. 3, line 2.2 "Национальная оборона" [National defence], year 2021; Korsunskaya, D. (2024, September 30). *Траты России на оборону в 25г вырастут до 13,5 трлн р, более чем вдвое обогнав социальные расходы* [Russian defence spending in 2025 will rise to 13.5 trillion roubles, more than twice social spending]. Reuters, in The Moscow Times (Russian service). https://ru.themoscowtimes.com/2024/09/30/update-1-traty-rossii-na-oboronu-v-25g-vyrastut-do-135-trln-r-bolee-chem-vdvoe-obognav-sotsialnye-raskhody-a143572; World Bank. (2026). *Inflation, GDP deflator (annual %) – Russian Federation (NY.GDP.DEFL.KD.ZG)*. https://api.worldbank.org/v2/country/RUS/indicator/NY.GDP.DEFL.KD.ZG.',
      },
      {
        id: '9',
        text: "Author's calculations based on Ministry of Finance of the Russian Federation (2026a), op. cit., n. 3, line 1.1; World Bank (2026), op. cit., n. 8.",
      },
    ],
    nodeIds: [],
  },
  {
    source: 'report-en.md, 1 Method',
    slug: 'method-chronology',
    title: 'Method',
    blocks: [
      {
        kind: 'p',
        text: 'A long war is paid for twice: with the money that comes in, and with the goods that must be bought to make weapons. To follow this double flow despite the sanctions, the report does not start from the national totals of the Russian economy. It starts from the precise points through which the money and the goods must pass.',
      },
      { kind: 'h3', text: 'The three layers' },
      {
        kind: 'p',
        text: 'The report therefore divides the Russian economy into nodes: sites (a port, a factory, a gas field), companies, fleets of ships or payment channels (a bank, a platform, a digital token). Each node serves one of three functions, which the report calls layers:',
      },
      {
        kind: 'li',
        text: '**Pay:** Earn the foreign currency that pays for the war, mainly by selling oil and gas;',
      },
      { kind: 'li', text: '**Finance:** Move that money, through banks and payment channels;' },
      { kind: 'li', text: '**Fight:** Import the components and make the weapons.' },
      {
        kind: 'p',
        text: 'These three layers follow the path of the money (figure 2). The foreign-currency revenue of the pay layer settles the imports of the fight layer, and this settlement passes through the finance layer. In parallel, taxes on oil and gas fill the budget, which orders weapons from Russian factories. A sanction can therefore target the inflow, the transit or the outflow of the money, and the report examines all three.',
      },
      { kind: 'h3', text: 'Critical nodes' },
      { kind: 'p', text: 'A node is called critical when it meets three conditions:' },
      {
        kind: 'li',
        text: '**Exposed to sanctions:** The European Union (EU), the American Office of Foreign Assets Control (OFAC) or the United Kingdom designates it, or a designated person owns 50% or more of it;',
      },
      {
        kind: 'li',
        text: '**Active in 2024-2026:** A dated production, transit or new designation shows it;',
      },
      {
        kind: 'li',
        text: '**Runs through a third country:** Its head office, the flag of its ships or a counterparty is in a country that does not apply the sanctions of the coalition (the EU, the United States, the United Kingdom and their allies).',
      },
      {
        kind: 'figure',
        text: 'Figure 2: The three layers of the Russian war economy and their links. Diagram by the author.',
        figure: {
          number: 2,
          title: 'The three layers of the Russian war economy and their links',
          unit: '',
          period: '',
          sources: 'Diagram by the author.',
        },
      },
      {
        kind: 'p',
        text: 'These conditions single out the nodes where the sanctions are in place but the activity continues through a third country: where the circumvention can be seen, and where a new measure could have an effect.',
      },
      {
        kind: 'p',
        text: 'The choice of period follows the calendar of the sanctions. By 2024, the major oil measures are in place: the embargo, the price cap, and then the first designations of shipowners that do not respect that cap.[^11] The years 2024-2026 therefore show how trade has adapted to these sanctions. After each measure, the report looks for correlations between the sanctions and trade, and then proposes explanations, each one attributed to its source, or presented as a hypothesis when no source establishes it.',
      },
      {
        kind: 'figure',
        text: 'Figure 1: Timeline of the main sanctions, 2014-2026. Data: Regulations (EU) No 269/2014 and No 833/2014; Regulations (EU) 2022/879, 2022/2367, 2023/250, 2025/395, 2025/1494 and 2026/506; Implementing Regulations (EU) 2022/2368, 2023/251 and 2026/124; U.S. Department of the Treasury (2023); Office of Foreign Assets Control (2025).[^10]',
        figure: {
          number: 1,
          title: 'Timeline of the main sanctions',
          unit: '',
          period: '2014-2026',
          sources:
            'Regulations (EU) No 269/2014 and No 833/2014; Regulations (EU) 2022/879, 2022/2367, 2023/250, 2025/395, 2025/1494 and 2026/506; Implementing Regulations (EU) 2022/2368, 2023/251 and 2026/124; U.S. Department of the Treasury (2023); Office of Foreign Assets Control (2025).[^10]',
        },
      },
      { kind: 'h3', text: 'The data and its control' },
      {
        kind: 'p',
        text: 'The data come from a database of nearly 5,200 entities (companies, ships, sites, ports, banks, people and legal acts) and the relations between them, such as a designation, an ownership, the management of a ship, a port call, an oil flow or a payment. These facts are taken from the official sanctions lists, company registers and published investigations, and each one points to the archived document that establishes it. The reliability of each official source follows the ADMIRALTY scale, which rates the issuer with a letter, from A for an official issuer (sanctions list, company register, official journal) to F when the issuer cannot be judged.',
      },
      {
        kind: 'p',
        text: 'In total, 493 nodes are critical, counting the ships of one management company as a single node. The pay layer holds the most, because the lists of designated ships are long and well documented. For at least 416 of them, the three conditions rest on a document from an official issuer. Annex A describes how the facts are collected and checked.',
      },
    ],
    notes: [
      {
        id: '10',
        text: "EU. (2014–2026). Regulations (EU) No 269/2014, No 833/2014, 2022/879, 2022/2367, 2022/2368, 2023/250, 2023/251, 2025/395, 2025/1494, 2026/506; Implementing Regulation (EU) 2026/124. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0269 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0833 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R0879 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2367 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2368 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0250 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0251 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025R0395 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025R1494 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R0506 ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R0124 ; U.S. Department of the Treasury. (2023, October 12). *Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia's War Machine* (press release jy1795). https://home.treasury.gov/news/press-releases/jy1795 ; Office of Foreign Assets Control. (2025, October 22). *Russia-related Designations; Issuance of New and Amended Russia-related General Licenses* (Recent Actions 20251022). https://ofac.treasury.gov/recent-actions/20251022.",
      },
      {
        id: '11',
        text: 'U.S. Department of the Treasury (2023), op. cit., n. 10.',
      },
    ],
    nodeIds: [],
  },
  {
    source: 'report-en.md, 2 Pay, sections 2.1 to 2.3',
    slug: 'pay',
    title: 'Pay',
    nodeIds: ['N-P026', 'N-P030'],
    blocks: [
      {
        kind: 'p',
        text: 'Oil and gas carry the Russian economy. They are the most discussed topic and often the worst understood. In 2021, their rent (what they earn beyond their cost of production) was worth about a sixth of GDP;[^12] fuels made up more than 40% of goods exports,[^13] and oil and gas brought in more than a third of federal budget revenue.[^14] If sanctions were to dry up the money of the war, this is where they should bite first.',
      },
      { kind: 'h3', text: 'The buyers' },
      {
        kind: 'p',
        text: "From 2022, the EU almost closed its market to Russian oil, with an embargo on crude carried by sea, then on oil products.[^15] It also cut its purchases of Russian gas, then decided in January 2026 to stop them in stages.[^16] By contrast, Asia took over (figure 3): China became Russia's first customer, and India bought twenty times as much Russian crude in 2025 as in 2021.[^17] Two reasons explain this shift:[^18]",
      },
      {
        kind: 'li',
        text: '**Price:** Sold at a discount, Russian crude stays cheaper for the buyer;',
      },
      {
        kind: 'li',
        text: '**Politics:** China and India do not apply the sanctions, and their leaders do not want to look as if they yield to the United States.',
      },
      {
        kind: 'p',
        text: 'Gas follows the same path to Asia: in 2025, for the first time, Gazprom delivered more gas by pipeline to China than to Europe.[^19]',
      },
      {
        kind: 'p',
        text: "But China sets the terms. To sell the gas of the Yamal peninsula, which Europe no longer buys, Russia has only one possible customer. That customer is in no hurry to seal a deal on the new Power of Siberia 2 pipeline: China does not want to depend too much on a single supplier, and it knows that Russia has no other buyer.[^20] The report's hypothesis is that the gas sold to China therefore replaces the volumes lost in Europe, but not their revenue.",
      },
      {
        kind: 'figure',
        text: "Figure 3: Russian exports by buyer and crude bought from Russia, 2020-2025. Data: Bahí Esteba et al. (2026); Eurostat (2026); UN Comtrade (2026); CREA (2026). Author's calculations.[^21]",
        figure: {
          number: 3,
          title: 'Russian exports by buyer and crude bought from Russia',
          unit: 'billion US dollars; million tonnes',
          period: '2020-2025',
          sources:
            "Bahí Esteba et al. (2026); Eurostat (2026); UN Comtrade (2026); CREA (2026). Author's calculations.[^21]",
        },
      },
      { kind: 'h3', text: 'The price and the cap' },
      {
        kind: 'p',
        text: 'To measure what Russia loses on each barrel, the report compares its oil with Brent, the North Sea oil that serves as the reference price. Urals, the main Russian crude exported, is heavier and higher in sulphur, so a little cheaper. In 2019, before the war, this price gap, called the discount, averaged less than $1 a barrel from January to September.[^22]',
      },
      {
        kind: 'p',
        text: 'Since December 2022, an EU company or a company of its allies can no longer carry, insure or finance Russian crude sold above a price cap (figure 4).[^23] The coalition chose a cap rather than a full embargo because it pursues two aims at once: reducing the oil profits that let Russia wage the war, and keeping world energy markets stable and well supplied.[^24]',
      },
      {
        kind: 'figure',
        text: 'Figure 4: Brent, Urals and the EU price cap, 2022-2026. Data: Federal Tax Service of Russia (2023-2026); Ministry of Finance of Russia (2023); Ministry of Economic Development of Russia (2026); World Bank (2026); EU regulations (2022-2026).[^25]',
        figure: {
          number: 4,
          title: 'Brent, Urals and the EU price cap',
          unit: 'dollars per barrel',
          period: '2022-2026',
          sources:
            'Federal Tax Service of Russia (2023-2026); Ministry of Finance of Russia (2023); Ministry of Economic Development of Russia (2026); World Bank (2026); EU regulations (2022-2026).[^25]',
        },
      },
      {
        kind: 'p',
        text: 'As long as Urals stays above the cap, it travels mostly on ships and with insurers outside the coalition, which the cap does not bind (section 2.5).[^26] Its price falls all the same, well beyond what the quality gap explains: sanctions push it down.[^27] The gap widened again after October 2025, when OFAC designated [[N-P026|Rosneft]] and [[N-P030|Lukoil]], two large Russian oil groups,[^28] and several Indian refiners stopped buying.[^29] From August 2023 to October 2025, Urals was worth $10 to $16 less than Brent each month; since November 2025, it has been worth $19 to $27 less.[^30] The report sees a probable effect of this designation, without being able to measure it, because the series shows only a coincidence of dates.',
      },
      {
        kind: 'p',
        text: 'For the buyers who stayed loyal, this fall is a windfall. Refiners in India, China and Turkey keep buying Russian crude through intermediaries, and the pressure of sanctions on its price improves their margins.[^31] China, in particular, has paid less for this crude than for that of its other suppliers since 2022. Moscow thus yields part of its oil rent to China, because it cannot lose its first customer.[^32]',
      },
      { kind: 'h3', text: 'The budget' },
      {
        kind: 'p',
        text: 'Oil taxation in Russia is based on the Urals price.[^33] A bigger discount therefore cuts what the state, which pays for the war, draws from each barrel: a 10% discount on sales to China alone costs the Russian Treasury about $3 billion a year.[^34]',
      },
      {
        kind: 'p',
        text: 'The share of oil and gas in federal revenue falls (figure 5) for two reasons, and the first is a real decline in that revenue. In current roubles, it fell by about a quarter from 2024 to 2025, mostly because of a lower oil price, then fell again from January to September 2026.[^35] This time, however, the Urals price in roubles rose. The fall comes instead from a strong rouble and from a rise in the "damper" (in Russian *dempfer*), a payment from the state to oil companies that increases with world fuel prices.[^36]',
      },
      {
        kind: 'figure',
        text: "Figure 5: Oil, gas and defence in the federal budget, 2014-2026. Data: Ministry of Finance of Russia (2026); Korsunskaya (2024); World Bank (2026). Author's calculations.[^37]",
        figure: {
          number: 5,
          title: 'Oil, gas and defence in the federal budget',
          unit: '%; trillion 2021 roubles',
          period: '2014-2026',
          sources:
            "Ministry of Finance of Russia (2026); Korsunskaya (2024); World Bank (2026). Author's calculations.[^37]",
        },
      },
      {
        kind: 'p',
        text: 'The rest of the economy also pays more, and this is the second reason for the fall. Profit tax went from 20 to 25% in 2025, and VAT from 20 to 22% in 2026.[^38] This shift is deliberate: the budget guidelines of the Ministry of Finance for 2026-2028 present the VAT rise as a way to bring the share of non-oil-and-gas revenue to 80%.[^39]',
      },
      {
        kind: 'p',
        text: "The report's hypothesis is that an ever more expensive defence rests more and more on other taxes and on the deficit. Because budget money is fungible (a rouble of oil revenue cannot be told from any other), figure 5 does not say that oil pays for defence.",
      },
    ],
    notes: [
      {
        id: '12',
        text: "Author's calculations based on World Bank. (2026). *Oil rents (% of GDP) – Russian Federation (NY.GDP.PETR.RT.ZS)*. https://api.worldbank.org ; World Bank. (2026). *Natural gas rents (% of GDP) – Russian Federation (NY.GDP.NGAS.RT.ZS)*. https://api.worldbank.org.",
      },
      {
        id: '13',
        text: 'World Bank. (2026, October 8). *Fuel exports (% of merchandise exports) – Russian Federation (TX.VAL.FUEL.ZS.UN)* [Data]. https://api.worldbank.org.',
      },
      {
        id: '14',
        text: "Author's calculations based on Ministry of Finance of the Russian Federation (2026a), op. cit., n. 3, lines 1 and 1.1, year 2021.",
      },
      { id: '15', text: 'CELEX 32022R0879, Art. 3m ; https://eur-lex.europa.eu.' },
      { id: '16', text: 'CELEX 32026R0261, recitals 1 and 10 ; https://eur-lex.europa.eu.' },
      {
        id: '17',
        text: "Bahí Esteba et al. (2026), op. cit., n. 1, fig. 2 ; Author's calculations based on UN Comtrade (2026), op. cit., n. 5.",
      },
      {
        id: '18',
        text: 'Kpler. (2025, December 2). *Rosneft and Lukoil sanctions are live: how India, China and Turkey adapt rather than exit*. Kpler. https://www.kpler.com/blog/rosneft-and-lukoil-sanctions-are-live-how-india-china-and-turkey-adapt-rather-than-exit.',
      },
      {
        id: '19',
        text: 'Interfax. (2026, January 13). *Gazprom supplies 38.8 bcm of gas to China in 2025, for first time more than towards west – company*. Interfax. https://interfax.com/newsroom/top-stories/115552/.',
      },
      {
        id: '20',
        text: 'Vakulenko, S. (2025, September 22). *Why Can’t Russia and China Agree on the Power of Siberia 2 Gas Pipeline?* Carnegie Politika. Carnegie Endowment for International Peace. https://carnegieendowment.org/russia-eurasia/politika/2025/09/russia-china-gas-deals.',
      },
      {
        id: '21',
        text: 'Bahí Esteba et al. (2026), op. cit., n. 1, fig. 2 ; Eurostat. (2026). *International trade of EU and non-EU countries since 2002 by CN8 (DS-045409)*. https://ec.europa.eu ; UN Comtrade (2026), op. cit., n. 5 ; Centre for Research on Energy and Clean Air (CREA). (2026). *Russia Fossil Tracker*. https://api.russiafossiltracker.com.',
      },
      {
        id: '22',
        text: 'Yagova, O., & Gorodyankin, G. (2019, October 11). *IMO 2020 regulations challenge Russian Urals crude*. Reuters, reprinted by Hydrocarbon Processing. https://www.hydrocarbonprocessing.com/news/2019/10/imo-2020-regulations-challenge-russian-urals-crude.',
      },
      { id: '23', text: 'CELEX 32022R2367, Art. 3n ; https://eur-lex.europa.eu.' },
      { id: '24', text: 'U.S. Department of the Treasury (2023), op. cit., n. 10.' },
      {
        id: '25',
        text: 'Federal Tax Service of Russia. (2023–2026). [Data for the calculation of the mineral extraction tax, monthly releases]. https://www.nalog.gov.ru/rn77/news/activities_fts/ (one page per month, for example *Опубликованы данные для расчёта НДПИ и НДД, а также акциза на нефтяное сырье за июль 2026 года* [Data published for the calculation of the mineral extraction tax and the additional income tax, and of the excise on crude, for July 2026], https://www.nalog.gov.ru/rn77/news/activities_fts/16643613/) ; World Bank. (2026, October 2). *Commodity Price Data (The Pink Sheet)* [Data, monthly prices]. https://www.worldbank.org/en/research/commodity-markets ; CELEX 32022R2367, 32022R2368, 32025R1494, 32026R0124.',
      },
      { id: '26', text: 'Dodonov et al. (2026), op. cit., n. 2, p. 3.' },
      { id: '27', text: 'Kpler (2025), op. cit., n. 18.' },
      { id: '28', text: 'OFAC (2025), op. cit., n. 10.' },
      { id: '29', text: 'Dodonov et al. (2026), op. cit., n. 2, p. 2.' },
      {
        id: '30',
        text: "Author's calculations based on World Bank. (2026, October 2). *Commodity Price Data (The Pink Sheet)* [Data, monthly prices]. https://www.worldbank.org/en/research/commodity-markets ; Federal Tax Service of Russia. (2023–2026). [Data for the calculation of the mineral extraction tax, monthly releases]. https://www.nalog.gov.ru/rn77/news/activities_fts/ (one page per month, for example *Опубликованы данные для расчёта НДПИ и НДД, а также акциза на нефтяное сырье за июль 2026 года* [Data published for the calculation of the mineral extraction tax and the additional income tax, and of the excise on crude, for July 2026], https://www.nalog.gov.ru/rn77/news/activities_fts/16643613/). Urals: monthly average price published by the Ministry of Economic Development; Brent: World Bank monthly average.",
      },
      { id: '31', text: 'Kpler (2025), op. cit., n. 18.' },
      {
        id: '32',
        text: 'Deryugina, T., & Shepotylo, O. (2026, September). *China’s Support for Russia* (Policy Brief No. 4). econ4ua. https://econ4ua.org/wp-content/uploads/2026/09/Chinas-Support-for-Russia-Final.pdf, p. 4.',
      },
      {
        id: '33',
        text: 'Federal Tax Service of Russia (2026), op. cit., n. 25 ; Ministry of Economic Development of the Russian Federation. (2026, October 2). *О среднем уровне цен нефти сорта «Юралс» за сентябрь 2026 года* [On the average price level of Urals oil for September 2026]. https://www.economy.gov.ru/material/departments/d12/konyunktura_mirovyh_tovarnyh_rynkov/o_srednem_urovne_cen_nefti_sorta_yurals_za_sentyabr_2026_goda.html.',
      },
      { id: '34', text: 'Deryugina and Shepotylo (2026), op. cit., n. 32, pp. 4–5.' },
      {
        id: '35',
        text: 'Ministry of Finance of the Russian Federation (2026a), op. cit., n. 3, line 1.1 "Нефтегазовые доходы" [Oil and gas revenue] ; Ministry of Finance of the Russian Federation. (2025, October 9). *Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2025 года* [Preliminary estimate of the execution of the federal budget for January–September 2025]. https://minfin.gov.ru/ru/press-center/?id_4=39967-predvaritelnaya_otsenka_ispolneniya_federalnogo_byudzheta_za_yanvar-sentyabr_2025_goda, p. 1.',
      },
      {
        id: '36',
        text: 'Ministry of Finance of the Russian Federation (2026b), op. cit., n. 3, p. 1 and table ; Nezavisimaya Gazeta. (2026, October 6). *Выплаты нефтяникам установили очередной рекорд* [Payments to oil companies set a new record]. https://www.ng.ru/economics/2026-10-06/1_9597_price.html.',
      },
      {
        id: '37',
        text: "Author's calculations based on Ministry of Finance of the Russian Federation (2026a), op. cit., n. 3, lines 1, 1.1 and 2.2 ; Ministry of Finance of the Russian Federation (2026b), op. cit., n. 3 ; Korsunskaya (2024), op. cit., n. 8 ; World Bank (2026), op. cit., n. 8.",
      },
      {
        id: '38',
        text: 'Federal Tax Service of Russia. (2025, January 20). *Ставка налога на прибыль организаций изменилась с 2025 года* [The corporate profit tax rate changed from 2025]. https://www.nalog.gov.ru/rn27/news/tax_doc_news/15617353/ ; Federal Tax Service of Russia. (2025, December 17). *Как исчислять НДС по новым правилам с 2026 года* [How to calculate VAT under the new rules from 2026]. https://www.nalog.gov.ru/rn25/news/activities_fts/16590316/.',
      },
      {
        id: '39',
        text: 'Ministry of Finance of the Russian Federation. (2025, October 3). *Информация Минфина России от 03.10.2025 «Основные направления бюджетной, налоговой и таможенно-тарифной политики на 2026 год и на плановый период 2027 и 2028 годов»* [Information of the Ministry of Finance of Russia of 3 October 2025, "Main directions of budget, tax and customs tariff policy for 2026 and for the planning period 2027 and 2028"]. Garant. https://base.garant.ru/412797173/, pp. 21, 30.',
      },
    ],
  },
  {
    source: 'report-en.md, 2 Pay, sections 2.4 to 2.6',
    slug: 'ports-fleet',
    title: 'Exporting through the ports and the fleet',
    nodeIds: ['N-P001', 'N-P002', 'N-P005', 'N-P011', 'N-P007', 'N-P025'],
    blocks: [
      { kind: 'h3', text: 'The ports' },
      {
        kind: 'p',
        text: 'Russian crude that does not leave by pipeline leaves Russia through a few ports, mainly [[N-P001|Primorsk]] and [[N-P002|Ust-Luga]] on the Baltic, [[N-P005|Novorossiysk]] on the Black Sea and [[N-P007|Kozmino]] on the Pacific.[^40] Traffic at the first three, all goods included, held up despite the embargo: in 2025, it exceeded its 2021 level (figure 6).[^41]',
      },
      {
        kind: 'p',
        text: 'Sanctions ended up targeting these ports themselves. Since February 2025, an EU company can no longer deal with the ports on the Baltic and the Black Sea, and since April 2026 with [[N-P011|Tuapse]] and Murmansk.[^42] Like the price cap, these measures bind only the companies of the coalition.',
      },
      { kind: 'h3', text: 'The fleet' },
      {
        kind: 'p',
        text: 'To leave ports closed to companies of the coalition, the crude needs ships that do not depend on them. These are mostly the tankers of the so-called "shadow fleet", tied to a country outside the coalition and with no Western insurance.[^43] Neither the cap nor the port ban touches them. The report\'s hypothesis is that their growth since the embargo explains why port traffic held up until 2025.',
      },
      {
        kind: 'figure',
        text: 'Figure 6: Traffic at Russian oil ports, 2014-2026. Data: ASOP (2022; 2026); PortNews (2018; 2019; 2021); NMTP (2017; 2020); Dodonov et al. (2026).[^44]',
        figure: {
          number: 6,
          title: 'Traffic at Russian oil ports',
          period: '2014-2026',
          sources:
            'ASOP (2022; 2026); PortNews (2018; 2019; 2021); NMTP (2017; 2020); Dodonov et al. (2026).[^44]',
        },
      },
      {
        kind: 'p',
        text: 'Most Russian crude exported by sea travels on these ships (figure 7). On their sterns fly mostly the flags of Panama, Barbados, Gabon or Sierra Leone. These flags of convenience also serve ordinary trade, so a flag alone does not signal circumvention. The companies that manage the tankers say more, because they are often based outside Russia. [[N-P025|Совкомфлот (Sovcomflot)]], the Russian state shipowner, thus transferred the management of tankers to Stream Ship Management, based in the United Arab Emirates. The United States designated that company for this reason.[^45]',
      },
      {
        kind: 'figure',
        text: 'Figure 7: Russian oil exported by sea, January 2026. Data: Dodonov et al. (2026); Raghunandan et al. (2026), based on Kpler.[^48]',
        figure: {
          number: 7,
          title: 'Russian oil exported by sea',
          period: 'January 2026',
          sources: 'Dodonov et al. (2026); Raghunandan et al. (2026), based on Kpler.[^48]',
        },
      },
      { kind: 'h3', text: 'Vessel sanctions' },
      {
        kind: 'p',
        text: 'Sanctions also target the ships themselves, by their International Maritime Organization (IMO) number, which never changes, while their name, flag, owner and AIS (automatic identification system) identity can change. Designation, however, does not stop port calls (figure 8).[^46] In December 2025, more than one designated tanker in five still loads Russian oil.[^47]',
      },
      {
        kind: 'figure',
        text: "Figure 8: Port calls of designated tankers after their designation. Data: Global Fishing Watch (2026); Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Author's calculations.[^50]",
        figure: {
          number: 8,
          title: 'Port calls of designated tankers after their designation',
          unit: 'ships',
          sources:
            "Global Fishing Watch (2026); Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Author's calculations.[^50]",
        },
      },
      {
        kind: 'p',
        text: 'The three sanctions regimes do not move at the same pace. When the EU and the United States designate the same ship, the United States does so first in nearly nine cases out of ten (figure 9).[^49]',
      },
      {
        kind: 'p',
        text: 'A designated ship also often changes hands. In a non-random sample of 100 designated ships, Ukrainian military intelligence (GUR), a party to the conflict, dates a change of owner or manager after designation for 81 of them.[^51]',
      },
      {
        kind: 'p',
        text: "A list of ships therefore describes a situation that the ship has often already left. The report's hypothesis is that targeting the company that manages the tankers, and the country where it is based, would reach the fleet more surely than targeting each ship.",
      },
      {
        kind: 'figure',
        text: "Figure 9: Tankers designated by the EU, the United Kingdom and OFAC. Data: Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Author's calculations.[^52]",
        figure: {
          number: 9,
          title: 'Tankers designated by the EU, the United Kingdom and OFAC',
          sources:
            "Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Author's calculations.[^52]",
        },
      },
    ],
    notes: [
      {
        id: '40',
        text: 'U.S. Department of the Treasury (2023), op. cit., n. 10 ; S&P Global Commodity Insights. (2024, January 10). *Russian Kozmino crude exports jump 9.4% in 2023 amid sanctions*. https://www.spglobal.com.',
      },
      {
        id: '41',
        text: 'ASOP (2022; 2026; 2026). https://www.morport.com, p. 1 ; PortNews (2018; 2019; 2021). https://portnews.ru ; NMTP (2017). https://en.portnews.ru, pp. 7–8 ; NMTP (2020). https://fs.moex.com, p. 1 ; Dodonov et al. (2026), op. cit., n. 2, p. 3.',
      },
      {
        id: '42',
        text: 'CELEX 32025R0395, Annex XIV ; CELEX 32026R0506, Annex XVI ; https://eur-lex.europa.eu.',
      },
      { id: '43', text: 'See n. 2.' },
      { id: '44', text: 'See n. 41.' },
      {
        id: '45',
        text: 'U.S. Department of the Treasury. (2025, January 10). *Treasury Intensifies Sanctions Against Russia by Targeting Russia’s Oil Production and Exports* (press release jy2777). https://home.treasury.gov/news/press-releases/jy2777, Annex 2.',
      },
      {
        id: '46',
        text: "Author's calculations based on Global Fishing Watch (2026). https://globalfishingwatch.org ; OFAC (2026). https://sanctionslistservice.ofac.treas.gov ; FCDO (2026). https://sanctionslist.fcdo.gov.uk ; CELEX 32014R0833 ; https://eur-lex.europa.eu.",
      },
      { id: '47', text: 'Dodonov et al. (2026), op. cit., n. 2, p. 2.' },
      {
        id: '48',
        text: 'Dodonov et al. (2026), op. cit., n. 2, pp. 2–8 ; Raghunandan, V. et al. (2026, February 18). *January 2026 — Monthly analysis of Russian fossil fuel exports and sanctions*. Centre for Research on Energy and Clean Air. https://energyandcleanair.org.',
      },
      {
        id: '49',
        text: "Author's calculations based on OFAC (2026), op. cit., n. 46 ; CELEX 32014R0833 ; https://eur-lex.europa.eu.",
      },
      { id: '50', text: 'See n. 46.' },
      {
        id: '51',
        text: "Author's calculations based on GUR. (2026). *War & Sanctions*. https://war-sanctions.gur.gov.ua ; OFAC (2026), op. cit., n. 46 ; FCDO (2026), op. cit., n. 46 ; CELEX 32014R0833 ; https://eur-lex.europa.eu.",
      },
      {
        id: '52',
        text: "Author's calculations based on OFAC (2026), op. cit., n. 46 ; FCDO (2026), op. cit., n. 46 ; CELEX 32014R0833, retrieved October 30, 2026 ; https://eur-lex.europa.eu.",
      },
    ],
  },
  {
    source: 'report-en.md, 3 Finance',
    slug: 'finance',
    title: 'Finance: the rouble replaces the dollar and the euro',
    nodeIds: ['N-M002', 'N-M008', 'N-M003', 'N-M004', 'N-M009', 'N-M007', 'N-M037', 'N-M040'],
    blocks: [
      {
        kind: 'p',
        text: 'Selling oil is not enough: Russia must also be paid, and then pay its foreign suppliers in turn. Before the war, most of these payments went through the dollar and the euro, and so through banks that the coalition controls. The question is where the money flows when those banks shut Russia out.',
      },
      { kind: 'h3', text: 'The rouble and the yuan' },
      {
        kind: 'p',
        text: 'From 2022, the large Russian banks, including [[N-M002|VTB]] and [[N-M008|Sberbank]], were designated by the United States[^53] and by the United Kingdom,[^54] and several were removed from SWIFT, on top of the freezing of their assets.[^55] Russian firms then moved from the currencies of "unfriendly" countries, such as the dollar and the euro, to the rouble and to other currencies, such as the yuan (figure 10).[^56]',
      },
      {
        kind: 'figure',
        text: 'Figure 10: Settlement currency of Russian exports and imports, 2019-2025. Data: Central Bank of Russia (2026).[^57]',
        figure: {
          number: 10,
          title: 'Settlement currency of Russian exports and imports',
          unit: 'percentage of total',
          period: '2019-2025',
          sources: 'Central Bank of Russia (2026).[^57]',
        },
      },
      {
        kind: 'p',
        text: "With China, the shift goes further. At the end of 2023, the yuan settled as many exports as the rouble,[^58] and the rouble and the yuan settle almost all payments between the two countries.[^59] This choice protects the trade from sanctions, but it ties Russia to a partner that accounts for about 40% of its trade, while Russia accounts for only a few per cent of Chinese trade.[^60] On the report's hypothesis, China can therefore set its terms.",
      },
      { kind: 'h3', text: 'Payment relays' },
      {
        kind: 'p',
        text: 'A payment in yuan is still exposed to US sanctions. A bank that settles in yuan still needs the dollar for the rest of its business. US Executive Order 14114, of December 2023, exposes to sanctions any foreign bank that helps the Russian military-industrial base. In June 2024, this risk extended to any significant transaction with VTB or Sberbank.[^61] Banks in third countries therefore withdrew. The Chinese bank that served as the main channel for Russian importers cut its ties with them in February 2024,[^62] Turkish and Emirati banks returned transfers or closed accounts,[^63] and in the summer of 2024 the Chinese state banks blocked Russian payments "en masse".[^64] Payments then moved through other relays, which the sanctions then followed:',
      },
      {
        kind: 'li',
        text: '**Subsidiaries of Russian banks (China, India, Kazakhstan, Belarus):** The [[N-M003|VTB branch in Shanghai]] became the main route for payments to China.[^65] From June 2024, the US Treasury included the VTB and Sberbank offices in China and India in their designations;[^66] the EU then banned transactions with VTB Shanghai and with the VTB subsidiaries in [[N-M004|Kazakhstan]] and Belarus,[^67] and then, in 2026, with [[N-M009|Sberbank India]] and [[N-M007|India VTB]].[^68]',
      },
      {
        kind: 'li',
        text: '**Small Chinese border banks (Heihe, Suifenhe):** They took over from the state banks, and the EU targeted two of them in 2025 and removed them in 2026.[^69]',
      },
      {
        kind: 'li',
        text: '**Banks in Central Asia and Armenia (Kyrgyzstan, Kazakhstan, Armenia):** In 2024, Armenian and Kazakh banks stopped accepting the Russian Mir card, because of the risk of secondary sanctions.[^70] Kyrgyzstan then concentrated rouble payments in two state banks,[^71] which the EU targeted in 2026, after two other Kyrgyz banks.[^72]',
      },
      {
        kind: 'li',
        text: "**Payment agents (Russia, China, Hong Kong, Kazakhstan):** Some sit in Russia and some on the supplier's side. They receive the importer's roubles and pay in its place; in 2024, their share of cross-border payments rose from under 20% to up to 80%, according to Vedomosti, quoted by The Bell.[^73]",
      },
      {
        kind: 'li',
        text: '**SPFS:** The Russian equivalent of SWIFT is open to foreign banks, which OFAC threatens to designate if they join it.[^74]',
      },
      {
        kind: 'p',
        text: 'The best-known payment agent, [[N-M037|A7]], hands each payment to a sub-agent in a third country, such as Hong Kong or Kyrgyzstan, and settles the counterparty in [[N-M040|A7A5]], a digital token worth one rouble.[^75] After the US, UK and EU designations in the second half of 2025, the daily volume of this token fell by 96% between July 2025 and June 2026.[^76]',
      },
      {
        kind: 'p',
        text: 'Some third countries let it happen. The United Arab Emirates welcomes Russian capital and companies without applying Western sanctions. The war against Iran, which has hit the Emirates since February 2026, does not change this line: in August, the Emirates cut their trade with Iran, not with Russia.[^77] Their banks limit some payments with Russia for fear of US sanctions, but no measure by the Emirati state against Russia is known.',
      },
      {
        kind: 'p',
        text: 'The report therefore hypothesises that each wave of designations does not close a channel, but pushes payments towards a smaller relay, further from the dollar. The dollar does not disappear, because the sub-agents of [[N-M037|A7]] still pay in dollars, yuan, dirhams and euros.[^78] The lever therefore remains the bank that keeps this access, and that bank can leave the channel: in 2026, the EU removed three Tajik banks from its list, because they took measures.[^79]',
      },
    ],
    notes: [
      {
        id: '53',
        text: 'U.S. Department of the Treasury. (2022). Press release jy0608. https://home.treasury.gov, p. 1; U.S. Department of the Treasury. (2022). Press release jy0705. https://home.treasury.gov, p. 1.',
      },
      { id: '54', text: 'FCDO (2026), op. cit., n. 46.' },
      { id: '55', text: 'CELEX 32022R0345, Art. 5h; https://eur-lex.europa.eu.' },
      {
        id: '56',
        text: "Prokopenko, A., & Kolyandr, A. (2024, November 2). *The rise of Russia's foreign trade middlemen*. Inside the Russian Economy. The Bell. https://en.thebell.io/the-rise-of-russias-foreign-trade-middlemen/.",
      },
      { id: '57', text: 'Central Bank of Russia (2026), op. cit., n. 4.' },
      {
        id: '58',
        text: 'Central Bank of Russia. (2024, January). *Обзор рисков финансовых рынков* [Review of financial market risks] (No. 1). https://www.cbr.ru/collection/collection/file/48852/orfr_2024-01.pdf, p. 6.',
      },
      {
        id: '59',
        text: 'TASS. (2026, October 23). *National currencies account for nearly 100% of Russia-China settlements*. TASS. https://tass.com/economy/2206739.',
      },
      { id: '60', text: 'Deryugina & Shepotylo (2026), op. cit., n. 32, p. 4.' },
      {
        id: '61',
        text: 'U.S. Department of the Treasury. (2023, December 22). Press release jy2011. https://home.treasury.gov/news/press-releases/jy2011; U.S. Department of the Treasury. (2024, June 12). Press release jy2404. https://home.treasury.gov/news/press-releases/jy2404.',
      },
      {
        id: '62',
        text: 'The Moscow Times. (2024, February 7). *Major Chinese Bank Halts All Settlements With Russia – Vedomosti*. https://www.themoscowtimes.com; The Bell. (2024, February 20). *How Russia uses China to get round sanctions*. https://en.thebell.io/how-russia-uses-china-to-get-round-sanctions/.',
      },
      {
        id: '63',
        text: 'Bloomberg. (2024, January 17). *Turkish Banks Tighten Screws on Russia Over Fear of US Sanctions*. https://www.bloomberg.com; The Moscow Times. (2024, February 19). *UAE Banks Limit Payments With Russia Over Secondary Sanctions Threat – Vedomosti*. https://www.themoscowtimes.com.',
      },
      {
        id: '64',
        text: 'Reuters. (2024, August 30). *Russia payment hurdles with China partners intensified in August, sources say*. The Standard (Hong Kong). https://www.thestandard.com.hk.',
      },
      { id: '65', text: 'Prokopenko & Kolyandr (2024), op. cit., n. 56.' },
      { id: '66', text: 'U.S. Department of the Treasury (2024), op. cit., n. 61.' },
      {
        id: '67',
        text: 'CELEX 32025R0395, Annex XI, p. 383; CELEX 32025R2033, p. 115; https://eur-lex.europa.eu.',
      },
      { id: '68', text: 'CELEX 32026R1848, Annex VIII; https://eur-lex.europa.eu.' },
      {
        id: '69',
        text: 'Reuters. (2024, June). *Russia, China find payments workaround as US sanctions net widens, sources say*. Yahoo News. https://www.yahoo.com/news/russia-china-payments-workaround-us-150733803.html; CELEX 02014R0833-20250720, Annex XLV, Part A; CELEX 32026R0506, Annex XV; https://eur-lex.europa.eu. Reuters does not name the banks; the names come from the EU list.',
      },
      {
        id: '70',
        text: 'RFE/RL. (2024, March 29). *Armenian Banks To Ditch Russian Cards Over U.S. Sanctions*. https://www.rferl.org; Interfax. (2024, April 3). *Most Kazakh banks not servicing Russian Mir cards due to sanctions*. https://interfax.com/newsroom/top-stories/101016/.',
      },
      {
        id: '71',
        text: '24.kg. (2025, April). *New procedure for Russian ruble transactions to be introduced in Kyrgyzstan*. https://24.kg; The Times of Central Asia. (2025, August). *Kyrgyz President Denounces "Politicized" Sanctions on Banks*. https://timesca.com.',
      },
      {
        id: '72',
        text: 'CELEX 32025R2033, Annex XIV, p. 116; CELEX 32026R0506, Annex XV, Part B, p. 70; https://eur-lex.europa.eu.',
      },
      { id: '73', text: 'Prokopenko & Kolyandr (2024), op. cit., n. 56.' },
      {
        id: '74',
        text: 'Central Bank of Russia. (2026). *Bank of Russia Annual Report for 2025*. https://www.cbr.ru, p. 187; OFAC. (2024). *Sanctions Risk for Foreign Financial Institutions that Join Russian Financial Messaging System, System for Transfer of Financial Messages*. https://ofac.treasury.gov.',
      },
      {
        id: '75',
        text: 'Financial Crimes Enforcement Network. (2026, October 1). *FinCEN Alert on the A7 Network* (FIN-2026-Alert007). https://www.fincen.gov/system/files/2026-10/FinCEN-Alert-A7-Network.pdf, pp. 2–5.',
      },
      {
        id: '76',
        text: 'U.S. Department of the Treasury. (2025, August 14). *Treasury Sanctions Cryptocurrency Exchange and Network Enabling Sanctions Evasion and Cyber Criminals* (press release sb0225). https://home.treasury.gov/news/press-releases/sb0225, p. 1; Elliptic. (2026, July 29). *The fall of A7A5*. https://www.elliptic.co/insights/the-fall-of-a7a5-how-sanctions-strangled-the-ruble-stablecoin/.',
      },
      {
        id: '77',
        text: 'Bianco, C. (2026). *Little Venice, little Sparta*. European Council on Foreign Relations. https://ecfr.eu/publication/little-venice-little-sparta-the-uaes-statecraft-meets-the-war-on-iran/; Institute for Financial Integrity. (2026). *August monthly sanctions and export controls report*. https://finintegrity.org/?p=11370. For the limits on payments by Emirati banks (last sentence of the paragraph only): The Moscow Times (2024), op. cit., n. 63.',
      },
      { id: '78', text: 'Financial Crimes Enforcement Network (2026), op. cit., n. 75, p. 5.' },
      {
        id: '79',
        text: 'CELEX 32026R0506, recital 14, p. 2, and Annex XV, p. 70; https://eur-lex.europa.eu.',
      },
    ],
  },
  {
    source: 'report-en.md, 4 Fight',
    slug: 'fight',
    title: 'Fight: the same goods, other sellers',
    nodeIds: ['N-F097'],
    blocks: [
      {
        kind: 'p',
        text: 'No modern army can do without on-board electronics. A Russian cruise missile or attack drone contains chips, sensors and engines that Russia does not make, or does not make in sufficient numbers. Oil money must therefore buy these parts abroad, even though the coalition has closed its own markets. What remains to be seen is who now sells these goods, at what price, and by which routes they reach the arms factories.',
      },
      { kind: 'h3', text: 'The suppliers' },
      {
        kind: 'p',
        text: 'Since 2022, the coalition no longer sells to Russia either its military technologies or its dual-use technologies, that is, civilian products, such as chips, that the Russian army can use.[^80] Those most useful to its weapons are gathered in a shared list called CHP (Common High Priority), such as integrated circuits or computer numerical control machine tools.[^81] The report measures these sales through the declarations of the selling countries.',
      },
      {
        kind: 'p',
        text: 'China and Hong Kong take the place of the coalition (figure 11), but in two different roles. China is above all a producer: for most of the dual-use technologies it sells to Russia, its exports rise without its imports rising, and re-export affects only a dozen high-technology products.[^82] Targeting China therefore hits production.',
      },
      {
        kind: 'p',
        text: 'Hong Kong plays another role, that of a platform. It takes a rising share of Russian imports of processors and integrated circuits, in place of the coalition, which may signal re-exported Western chips.[^83] Hong Kong applies only the sanctions decided by the UN Security Council, which do not target Russia: EU and US sanctions have no legal force there. This financial centre also lets a company hide its owner, and lets new companies be created or dissolved quickly. It is therefore a convenient place of transit for shell companies.[^84] Targeting Hong Kong therefore hits the transit and the payment.',
      },
      {
        kind: 'figure',
        text: "Figure 11: Exports of CHP goods to Russia, 2021-2025. Data: UN Comtrade (2026); Risinger et al. (2026). Author's calculations.[^85]",
        figure: {
          number: 11,
          title: 'Exports of CHP goods to Russia',
          unit: 'million current US dollars',
          period: '2021-2025',
          sources: "UN Comtrade (2026); Risinger et al. (2026). Author's calculations.[^85]",
        },
      },
      { kind: 'h3', text: 'The price of the goods' },
      {
        kind: 'p',
        text: 'This change of suppliers has a price. From the spring of 2022, Russian imports became more expensive. The main cause is neither transport nor the detour through neighbouring countries. It is the margins of the suppliers that stayed on the market, which the departure of Western competitors lets them raise, in particular for strategic goods.[^86] Dependence on China sharpens this effect: the premium that Russia pays China for priority goods rises with the Chinese share of its purchases, and for computer numerical control machine tools, with no other seller, Russia must accept the Chinese price.[^87] Sanctions therefore do not cut off access to these goods, but they make them more costly, and this cost is highest for goods bought from China.',
      },
      { kind: 'h3', text: 'The routes of the components' },
      {
        kind: 'p',
        text: "Russia's neighbours can also serve as a route. Armenia, Kazakhstan and Kyrgyzstan, which form a customs union with it,[^88] have sold it far more machinery and electrical equipment since 2021.[^89] To learn which goods end up in weapons, investigators take apart Russian weapons that have fallen in Ukraine and record the brand and date of each component.[^90] Two thirds of the dated parts were made after the invasion: purchases continue despite the controls.[^91] They go through intermediaries, such as [[N-F097|Pixel Devices]] in Hong Kong.[^92] Sanctions lists name many intermediaries and few makers of the parts.[^93]",
      },
      {
        kind: 'p',
        text: "Yet weapon debris gives a biased picture of where the parts come from. The public catalogue of the GUR, a party to the conflict, attributes a US-headquartered brand to two thirds of its components. The report hypothesises that the catalogue first records the coalition's brands, on which sanctions can bear, while a Chinese part with no legible brand more often stays unattributed. Above all, the brand does not say where the part is made. From January to October 2023, by value, 61% of Russian imports of critical components of the brands found in weapons came from companies headquartered in the United States. Only 8% were produced there, against 35% in China.[^94] Tracing a part back along its chain, from factory to weapon, therefore takes shipment-level data, which this report does not have.",
      },
    ],
    notes: [
      {
        id: '80',
        text: 'CELEX 32014R0833, Arts. 2 and 4; European Commission. (2024, February). *List of common high priority items*. https://finance.ec.europa.eu/system/files/2023-09/list-common-high-priority-items_en.pdf; https://eur-lex.europa.eu.',
      },
      {
        id: '81',
        text: 'Risinger, L. et al. (2026, April). *Russian CHP Imports Tracker*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/04/KSE_CHP_tracker_Q1_2026-1.pdf, pp. 1, 9.',
      },
      { id: '82', text: 'Deryugina & Shepotylo (2026), op. cit., n. 32, p. 9.' },
      {
        id: '83',
        text: "Risinger, L., & Hilgenstock, B. (2026, July). *Russian CHP Imports Tracker: Q2 2026*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/07/CHP-Q2-2026-Report.pdf, p. 3; Kot, B. (2023, May 17). *Hong Kong's Technology Lifeline to Russia*. Carnegie Endowment. https://carnegieendowment.org/research/2023/05/hong-kongs-technology-lifeline-to-russia.",
      },
      {
        id: '84',
        text: "Government of the Hong Kong Special Administrative Region. (2019). *LCQ2: Implementation of sanctions imposed by United Nations Security Council*. info.gov.hk/gia/general/201901/23/P2019012300436.htm; USCC. (2025). *China's facilitation of sanctions and export control evasion*. uscc.gov/research.",
      },
      {
        id: '85',
        text: "Author's calculations based on UN Comtrade (2026), op. cit., n. 5; Risinger et al. (2026), op. cit., n. 81, p. 3.",
      },
      {
        id: '86',
        text: 'Emlinger, C., & Lefebvre, K. (2025, February). *Working Around Sanctions. What Cost to Russia?* (Policy Brief No. 50). CEPII. https://www.cepii.fr/PDF_PUB/pb/2025/pb2025-50.pdf, pp. 1, 6, 8.',
      },
      { id: '87', text: 'Risinger & Hilgenstock (2026), op. cit., n. 83, pp. 5–6.' },
      { id: '88', text: 'Risinger et al. (2026), op. cit., n. 81, p. 7.' },
      { id: '89', text: "Author's calculations based on UN Comtrade (2026), op. cit., n. 5." },
      {
        id: '90',
        text: 'Byrne, J. et al. (2022, August). *Silicon Lifeline*. Royal United Services Institute. https://static.rusi.org/RUSI-Silicon-Lifeline-final-updated-web_1.pdf, p. 24.',
      },
      {
        id: '91',
        text: "Author's calculations based on Conflict Armament Research, & Hayes, D. (2025). *Tracking the Components of Missiles and UAVs Used by Russia in Ukraine*. IISS. https://www.iiss.org; Byrne et al. (2022), op. cit., n. 90; GUR. (2026). *War & Sanctions*. https://war-sanctions.gur.gov.ua.",
      },
      {
        id: '92',
        text: "U.S. Department of the Treasury. (2024, May 1). *U.S. Continues to Degrade Russia's Military-Industrial Base and Target Third-Country Support with Nearly 300 New Sanctions* (press release jy2318). https://home.treasury.gov/news/press-releases/jy2318, Annex 1.",
      },
      {
        id: '93',
        text: "U.S. Department of the Treasury. (2024, October 17). *Treasury Targets Actors Involved in Drone Production for Russia's War Against Ukraine* (press release jy2651). https://home.treasury.gov/news/press-releases/jy2651; U.S. Department of State. (2025, January 15). *Sanctions to Disrupt Russia's Military Industrial Base and Sanctions Evasion*. https://2021-2025.state.gov/office-of-the-spokesperson/releases/2025/01/sanctions-to-disrupt-russias-military-industrial-base-and-sanctions-evasion/.",
      },
      {
        id: '94',
        text: "Author's calculations based on GUR. (2026, October 28). *Components in the aggressor's weapon*. War & Sanctions. https://war-sanctions.gur.gov.ua; Bilousova, O., Hilgenstock, B. et al. (2024, January). *Challenges of Export Controls Enforcement*. KSE Institute. https://kse.ua, p. 16.",
      },
    ],
  },
  {
    source: 'report-en.md, 5 Who owns what',
    slug: 'ownership',
    title: 'Who owns what, and what we do not know',
    nodeIds: [
      'N-P026',
      'N-M001',
      'N-P034',
      'N-P025',
      'N-P052',
      'N-P053',
      'N-O003',
      'N-O005',
      'N-O010',
      'N-O015',
      'N-O016',
      'N-O017',
      'N-O019',
      'N-O023',
      'N-O024',
      'N-O032',
      'N-O029',
      'N-O027',
      'N-O030',
      'N-O031',
      'N-O033',
      'N-O034',
      'N-O037',
      'N-O038',
      'N-O039',
      'N-O021',
      'N-O049',
      'N-O044',
      'N-O041',
      'N-O042',
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Behind every port, every tanker and every bank stands an owner: sometimes the state, sometimes a person close to power, sometimes nobody who can be named. Who holds these nodes, and how far does a sanction reach into them?',
      },
      {
        kind: 'p',
        text: 'A sanction does not hit only the companies it names. In the United States, a company owned 50% or more, in aggregate, by designated persons is blocked as well.[^95] The EU applies a test of 50% or more, in aggregate, and the United Kingdom a test of more than 50% that adds control.[^96] Knowing who owns a company therefore tells how far a sanction reaches it. The report traces each chain of shares up to the state, to a person, or to a company with no documented ultimate owner (figure 12).',
      },
      { kind: 'h3', text: 'The state and its holdings' },
      {
        kind: 'p',
        text: 'At the top, the state holds the large companies through a few holdings. A public holding that it owns outright is the first shareholder of [[N-P026|Rosneft]] and, together with the Federal Agency for State Property Management ([[N-O003|Rosimushchestvo]]), gives the state close to half of [[N-O005|Gazprom]].[^97] Gazprom in turn owns almost all of [[N-O010|Gazprom Neft]][^98] and is a main shareholder of [[N-M001|Gazprombank]].[^99] Likewise, the state holds all the voting rights of [[N-P034|Transneft]], which owns the holding of the port of Novorossiysk.[^100] A designation of any of them therefore reaches its subsidiaries owned 50% or more.',
      },
      {
        kind: 'figure',
        text: "Figure 12: Who owns oil, gas and the fleet. Data: OFAC (2026); Regulation (EU) No 269/2014 (2026); FCDO (2026); Rosneft (2021); Gazprom (2024); Gazprombank (2022); TASS (2024). Author's calculations.[^101]",
        figure: {
          number: 12,
          title: 'Who owns oil, gas and the fleet',
          sources:
            "OFAC (2026); Regulation (EU) No 269/2014 (2026); FCDO (2026); Rosneft (2021); Gazprom (2024); Gazprombank (2022); TASS (2024). Author's calculations.[^101]",
        },
      },
      { kind: 'h3', text: 'The fleet' },
      {
        kind: 'p',
        text: "The state fleet follows the same pattern, then slips away from it. [[N-P025|Sovcomflot]], the state shipowner, had its tankers managed by [[N-O015|SUN Ship Management]], which OFAC designated in 2023,[^102] and then by [[N-O016|SKF Arktika]], which manages [[N-P052|South Fleet]] and [[N-P053|Invest Fleet]].[^103] Later, the management of the group's tankers passed to [[N-O017|Stream Ship Management]] (section 2.5)[^104] and to [[N-O019|Citrine Marine]], which the EU designated for taking over that management.[^105] No source names the ultimate owner of these two companies: the chain starts at the state and stops at an unknown owner.",
      },
      { kind: 'h3', text: "The president's associates" },
      {
        kind: 'p',
        text: 'After 2000, keeping a large company meant staying out of politics. In 2000, Vladimir Putin received about twenty of the big businessmen of the 1990s at the Kremlin and let them keep their assets on that condition.[^106] Mikhail Khodorkovsky, who had publicly accused officials of corruption, was arrested in October 2003. In December 2004, the main production subsidiary of his oil group, Yukos, was sold at auction to an unknown company, which Rosneft bought four days later.[^107] Pardoned in 2013, Khodorkovsky lives in London today, and in July 2014 three arbitration tribunals ruled that Russia had taken measures with an effect equivalent to expropriation.[^108]',
      },
      {
        kind: 'p',
        text: "Loyalty, by contrast, opens public contracts. Yevgeny Prigozhin came out of prison, opened hot-dog stands in Saint Petersburg, then a restaurant where the president, once elected, received his foreign guests; his company Concord then won the Kremlin's catering contracts.[^109] He financed the Internet Research Agency, which the US Treasury designated in 2018, and admitted in 2022 that he had founded the Wagner group in 2014.[^110] He died in a plane crash on 23 August 2023, exactly two months after his mutiny.[^111] Both paths follow one rule: the president did not abolish the oligarchy; he targeted only the oligarchs who threatened his power.[^112]",
      },
      {
        kind: 'p',
        text: "Outside the state, the large private shareholders form a circle that the designation texts link to the president. [[N-O023|Gennady Timchenko]], an old acquaintance of [[N-O024|Vladimir Putin]], shares with [[N-O032|Leonid Mikhelson]] the majority of a large petrochemical group and is a shareholder of [[N-O029|Bank Rossiya]].[^113] Mikhelson directly holds about 14% of [[N-O027|Novatek]].[^114] [[N-O030|Yuri Kovalchuk]], another close associate of the president, held more than a third of Bank Rossiya in 2013 and controls the insurer [[N-O031|SOGAZ]].[^115] The circle reaches the family: in 2013 [[N-O033|Kirill Shamalov]] married [[N-O034|Katerina Tikhonova]], the president's daughter, and then bought 17% of the same petrochemical group from Timchenko.[^116]",
      },
      {
        kind: 'p',
        text: 'State companies are run by associates who do not own them. [[N-O037|Igor Sechin]] ([[N-P026|Rosneft]]) is a personal friend of the president, and [[N-O038|Nikolay Tokarev]] ([[N-P034|Transneft]]) served with him in the KGB;[^117] [[N-O039|Sergei Chemezov]] ([[N-O021|Rostec]]) knew him in East Germany.[^118] These friends and former colleagues were given large public assets to manage, which made them "state oligarchs".[^119]',
      },
      {
        kind: 'p',
        text: 'State banks follow the same rule. The head of VEB.RF is appointed by the head of state and takes his instructions directly from him; a deputy president of VTB is the son of the director of the FSB. Since 2023, VTB also manages the United Shipbuilding Corporation in trust, by presidential decree.[^120] Promsvyazbank, nationalised in 2018, is run by the son of a former director of foreign intelligence.[^121] The chain of shares stops at the state, but the chain of management leads to the same circle, and the 50% rule follows shares, not these appointments.',
      },
      { kind: 'h3', text: 'Unknown owners' },
      {
        kind: 'p',
        text: 'Among the intermediaries and in the private fleet, the chain stops at an unknown owner:',
      },
      {
        kind: 'li',
        text: '**Oil trading:** Little-known traders with opaque ownership have carried, since the price cap, up to half of Russian oil exports.[^122] The Council of the EU thus links the company [[N-O049|Nord Axis]] to the [[N-O044|2Rivers group]]; the ultimate owner of Nord Axis remains undocumented.[^123]',
      },
      {
        kind: 'li',
        text: '**Vessels:** About fifteen shipowners or managers each own or operate at least six designated vessels, with no documented ultimate owner.',
      },
      {
        kind: 'li',
        text: "**[[N-O042|Surgutneftegaz]]:** The country's third-largest oil company, run by [[N-O041|Vladimir Bogdanov]], a close associate of the president, has never published its full ownership structure.[^124]",
      },
      {
        kind: 'p',
        text: 'The report hypothesises that this opacity protects these companies: the 50% rule applies in law, but nobody can apply it without knowing the chain of shares.[^125] What remains is to designate each company for its activity and to attach each new manager to the group it replaces, as the Council did for Citrine Marine and Nord Axis.',
      },
    ],
    notes: [
      {
        id: '95',
        text: 'Office of Foreign Assets Control. (2014, August 13). *Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked*. https://ofac.treasury.gov ; Office of Foreign Assets Control. (n.d.). *FAQ 401*. https://ofac.treasury.gov/faqs/401.',
      },
      {
        id: '96',
        text: 'Council of the EU. (2024, July 3). *Update of the EU Best Practices for the effective implementation of restrictive measures* (doc. 11623/24), points 63–64. https://data.consilium.europa.eu/doc/document/ST-11623-2024-INIT/en/pdf ; HM Treasury, Office of Financial Sanctions Implementation. (n.d.). *UK financial sanctions general guidance*, section 4. https://www.gov.uk/government/publications/financial-sanctions-general-guidance/uk-financial-sanctions-general-guidance.',
      },
      {
        id: '97',
        text: 'Rosneft. (2021). *Shareholder structure*. rosneft.com, p. 1 ; Gazprom. (2024). *Equity capital structure*. gazprom.com, p. 1.',
      },
      {
        id: '98',
        text: 'TASS. (2024). *Gazprom Neft to pay out record 2023 dividends*. tass.com, p. 1.',
      },
      { id: '99', text: 'Gazprombank. (2022). [Gazprombank shareholders]. gazprombank.ru, p. 1.' },
      {
        id: '100',
        text: 'Transneft. (2022, January 13). *Company* [Archived version]. https://web.archive.org, p. 1 ; Vedomosti. (2018, October 9). *«Транснефть» консолидировала 62% акций НМТП* [Transneft consolidates 62% of NMTP shares]. https://www.vedomosti.ru/business/news/2018/10/09/783225-transneft, p. 1.',
      },
      {
        id: '101',
        text: 'Rosneft (2021) and Gazprom (2024), op. cit., n. 97 ; Gazprombank (2022), op. cit., n. 99 ; TASS (2024), op. cit., n. 98.',
      },
      {
        id: '102',
        text: 'U.S. Department of the Treasury. (2023, December 20). *Treasury Tightens the Price Cap with New Sanctions and Updated Guidance* (press release jy2008). https://home.treasury.gov/news/press-releases/jy2008, p. 1.',
      },
      {
        id: '103',
        text: 'CELEX 32025R0389, annex, entries 530 to 532, pp. 44–45 ; https://eur-lex.europa.eu.',
      },
      { id: '104', text: 'U.S. Department of the Treasury (2025), op. cit., n. 45, annex 2.' },
      {
        id: '105',
        text: 'CELEX 02014R0269-20260928, annex I, entry 685 "Citrine Marine SPC" ; https://eur-lex.europa.eu.',
      },
      {
        id: '106',
        text: 'BBC News. (2005, May 31). *Timeline: The rise and fall of Yukos*. http://news.bbc.co.uk/2/hi/business/4041551.stm ; NPR Planet Money. (2022, March 29). *How Putin conquered Russia’s oligarchy*. KPBS Public Media. https://www.kpbs.org/news/international/2022/03/29/how-putin-conquered-russias-oligarchy.',
      },
      {
        id: '107',
        text: 'BBC News. (2004, December 23). *Putin backs state grab for Yukos*. http://news.bbc.co.uk/2/hi/business/4120339.stm ; BBC News (2005), op. cit., n. 106.',
      },
      {
        id: '108',
        text: 'Permanent Court of Arbitration. (2014, July 18). *Hulley Enterprises Limited (Cyprus) v. The Russian Federation*, PCA Case No. 2005-03/AA226, Final Award. https://pca-cpa.org/en/cases/60/ ; Permanent Court of Arbitration. (2014, July 18). *Yukos Universal Limited (Isle of Man) v. The Russian Federation*, PCA Case No. 2005-04/AA227, Final Award ; Permanent Court of Arbitration. (2014, July 18). *Veteran Petroleum Limited (Cyprus) v. The Russian Federation*, PCA Case No. 2005-05/AA228, Final Award.',
      },
      {
        id: '109',
        text: "Shevchenko, V. (2023, June 25). *Yevgeny Prigozhin: From Putin's chef to rebel in chief*. BBC News. https://www.bbc.com/news/world-europe-64976080.",
      },
      {
        id: '110',
        text: 'U.S. Department of the Treasury. (2018). Press release sm0312. https://home.treasury.gov ; Reuters. (2022). *Russia’s Prigozhin admits link to Wagner mercenaries for first time*. https://www.reuters.com.',
      },
      {
        id: '111',
        text: 'Reuters. (2023, August 24). *Wagner boss Yevgeny Prigozhin listed in Russian plane crash with no survivors*. https://www.reuters.com/world/europe/ten-killed-private-jet-crash-north-moscow-tass-2023-08-23/.',
      },
      { id: '112', text: 'See n. 106.' },
      {
        id: '113',
        text: 'CELEX 02014R0269-20260928, annex I, entries 694 "Gennady Nikolayevich TIMCHENKO" and 731 "Dmitry Vladimirovich KONOV" ; https://eur-lex.europa.eu.',
      },
      {
        id: '114',
        text: 'FCDO (2026), op. cit., n. 46, entry RUS1126 ; Interfax. (2022, March 21). *Mikhelson transfers around 14% stake in Novatek to direct ownership, eliminates Cyprus ‘layer’*. https://interfax.com/newsroom/top-stories/77137/, p. 1.',
      },
      {
        id: '115',
        text: 'CELEX 02014R0269-20260928, annex I, entries 94 "Yuriy Valentinovich KOVALCHUK" and 1381 "Stepan Kirillovich KOVALCHUK" ; https://eur-lex.europa.eu.',
      },
      {
        id: '116',
        text: 'U.S. Department of the Treasury. (2018, April 6). *Treasury Designates Russian Oligarchs, Officials, and Entities in Response to Worldwide Malign Activity* (press release sm0338). https://home.treasury.gov/news/press-releases/sm0338, p. 1.',
      },
      {
        id: '117',
        text: 'CELEX 02014R0269-20260928, annex I, entries 671 "Igor Ivanovich SECHIN" and 672 "Nikolay Petrovich TOKAREV" ; https://eur-lex.europa.eu.',
      },
      {
        id: '118',
        text: 'U.S. Department of the Treasury. (2014, April 28). *Press release jl2369*. home.treasury.gov/news/press-releases/jl2369, p. 1.',
      },
      {
        id: '119',
        text: 'Stanovaya, T. (2020, February 11). *Unconsolidated: The five Russian elites shaping Putin’s transition*. Carnegie Endowment for International Peace. https://carnegieendowment.org.',
      },
      {
        id: '120',
        text: 'CELEX 02014R0269-20260928, annex I, entries 225, 226 and 227 ; https://eur-lex.europa.eu ; President of Russia. (2018, May 24). Executive order on the chairman of VEB. http://en.kremlin.ru/events/president/news/57542 ; President of Russia. (2023, October 9). Executive order on the shares of the United Shipbuilding Corporation. http://en.special.kremlin.ru/acts/news/72465.',
      },
      {
        id: '121',
        text: 'U.S. Department of the Treasury. (2022, February 22). *U.S. Treasury imposes immediate economic costs in response to actions in the Donetsk and Luhansk regions* (press release jy0602). https://home.treasury.gov/news/press-releases/jy0602.',
      },
      {
        id: '122',
        text: 'U.S. Department of the Treasury (2023), op. cit., n. 102, p. 1, section "Under-the-radar traders of Russian oil".',
      },
      {
        id: '123',
        text: 'CELEX 32025R1476, annex, entries 625 "2Rivers DMCC" and 626 "2Rivers PTE Ltd", p. 25 ; FCDO (2026), op. cit., n. 46, entry RUS2541 ; https://eur-lex.europa.eu.',
      },
      {
        id: '124',
        text: 'CELEX 02014R0269-20260928, annex I, entry "Vladimir Leonidovich BOGDANOV" ; The Moscow Times. (2013, April 30). *Surgut Discloses $29Bln Cash Hoard*. https://www.themoscowtimes.com/2013/04/30/surgut-discloses-29bln-cash-hoard-a23733 ; https://eur-lex.europa.eu.',
      },
      { id: '125', text: 'OFAC (2014), op. cit., n. 95 ; OFAC (n.d.), op. cit., n. 95.' },
    ],
  },
  {
    source: 'report-en.md, 6 Limitations',
    slug: 'limits',
    title: 'Limits',
    nodeIds: ['N-M037'],
    blocks: [
      {
        kind: 'p',
        text: 'A report based on open sources sees what those sources publish, and no more. Before drawing conclusions, it must say what the facts gathered here cannot establish.',
      },
      { kind: 'h3', text: 'Limits of the evidence' },
      {
        kind: 'p',
        text: 'The report does not measure the effect of sanctions: where no source establishes a causal link, that link remains a hypothesis. Four further limits bear on the facts themselves:',
      },
      {
        kind: 'li',
        text: '**Coverage of the database:** It covers maritime transport well, but banks and armaments poorly. It links few companies to a payment or to a component, and it gives an amount for almost none of them; the section on payments therefore rests on fewer facts than the section on the fleet.',
      },
      {
        kind: 'li',
        text: '**Reliability of sources:** Only official sources receive a reliability rating. Think-tank reports and the press are not rated, so the weight of the facts that come from them is not measured.',
      },
      {
        kind: 'li',
        text: '**Mirror data:** Because Russia no longer publishes its trade by product, the report reads the declarations of its partners, which therefore give a minimum. The United Arab Emirates and Vietnam report no product-level data to UN Comtrade for 2024-2025, and Kazakhstan and Thailand report data only up to February 2024 and February 2025.[^126]',
      },
      {
        kind: 'li',
        text: "**The fleet:** Changes of owner and manager come from the GUR, a party to the conflict. It gives the vessel's current owner or manager and the date it took up the role, but rarely the first change after designation.[^127] The loss of the AIS identity tied to the IMO number, which the Global Fishing Watch registry makes visible, remains a lead, because that registry is not archived.",
      },
      {
        kind: 'p',
        text: 'Finally, no fact has been reviewed by a person: the checks are done by rules and by AI agents (Annex A). As a result, each fact must be checked at its source before it is used for a designation.',
      },
      { kind: 'h3', text: 'Research leads' },
      { kind: 'p', text: 'These limits point to directions for research:' },
      {
        kind: 'li',
        text: '**Measure the effect of sanctions:** Compare monthly series of prices and export volumes with the dates of designation, to test whether a designation really widens the discount on Russian crude.',
      },
      {
        kind: 'li',
        text: "**Document payments and components:** Link the companies of the database to payments and components, with amounts, using the alerts of the Financial Crimes Enforcement Network (FinCEN), US Treasury press releases and teardown studies of Russian weapons, to learn what volume passes through Kyrgyz banks and [[N-M037|A7]]'s sub-agents.",
      },
      {
        kind: 'li',
        text: '**Complete the mirror data:** Look for customs data that cover the United Arab Emirates, Vietnam, Kazakhstan and Thailand, to learn what share of the priority goods for weapons passes through these countries.',
      },
      {
        kind: 'li',
        text: '**Date the changes in the fleet:** Archive the history of AIS identities and compare it with the flag registers, to learn how long a designated vessel takes to change identity.',
      },
    ],
    notes: [
      {
        id: '126',
        text: 'UN Comtrade (2026), op. cit., n. 5 ; Risinger et al. (2026), op. cit., n. 81, p. 3.',
      },
      {
        id: '127',
        text: 'Main Directorate of Intelligence of the Ministry of Defence of Ukraine (GUR) (2026), op. cit., n. 51 ; Global Fishing Watch (2026), op. cit., n. 46.',
      },
    ],
  },
  {
    source: 'report-en.md, Conclusion',
    slug: 'conclusion',
    title: 'Conclusion',
    nodeIds: ['N-P026', 'N-P030', 'N-M037', 'N-F097'],
    blocks: [
      {
        kind: 'p',
        text: 'Sanctions weigh on the Russian economy, but they do not stop it. The revenue the state draws from oil and gas is falling, while it raises its other taxes to pay for an ever costlier defence. The discount on Russian crude widened after the American sanctions of 2025, and the goods Russia must import cost more. The war therefore costs more to wage, but it can still be financed.',
      },
      {
        kind: 'p',
        text: "Russia adapts in two ways. First, it relies on a parallel market on the margins of Western sanctions: tankers outside the coalition, managers based in third countries, payment agents, and shell companies created and dissolved quickly. Second, and legally, it turns to partners that do not apply the sanctions. China and India buy its oil, and China sells it most of the priority goods for weapons. These partners do not provide this service for nothing: Russia has few other choices, and they pay less for its oil and charge more for their goods. Part of the cost of sanctions for Russia thus becomes, according to the report's hypothesis, a gain for its new partners.",
      },
      {
        kind: 'p',
        text: 'EU sanctions follow this shift step by step. They go up the chain: the product, then the means, then the source. The EU first targeted oil, through the embargo and the price cap, then the vessels that carry it, then the ports it leaves from. Each step answers the circumvention of the one before and arrives late; the report assumes that the parallel market re-forms faster than the lists grow.',
      },
      {
        kind: 'p',
        text: "These two routes call for two responses. Against the parallel market, designating companies one by one gives time to create others; targeting a whole network at once, from owner to payment agent, and aligning the coalition's lists would shorten that delay. Against the new partners, by contrast, only the threat of secondary sanctions seems to carry weight, because it affects the access of their banks and firms to the dollar.",
      },
    ],
    notes: [],
  },
  {
    source: 'report-en.md, Annex A Research method',
    slug: 'annex-method',
    title: 'Annex A. Research method',
    nodeIds: [],
    blocks: [
      { kind: 'h3', text: 'A.1 The database' },
      {
        kind: 'p',
        text: 'The report rests on a database of entities (companies, vessels, sites, ports, banks, persons, legal acts) and of the relations between them, such as a designation, a shareholding, the management of a vessel, a port call, an oil flow or a bank settlement. Each fact in the database points to an archived document (web page, official act, data file, register response), with the page and the excerpt that establish it. On 27 October 2026, the database holds 6,327 entities; because the selection does not use the 1,165 military units, about 5,200 entities are tested.',
      },
      {
        kind: 'p',
        text: 'These documents come from the official sanctions lists (OFAC, United Kingdom, EU acts), from company registers, from public statistics (UN Comtrade, Eurostat, World Bank, Bank of Russia, Russian Ministry of Finance), from research institutes (KSE, CREA, Bruegel) and from investigative press.',
      },
      { kind: 'h3', text: 'A.2 Source rules' },
      {
        kind: 'li',
        text: 'A designation is cited from the official line of the OFAC list, of the UK list or of the EU act.',
      },
      {
        kind: 'li',
        text: 'The portal of Ukrainian military intelligence (GUR) is cited sheet by sheet, and its claims remain attributed to the GUR, a party to the conflict.',
      },
      {
        kind: 'li',
        text: 'Because Russia has not published its trade by product since 2022, that trade is read in the declarations of its partners (mirror data).',
      },
      {
        kind: 'li',
        text: 'No data that comes from a leak is cited, but a press article about a leak may be.',
      },
      {
        kind: 'li',
        text: 'A source that is known but not archived remains a lead and does not count as a fact; likewise, a value without a source remains undocumented.',
      },
      {
        kind: 'li',
        text: "The reliability of each source's issuer follows the ADMIRALTY scale, from A (official issuer) to F (cannot be judged).",
      },
      { kind: 'h3', text: 'A.3 Selecting the critical nodes' },
      {
        kind: 'p',
        text: 'The three conditions of the Method section apply in the same way to all entities in the database:',
      },
      {
        kind: 'li',
        text: '**Exposed to sanctions:** A designation relation to an EU, OFAC or UK list, or a holding of 50% or more by a designated entity;',
      },
      {
        kind: 'li',
        text: '**Active in 2024-2026:** A relation dated in that period (designation, port call, transshipment, event);',
      },
      {
        kind: 'li',
        text: "**Passes through a third country:** Either the entity's country of registration, or the flag of one of its vessels, or the country of a direct counterparty is one that does not apply the coalition's sanctions. A country read only from a company's name does not count while no archived document gives its address.",
      },
      {
        kind: 'p',
        text: 'Vessels of one management company, or failing that of one owner, form a single node. One act of designation can meet more than one condition; where no activity is observed, a new designation stands as proof of activity.',
      },
      { kind: 'h3', text: 'A.4 Checking facts and text' },
      {
        kind: 'p',
        text: "No fact has been reviewed by a person: this is a choice of method. AI agents collect and archive the sources, then propose each fact with the excerpt of its source. Other agents, which start with a fresh context and did not propose that fact, check that the excerpt appears in the archived source and supports the fact, before validating it. Other facts still wait for a check or a better source. The few facts entered by hand carry a label that sets them apart from the facts produced by the agents. The counts, shares and medians are the author's calculations, which no review agent validates one by one. Each part of the text was reviewed by agents distinct from its writer, and those agents checked its sources one by one; and the author reviewed the text, not each fact against its source.",
      },
    ],
    notes: [],
  },
];

// English text of the figures, keyed by their number in the French publication: fig1 and fig2
// content, panel titles, notes, and English labels for the French strings of
// data/publication-figures.json. {x} marks a value read from the data. On the page, key 9 is
// figure 10 (the settlement currencies), key 10 is figure 11 (CHP goods) and key 11 is the routes
// figure, which has no number in the final text.
export const figureTexts = {
  fig1: {
    layers: [
      {
        k: 'Pay',
        d: 'earn the foreign currency that pays for the war',
        items: [
          'Oil and gas ports and pipelines',
          'Tankers, including designated vessels',
          'Buyer countries',
        ],
      },
      {
        k: 'Finance',
        d: 'move the money',
        items: [
          'Russian and foreign banks',
          'Payment agents, SPFS',
          'Crypto-assets and backed tokens',
        ],
      },
      {
        k: 'Fight',
        d: 'import the components, produce the weapons',
        items: [
          'Dual-use and critical goods',
          'From the component to the factory',
          'Designated arms factories',
        ],
      },
    ],
    conditions: [
      {
        letter: 'a',
        title: 'Exposed to sanctions',
        text: 'designated, or owned 50% or more by a designated person',
      },
      {
        letter: 'b',
        title: 'Active in 2024-2026',
        text: 'production, transit or new designation, dated',
      },
      {
        letter: 'c',
        title: 'Goes through a third country',
        text: 'seat, flag or counterparty outside the coalition',
      },
    ],
    arrows: [
      {
        from: 'Pay',
        to: 'Finance',
        lines: ['revenue', 'in foreign currency'],
      },
      {
        from: 'Finance',
        to: 'Fight',
        lines: ['pays for the', 'imports'],
      },
    ],
    budgetPath: 'budget path: taxes fill the budget, which orders weapons from Russian factories',
  },
  fig2: {
    events: [
      {
        date: '2014-03-17',
        actor: 'EU',
        title: 'Crimea',
        detail: 'assets frozen',
      },
      {
        date: '2014-07-31',
        actor: 'EU',
        title: 'Sectoral sanctions',
        detail: 'banks, oil, dual use',
      },
      {
        date: '2022-02-24',
        actor: 'WAR',
        title: 'Invasion of Ukraine',
        detail: '',
      },
      {
        date: '2022-06-03',
        actor: 'EU',
        title: 'Oil embargo',
        detail: 'seaborne crude',
      },
      {
        date: '2022-12-05',
        actor: 'COAL',
        title: 'Price cap',
        detail: '$60 per barrel',
      },
      {
        date: '2023-02-05',
        actor: 'COAL',
        title: 'Oil products',
        detail: 'embargo and caps',
      },
      {
        date: '2023-10-12',
        actor: 'US',
        title: 'Enforcement of the cap',
        detail: 'shipowners designated',
      },
      {
        date: '2025-02-25',
        actor: 'EU',
        title: 'Ports banned',
        detail: 'Primorsk, Novorossiysk, Ust-Luga',
      },
      {
        date: '2025-09-03',
        actor: 'EU',
        title: 'Cap lowered',
        detail: '$47.6 per barrel',
      },
      {
        date: '2025-10-22',
        actor: 'US',
        title: 'Rosneft and Lukoil',
        detail: 'designated',
      },
      {
        date: '2026-02-01',
        actor: 'EU',
        title: 'Cap lowered',
        detail: '$44.1 per barrel',
      },
      {
        date: '2026-04-24',
        actor: 'EU',
        title: 'New ports',
        detail: 'Tuapse, Murmansk',
      },
    ],
    legend: {
      EU: 'European Union',
      US: 'United States (OFAC)',
      COAL: 'coalition (price cap)',
      WAR: 'war',
    },
  },
  figures: {
    '1': {
      panels: [],
      note: '',
      labels: {
        Payer: 'Pay',
        'gagner les devises qui paient la guerre':
          'earn the foreign currency that pays for the war',
        Financer: 'Finance',
        'faire circuler l’argent': 'move the money',
        Combattre: 'Fight',
        'importer les composants, produire les armes': 'import the components, produce the weapons',
        'Ports et oléoducs du pétrole et du gaz': 'Oil and gas ports and pipelines',
        'Pétroliers, dont des navires désignés': 'Tankers, including designated vessels',
        'Pays acheteurs': 'Buyer countries',
        'Banques russes et étrangères': 'Russian and foreign banks',
        'Agents de paiement, SPFS': 'Payment agents, SPFS',
        'Cryptoactifs et jetons adossés': 'Crypto-assets and backed tokens',
        'Biens à double usage et critiques': 'Dual-use and critical goods',
        'Du composant à l’usine': 'From the component to the factory',
        'Usines d’armement désignées': 'Designated arms factories',
        recettes: 'revenue',
        'en devises': 'in foreign currency',
        'paie les': 'pays for the',
        importations: 'imports',
        'voie du budget : les taxes remplissent le budget, qui commande des armes aux usines russes':
          'budget path: taxes fill the budget, which orders weapons from Russian factories',
        'Exposé aux sanctions': 'Exposed to sanctions',
        'désigné, ou détenu à 50 % ou plus par une personne désignée':
          'designated, or owned 50% or more by a designated person',
        'Actif en 2024-2026': 'Active in 2024-2026',
        'production, transit ou désignation nouvelle, datés':
          'production, transit or new designation, dated',
        'Passe par un pays tiers': 'Goes through a third country',
        'siège, pavillon ou contrepartie hors de la coalition':
          'seat, flag or counterparty outside the coalition',
      },
    },
    '2': {
      panels: [],
      note: '',
      labels: {
        'Union européenne': 'European Union',
        'États-Unis (OFAC)': 'United States (OFAC)',
        'coalition (plafond de prix)': 'coalition (price cap)',
        guerre: 'war',
        Crimée: 'Crimea',
        'avoirs gelés': 'assets frozen',
        'Sanctions sectorielles': 'Sectoral sanctions',
        'banques, pétrole, double usage': 'banks, oil, dual use',
        'Invasion de l’Ukraine': 'Invasion of Ukraine',
        'Embargo pétrolier': 'Oil embargo',
        'brut par mer': 'seaborne crude',
        'Plafond de prix': 'Price cap',
        '60 $ le baril': '$60 per barrel',
        'Produits pétroliers': 'Oil products',
        'embargo et plafonds': 'embargo and caps',
        'Contrôle du plafond': 'Enforcement of the cap',
        'armateurs désignés': 'shipowners designated',
        'Ports interdits': 'Ports banned',
        'Primorsk, Novorossiisk, Oust-Louga': 'Primorsk, Novorossiysk, Ust-Luga',
        'Plafond abaissé': 'Cap lowered',
        '47,6 $ le baril': '$47.6 per barrel',
        'Rosneft et Lukoil': 'Rosneft and Lukoil',
        désignés: 'designated',
        '44,1 $ le baril': '$44.1 per barrel',
        'Nouveaux ports': 'New ports',
        'Touapsé, Mourmansk': 'Tuapse, Murmansk',
      },
    },
    '3': {
      panels: [
        {
          id: 'a',
          title: 'Russian exports by buyer',
          unit: 'billion dollars',
        },
        {
          id: 'b',
          title: 'Crude bought from Russia',
          unit: 'million tonnes',
        },
      ],
      note: 'Mirror data, reported by the buyer country. Coalition (a): EU, United States, United Kingdom, Japan, South Korea, Switzerland, Norway; EU (b): the 27 member states. Crude of Turkey: CREA estimate; China 2023: Comtrade estimate.',
      labels: {
        'a. Exportations russes par acheteur': 'a. Russian exports by buyer',
        'milliards de dollars': 'billion dollars',
        'b. Brut acheté à la Russie': 'b. Crude bought from Russia',
        'millions de tonnes': 'million tonnes',
        invasion: 'invasion',
        'point vide : estimation (autre mesure que la douane)':
          'hollow point: estimate (a measure other than customs)',
        Chine: 'China',
        Inde: 'India',
        Turquie: 'Turkey',
        Kazakhstan: 'Kazakhstan',
        Coalition: 'Coalition',
        UE: 'EU',
      },
    },
    '4': {
      panels: [
        {
          id: 'a',
          title: 'Brent, Urals and the price cap',
          unit: 'dollars per barrel',
        },
      ],
      note: 'Urals: monthly average price used for the Russian mineral extraction tax. Brent: monthly price of the World Bank. The blue area is the gap between the two; it also includes quality and freight. Cap: maximum price, set by the EU, of a Russian crude transported or insured by a coalition company.',
      labels: {
        'dollars par baril': 'dollars per barrel',
        'plafond {v} $': 'cap ${v}',
        ' (5 déc. 2022)': ' (5 Dec. 2022)',
        Brent: 'Brent',
        Oural: 'Urals',
        'prix de l’Oural non publié': 'Urals price not published',
        'pour dix mois de 2023': 'for ten months of 2023',
        'Rosneft et Lukoil désignés': 'Rosneft and Lukoil designated',
        'janv. {year}': 'Jan. {year}',
      },
    },
    '5': {
      panels: [
        {
          id: 'a',
          title: 'Share of oil and gas in revenue',
          unit: '%',
        },
        {
          id: 'b',
          title: 'Oil and gas revenue, and defence',
          unit: 'trillion 2021 roubles',
        },
      ],
      note: 'Constant prices: values divided by the GDP deflator (base 2021). Defence: section “National defence” of the budget; the ministry no longer publishes the detail since 2022; 2022 according to Reuters, 2024 and 2025: planned budget.',
      labels: {
        'a. Part du pétrole et du gaz dans les recettes': 'a. Share of oil and gas in revenue',
        'b. Recettes du pétrole et du gaz, et défense': 'b. Oil and gas revenue, and defence',
        'billions de roubles de 2021': 'trillion 2021 roubles',
        invasion: 'invasion',
        année: 'year',
        'janv.-sept.': 'Jan.-Sept.',
        'janv.-sept. 2025 : {v} %': 'Jan.-Sept. 2025: {v}%',
        'Pétrole et gaz': 'Oil and gas',
        'Défense (prévu)': 'Defence (planned)',
        Défense: 'Defence',
        '2023 : pas de chiffre': '2023: no figure',
        'année entière': 'full year',
        'janvier-septembre (2026 provisoire)': 'January-September (2026 provisional)',
        'point vide : budget prévu ; 2022 d’après Reuters':
          'hollow point: planned budget; 2022 according to Reuters',
      },
    },
    '6': {
      panels: [
        {
          id: 'a',
          title: 'Traffic of the oil ports',
          unit: 'all cargo, index 2021 = 100',
        },
        {
          id: 'b',
          title: 'January-April 2026 / January-April 2025',
          unit: 'change in %',
        },
        {
          id: 'c',
          title: '',
          unit: '',
        },
      ],
      note: 'Novorossiysk includes the CPC terminal (mostly Kazakh oil). Tuapse: no figure for 2014 and 2015.',
      noteB:
        '“Shadow fleet” and “IG” (insurance by a club of the International Group) are KSE categories, not designations; the small coalition fleet without IG insurance is not shown.',
      labels: {
        'a. Trafic des ports pétroliers': 'a. Traffic of the oil ports',
        'toutes marchandises, indice 2021 = 100': 'all cargo, index 2021 = 100',
        'embargo de l’UE': 'EU embargo',
        'b. Janvier-avril 2026 / janvier-avril 2025': 'b. January-April 2026 / January-April 2025',
        'variation en %': 'change in %',
        Primorsk: 'Primorsk',
        'Oust-Louga': 'Ust-Luga',
        'Novorossiisk (avec CPC)': 'Novorossiysk (incl. CPC)',
        Touapsé: 'Tuapse',
        'Tous les ports : brut': 'All ports: crude oil',
        'Tous les ports : produits': 'All ports: oil products',
        'Tous les ports : toutes marchandises': 'All ports: all cargo',
        'embargo (UE)': 'embargo (EU)',
        'ports interdits': 'ports banned',
        '« Flotte fantôme »': '“Shadow fleet”',
        'Assurés IG': 'IG-insured',
      },
    },
    '7': {
      panels: [
        {
          id: 'a',
          title: 'Seaborne oil, January 2026',
          unit: 'thousand barrels per day (kb/d)',
        },
        {
          id: 'b1',
          title: 'PIPELINE GAS',
          unit: 'bcm',
        },
        {
          id: 'b2',
          title: 'LIQUEFIED NATURAL GAS',
          unit: 'Mt',
        },
        {
          id: 'c',
          title: 'PIPELINE CRUDE',
          unit: 'Mt',
        },
      ],
      note: '“Other countries” is a balance calculated by the author.',
      noteB:
        'Gas to the EU: EU and South-East Europe (TurkStream). Crude to the EU: Druzhba south, through Ukraine. Druzhba north: no more Russian crude to Poland and Germany since 2023 (GEM); to Belarus, 2025 volume not documented. “Other countries” is a balance calculated by the author. Pipeline gas and LNG do not add up: no conversion factor is recorded. Hatching: designated project (Arctic LNG 2, designated by OFAC and the United Kingdom).',
      labels: {
        'a. Pétrole par mer, janvier 2026': 'a. Seaborne oil, January 2026',
        'milliers de barils par jour (kb/j)': 'thousand barrels per day (kb/d)',
        'Chaque bande relie deux colonnes voisines : aucune source ne relie une catégorie de flotte à un acheteur.':
          'Each band links two neighbouring columns: no source links a fleet category to a buyer.',
        'BASSIN DE CHARGEMENT': 'LOADING BASIN',
        'FLOTTE (CATÉGORIE KSE)': 'FLEET (KSE CATEGORY)',
        PRODUIT: 'PRODUCT',
        ACHETEUR: 'BUYER',
        '{v} kb/j': '{v} kb/d',
        '{v} % désignés (CREA)': '{v}% designated (CREA)',
        'Brut · Baltique': 'Crude · Baltic',
        'Brut · mer Noire': 'Crude · Black Sea',
        'Brut · Pacifique': 'Crude · Pacific',
        'Brut · Arctique': 'Crude · Arctic',
        'Produits · Baltique': 'Products · Baltic',
        'Produits · mer Noire': 'Products · Black Sea',
        'Produits · Pacifique': 'Products · Pacific',
        'Produits · Arctique': 'Products · Arctic',
        '« Flotte fantôme »': '“Shadow fleet”',
        'Assurés IG': 'IG-insured',
        'Coalition, sans assurance IG': 'Coalition, no IG cover',
        'Brut par mer': 'Seaborne crude',
        'Produits par mer': 'Seaborne products',
        Chine: 'China',
        Inde: 'India',
        Turquie: 'Turkey',
        Singapour: 'Singapore',
        Brésil: 'Brazil',
        'Autres pays': 'Other countries',
        'Destination inconnue': 'Unknown destination',
        'GAZ PAR GAZODUC': 'PIPELINE GAS',
        'GAZ NATUREL LIQUÉFIÉ': 'LIQUEFIED NATURAL GAS',
        'BRUT PAR OLÉODUC': 'PIPELINE CRUDE',
        'Md m³': 'bcm',
        UE: 'EU',
        'Chine, Japon, Corée du Sud (non ventilé)': 'China, Japan, South Korea (not broken down)',
        'antenne ESPO :': 'ESPO spur:',
        'flux 2025 non documenté (capacité {v} Mt/an)':
          '2025 flow not documented (capacity {v} Mt/year)',
        ' (désigné)': ' (designated)',
        'TurkStream et Blue Stream': 'TurkStream and Blue Stream',
        'Force de Sibérie': 'Power of Siberia',
        'UE et Europe du Sud-Est': 'EU and South-East Europe',
        'Asie (Chine, Japon, Corée du Sud)': 'Asia (China, Japan, South Korea)',
        'Droujba sud (via l’Ukraine)': 'Druzhba south (via Ukraine)',
        Slovaquie: 'Slovakia',
        Hongrie: 'Hungary',
        Tchéquie: 'Czechia',
      },
    },
    '8': {
      panels: [],
      note: 'Census of the {F.census.read} designated tankers of the database, of which {F.census.ais} have an AIS identity; each share counts the vessels tracked long enough (6, 12 or 24 months before 26 October 2026). The {lanesN} vessels of the timeline are examples chosen to show each profile. Bars: AIS identity according to the register dates (leads). A new identity not linked to the IMO number leaves the tracking: the calls after the designation are minimums. The calls in the EU count the {F.census.ais} vessels, of which only {F.census.fol24} are tracked 24 months ({F.census.eu24b} before, {F.census.eu24a} after for these).',
      labels: {
        'perdent dans les 12 mois leur identité AIS liée au numéro OMI (navires suivis 12 mois)':
          'lose within 12 months their AIS identity linked to the IMO number (vessels tracked 12 months)',
        'font encore escale 6 mois ou plus après leur désignation (suivis 6 mois)':
          'still make port calls 6 months or more after their designation (tracked 6 months)',
        'font encore escale 12 mois ou plus après leur désignation (suivis 12 mois)':
          'still make port calls 12 months or more after their designation (tracked 12 months)',
        'font escale dans un port de l’UE : 6 mois avant, puis 24 mois après leur désignation (un minimum)':
          'call at an EU port: 6 months before, then 24 months after their designation (a minimum)',
        'sur {n}': 'of {n}',
        'Chiffres : les {ais} pétroliers désignés qui ont une identité AIS. Frise : {lanesN} navires, exemples de chaque profil.':
          'Figures: the {ais} designated tankers that have an AIS identity. Timeline: {lanesN} vessels, examples of each profile.',
        'pavillon russe': 'Russian flag',
        'autre pavillon (code ISO)': 'other flag (ISO code)',
        'hors de la période lue': 'outside the period read',
        'changement de pavillon (piste)': 'change of flag (lead)',
        'Escales :': 'Port calls:',
        'au-dessus : port russe': 'above: Russian port',
        'au-dessous : autre port': 'below: other port',
        'triangle : port de l’UE': 'triangle: EU port',
        '{m} mois': '{m} months',
        désignation: 'designation',
        '+6 mois': '+6 months',
        '+12 mois': '+12 months',
        'aucune identité AIS suivie': 'no AIS identity tracked',
      },
    },
    '9': {
      panels: [
        {
          id: 'a',
          title: 'Exports',
          unit: '%',
        },
        {
          id: 'b',
          title: 'Imports',
          unit: '%',
        },
      ],
      note: 'Currencies of “unfriendly” countries: “unfriendly countries” is the term of the Russian government (list 430-r); the series adds up the currencies of these countries. Shares of all settlements, in %.',
      labels: {
        Rouble: 'Rouble',
        'Autres devises': 'Other currencies',
        'Devises de pays « inamicaux »': 'Currencies of “unfriendly” countries',
        'a. Exportations': 'a. Exports',
        'b. Importations': 'b. Imports',
      },
    },
    '10': {
      panels: [
        {
          id: 'a',
          title: '',
          unit: 'million dollars',
        },
      ],
      note: 'Mirror data, reported by the seller country: minimums, because partners stopped reporting (Kazakhstan since February 2024, Thailand since February 2025, according to the KSE). CHP goods: 55 six-digit codes of the Harmonized System.',
      labels: {
        'millions de dollars': 'million dollars',
        'décret 14114 (22 déc. 2023)': 'Executive Order 14114 (22 Dec. 2023)',
        'Au-dessus de chaque barre : part de la Chine et de Hong Kong.':
          'Above each bar: share of China and Hong Kong.',
        Coalition: 'Coalition',
        Chine: 'China',
        'Hong Kong': 'Hong Kong',
        'Neuf pays tiers': 'Nine third countries',
      },
    },
    '11': {
      panels: [],
      note: 'The widths count the chains (one chain = 1, shared between its routes), not a volume or a value: these are investigated cases, not shares of trade. {F.doc} of the {F.routes * 3} steps are documented (documented links and Ukrainian government source). The {F.chains} chains shown follow {F.routes} routes, that is {F.routes * 3} links (three per route). Undocumented passage: the two steps are documented, not the passage from one to the other. {F.chains} of the {F.all} chains recorded are shown. A route is not a sale by the manufacturer.',
      labels: {
        'liens documentés ({n}, dont {m} sans l’intermédiaire étranger)':
          'documented links ({n}, of which {m} without the foreign intermediary)',
        'documentés par une source du gouvernement ukrainien seulement ({n})':
          'documented by a Ukrainian government source only ({n})',
        'piste ({n})': 'lead ({n})',
        'passage non documenté ({n})': 'undocumented passage ({n})',
        'FABRICANT DU COMPOSANT': 'COMPONENT MANUFACTURER',
        INTERMÉDIAIRE: 'INTERMEDIARY',
        ACHETEUR: 'BUYER',
        'USAGE FINAL': 'END USE',
        '(pays)': '(country)',
        'États-Unis': 'United States',
        Chine: 'China',
        UE: 'EU',
        Suisse: 'Switzerland',
        'Royaume-Uni': 'UK',
        Iran: 'Iran',
        Taïwan: 'Taiwan',
        'Non nommé': 'Not named',
        'Hong Kong': 'Hong Kong',
        'Asie centrale': 'Central Asia',
        Europe: 'Europe',
        Turquie: 'Turkey',
        'Émirats arabes unis': 'United Arab Emirates',
        'Aucun (achat direct)': 'None (direct purchase)',
        'Importateur ou négociant': 'Importer or trader',
        'Producteur de sous-systèmes': 'Subsystem producer',
        'Producteur iranien, nord-coréen': 'Iranian or North Korean producer',
        'Agent d’achat': 'Procurement agent',
        Drones: 'Drones',
        Missiles: 'Missiles',
        'Bombes guidées': 'Guided bombs',
        'Autre, non précisé': 'Other, not stated',
      },
    },
    '12': {
      panels: [],
      note: '',
      labels: {
        'État, holdings et sociétés d’État': 'State, holdings and state companies',
        'Président, cercle et actionnaires privés': 'President, circle and private shareholders',
        'Sociétés et actionnaires étrangers': 'Companies and foreign shareholders',
        'Intermédiaires et propriétaires inconnus': 'Intermediaries and unknown owners',
        'État russe': 'Russian State',
        'propriétaire non nommé': 'owner not named',
        'possède ou exploite les navires de {n} armateurs ou gestionnaires :':
          'owns or operates the vessels of {n} shipowners or managers:',
        'État et sociétés d’État': 'State and state companies',
        personnes: 'persons',
        sociétés: 'companies',
        'actionnaire étranger': 'foreign shareholder',
        intermédiaire: 'intermediary',
        'propriétaire inconnu': 'unknown owner',
        'possède, contrôle ou gère': 'owns, controls or manages',
        'lien personnel ou de direction': 'personal or management link',
        'fait proposé, en attente de validation': 'proposed fact, awaiting validation',
        gère: 'manages',
        reprise: 'takeover',
      },
    },
  },
  dataLabels: {
    'Pavillon russe à la désignation, escales continues':
      'Russian flag at designation, calls continue',
    'Pavillon changé avant la désignation': 'Flag changed before designation',
    'Pavillon changé après la désignation': 'Flag changed after designation',
    'Pavillon étranger, escales continues': 'Foreign flag, calls continue',
    'Pavillon étranger, sortie du suivi': 'Foreign flag, left the tracking',
    'État russe (gouvernement)': 'Russian State (government)',
    État: 'State',
    'société d’État': 'state company',
    'société d’État (flotte)': 'state company (fleet)',
    'société d’État (armement)': 'state company (arms)',
    'banque d’État': 'state bank',
    'holding d’État': 'state holding',
    'holding privée': 'private holding',
    'banque privée': 'private bank',
    'société privée': 'private company',
    'société de négoce': 'trading company',
    société: 'company',
    'actionnaire étranger': 'foreign shareholder',
    intermédiaire: 'intermediary',
    'propriétaire inconnu': 'unknown owner',
    'armateur ou gestionnaire': 'shipowner or manager',
    assureur: 'insurer',
    projet: 'project',
    'raffineur (Inde)': 'refiner (India)',
    cercle: 'circle',
    dirigeant: 'executive',
    famille: 'family',
    'famille (désignée)': 'family (designated)',
    'président (désigné)': 'president (designated)',
    privé: 'private',
    possède: 'owns',
    'possède (actionnaire)': 'owns (shareholder)',
    'possède (premier actionnaire)': 'owns (largest shareholder)',
    'possède (part achetée à Trafigura)': 'owns (stake bought from Trafigura)',
    'possède (jusqu’au 11 janvier 2023)': 'owns (until 11 January 2023)',
    'possède ou exploite': 'owns or operates',
    contrôle: 'controls',
    'contrôle (filiale)': 'controls (subsidiary)',
    'contrôle (société du groupe)': 'controls (group company)',
    gère: 'manages',
    'gère des pétroliers autrefois gérés par le groupe':
      'manages tankers formerly managed by the group',
    'reçoit la gestion de pétroliers du groupe': 'receives the management of tankers of the group',
    proche: 'close associate',
    fille: 'daughter',
    'mariage (février 2013)': 'marriage (February 2013)',
    dirige: 'heads',
    cofondateur: 'co-founder',
    'lié à': 'linked to',
    'même réseau': 'same network',
    '100 % des actions avec droit de vote': '100% of the voting shares',
    '50 % (52,32 % des droits de vote, ministère des Finances)':
      '50% (52.32% of the voting rights, Ministry of Finance)',
    'majorité, non chiffrée par la source': 'majority, not quantified by the source',
    'non chiffré': 'not quantified',
    '100 %': '100%',
    '40,40 %': '40.40%',
    '10,97 %': '10.97%',
    '38,37 %': '38.37%',
    '19,75 %': '19.75%',
    '18,46 %': '18.46%',
    '9,60 %': '9.60%',
    '95,68 %': '95.68%',
    '27,99 %': '27.99%',
    '21,90 %': '21.90%',
    '8,03 %': '8.03%',
    '4,79 %': '4.79%',
    '49,13 %': '49.13%',
    '49,8 %': '49.8%',
    '60 %': '60%',
    '10 %': '10%',
    '25 % + 1 action': '25% + 1 share',
    '75 % moins une action': '75% minus one share',
    'actionnaire unique': 'sole shareholder',
    'grand actionnaire, non chiffré': 'major shareholder, not quantified',
    'majorité, avec L. Mikhelson': 'majority, with L. Mikhelson',
    'majorité, avec G. Timtchenko': 'majority, with G. Timchenko',
    'actionnaire, non chiffré': 'shareholder, not quantified',
    'environ 38 % en 2013': 'about 38% in 2013',
    '14,39 % en direct (2022)': '14.39% direct (2022)',
    'dont 17 % achetés à G. Timtchenko (part totale non chiffrée)':
      'of which 17% bought from G. Timchenko (total stake not quantified)',
    'structure jamais publiée en entier': 'structure never published in full',
    '11 navires': '11 vessels',
    '10 navires': '10 vessels',
    '9 navires': '9 vessels',
    '8 navires': '8 vessels',
    '7 navires': '7 vessels',
    '6 navires': '6 vessels',
    'fait du record': 'fact of the record',
    'fait du record ; part proposée (cette session)':
      'fact of the record; stake proposed (this session)',
    'proposé (autre session)': 'proposed (other session)',
    'proposé (cette session)': 'proposed (this session)',
    'proposé (cette session) (part de 17 % : document stocké, non proposé)':
      'proposed (this session) (17% stake: document stored, not proposed)',
    validé: 'validated',
    'document stocké, non proposé (pas un fait du record : aucun propriétaire à nommer)':
      'document stored, not proposed (not a fact of the record: no owner to name)',
    'propriétaire non publié': 'owner not published',
    'propriétaire non nommé': 'owner not named',
    Rosimouchtchestvo: 'Rosimushchestvo',
    'Gazfond (fonds de pension)': 'Gazfond (pension fund)',
    Kalachnikov: 'Kalashnikov',
    '54 sociétés de négoce': '54 trading companies',
    'Hara Capital (actionnaire de Tendril depuis le 11 janvier 2023)':
      'Hara Capital (shareholder of Tendril since 11 January 2023)',
    'Alan LOUCHNIKOV (via TKH-Invest)': 'Alan Lushnikov (via TKH-Invest)',
    'Guennadi TIMTCHENKO': 'Gennady Timchenko',
    'Vladimir POUTINE': 'Vladimir Putin',
    'Iouri KOVALTCHOUK': 'Yuri Kovalchuk',
    'Leonid MIKHELSON': 'Leonid Mikhelson',
    'Kirill CHAMALOV': 'Kirill Shamalov',
    'Katerina TIKHONOVA': 'Katerina Tikhonova',
    'Arkadi ROTENBERG': 'Arkady Rotenberg',
    'Igor SETCHINE': 'Igor Sechin',
    'Nikolaï TOKAREV': 'Nikolai Tokarev',
    'Sergueï TCHEMEZOV': 'Sergei Chemezov',
    'Andreï KOSTINE': 'Andrei Kostin',
    'Vladimir BOGDANOV': 'Vladimir Bogdanov',
    'Ahmed KERIMOV': 'Ahmed Kerimov',
    'Talat SAFAROV': 'Talat Safarov',
    'Tahir GARAYEV': 'Tahir Garayev',
  },
};

// The words of the report page itself: controls, counters, panels and labels.
export const ui = {
  reportLabel: 'Research report',
  counters: {
    // The accessible name of the counts in the annex.
    label: 'Scale of the research',
    nodes: 'Nodes',
    relations: 'Relations',
    documents: 'Documents',
    sources: 'Notes',
  },
  part: { nodes: 'Nodes in this part' },
  figure: {
    name: 'Figure',
    unit: 'Unit',
    period: 'Period',
    sources: 'Sources',
    note: 'Note',
    pending: 'The chart of this figure comes in a later version of the page.',
  },
  node: {
    open: 'Open the record',
    evidence: 'Evidence score',
    outOf: 'of 11',
    relations: 'Relations',
    documents: 'Documents',
  },
  panel: {
    close: 'Close',
    drag: 'Drag down to close',
    relations: 'Relations',
    noRelation: 'No relation joins this node to another node of the report.',
    neighbours: 'Neighbours',
    neighboursLabel: 'The node and its neighbours in the report graph',
    place: 'Place',
    placeLabel: 'Position of the node on a map',
    sources: 'Documents',
    noSource: 'No document identifier is stored for this node.',
    record: 'Record',
    entity: 'Open the entity page',
    graph: 'Open in the graph',
  },
  note: { label: 'Note', all: 'All notes' },
  index: {
    title: 'All nodes of the report',
    layers: ['Pay', 'Finance', 'Fight', 'Ownership'],
  },
  bibliography: {
    title: 'Notes and sources',
    back: 'Back to the report',
    label: 'Report notes',
    // The art of the report page. Each line is the credit of public/report-media/credits.json.
    images: {
      title: 'Images',
      items: [
        {
          credit:
            '"Crude Oil Tanker in Port Arthur, Texas" by Quintin Soloviev, CC0, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Crude_Oil_Tanker_in_Port_Arthur,_Texas.jpg',
        },
        {
          credit:
            '"1829 map of the Black Sea by the Russian Hydrographic Depot" by Russian Hydrographic Depot, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:1829_map_of_the_Black_Sea_by_the_Russian_Hydrographic_Depot.jpg',
        },
        {
          credit:
            '"Crude oil tanker Eagle San Diego" by Jordanroderick, CC0, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Crude_oil_tanker_Eagle_San_Diego.jpg',
        },
        {
          credit: '"1903 Baku Oil Wells" by Unknown author, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:1903_Baku_Oil_Wells.jpg',
        },
        {
          credit:
            '"Caucasus Novorossiysk general view Postcard 1900-1904" by Brothers Borisov Publishing House, Novorossiysk, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Caucasus_Novorossiysk_general_view_Postcard_1900-1904.jpg',
        },
        {
          credit:
            '"Russia 1771 Sestroretsk Rouble" by Russia (coin), National Numismatic Collection (image), public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Russia_1771_Sestroretsk_Rouble.jpg',
        },
        {
          credit:
            '"Pair of Flintlock Pistols of Empress Catherine the Great (1729–1796)", Johan Adolph Grecke, 1786. The Metropolitan Museum of Art, Open Access, CC0',
          href: 'https://www.metmuseum.org/art/collection/search/24927',
        },
        {
          credit:
            '"Chess set", Unknown maker (Russian, Kholmogory), late 18th–early 19th century. The Metropolitan Museum of Art, Open Access, CC0',
          href: 'https://www.metmuseum.org/art/collection/search/202506',
        },
      ],
    },
  },
} as const;

export const openingUi = {
  // The dithered photograph in two tones, black and the accent, as the art of the chapters.
  cover: {
    src: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-in-port-arthur-texas-dither.png',
    // The photograph itself, for a phone: the dither is too coarse at that size.
    photo: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-in-port-arthur-texas.jpg',
  },
  partBar: { label: 'Parts of the report', of: '/' },
  // The actions of the first screen, one row. The PDF action shows only when the build copied it.
  links: { label: 'Report links', read: 'Read', data: 'Data', pdf: 'Download PDF' },
  summary: {
    // The plate of the summary head on a wide screen: an old chart of the Black Sea, in two tones.
    art: import.meta.env.BASE_URL + 'report-media/black-sea-map-1829-dither.png',
    // The figure of the settlement currencies: the rouble line of the export panel. It sits under
    // the finding of note 4 (2021 and 2025 only), and cites note 57 of that figure (figure 10),
    // which covers 2019-2025.
    chart: {
      title: 'Exports settled in roubles',
      label: 'Exports settled in roubles, percentage of export settlements, by year',
      unit: '% of export settlements',
      period: '2019-2025',
      source: 'Source: Bank of Russia (2026).',
      finding: '4',
      note: { part: 'finance', id: '57' },
      marked: [2021, 2025],
    },
    // One entry for each list item, with the note of that item. A number comes from the item
    // text; words, when given, are written exactly as in the item. The item on the price has no
    // note.
    values: [
      { words: '', note: '1' },
      { words: '', note: '2' },
      { words: 'almost doubled', note: '' },
      { words: 'less than one fifth', note: '3' },
      { words: '', note: '4' },
      { words: '', note: '5' },
    ],
  },
  introduction: {
    // The art of the chapter opening, a dithered photograph.
    art: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-eagle-san-diego-dither.png',
  },
} as const;

export const methodUi = {
  layers: {
    label: 'Layers',
    unit: 'Critical nodes, one square for each node',
    // The figure counts the nodes of the report, so its period is the period of the report.
    period: '2024-2026',
    critical: 'Critical, no page record',
    inData: 'Critical and in the page data',
    examined: 'In the page data, fewer than three conditions documented',
    open: 'Open the nodes of the page data',
    conditions: 'Three conditions of a critical node',
  },
  timeline: {
    label: 'Sanctions, 2014-2026',
    // Quoted from the text of the part.
    period: 'The years 2024-2026',
    gap: '2015-2021: no event in this figure',
    unit: 'Event, dated',
    actors: { COAL: 'COALITION' } as Readonly<Partial<Record<string, string>>>,
    cursor: 'Time cursor: event',
    counters:
      "Tankers designated by each regime to the end of the quarter of the event. Data: the sanctions lists of the EU, the UK and OFAC; author's calculations",
    table: 'Events and tankers designated, as a table',
    date: 'Date',
    event: 'Event',
  },
} as const;

export const payUi = {
  image: import.meta.env.BASE_URL + 'report-media/baku-oil-wells-1903.jpg',
  estimate: 'Hollow point: estimate (a measure other than customs)',
  crossingNote: 'Ring: where one line goes below another, between two year-end values.',
  // The mark where a line of the old buyers goes below a line of a new buyer.
  crossing: '{a} below {b}',
  // The year scrubber of figure 3, the mark of an estimate in its readout, and its data table.
  year: 'Year',
  estimated: 'estimate',
  table: 'Values of all years',
  // The heading of the column of notes beside the text.
  sidenotes: 'Notes',
  f4: {
    label: 'Brent price, Urals price and EU price cap, monthly',
    // The note of figure 4, with the shaded area of this chart in place of a colour name.
    note: 'Urals: monthly average price used for the Russian mineral extraction tax. Brent: monthly price of the World Bank. The shaded area is the gap between the two; it also includes quality and freight. Cap: maximum price, set by the EU, of a Russian crude transported or insured by a coalition company.',
    // Each card quotes the text of the part: the first cap, the cap and the fleet, then the gap
    // after the designation of Rosneft and Lukoil.
    steps: [
      {
        text: 'Since December 2022, an EU company or a company of its allies can no longer carry, insure or finance Russian crude sold above a price cap (figure 4).[^23]',
      },
      {
        text: 'As long as Urals stays above the cap, it travels mostly on ships and with insurers outside the coalition, which the cap does not bind (section 2.5).[^26]',
      },
      {
        text: 'The gap widened again after October 2025, when OFAC designated [[N-P026|Rosneft]] and [[N-P030|Lukoil]], two large Russian oil groups,[^28] and several Indian refiners stopped buying.[^29] From August 2023 to October 2025, Urals was worth $10 to $16 less than Brent each month; since November 2025, it has been worth $19 to $27 less.[^30]',
      },
    ],
    // The slider under the chart: a line that the reader moves. It is not a cap and not a model.
    whatIf: {
      title: 'What-if line, not a model',
      slider: 'What-if line, in $ per barrel',
      line: 'what-if {v} $',
      above: 'Urals above the line: {n} of {k} months with a value.',
      none: 'Urals is above the line in no month.',
      missing: 'Months with no Urals value: {n}. They stay blank.',
      table: 'Urals minus the what-if line, each month',
      month: 'Month',
      urals: 'Urals ($ per barrel)',
      gap: 'Urals minus the line ($)',
    },
  },
} as const;

export const portsFleetUi = {
  // The art of the opening: a postcard of the port of Novorossiysk, drawn in ASCII.
  art: import.meta.env.BASE_URL + 'report-media/novorossiysk-postcard-1900-1904.jpg',
  map: {
    label: 'Map of the oil export terminals of the report',
    named: 'Named in this step',
    other: 'Other terminal of the report',
    ban: 'EU ban on transactions with the port: start date at each port',
    banDates: {
      'N-P001': 'February 2025',
      'N-P002': 'February 2025',
      'N-P005': 'February 2025',
      'N-P011': 'April 2026',
      'N-P009': 'April 2026',
    },
    pacific: 'Crude export ports on the Baltic, the Black Sea and the Pacific',
    change: 'Traffic, January-April 2026 / January-April 2025, change in %',
    throughput: 'Circle area: all-cargo traffic in',
    visits: {
      label: 'AIS port visits of the tankers named in this report, GFW, query date',
      powered: 'Powered by Global Fishing Watch.',
      counted: 'Port visits:',
      by: 'visits by',
      listed: 'listed tankers',
      of: 'of the',
      sources: 'Sources of this map',
      port: 'Port',
      count: 'Visits',
      tankers: 'Tankers',
      limit: 'A presence in port, not a loading.',
    },
    flows: 'Seaborne crude by loading basin and fleet, January 2026, kb/d',
    open: 'Open the record of',
    data: 'Data:',
    basemap: 'Basemap:',
    fleetTags: {
      '“Shadow fleet”': 'shadow fleet',
      'IG-insured': 'IG',
      'Coalition, no IG cover': 'coalition',
    },
  },
  traffic: {
    embargoDate: 'Dec. 2022',
    cTitle: 'c. Seaborne crude by fleet category',
    cUnit: 'kb/d',
  },
  flows: {
    table: 'Values of the chart',
    from: 'From',
    to: 'To',
    value: 'Value',
    state: 'State',
    notDocumented: 'not documented',
  },
  lives: {
    period: '6 months before to 24 months after each designation',
    lost: 'designated tankers, one dot each',
    after: 'Port call after the designation',
    label:
      'Timeline of {n} designated ships, from 6 months before to 24 months after their designation',
  },
  waves: {
    regimes: { EU: 'EU', UK: 'UK', OFAC: 'OFAC' },
    unit: 'tankers',
    filters: 'Regimes shown',
    aTitle: 'a. New designations, by quarter',
    aUnit: 'a tanker designated by two regimes counts twice',
    aLabel: 'New designations of tankers per quarter, by regime',
    earlier: '{n} designations before 2022 are not drawn.',
    bTitle: 'b. Tankers, by the regimes that designate them',
    bUnit: 'each tanker counts once',
    tankers: '{n} tankers designated by the regimes shown',
    none: 'No regime is shown. Select EU, UK or OFAC.',
    quarter: 'Quarter',
    partialRow: '{q}, to {date}',
    partial: 'Dashed column: {q}, designations to {date} only.',
  },
} as const;

export const financeUi = {
  image: import.meta.env.BASE_URL + 'report-media/sestroretsk-rouble-1771.jpg',
  figure: {
    // The years that the steps of the scene show, from the data of figure 10.
    steps: [2021, 2022, 2023, 2024, 2025],
    stepLabel: 'Rouble share of settlements',
    exports: 'Exports',
    imports: 'Imports',
    tableCaption: 'Data of figure 10, percentage of total',
    year: 'Year',
  },
  relays: { label: 'Payment relays' },
} as const;

export const fightUi = {
  image: import.meta.env.BASE_URL + 'report-media/met-24927-flintlock-pistols.jpg',
  suppliers: {
    a: 'a. By reporting country',
    b: 'b. Nine third countries',
    bScale: 'One scale for the nine countries: the tallest bar is {max}.',
    year: 'Year',
    country: 'Reporting country',
    noValue: 'Hatch: no declared value',
    noValueShort: 'n/d',
    sanctionYear: 'Band: 2023, the year of Executive Order 14114',
  },
  chain: {
    title: 'From the brand to the weapon',
    step: 'Step',
    mapLabel: 'Map of the places named by the step in view',
    openSite: 'Open the record of the site',
    imports:
      'Russian imports of CHP battlefield goods, January–October 2023, share of the value in %',
    brands: 'Coalition brands, million USD',
    document: 'Document',
    page: 'p.',
    source: 'Source',
    unit: 'Unit',
    routesTitle: 'From the manufacturer to the intermediary',
    buyersTitle: 'From the intermediary to the weapon',
    byIntermediary: 'Chains by intermediary',
    byBuyer: 'Chains by buyer',
    byUse: 'Chains by end use',
    sites: 'Fight nodes with a known site',
    states: 'Line: documented. Dash: lead. Dots: no source found.',
    stepsByState: 'Steps of the routes, by state',
    chinaShare: 'China, Hong Kong: share of the value',
    kse: {
      text: 'KSE Institute, "Challenges of Export Controls Enforcement", January 2024',
      url: 'https://kse-ua-prod-media.fra1.digitaloceanspaces.com/wp-content/uploads/2024/01/Challenges-of-Export-Controls-Enforcement.pdf',
    },
    record: 'Record',
    siteCount: '{n} sites on the map',
    flowColumns: [
      'Country of the component manufacturer',
      'Country of the intermediary',
      'Buyer',
      'End use',
    ],
    flowText:
      'Each band is a set of chains. Its width counts chains, on one scale for the four columns. China and Hong Kong carry the accent.',
    unitChains: 'Chains',
    // A reference line of the map, for orientation only.
    urals: 'Urals',
    russia: 'Russia',
    // The unit of the chain counts, as the note of the routes figure gives it: a count can have decimals.
    chainUnit: 'one chain = 1, shared between its routes',
  },
  noPeriod: 'Not given in the source of the figure',
  // The routes of the components: a figure of the page with no number, because the final text
  // has no such figure. Its notes are the notes of the final text on the teardowns and the lists.
  routes: {
    title: 'Routes of the foreign components of Russian weapons',
    unit: 'number of chains',
    sources: 'RUSI, CAR, IISS; US and Ukrainian authorities; press.[^91][^93]',
  },
} as const;
// The words of the ownership part and of its figure 12.
export const ownershipUi = {
  image: import.meta.env.BASE_URL + 'report-media/met-202506-chess-set.jpg',
  figure: {
    legend: 'Legend',
    links: 'links',
    more: 'Show {n} more',
    fewer: 'Show fewer',
    table: 'All the links of figure 12, as a table',
    rows: '{n} rows',
    columns: {
      owner: 'Owner',
      relation: 'Relation',
      share: 'Share',
      owned: 'Owned',
      state: 'State',
    },
  },
} as const;

export const closingUi = {
  limits: {
    limitsLabel: 'Limits of the evidence',
    leadsLabel: 'Leads',
    checkLabel: 'Check before use',
  },
  annex: {
    // The format of the numbers and of the date of the strip.
    locale: 'en-GB',
    // The counts of the database, read from the final text.
    record: 'In the database',
    entities: 'Entities',
    critical: 'Critical nodes',
    official: 'Critical nodes on an official source, at least',
    recordSource: 'Source: the text of this report, counts as at {date}',
    // The counts of the page data.
    report: 'In this report',
  },
} as const;

/** The English copy of the report content. The copy of another locale has the same shape
 * (`ReportContent` in use-content.ts), and the page reads it from the content context. */
export const en = {
  report,
  parts,
  figureTexts,
  ui,
  openingUi,
  methodUi,
  payUi,
  portsFleetUi,
  financeUi,
  fightUi,
  ownershipUi,
  closingUi,
};
