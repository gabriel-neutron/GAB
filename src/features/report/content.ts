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
    source: 'partie-IV.md',
    slug: 'finance',
    title: 'Finance: the rouble replaces the dollar and the euro',
    nodeIds: ['N-M002', 'N-M008', 'N-M003', 'N-M004', 'N-M009', 'N-M007', 'N-M037', 'N-M040'],
    blocks: [
      {
        kind: 'p',
        text: 'From 2022, the United States[^IV-1] and the United Kingdom[^IV-2] designate the large Russian banks, among them [[N-M002|VTB]] and [[N-M008|Sberbank]]. In addition to the freeze of their assets, the EU removes several of them from SWIFT, the messaging network through which the world\'s banks send each other their payment orders.[^IV-3] Russian companies therefore move away from the currencies of "unfriendly" countries, such as the dollar and the euro, to the rouble and to other currencies, such as the yuan (figure 9).[^IV-4]',
      },
      {
        kind: 'figure',
        text: 'Figure 9. Settlement currency of Russian exports and imports, 2019-2025 (percentage of total). Source: Bank of Russia (2026).[^IV-5]',
        figure: {
          number: 9,
          title: 'Settlement currency of Russian exports and imports, 2019-2025',
          unit: 'percentage of total',
          period: '2019-2025',
          sources: 'Bank of Russia (2026).',
        },
      },
      {
        kind: 'p',
        text: "At the end of 2023, the yuan settles as many exports as the rouble,[^IV-6] and with China, the rouble and the yuan settle almost all payments, according to the Russian deputy finance minister.[^IV-7] This choice protects this trade from sanctions. But it ties Russia to a partner that accounts for about 40% of its trade, while Russia accounts for only a few percent of Chinese trade.[^IV-8] Under the report's hypothesis, China can therefore set its terms. The Council on Foreign Relations (CFR) also sees the May 2025 agreements on the links between their banks and on settlements in national currencies as a sign that Russia accepts this imbalance.[^IV-9]",
      },
      {
        kind: 'p',
        text: 'Yet a payment in yuan still goes through a bank that needs the dollar. US Executive Order 14114, of December 2023, exposes to sanctions any foreign bank that helps the Russian military-industrial base; in June 2024, this risk extends to any transaction with [[N-M002|VTB]] or [[N-M008|Sberbank]].[^IV-10] Banks in third countries therefore pull out. Zhejiang Chouzhou Commercial Bank, the main channel for Russian importers, cuts ties with them in February 2024.[^IV-11] Turkish and Emirati banks return transfers or close accounts.[^IV-12] And in the summer of 2024, Chinese state banks block Russian payments "en masse", according to Reuters.[^IV-13] Payments then move to other relays, which the sanctions later follow:',
      },
      {
        kind: 'li',
        text: "**Subsidiaries of Russian banks (China, India, Kazakhstan, Belarus).** [[N-M003|VTB's Shanghai branch]] becomes the main route for payments to China.[^IV-14] From June 2024, the US Treasury includes the offices of [[N-M002|VTB]] and [[N-M008|Sberbank]] in China and India in their designations.[^IV-15] The EU then bans transactions with VTB Shanghai and with the VTB subsidiaries in [[N-M004|Kazakhstan]] and Belarus,[^IV-16] then, in 2026, with [[N-M009|Sberbank India]] and [[N-M007|India VTB]].[^IV-17]",
      },
      {
        kind: 'li',
        text: '**Small Chinese border banks (Heihe, Suifenhe).** They take over from the state banks, according to Reuters, and the EU targets two of them in 2025.[^IV-18]',
      },
      {
        kind: 'li',
        text: '**Banks in Central Asia and Armenia (Kyrgyzstan, Kazakhstan, Armenia).** In 2024, Armenian and Kazakh banks stop accepting the Russian Mir card, because of the risk of secondary sanctions.[^IV-19] Kyrgyzstan then concentrates rouble payments in two state banks,[^IV-20] which the EU targets in 2026, after two other Kyrgyz banks.[^IV-21]',
      },
      {
        kind: 'li',
        text: "**Payment agents (Russia, China, Hong Kong, Kazakhstan).** Based in Russia and in the supplier's country, they receive the importer's roubles and pay on its behalf. Their share of cross-border payments quadruples in a few months in 2024, according to Vedomosti as cited by The Bell.[^IV-22]",
      },
      {
        kind: 'li',
        text: '**Barter and cryptocurrency.** The Russian Ministry of Economic Development recommends barter from February 2024,[^IV-23] and a law of August 2024 allows settlements in cryptocurrency on an experimental basis.[^IV-24]',
      },
      {
        kind: 'li',
        text: '**SPFS**, the Russian equivalent of SWIFT, which is open to foreign banks. OFAC threatens to designate them if they join it.[^IV-25]',
      },
      {
        kind: 'p',
        text: 'The best known of these agents, [[N-M037|A7]], gives each payment to a sub-agent in a third country, such as Hong Kong or Kyrgyzstan. It settles the counterpart in [[N-M040|A7A5]], a digital token worth one rouble.[^IV-26] After OFAC designates A7 in August 2025, the daily volume of this token collapses, according to Elliptic.[^IV-27]',
      },
      {
        kind: 'p',
        text: "The report therefore puts forward the hypothesis that each wave of designations does not close a channel. Instead, it pushes payments toward a smaller relay that is further from the dollar. The dollar does not disappear, because [[N-M037|A7]]'s sub-agents still pay in dollars, yuan, dirhams and euros.[^IV-28] The lever therefore remains the bank that keeps this access, and that bank can leave the channel: in 2026, the EU removes three Tajik banks from its list, because they have taken measures.[^IV-29]",
      },
    ],
    notes: [
      {
        id: 'IV-1',
        text: 'US Treasury, "U.S. Treasury Announces Unprecedented & Expansive Sanctions Against Russia, Imposing Swift and Severe Economic Costs", press release jy0608, 24 February 2022, p. 1 (VTB); US Treasury, "U.S. Treasury Escalates Sanctions on Russia for Its Atrocities in Ukraine", press release jy0705, 6 April 2022, p. 1 (Sberbank).',
      },
      {
        id: 'IV-2',
        text: 'FCDO, *UK Sanctions List*, version of 16 October 2026.',
      },
      {
        id: 'IV-3',
        text: 'Council Regulation (EU) 2022/345 of 1 March 2022 amending Regulation (EU) No 833/2014, Art. 5h.',
      },
      {
        id: 'IV-4',
        text: 'The Bell (A. Prokopenko, A. Kolyandr), "The rise of Russia’s foreign trade middlemen", *Inside the Russian Economy* newsletter, 2 November 2024.',
      },
      {
        id: 'IV-5',
        text: 'Bank of Russia, "Currency Composition of Settlements", annual series for exports and imports, Russia, 2019-2025, update of 15 October 2026. Settlements of trade in goods and services. "Unfriendly" currencies: currencies of the countries on the Russian government\'s list of "unfriendly" states. The Bank of Russia does not break down "other currencies".',
      },
      {
        id: 'IV-6',
        text: "Bank of Russia, *Обзор рисков финансовых рынков*, No. 1, January 2024, p. 6: in December 2023, the yuan settles 35.8% of export revenue, the rouble 35.7%. No source read gives a figure for the yuan's share in 2024 or in 2025.",
      },
      {
        id: 'IV-7',
        text: 'TASS, "National currencies account for nearly 100% of Russia-China settlements", 23 October 2026 (interview with Ivan Chebeskov, Deputy Finance Minister of Russia). An official statement, not a published statistic.',
      },
      {
        id: 'IV-8',
        text: "T. Deryugina and O. Shepotylo, *China’s Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4 (3.6% of Chinese trade in 2025; about 40% of Russian trade, based on the partners' mirror statistics).",
      },
      {
        id: 'IV-9',
        text: 'Council on Foreign Relations, "China-Russia-Ukraine: May 2025", 7 July 2025.',
      },
      {
        id: 'IV-10',
        text: 'US Treasury, "Statement from Secretary Yellen on President Biden’s Executive Order Taking Additional Steps With Respect to Russia’s Harmful Activities", press release jy2011, 22 December 2023; US Treasury, "As Russia Completes Transition to a Full War Economy, Treasury Takes Sweeping Aim at Foundational Financial Infrastructure and Access to Third Country Support", press release jy2404, 12 June 2024.',
      },
      {
        id: 'IV-11',
        text: '"Major Chinese Bank Halts All Settlements With Russia – Vedomosti", *The Moscow Times*, 7 February 2024; The Bell, "How Russia uses China to get round sanctions", 20 February 2024, which also names Bank of China, China Construction Bank and ICBC among the banks that tighten their checks.',
      },
      {
        id: 'IV-12',
        text: '"Turkish Banks Tighten Screws on Russia Over Fear of US Sanctions", *Bloomberg*, 17 January 2024; "UAE Banks Limit Payments With Russia Over Secondary Sanctions Threat – Vedomosti", *The Moscow Times*, 19 February 2024.',
      },
      {
        id: 'IV-13',
        text: 'Reuters, "Russia payment hurdles with China partners intensified in August, sources say", republished by *The Standard* (Hong Kong), 30 August 2024.',
      },
      {
        id: 'IV-14',
        text: 'The Bell (A. Prokopenko, A. Kolyandr), "The rise of Russia’s foreign trade middlemen", *Inside the Russian Economy* newsletter, 2 November 2024.',
      },
      {
        id: 'IV-15',
        text: 'US Treasury, "As Russia Completes Transition to a Full War Economy, Treasury Takes Sweeping Aim at Foundational Financial Infrastructure and Access to Third Country Support", press release jy2404, 12 June 2024.',
      },
      {
        id: 'IV-16',
        text: 'Council Regulation (EU) 2025/395 of 24 February 2025 amending Regulation (EU) No 833/2014, Annex XI, p. 383 (VTB Shanghai); Council Regulation (EU) 2025/2033 of 23 October 2025, p. 115 (subsidiaries of VTB, Sberbank and Alfa-Bank in Belarus, VTB Kazakhstan, as of 2 December 2025).',
      },
      {
        id: 'IV-17',
        text: 'Council Regulation (EU) 2026/1848 of 23 July 2026, Annex VIII (Sberbank India, India VTB, as of 13 August 2026).',
      },
      {
        id: 'IV-18',
        text: 'Reuters, "Russia, China find payments workaround as US sanctions net widens, sources say", republished by *Yahoo News*, June 2024; Council Regulation (EU) No 833/2014 of 31 July 2014, consolidated version of 20 July 2025, Annex XLV, Part A (Heihe Rural Commercial Bank, Heilongjiang Suifenhe Rural Commercial Bank, as of 9 August 2025).',
      },
      {
        id: 'IV-19',
        text: '"Armenian Banks To Ditch Russian Cards Over U.S. Sanctions", *RFE/RL*, 29 March 2024; "Most Kazakh banks not servicing Russian Mir cards due to sanctions", *Interfax*, 3 April 2024.',
      },
      {
        id: 'IV-20',
        text: '"New procedure for Russian ruble transactions to be introduced in Kyrgyzstan", *24.kg*, April 2025; "Kyrgyz President Denounces “Politicized” Sanctions on Banks", *The Times of Central Asia*, August 2025.',
      },
      {
        id: 'IV-21',
        text: 'Council Regulation (EU) 2025/2033 of 23 October 2025, Annex XIV, p. 116 (Tolubay, Eurasian Savings Bank); Council Regulation (EU) 2026/506 of 23 April 2026 amending Regulation (EU) No 833/2014, *OJ* L of 23 April 2026, Annex XV, Part B, p. 70 (Keremet Bank, Capital Bank of Central Asia).',
      },
      {
        id: 'IV-22',
        text: 'The Bell (A. Prokopenko, A. Kolyandr), "The rise of Russia’s foreign trade middlemen", *Inside the Russian Economy* newsletter, 2 November 2024 (based on a Vedomosti article of 30 October 2024): less than 20% in early summer 2024, up to 80% at the end of October 2024. This press figure has no official equivalent, and no source read gives a figure for the payments that go through a given bank or channel.',
      },
      {
        id: 'IV-23',
        text: 'Reuters, "EXCLUSIVE: First Russia-China barter trade may come this autumn, sources say", 8 August 2024.',
      },
      {
        id: 'IV-24',
        text: '"Putin signs law allowing experimental foreign trade settlements in cryptocurrency", *TASS*, 8 August 2024.',
      },
      {
        id: 'IV-25',
        text: 'Bank of Russia, *Bank of Russia Annual Report for 2025*, 2026, p. 187 (579 users at the end of 2025, more than a quarter of them outside Russia); US Treasury (OFAC), *Sanctions Risk for Foreign Financial Institutions that Join Russian Financial Messaging System, System for Transfer of Financial Messages*, alert, 21 November 2024.',
      },
      {
        id: 'IV-26',
        text: "FinCEN, *FinCEN Alert on the A7 Network*, FIN-2026-Alert007, 1 October 2026, pp. 2-5. FinCEN counts at least 179.1 billion dollars of A7A5 transactions from February 2025 to June 2026 (p. 5). The token serves as the network's internal ledger, and this amount counts transfers, not new payments.",
      },
      {
        id: 'IV-27',
        text: 'US Treasury, "Treasury Sanctions Cryptocurrency Exchange and Network Enabling Sanctions Evasion and Cyber Criminals", press release sb0225, 14 August 2025, p. 1 (A7, Old Vector, the issuer of A7A5, and Grinex, the Kyrgyz exchange where it trades); Elliptic, "The fall of A7A5: how sanctions strangled the ruble stablecoin", 29 July 2026 (daily volume down 96% from July 2025 to June 2026).',
      },
      {
        id: 'IV-28',
        text: 'FinCEN, *FinCEN Alert on the A7 Network*, FIN-2026-Alert007, 1 October 2026, p. 5.',
      },
      {
        id: 'IV-29',
        text: 'Council Regulation (EU) 2026/506 of 23 April 2026 amending Regulation (EU) No 833/2014, recital 14, p. 2, and Annex XV, p. 70 (Dushanbe City Bank, Spitamen Bank, Commerce Bank of Tajikistan).',
      },
    ],
  },
  {
    source: 'partie-IV.md',
    slug: 'fight',
    title: 'Fight: the same goods, other sellers',
    nodeIds: ['N-F097', 'N-F032', 'N-M037'],
    blocks: [
      {
        kind: 'p',
        text: 'Since 2022, the coalition no longer sells Russia the goods that are useful for its weapons. These goods are on a common list called CHP (*Common High Priority*), such as integrated circuits or computer numerical control machine tools.[^IV-30] Russia must therefore replace these former imports with new suppliers, often in China, or go through illegal import networks, with companies in third countries that cost much more.[^IV-31] Because Russia no longer publishes its customs data, the report reads the sales that the selling countries declare, called mirror data.[^IV-32]',
      },
      {
        kind: 'figure',
        text: 'Figure 10. Exports of CHP goods to Russia, by reporting country, 2021-2025 (million current US dollars). Sources: UN Comtrade; KSE Institute (2026).[^IV-33]',
        figure: {
          number: 10,
          title: 'Exports of CHP goods to Russia, by reporting country, 2021-2025',
          unit: 'million current US dollars',
          period: '2021-2025',
          sources: 'UN Comtrade; KSE Institute (2026).',
        },
      },
      {
        kind: 'p',
        text: "China and Hong Kong take the place of the coalition (figure 10), but with two different roles. China is mainly a producer. For most of the dual-use goods it sells to Russia, its exports rise without a rise in its imports, and re-export affects only about a dozen high-technology products.[^IV-34] Hong Kong, on the contrary, is a platform. As the world's largest importer of chips, it replaces the coalition for processors, which, according to the KSE Institute, can point to re-exported Western chips.[^IV-35] It is also a financial centre that applies only UN sanctions.[^IV-36] Targeting China therefore hits production, and targeting Hong Kong hits transit and payment.",
      },
      {
        kind: 'p',
        text: "This change of suppliers has a price. From spring 2022, Russian imports become more expensive. According to CEPII, the main cause is neither transport nor the detour through neighbouring countries. It is the margins of the suppliers that stayed in the market, which the exit of Western competitors lets them raise, in particular for strategic goods.[^IV-37] Dependence on China makes this effect stronger. According to the KSE Institute, the premium that Russia pays China for priority goods rises with China's share of its purchases. And for computer numerical control machine tools, with no other seller, Russia must accept the Chinese price.[^IV-38] On the other hand, the average premium paid to all suppliers stays much lower, because other sellers remain cheaper.[^IV-39] The sanctions therefore do not cut access to these goods, but they make it more costly, and this cost mainly benefits China.",
      },
      {
        kind: 'p',
        text: "Russia's neighbours can also serve as a route. Armenia, Kazakhstan and Kyrgyzstan sell it much more machinery and electrical equipment than in 2021,[^IV-40] and together with Russia they form a customs union, with no customs between its members, which the KSE names as a possible route for the coalition's goods.[^IV-41]",
      },
      {
        kind: 'p',
        text: 'Because trade data do not say which goods end up in weapons, investigators take apart Russian weapons that fell in Ukraine. They record the brand and the date of manufacture of each component, then trace its path back (figure 11).[^IV-42]',
      },
      {
        kind: 'figure',
        text: 'Figure 11. Routes of the foreign components of Russian weapons (number of chains). Sources: RUSI, CAR, IISS; US and Ukrainian authorities; press.[^IV-43]',
        figure: {
          number: 11,
          title: 'Routes of the foreign components of Russian weapons',
          unit: 'number of chains',
          period: '',
          sources: 'RUSI, CAR, IISS; US and Ukrainian authorities; press.',
        },
      },
      {
        kind: 'p',
        text: 'Two thirds of the dated parts were made after the invasion: purchases therefore continue despite the controls.[^IV-44] They go through intermediaries, such as [[N-F097|Pixel Devices]] in Hong Kong, according to the US Treasury.[^IV-45] Sanctions lists name these intermediaries, but rarely the manufacturer. When a source links the two, it is most often a court case or the customs documents of a Russian importer, such as Microlab-IC, which supplies chips from Analog Devices and transistors from Nexperia to the buyer for [[N-F032|KTRV]], the Russian missile maker.[^IV-46]',
      },
      {
        kind: 'p',
        text: "Hong Kong therefore serves both money, through [[N-M037|A7]]'s sub-agents, and goods (figure 11). Kyrgyzstan could play the same double role, since Russian payments go through its banks and its sales of CHP goods to Russia grow almost ninefold from 2021 to 2025.[^IV-47] But that a single network links these two circuits remains a hypothesis of the report, which no source read establishes.",
      },
    ],
    notes: [
      {
        id: 'IV-30',
        text: 'KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, pp. 1, 9.',
      },
      {
        id: 'IV-31',
        text: 'KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, p. 5 (premium of about 300% paid to China in 2025 for CHP goods); C. Emlinger and K. Lefebvre, *Working Around Sanctions. What Cost to Russia?*, CEPII, Policy Brief No. 50, February 2025, pp. 6, 8 (price rise due mainly to supplier margins).',
      },
      {
        id: 'IV-32',
        text: 'KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, p. 2.',
      },
      {
        id: 'IV-33',
        text: "Author's calculations based on UN Comtrade, declared exports to Russia, 55 six-digit Harmonized System (HS6) codes, 2021-2025, query of 25 October 2026; KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, p. 3. The list of 55 codes is the author's own; the reporters are 17 partners: the coalition, China, Hong Kong and nine third countries. China and Hong Kong make up 88% of declared sales in 2025. Mirror data are floors: the United Arab Emirates and Viet Nam declare nothing in 2024 or in 2025, and Kazakhstan and Thailand declare only in part.",
      },
      {
        id: 'IV-34',
        text: 'T. Deryugina and O. Shepotylo, *China’s Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 9 (52 of the 85 dual-use codes, 57% of the value; twelve codes, about 50 million dollars per month, with a re-export profile).',
      },
      {
        id: 'IV-35',
        text: 'KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, p. 3 (HS codes 854231 and 854239; partial Hong Kong data); B. Kot, "Hong Kong’s Technology Lifeline to Russia", Carnegie Endowment for International Peace, 17 May 2023 (24.3% of world imports of integrated circuits in 2020).',
      },
      {
        id: 'IV-36',
        text: 'US Department of State, Bureau of East Asian and Pacific Affairs, *2025 Hong Kong Policy Act Report*, 31 March 2025: the Hong Kong Monetary Authority reminds banks that they have no legal obligation to observe the unilateral sanctions of a foreign government.',
      },
      {
        id: 'IV-37',
        text: 'C. Emlinger and K. Lefebvre, *Working Around Sanctions. What Cost to Russia?*, CEPII, Policy Brief No. 50, February 2025, pp. 1, 6, 8 (+13% on average per product and origin, +22% for countries that do not apply sanctions, +122% for strategic products; transport and insurance +3%).',
      },
      {
        id: 'IV-38',
        text: "KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, pp. 5-6 (premium of about 300% in 2025 compared with the price paid by China's other customers).",
      },
      {
        id: 'IV-39',
        text: 'KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, p. 7 (premium below 50% most of the time, falling in 2025).',
      },
      {
        id: 'IV-40',
        text: "Author's calculations based on UN Comtrade, exports declared by Armenia, Kazakhstan and Kyrgyzstan to Russia, HS 84 (machinery) and HS 85 (electrical equipment), 2021 and 2024, query of 25 October 2026: Armenia ×43, Kazakhstan ×6.5, Kyrgyzstan ×26. These are trade data, not proof of circumvention.",
      },
      {
        id: 'IV-41',
        text: 'KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, p. 7. The KSE states that these flows alone do not prove circumvention.',
      },
      {
        id: 'IV-42',
        text: 'For example: J. Byrne et al., *Silicon Lifeline: Western Electronics at the Heart of Russia’s War Machine*, RUSI, August 2022, p. 24 (Analog Devices AD9361 transceiver in the Orlan-10 reconnaissance drone).',
      },
      {
        id: 'IV-43',
        text: 'J. Byrne et al., *Silicon Lifeline: Western Electronics at the Heart of Russia’s War Machine*, RUSI, August 2022; GUR, *War & Sanctions* portal; Conflict Armament Research, "Field dispatches", conflictarm.com; seven US Treasury press releases, among them "Treasury Targets Actors Involved in Drone Production for Russia’s War Against Ukraine", jy2651, 17 October 2024, and two from the State Department, among them "Sanctions to Disrupt Russia’s Military Industrial Base and Sanctions Evasion", 15 January 2025; Bureau of Industry and Security (BIS) of the US Department of Commerce, temporary denial order against A. Petrov and Electrocom VPK, August 2023; US Department of Justice, nine documents, among them "Four Arrested and Multiple Russian Nationals Charged in Connection with Two Schemes to Evade Sanctions and Send U.S. Technology Used in Weapons Systems to Russia", 1 November 2023; KSE Institute (O. Bilousova et al.), *Russia’s Military Capacity and the Role of Imported Components*, 19 June 2023, p. 6; C. Nye and C. Sun, "PRC Supply Chain Ecosystem Behind Iran’s Drone Campaign", Jamestown Foundation, *China Brief*, April 2026; Conflict Armament Research and D. Hayes, *Tracking the Components of Missiles and UAVs Used by Russia in Ukraine: What Lessons for Control Regimes?*, International Institute for Strategic Studies (IISS), September 2025, pp. 8, 12; press, eight articles, among them "Russia imports huge quantities of Irish components for use in suicide drones", *The Irish Times*, 18 February 2026. The figure shows 24 of the 42 chains recorded; "documented" means that a source read establishes it, press included; the widths count cases, not shares of trade; 94 of the 132 steps of these routes are documented. The step from the manufacturer to the intermediary is the least documented: 26 of the 44 routes in the figure have no source that names both the manufacturer and the intermediary (author\'s calculations).',
      },
      {
        id: 'IV-44',
        text: "Author's calculations based on the date codes of components recorded by Conflict Armament Research and the IISS, and by RUSI (*Silicon Lifeline*, August 2022), the GUR (*War & Sanctions* portal) and the US authorities: 19 of the 29 dated parts were made after February 2022. A date code shows manufacture, not shipment.",
      },
      {
        id: 'IV-45',
        text: 'US Treasury, "U.S. Continues to Degrade Russia’s Military-Industrial Base and Target Third-Country Support with Nearly 300 New Sanctions", press release jy2318, 1 May 2024, Annex 1 (at least 210 million dollars of electronics shipped to Russia since April 2022).',
      },
      {
        id: 'IV-46',
        text: 'StateWatch, "Who supplies the microelectronics for Russia’s missiles: the procurement network of Tactical Missiles Corporation", investigation carried out with UNITED24 Media, a Ukrainian state media outlet, based on customs documents, 18 August 2026, p. 1; US Department of Justice (Eastern District of New York), press release on the case *United States v. Goltsev et al.*, "Brooklyn Resident and Two Russian-Canadian Nationals Charged with Massive Sanctions Evasion and Export Control Scheme", 31 October 2023, p. 1 (purchases of components from US manufacturers and distributors by the company SH Brothers).',
      },
      {
        id: 'IV-47',
        text: "Author's calculations based on UN Comtrade, exports declared by Kyrgyzstan to Russia, 55 six-digit Harmonized System (HS6) codes, 2021 and 2025, query of 25 October 2026: 1.8 then 15.8 million current dollars.",
      },
    ],
  },
  {
    source: 'partie-V.md',
    slug: 'ownership',
    title: 'Who owns what, and what we do not know',
    blocks: [
      {
        kind: 'p',
        text: 'A sanction does not only hit the companies it names. In the United States, a company that designated persons own, together, at 50% or more is blocked too.[^V-1] The EU and the United Kingdom use ownership of more than 50%, and they add control.[^V-2] So knowing who owns a company tells us how far a sanction reaches it. The report therefore traces each chain of shares back to the State, to a person, or to a company without a documented ultimate owner (figure 12).',
      },
      {
        kind: 'figure',
        text: "Figure 12. Who owns the oil, the gas and the fleet: from the State, its holdings and the president's close associates down to intermediaries without a documented ultimate owner. Sources: US Treasury (OFAC); Council of the EU; FCDO; Rosneft; Gazprom; Gazprombank; Interfax.",
        figure: {
          number: 12,
          title:
            "Who owns the oil, the gas and the fleet: from the State, its holdings and the president's close associates down to intermediaries without a documented ultimate owner.",
          unit: '',
          period: '',
          sources:
            'US Treasury (OFAC); Council of the EU; FCDO; Rosneft; Gazprom; Gazprombank; Interfax.',
        },
      },
      {
        kind: 'p',
        text: 'At the top, the State holds the large companies through a few holdings. [[N-O004|Rosneftegaz]], which the State owns in full, is the largest shareholder of [[N-P026|Rosneft]]. Together with the Federal Agency for State Property Management ([[N-O003|Rosimushchestvo]]), it gives the State nearly half of [[N-O005|Gazprom]].[^V-3] Gazprom in turn owns almost all of [[N-O010|Gazprom Neft]][^V-4] and, with its company [[N-O011|Gazprom Kapital]], nearly half of [[N-M001|Gazprombank]].[^V-5] In the same way, the State has all the voting rights in [[N-P034|Transneft]], which owns the holding of the port of Novorossiysk.[^V-6] A designation of any one of them therefore reaches its subsidiaries owned at 50% or more.',
      },
      {
        kind: 'p',
        text: 'The State fleet follows the same pattern, then escapes it. [[N-P025|Sovcomflot]], the State shipowner, had its tankers managed by [[N-O015|SUN Ship Management]], which OFAC designated in 2023,[^V-7] then by [[N-O016|SKF Arktika]], which manages [[N-P052|South Fleet]] and [[N-P053|Invest Fleet]] according to the Council of the EU.[^V-8] [[N-P026|Rosneft]] and Gazprom Neft have their own shipowners, which OFAC designated in 2025.[^V-9] However, according to the US Treasury, Sovcomflot moved the management of tankers to [[N-O017|Stream Ship Management]] to evade sanctions,[^V-10] and according to the Council, [[N-O019|Citrine Marine]] now manages tankers that the group used to manage.[^V-11] No source names the ultimate owner of these two companies: the chain starts at the State and stops at an unknown owner.',
      },
      {
        kind: 'p',
        text: "Outside the State, the large private shareholders form a circle that the designation texts link to the president. According to the Council of the EU, [[N-O023|Gennady Timchenko]], a long-time acquaintance of [[N-O024|Vladimir Putin]], shares the majority of [[N-O028|Sibur]] with [[N-O032|Leonid Mikhelson]] and is a shareholder of [[N-O029|Bank Rossiya]].[^V-12] According to OFAC, he also owns [[N-O025|Volga Group]] and co-founded the trader [[N-O026|Gunvor]], in which Vladimir Putin allegedly has investments; the report could not verify this 2014 allegation.[^V-13] Mikhelson directly holds about 14% of [[N-O027|Novatek]];[^V-14] no primary source consulted confirms the stake attributed to Timchenko. [[N-O030|Yuri Kovalchuk]], another close associate according to the Council, held more than a third of Bank Rossiya in 2013 and controls the insurer [[N-O031|SOGAZ]].[^V-15] The circle reaches the family: according to OFAC, [[N-O033|Kirill Shamalov]] married [[N-O034|Katerina Tikhonova]], the president's daughter, in 2013, then bought 17% of Sibur from Timchenko.[^V-16]",
      },
      {
        kind: 'p',
        text: 'Close associates who do not own the State companies run them. According to the Council, [[N-O037|Igor Sechin]] ([[N-P026|Rosneft]]) is a personal friend of the president, and [[N-O038|Nikolai Tokarev]] ([[N-P034|Transneft]]) served with him in the KGB;[^V-17] according to OFAC, [[N-O039|Sergei Chemezov]] ([[N-O021|Rostec]]) met him in East Germany.[^V-18] The chain of shares stops at the State, but the chain of management leads to the same circle.',
      },
      {
        kind: 'p',
        text: 'Among the intermediaries and in the private fleet, the chain stops at an unknown owner:',
      },
      {
        kind: 'li',
        text: "**Oil trading.** According to OFAC, little-known traders with opaque ownership have carried up to half of Russian oil exports since the price cap.[^V-19] In this way, the Council links [[N-O049|Nord Axis]], which bought [[N-O058|Trafigura]]'s stake in [[N-O050|Vostok Oil]], a [[N-P026|Rosneft]] project, in 2022, to the [[N-O044|2Rivers group]], of which [[N-O043|Ahmed Kerimov]] is a shareholder; the ultimate owner of Nord Axis remains not documented.[^V-20]",
      },
      {
        kind: 'li',
        text: '**Ships.** About fifteen shipowners or managers, such as [[N-O062|White Agate Marine]] or [[N-O063|Sunne Co]], each own or operate at least six sanctioned ships, without a documented ultimate owner.[^V-21]',
      },
      {
        kind: 'li',
        text: "**[[N-O042|Surgutneftegaz]].** The country's third-largest oil company, run by [[N-O041|Vladimir Bogdanov]], a close associate of the president according to the Council, has never published its full ownership structure.[^V-22] The report makes the hypothesis that this opacity protects these companies: the 50% rule applies in law, but nobody can apply it without knowing the chain of shares.[^V-23] What remains is to designate each company for its activity and to link each new manager to the group it replaces, as the Council did for Citrine Marine and Nord Axis.",
      },
    ],
    notes: [
      {
        id: 'V-1',
        text: 'US Treasury (OFAC), *Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked*, 13 August 2014, p. 1; US Treasury (OFAC), *Frequently Asked Questions*, FAQ 401, consulted on 27 October 2026.',
      },
      {
        id: 'V-2',
        text: 'Council of the EU, *EU Best Practices for the effective implementation of restrictive measures*, doc. 10572/22, 27 June 2022, pp. 23-24, points 62 to 64; HM Treasury, OFSI, *UK financial sanctions general guidance*, section 4, consulted on 27 October 2026.',
      },
      {
        id: 'V-3',
        text: 'Rosneft, « Shareholder structure », status at 1 July 2021, p. 1 (Rosneftegaz, fully federal, holds 40.4% of Rosneft); Gazprom, « Equity capital structure », status at 31 December 2024, p. 1 (Rosimushchestvo 38.37%, Rosneftegaz 10.97%).',
      },
      {
        id: 'V-4',
        text: 'TASS, « Gazprom Neft to pay out record 2023 dividends of 102.43 rubles per share », 28 June 2024, p. 1 (95.68%).',
      },
      {
        id: 'V-5',
        text: 'Gazprombank, « Акционеры Газпромбанка », page consulted in its version of 18 February 2022, p. 1 (Gazprom 27.99%; Gazprom Kapital 21.90%).',
      },
      {
        id: 'V-6',
        text: 'Transneft, « Company », company website, version of 13 January 2022, p. 1; *Vedomosti*, « Транснефть консолидировала 62 % акций НМТП », 9 October 2018, p. 1.',
      },
      {
        id: 'V-7',
        text: 'US Treasury (OFAC), « Treasury Tightens the Price Cap with New Sanctions and Updated Guidance », press release jy2008, 20 December 2023, p. 1.',
      },
      {
        id: 'V-8',
        text: 'Council Implementing Regulation (EU) 2025/389 of 24 February 2025 implementing Regulation (EU) No 269/2014, annex, entries 530 to 532, pp. 44-45.',
      },
      {
        id: 'V-9',
        text: 'US Treasury (OFAC), « Treasury Intensifies Sanctions Against Russia by Targeting Russia’s Oil Production and Exports », press release jy2777, 10 January 2025, p. 1.',
      },
      {
        id: 'V-10',
        text: 'US Treasury (OFAC), « Treasury Intensifies Sanctions Against Russia by Targeting Russia’s Oil Production and Exports », press release jy2777, 10 January 2025, annex 2.',
      },
      {
        id: 'V-11',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, consolidated version of 28 September 2026, annex I, entry 685 « Citrine Marine SPC ».',
      },
      {
        id: 'V-12',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, consolidated version of 28 September 2026, annex I, entry 694 « Gennady Nikolayevich TIMCHENKO ».',
      },
      {
        id: 'V-13',
        text: 'US Treasury (OFAC), « Announcement Of Additional Treasury Sanctions On Russian Government Officials And Entities », press release jl2369, 28 April 2014, p. 1; US Treasury (OFAC), « Treasury Sanctions Russian Officials, Members Of The Russian Leadership’s Inner Circle, And An Entity For Involvement In The Situation In Ukraine », press release jl23331, 20 March 2014, p. 1.',
      },
      {
        id: 'V-14',
        text: 'FCDO, *UK Sanctions List*, version of 27 October 2026, entry RUS1126; Interfax, « Mikhelson transfers around 14% stake in Novatek to direct ownership, eliminates Cyprus ‘layer’ », 21 March 2022, p. 1.',
      },
      {
        id: 'V-15',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, consolidated version of 28 September 2026, annex I, entries 94 « Yuriy Valentinovich KOVALCHUK » and 1381 « Stepan Kirillovich KOVALCHUK ».',
      },
      {
        id: 'V-16',
        text: 'US Treasury (OFAC), « Treasury Designates Russian Oligarchs, Officials, and Entities in Response to Worldwide Malign Activity », press release sm0338, 6 April 2018, p. 1.',
      },
      {
        id: 'V-17',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, consolidated version of 28 September 2026, annex I, entries 671 « Igor Ivanovich SECHIN » and 672 « Nikolay Petrovich TOKAREV ».',
      },
      {
        id: 'V-18',
        text: 'US Treasury (OFAC), « Announcement Of Additional Treasury Sanctions On Russian Government Officials And Entities », press release jl2369, 28 April 2014, p. 1.',
      },
      {
        id: 'V-19',
        text: 'US Treasury (OFAC), « Treasury Tightens the Price Cap with New Sanctions and Updated Guidance », press release jy2008, 20 December 2023, p. 1, section « Under-the-radar traders of Russian oil ».',
      },
      {
        id: 'V-20',
        text: 'Council Implementing Regulation (EU) 2025/1476 of 18 July 2025 implementing Regulation (EU) No 269/2014, annex, entries 625 « 2Rivers DMCC » and 626 « 2Rivers PTE Ltd », p. 25; Interfax, « Trafigura sells 10% of Vostok Oil to Hong Kong firm Nord Axis Limited », 13 July 2022, p. 1.',
      },
      {
        id: 'V-21',
        text: "Author's calculations on the report's database, which brings together the designations of the OFAC lists (21 October 2026), the United Kingdom lists (27 October 2026), the EU acts and the records of the GUR *War & Sanctions* portal: companies that own or operate at least six ships and whose owner none of these sources names.",
      },
      {
        id: 'V-22',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, consolidated version of 28 September 2026, annex I, entry « Vladimir Leonidovich BOGDANOV »; *The Moscow Times*, « Surgut Discloses $29Bln Cash Hoard », 30 April 2013.',
      },
      {
        id: 'V-23',
        text: 'US Treasury (OFAC), *Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked*, 13 August 2014, p. 1; US Treasury (OFAC), *Frequently Asked Questions*, FAQ 401, consulted on 27 October 2026.',
      },
    ],
    nodeIds: [
      'N-P026',
      'N-M001',
      'N-P034',
      'N-P025',
      'N-P052',
      'N-P053',
      'N-O004',
      'N-O003',
      'N-O005',
      'N-O010',
      'N-O011',
      'N-O015',
      'N-O016',
      'N-O017',
      'N-O019',
      'N-O023',
      'N-O024',
      'N-O028',
      'N-O032',
      'N-O029',
      'N-O025',
      'N-O026',
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
      'N-O058',
      'N-O050',
      'N-O044',
      'N-O043',
      'N-O062',
      'N-O063',
      'N-O041',
      'N-O042',
    ],
  },
  {
    source: 'partie-VI.md',
    slug: 'limits',
    title: 'Limits',
    blocks: [
      {
        kind: 'p',
        text: 'The report does not measure the effect of the sanctions: when no source establishes a causal link, that link remains a hypothesis. In addition, four limits weigh on the facts themselves.',
      },
      {
        kind: 'li',
        text: '**The database covers maritime transport well, but banks and weapons poorly.** It links few companies to a payment or a component, and it gives an amount for almost none of them. Part III, on payments, therefore rests on fewer facts than Part II, on the fleet.[^VI-1]',
      },
      {
        kind: 'li',
        text: '**Only official sources receive a reliability grade.** Institute reports and the press are not graded, so the weight of the facts that come from them is not measured.[^VI-2]',
      },
      {
        kind: 'li',
        text: '**Mirror data give a minimum.** Russia no longer publishes its trade by product, so the report reads the declarations of its partners. But the United Arab Emirates and Viet Nam declare no common high priority items (CHP) for weapons in 2024-2025, and Kazakhstan and Thailand declare only part of them.[^VI-3]',
      },
      {
        kind: 'li',
        text: '**The fleet dates come mainly from Ukrainian military intelligence (GUR), a party to the conflict.** The GUR gives the current owner and manager of a ship, but rarely the date of the change. This is why figure 8 rests on the Global Fishing Watch registry, which, for its part, is not archived.[^VI-4]',
      },
      {
        kind: 'p',
        text: 'Finally, no person has reviewed any fact: rules and models do the checks (annex A). As a result, each fact must be verified at its source before it serves for a designation.',
      },
      {
        kind: 'h3',
        text: 'Lines of research',
      },
      {
        kind: 'p',
        text: 'These limits point to directions for research:',
      },
      {
        kind: 'li',
        text: '**Measure the effect of the sanctions.** Bring together monthly series of prices and export volumes, such as the Urals prices that the Russian tax administration publishes and the flows that the KSE and the Centre for Research on Energy and Clean Air (CREA) track. Then compare them with the designation dates, to test whether a designation really widens the discount on Russian crude.',
      },
      {
        kind: 'li',
        text: '**Document payments and components.** Link the companies in the database to payments and components, with amounts, from FinCEN alerts, US Treasury press releases and studies that take Russian weapons apart, to learn what volume passes through the Kyrgyz banks and the sub-agents of [[N-M037|A7]].',
      },
      {
        kind: 'li',
        text: '**Grade all sources.** Extend the ADMIRALTY scale to institute reports and the press, to learn what weight to give to facts that come from the KSE, from Kpler (a maritime trade data company) or from newspapers.',
      },
      {
        kind: 'li',
        text: '**Complete the mirror data.** Look for customs data that cover the United Arab Emirates, Viet Nam, Kazakhstan and Thailand, to learn what share of the high priority items for weapons passes through these countries.',
      },
      {
        kind: 'li',
        text: '**Date the fleet changes.** Archive the Global Fishing Watch records and compare them with the flag registries, to learn how long a designated ship takes to change its identity.',
      },
    ],
    notes: [
      {
        id: 'VI-1',
        text: "Author's calculations on the report's database, which brings together the designations of the OFAC lists (21 October 2026), the United Kingdom lists (16 October 2026) and the EU acts, company registers, the GUR records and press articles: relations from companies to a payment, a component or an amount, compared with the management and ownership relations of ships.",
      },
      {
        id: 'VI-2',
        text: "Author's calculations on the report's database, which brings together the designations of the US Treasury *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO *UK Sanctions List* (version of 16 October 2026) and the EU acts, company registers and ship records: reliability grades, on the ADMIRALTY scale, of the cited documents (sanctions lists, EU acts, public statistics, institute reports, press). The letter A is given only when the document comes from an official issuer on its own website.",
      },
      {
        id: 'VI-3',
        text: 'UN Comtrade, mirror data, exports to Russia of the 55 codes of the common high priority items list (CHP) by reporter, 2024 and 2025, query of 25 October 2026 (no line declared by the United Arab Emirates and Viet Nam); KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, p. 3.',
      },
      {
        id: 'VI-4',
        text: 'GUR (Ukrainian military intelligence), *War & Sanctions* portal, ship records, 2026 updates; Global Fishing Watch, vessel registry, 2026.',
      },
    ],
    nodeIds: ['N-M037'],
  },
  {
    source: 'conclusion.md',
    slug: 'conclusion',
    title: 'Conclusion',
    nodeIds: ['N-P026', 'N-P030', 'N-M037', 'N-F097'],
    blocks: [
      {
        kind: 'p',
        text: 'The sanctions do have an effect on the Russian economy. First, they reduce federal oil and gas revenue, which falls by 36% at constant prices from 2021 to 2025,[^C-1] while the state raises the profit tax and VAT.[^C-2] Also, since November 2025, the gap between the price of Russian crude and the price of Brent, the North Sea oil that serves as the benchmark, has almost doubled. The report links this to the US designation of [[N-P026|Rosneft]] and [[N-P030|Lukoil]], but it cannot measure that link: on average, a Russian barrel sells for some twenty dollars or more below Brent.[^C-3] The sanctions also make the goods that Russia imports more expensive, and not mainly because of the intermediaries. According to CEPII, the increase does not come from transport or from the detour through neighbouring countries. It comes from the margins of the suppliers that stayed in the Russian market, which the exit of Western competitors lets them raise.[^C-4] According to KSE, the premium that China charges for priority goods for weapons also rises with Russia’s dependence on China.[^C-5]',
      },
      {
        kind: 'p',
        text: 'Yet Russia gets around them in two ways. On the one hand, in a way that is illegal under Western sanctions, it uses a parallel market of intermediaries. In January 2026, the “shadow fleet” carries 79% of the crude exported by sea,[^C-6] and the companies that manage these tankers are often based in the United Arab Emirates.[^C-7] The sub-agents of [[N-M037|the A7 network]] pay suppliers from accounts outside Russia,[^C-8] and Hong Kong companies with no named owner, such as [[N-F097|Pixel Devices]], ship the electronics.[^C-9] On the other hand, in a legal way, it turns to new trade partners outside the coalition. China becomes its largest customer, India buys twenty times more Russian crude in 2025 than in 2021,[^C-10] and China supplies 77% of the priority goods for weapons (the components that the coalition watches first) that Russia imports in 2025, while Hong Kong, a financial centre and re-export platform, supplies 11%.[^C-11] These partners take advantage of their position, because Russia has few other choices: China pays less for Russian crude than for crude from its other suppliers,[^C-12] and it keeps the upper hand in the talks on the gas that Europe no longer buys.[^C-13] So, according to the report’s hypothesis, part of the cost of the sanctions for Russia becomes a gain for its new partners.',
      },
      {
        kind: 'p',
        text: 'The report can thus answer its starting question: which routes do the money and the goods of the war take? The money comes mainly from oil sold to Asia and carried by the shadow fleet. It then moves through payment agents and third-country banks, further and further away from the dollar. The goods come mainly from China, directly, and from Hong Kong, through intermediaries.',
      },
      {
        kind: 'p',
        text: 'For a decision-maker, these two routes call for two responses. Against the parallel market, designating companies one by one leaves time, according to the report’s hypothesis, to create new ones, all the more so because the EU often designates a vessel months after the United States.[^C-14] Targeting a whole network at once (owner, manager, payment agent) and aligning the coalition’s lists would cut this delay. Against the new partners, however, only the threat of secondary sanctions seems to carry weight: in India, according to KSE, it made electronics sales to Russia fall by 95% in one month in 2024.[^C-15]',
      },
    ],
    notes: [
      {
        id: 'C-1',
        text: 'Author’s calculations based on the Ministry of Finance of Russia, annex 3.1, « Краткая информация об исполнении федерального бюджета », 5 May 2026, line 1.1; World Bank, “Inflation, GDP deflator (annual %)” (NY.GDP.DEFL.KD.ZG), Russia, 2014-2025, update of 8 October 2026.',
      },
      {
        id: 'C-2',
        text: 'Federal Tax Service of Russia (FNS), « Ставка налога на прибыль организаций изменилась с 2025 года », 20 January 2025 (Federal Law No. 176-FZ of 12 July 2024); FNS, « С 2026 года ставка НДС увеличена », 17 December 2025 (Federal Law No. 425-FZ of 28 November 2025).',
      },
      {
        id: 'C-3',
        text: 'Author’s calculations based on the World Bank, *Commodity Markets (Pink Sheet)*, monthly Brent prices, update of 2 October 2026, and the Federal Tax Service of Russia (FNS), « Опубликованы данные для расчёта НДПИ… », monthly pages, August 2023 to September 2026 (Urals price). Monthly gap of 10 to 16 dollars per barrel before November 2025, and of 19 to 27 dollars after.',
      },
      {
        id: 'C-4',
        text: 'C. Emlinger and K. Lefebvre, *Working Around Sanctions. What Cost to Russia?*, CEPII, Policy Brief No. 50, February 2025, pp. 1, 6, 8 (Russian import prices +13% on average by product and origin, +22% for countries that do not apply sanctions, +122% for strategic products; transport and insurance +3%).',
      },
      {
        id: 'C-5',
        text: 'KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, p. 5 (premium of about 300% in 2025 compared with the price paid by China’s other customers).',
      },
      {
        id: 'C-6',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026, p. 3. KSE classifies these vessels by their flag and their insurance.',
      },
      {
        id: 'C-7',
        text: 'Author’s calculations on the report’s database, which brings together the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records: country of the head office of the selected tanker management companies.',
      },
      {
        id: 'C-8',
        text: 'FinCEN, *FinCEN Alert on the A7 Network*, FIN-2026-Alert007, 1 October 2026, pp. 2-5.',
      },
      {
        id: 'C-9',
        text: 'US Treasury, “U.S. Continues to Degrade Russia’s Military-Industrial Base and Target Third-Country Support with Nearly 300 New Sanctions”, press release jy2318, 1 May 2024, annex 1; FCDO, *UK Sanctions List*, version of 16 October 2026.',
      },
      {
        id: 'C-10',
        text: 'Author’s calculations based on Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2 (China); UN Comtrade, imports from Russia reported by India, HS 2709, net weight, 2021 and 2025, query of 25 October 2026.',
      },
      {
        id: 'C-11',
        text: 'Author’s calculations based on UN Comtrade, exports to Russia reported by 17 partners (coalition, China, Hong Kong and nine third countries), 55 six-digit Harmonized System codes taken from the common high priority (CHP) goods list of the EU, the United States, the United Kingdom and Japan, 2025, query of 25 October 2026: China 77%, Hong Kong 11% of reported sales.',
      },
      {
        id: 'C-12',
        text: 'T. Deryugina and O. Shepotylo, *China’s Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4 (discount of 5 to 9% per year since 2022; according to the authors, Moscow thus gives up part of its oil rent, because it cannot lose its largest customer).',
      },
      {
        id: 'C-13',
        text: 'S. Vakulenko, “Price Analysis Shows China Holds Upper Hand in Russia Gas Supply Talks”, *Carnegie Politika*, Carnegie Endowment for International Peace, 23 October 2026.',
      },
      {
        id: 'C-14',
        text: 'Author’s calculations based on the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026) and Annex XLII of Regulation (EU) No 833/2014 (as at 22 October 2026): the United States designates first in 182 of the 211 cases, with a median gap of 131 days.',
      },
      {
        id: 'C-15',
        text: 'KSE Institute (L. Risinger, M. Talalaievskyi, B. Hilgenstock), *Russian CHP Imports Tracker*, Q1 2026, April 2026, p. 6. KSE attributes the fall mainly to Executive Order 14114, and to a lesser extent to Russian and Indian efforts.',
      },
    ],
  },
  {
    source: 'annexe-A.md',
    slug: 'annex-method',
    title: 'Annex A. Research method',
    nodeIds: [],
    blocks: [
      {
        kind: 'h3',
        text: 'A.1 The database',
      },
      {
        kind: 'p',
        text: 'The report rests on a database of entities (companies, vessels, sites, ports, banks, people, legal acts) and of the relations between them, such as a designation, an ownership, the management of a vessel, a port call, an oil flow or a bank settlement. Each fact in the database points to an archived document (web page, official act, data file, register response), with the page and the extract that establish it. As at 27 October 2026, the database holds 6,327 entities. Because the selection does not use the 1,165 military units, close to 5,200 entities are tested.[^A-1]',
      },
      {
        kind: 'p',
        text: 'These documents come from the official sanctions lists (OFAC, United Kingdom, EU acts), company registers, public statistics (UN Comtrade, Eurostat, World Bank, Bank of Russia, Russian Ministry of Finance), research institutes (KSE, CREA, Bruegel) and investigative journalism.',
      },
      {
        kind: 'h3',
        text: 'A.2 The source rules',
      },
      {
        kind: 'li',
        text: 'A designation is cited from the official entry of the OFAC list, the UK list or the EU act.',
      },
      {
        kind: 'li',
        text: 'The portal of Ukrainian military intelligence (GUR) is cited record by record, and its claims stay attributed to the GUR, a party to the conflict.',
      },
      {
        kind: 'li',
        text: 'Because Russia has not published its trade by product since 2022, this trade is read in the declarations of its partners (mirror data).',
      },
      {
        kind: 'li',
        text: 'No data from a leak is cited, but a press article about a leak can be.',
      },
      {
        kind: 'li',
        text: 'A source that is known but not archived stays a lead and does not count as a fact. In the same way, a value with no source stays undocumented.',
      },
      {
        kind: 'li',
        text: 'The reliability of the issuer of each source follows the ADMIRALTY scale, from A (official issuer) to F (cannot be judged).',
      },
      {
        kind: 'h3',
        text: 'A.3 The selection of critical nodes',
      },
      {
        kind: 'p',
        text: 'The three conditions of Part I apply in the same way to all entities in the database:',
      },
      {
        kind: 'li',
        text: '**Exposed to sanctions**: a designation relation to an EU, OFAC or UK list, or 50% or more ownership by a designated entity;',
      },
      {
        kind: 'li',
        text: '**Active in 2024-2026**: a relation dated in this period (designation, port call, transshipment, event);',
      },
      {
        kind: 'li',
        text: '**Goes through a third country**: the entity’s country of registration, the flag of one of its vessels or a direct counterparty is a country that does not apply the coalition’s sanctions. A country read only in a company’s name does not count as long as no archived document gives the company’s address.',
      },
      {
        kind: 'p',
        text: 'The vessels of the same management company, or failing that of the same owner, form a single node.',
      },
      {
        kind: 'h3',
        text: 'A.4 The check of the facts and the text',
      },
      {
        kind: 'p',
        text: 'No person has reviewed any fact. Rules and models other than those that proposed the selected facts have checked them, while other facts still wait for a check or a better source. In the same way, agents separate from the writer of each part of the text reviewed it and checked its sources one by one.',
      },
    ],
    notes: [
      {
        id: 'A-1',
        text: 'Author’s calculations on the report’s database, which brings together the designations of the OFAC lists (21 October 2026), the UK lists (16 October 2026) and EU acts, company registers, GUR records and press articles: entities in the database as at 27 October 2026, including the military units, which are not tested.',
      },
    ],
  },
];

// English text of the 12 figures of the publication: fig1 and fig2 content, panel titles, notes,
// and English labels for the French strings of data/publication-figures.json. {x} marks a value read from the data.
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
    // the finding of note 4 (2021 and 2025 only), and cites note IV-5 of that figure, which covers
    // 2019-2025.
    chart: {
      title: 'Exports settled in roubles',
      label: 'Exports settled in roubles, percentage of export settlements, by year',
      unit: '% of export settlements',
      period: '2019-2025',
      source: 'Source: Bank of Russia (2026).',
      finding: '4',
      note: { part: 'finance', id: 'IV-5' },
      marked: [2021, 2025],
    },
    // Each value is written exactly as in the list item of the same place, with the note of
    // that item. The item on the price has no note.
    values: [
      { value: '84%', note: '1' },
      { value: '79%', note: '2' },
      { value: 'almost doubled', note: '' },
      { value: 'less than one fifth', note: '3' },
      { value: '53%', note: '4' },
      { value: '77%', note: '5' },
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
    critical: 'Critical nodes',
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
  },
  // The critical nodes of each layer. Their sum is the count of critical nodes of the text.
  numbers: {
    layers: [
      { value: '442', label: 'Pay' },
      { value: '29', label: 'Finance' },
      { value: '22', label: 'Fight' },
    ],
  },
} as const;

export const payUi = {
  image: import.meta.env.BASE_URL + 'report-media/baku-oil-wells-1903.jpg',
  estimate: 'Hollow point: estimate (a measure other than customs)',
  crossingNote: 'Ring: where one line goes below another, between two year-end values.',
  // The mark where a line of the old buyers goes below a line of a new buyer.
  crossing: '{a} below {b}',
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
      port: 'Port',
      count: 'Visits',
      tankers: 'Tankers',
      limit: 'A visit is an AIS presence in the port, not a loading.',
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
} as const;

export const financeUi = {
  image: import.meta.env.BASE_URL + 'report-media/sestroretsk-rouble-1771.jpg',
  figure: {
    // The years that the steps of the scene show, from the data of figure 9.
    steps: [2021, 2022, 2023, 2024, 2025],
    stepLabel: 'Rouble share of settlements',
    exports: 'Exports',
    imports: 'Imports',
    tableCaption: 'Data of figure 9, percentage of total',
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
    // The unit of the chain counts, as the note of figure 11 gives it: a count can have decimals.
    chainUnit: 'one chain = 1, shared between its routes',
  },
  noPeriod: 'Not given in the source of the figure',
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
    // The date of the counts, as the annex of the final text gives it.
    dataDate: 'Database as at 27 October 2026',
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
