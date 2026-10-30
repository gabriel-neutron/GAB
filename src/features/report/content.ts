export const report = {
  title: 'Russia’s war economy',
  subtitle: 'What keeps it running in 2026',
  date: 'October 2026',
  deck: 'Oil, money and imported components. Following the infrastructure that sustains Russia’s war, and the limits of sanctions.',
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
    source: 'synthese.md',
    slug: 'summary',
    title: 'Summary',
    blocks: [
      {
        kind: 'p',
        text: '**The problem.** Since 2022, the European Union, the United States, the United Kingdom and their allies have imposed broad sanctions on Russia, from oil and gas to military technology. Yet the war goes on, and it costs more and more: at constant prices,[^S-1] the defence budget planned for 2025 is 2.6 times the 2021 spending.[^S-2] Where do the money and the technology that let Russia wage it come from?',
      },
      {
        kind: 'p',
        text: '**The method.** In a database of nearly 5,200 entities, where each fact points to an archived document, the report looks for the nodes (companies, ports, fleets, banks, payment channels) that are exposed to sanctions, active in 2024-2026 and linked to a country that does not apply them. These nodes serve to earn the money for the war, to move it, or to buy the components of weapons.[^S-3]',
      },
      {
        kind: 'p',
        text: '**The result.** Russia holds out, and the report explains this by new trade relations with countries that are not aligned with the coalition. These countries use their strategic autonomy to avoid secondary sanctions (which target companies in third countries), while they take advantage of their strong position in negotiations with Russia.',
      },
      {
        kind: 'li',
        text: '**Customers:** From 2021 to 2025, EU purchases from Russia fall by 84%. By contrast, China becomes Russia’s first customer, and India multiplies its purchases of Russian crude by twenty.[^S-4]',
      },
      {
        kind: 'li',
        text: '**Ships:** To deliver them, Russia relies on the "shadow fleet" (tankers without Western insurance), which carries 79% of the crude exported by sea in January 2026.[^S-5] Most of the selected nodes are therefore the companies that manage these tankers, often based in the United Arab Emirates.[^S-6]',
      },
      {
        kind: 'li',
        text: '**Price:** But this detour has a cost. Since November 2025, the discount on Russian crude (its price gap with Brent, the benchmark oil) has almost doubled.[^S-7] The report links this, as a hypothesis, to the US sanctions of October 2025 against [[N-P026|Rosneft]] and [[N-P030|Lukoil]].[^S-8] The partners profit from it: China buys Russian crude at a discount and sells the components of weapons at a high premium.[^S-9]',
      },
      {
        kind: 'li',
        text: '**Budget:** The share of oil and gas in federal revenue falls from half in 2014 to less than one fifth in 2026, mostly because these revenues decline.[^S-10]',
      },
      {
        kind: 'li',
        text: '**Currency:** The rouble settles 53% of Russian exports in 2025, against 14% in 2021.[^S-11] With China, the rouble and the yuan settle almost all payments.[^S-12] This ties Russia to a partner for which it carries little weight.[^S-13]',
      },
      {
        kind: 'li',
        text: '**Components:** Finally, China supplies 77% of the high-priority items for weapons (the components that the coalition monitors first) sold to Russia in 2025, and Hong Kong, a financial centre and re-export platform, 11%.[^S-14]',
      },
    ],
    notes: [
      {
        id: 'S-1',
        text: 'World Bank, "Inflation, GDP deflator (annual %)" (NY.GDP.DEFL.KD.ZG), Russia, update of 8 October 2026.',
      },
      {
        id: 'S-2',
        text: 'Author’s calculations based on the Ministry of Finance of Russia, annex 3.1, «Краткая информация об исполнении федерального бюджета», 5 May 2026, line 2.2 «Национальная оборона»; Reuters (D. Korsounskaïa), «Траты России на оборону в 25г вырастут до 13,5 трлн р…», 30 September 2024, republished by *The Moscow Times*, Russian edition.',
      },
      {
        id: 'S-3',
        text: 'Author’s calculations on the report’s database, which combines the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records: entities in the database, nodes that meet the three selection conditions, and countries of the head office of the selected tanker management companies.',
      },
      {
        id: 'S-4',
        text: 'Author’s calculations based on Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2 (all goods); UN Comtrade, imports from Russia reported by India and China, HS 2709, net weight, 2021 and 2025, query of 25 October 2026.',
      },
      {
        id: 'S-5',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026, p. 3. KSE classifies these ships by their flag and their insurance.',
      },
      {
        id: 'S-6',
        text: 'Author’s calculations on the report’s database, which combines the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records: entities in the database, nodes that meet the three selection conditions, and countries of the head office of the selected tanker management companies.',
      },
      {
        id: 'S-7',
        text: 'Author’s calculations based on World Bank, *Commodity Markets (Pink Sheet)*, monthly Brent prices, update of 2 October 2026, and Federal Tax Service of Russia (FNS), «Опубликованы данные для расчёта НДПИ…», monthly pages, August 2023 to September 2026 (Urals price): the discount goes from 10-16 to 19-27 dollars per barrel.',
      },
      {
        id: 'S-8',
        text: 'US Treasury (OFAC), "Russia-related Designations; Issuance of New and Amended Russia-related General Licenses", Recent Actions, 22 October 2025.',
      },
      {
        id: 'S-9',
        text: 'KSE Institute (L. Risinger, B. Hilgenstock), *Russian CHP Imports Tracker*, Q2 2026, July 2026, pp. 5-6; T. Deryugina and O. Shepotylo, *China’s Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4.',
      },
      {
        id: 'S-10',
        text: 'Author’s calculations based on the Ministry of Finance of Russia, annex 3.1, «Краткая информация об исполнении федерального бюджета», 5 May 2026, lines 1, 1.1 and 1.2; Ministry of Finance of Russia, «Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года», press release, 9 October 2026. The year 2026 covers January to September. The decline in oil and gas revenue explains about two thirds of the fall in their share in 2025, and half in 2026 (share recalculated with the other revenues of the previous year).',
      },
      {
        id: 'S-11',
        text: 'Bank of Russia, "Currency Composition of Settlements for Exports", Russia, 2021 and 2025, update of 15 October 2026.',
      },
      {
        id: 'S-12',
        text: 'TASS, "National currencies account for nearly 100% of Russia-China settlements", 23 October 2026 (interview with Ivan Tchebeskov, Deputy Minister of Finance of Russia).',
      },
      {
        id: 'S-13',
        text: 'T. Deryugina and O. Shepotylo, *China’s Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4 (Russia accounts for 3.6% of China’s trade in goods in 2025; China, about 40% of Russia’s).',
      },
      {
        id: 'S-14',
        text: 'Author’s calculations based on UN Comtrade, exports to Russia reported by 17 partners (coalition, China, Hong Kong and nine third countries), 55 six-digit codes of the Harmonized System taken from the Common High Priority (CHP) list of the EU, the United States, the United Kingdom and Japan, 2025, query of 25 October 2026: China 77%, Hong Kong 11% of reported sales.',
      },
    ],
    nodeIds: ['N-P026', 'N-P030'],
  },
  {
    source: 'introduction.md',
    slug: 'introduction',
    title: 'Introduction',
    blocks: [
      {
        kind: 'p',
        text: 'Sanctions against Russia did not start in 2022. As early as 2014, at the time of the annexation of Crimea, the European Union froze the assets of 21 Russian and Crimean officials. It then banned the five large Russian state banks from raising funds for more than 90 days on its markets, and restricted the sale of oil technology and of dual-use goods meant for the military.[^Int-1] Then, in December 2016, the United States kept its sanctions in place until Russia applied the Minsk agreements, signed in 2014 and 2015 to stop the fighting in eastern Ukraine.[^Int-2] By contrast, after the invasion of Ukraine on 24 February 2022, the measures changed in scale: an embargo on Russian oil, a price cap on oil sold elsewhere, and bans on ports and banks.',
      },
      {
        kind: 'p',
        text: 'Yet the war goes on in 2026, and the Russian state manages to pay for it: at constant prices,[^Int-3] the budget planned for defence in 2025 is 2.6 times the 2021 spending,[^Int-4] while, over the same period, oil and gas revenue falls by 36%.[^Int-5] If this revenue declines while war spending rises, which routes do the money and goods of the war take?',
      },
      {
        kind: 'p',
        text: 'This report looks for these routes by asking three questions:',
      },
      {
        kind: 'li',
        text: 'Which nodes (companies, ports, fleets, banks) make it possible to finance the war?',
      },
      {
        kind: 'li',
        text: 'Who owns them?',
      },
      {
        kind: 'li',
        text: 'How do they get around the sanctions?',
      },
      {
        kind: 'p',
        text: 'To answer, it follows what has changed since 2022 in exports, imports and payments. After each measure, it looks for correlations between the sanctions and trade, then puts forward explanations. Each explanation is attributed to its source, or presented as a hypothesis when no source establishes it. The method and the chronology of sanctions open the report, and the limits of the evidence close it.',
      },
    ],
    notes: [
      {
        id: 'Int-1',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014, annex I; Council Regulation (EU) No 833/2014 of 31 July 2014, arts. 2 to 5.',
      },
      {
        id: 'Int-2',
        text: 'US Treasury (OFAC), "Treasury Sanctions Individuals and Entities In Connection with Russia’s Occupation of Crimea and the Conflict in Ukraine", press release jl0688, 20 December 2016.',
      },
      {
        id: 'Int-3',
        text: 'World Bank, "Inflation, GDP deflator (annual %)" (NY.GDP.DEFL.KD.ZG), Russia, update of 8 October 2026.',
      },
      {
        id: 'Int-4',
        text: 'Author’s calculations based on the Ministry of Finance of Russia, annex 3.1, «Краткая информация об исполнении федерального бюджета», 5 May 2026, line 2.2 «Национальная оборона»; Reuters (D. Korsounskaïa), «Траты России на оборону в 25г вырастут до 13,5 трлн р…», 30 September 2024, republished by *The Moscow Times*, Russian edition.',
      },
      {
        id: 'Int-5',
        text: 'Author’s calculations based on the Ministry of Finance of Russia, annex 3.1, «Краткая информация об исполнении федерального бюджета», 5 May 2026, line 1.1; World Bank, "Inflation, GDP deflator (annual %)" (NY.GDP.DEFL.KD.ZG), Russia, 2014-2025, update of 8 October 2026.',
      },
    ],
    nodeIds: [],
  },
  {
    source: 'partie-I.md',
    slug: 'method-chronology',
    title: 'Method and chronology of sanctions',
    blocks: [
      {
        kind: 'p',
        text: 'To follow the money and goods of the war, the report divides the Russian economy into nodes: a site (a port, a plant, a gas field), a company, a fleet of ships or a payment channel (a bank, a platform, a digital token). These nodes fall into three layers, pay, finance and fight (figure 1). The report links them because they depend on one another: the pay layer brings the money that the other two need. As the report assumes, a sanction that cuts one layer therefore also hinders the layers that it feeds.',
      },
      {
        kind: 'p',
        text: 'The report does not keep all designated nodes, but only those that it calls critical, which meet three conditions. First, a critical node is exposed to sanctions: the European Union (EU), the US Office of Foreign Assets Control (OFAC) or the United Kingdom designates it, or a designated person owns 50% or more of it. An old designation does not tell whether the node is still in use, so the node must also leave a dated trace from 2024-2026: production, transit or a new designation. Finally, it passes through a third country, through its head office, the flag of its ships or a counterparty. A third country does not apply the sanctions of the coalition (the EU, the United States, the United Kingdom and their allies), and it is therefore through such a country that Russia can get around them.',
      },
      {
        kind: 'figure',
        text: 'Figure 1. The three layers of the Russian war economy and their links. Source: author.',
        figure: {
          number: 1,
          title: 'The three layers of the Russian war economy and their links',
          unit: '',
          period: '',
          sources: 'author',
        },
      },
      {
        kind: 'p',
        text: 'The report covers 2024-2026 because by then the main oil sanctions are in place: the embargo, the price cap, then the first designations of shipowners that do not respect this cap (figure 2).[^I-1] These years therefore show how trade has adapted to these sanctions.',
      },
      {
        kind: 'figure',
        text: 'Figure 2. Chronology of the main sanctions against Russia, 2014-2026. Sources: EU and OFAC acts.[^I-2][^I-3][^I-4][^I-5][^I-6]',
        figure: {
          number: 2,
          title: 'Chronology of the main sanctions against Russia',
          unit: '',
          period: '2014-2026',
          sources: 'EU and OFAC acts.[^I-2][^I-3][^I-4][^I-5][^I-6]',
        },
      },
      {
        kind: 'p',
        text: 'The data come from a database of nearly 5,200 entities (companies, ships, sites, ports, banks, persons and legal acts)[^I-7] and the relations between them, such as a designation, ownership, the management of a ship, a port call, an oil flow or a payment. These facts come from official sanctions lists, company registers and published investigations, and each one points to the archived document that establishes it. The reliability of each source follows the ADMIRALTY scale, used by intelligence services and investigators. It rates the issuer with a letter, from A for an official issuer (sanctions list, company register, official journal) to F when nothing makes it possible to judge it.',
      },
      {
        kind: 'p',
        text: 'In total, 493 nodes are critical: 442 serve to pay, 29 to finance and 22 to fight, with the ships of one management company counted as a single node.[^I-8] For at least 416 of them, the three conditions rest on a document from an official issuer.[^I-9]',
      },
    ],
    notes: [
      {
        id: 'I-1',
        text: 'US Treasury (OFAC), "Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia’s War Machine", press release jy1795, 12 October 2023.',
      },
      {
        id: 'I-2',
        text: 'Council Regulation (EU) No 269/2014 of 17 March 2014 (art. 2 and annex I) and Council Regulation (EU) No 833/2014 of 31 July 2014 (arts. 2 to 5).',
      },
      {
        id: 'I-3',
        text: 'Council Regulation (EU) 2022/879 of 3 June 2022 (art. 3 m); Council Regulation (EU) 2022/2367 of 3 December 2022 (art. 3 n) and Commission Implementing Regulation (EU) 2022/2368 of 3 December 2022.',
      },
      {
        id: 'I-4',
        text: 'Council Regulation (EU) 2023/250 of 4 February 2023 and Commission Implementing Regulation (EU) 2023/251 of 4 February 2023; US Treasury (OFAC), "Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia’s War Machine", press release jy1795, 12 October 2023.',
      },
      {
        id: 'I-5',
        text: 'Council Regulation (EU) 2025/395 of 24 February 2025 (annex XIV); US Treasury (OFAC), "Russia-related Designations; Issuance of New and Amended Russia-related General Licenses", Recent Actions, 22 October 2025.',
      },
      {
        id: 'I-6',
        text: 'Commission Implementing Regulation (EU) 2026/124 of 14 January 2026; Council Regulation (EU) 2026/506 of 23 April 2026 (annex XVI).',
      },
      {
        id: 'I-7',
        text: 'Author’s calculations on the report’s database, which combines the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records. The database holds 6,327 entities, including 1,165 military units excluded from the selection, which gives nearly 5,200 entities examined, and 2,299 entities designated by the EU, OFAC or the United Kingdom.',
      },
      {
        id: 'I-8',
        text: 'Author’s calculations on the report’s database, which combines the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records (450 nodes); published investigations on banks and suppliers of weapons (43 nodes). The pay layer dominates because the lists of designated ships are long and well documented: the count measures what is documented, not the economic weight of each layer.',
      },
      {
        id: 'I-9',
        text: 'Author’s calculations on the report’s database, which combines the designations of the US Treasury’s *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO’s *UK Sanctions List* (version of 16 October 2026) and EU acts, company registers and vessel records: nodes whose three conditions rest on a document from an official issuer. The letter A is given only when the document comes from an official issuer on its own website; institute reports and the press receive no reliability rating.',
      },
    ],
    nodeIds: ['N-P026', 'N-P030'],
  },
  {
    source: 'partie-II.md',
    slug: 'pay',
    title: 'Pay: selling oil and gas',
    nodeIds: ['N-P026', 'N-P030'],
    blocks: [
      {
        kind: 'p',
        text: 'Let us start with the elephant in the room, the subject that is both the most discussed and often the most misunderstood: oil and gas, which carry the Russian economy. In 2021, their rent (what they earn above their cost of production) is worth about one sixth of GDP;[^II-1] fuels make up more than 40% of goods exports,[^II-2] and oil and gas bring in more than a third of federal budget revenue.[^II-3]',
      },
      {
        kind: 'figure',
        text: 'Figure 3. Russian exports by buyer (billion US dollars) and crude bought from Russia (million tonnes), 2020-2025. Sources: Bruegel; Eurostat; UN Comtrade; CREA.[^II-4][^II-5]',
        figure: {
          number: 3,
          title:
            'Russian exports by buyer (billion US dollars) and crude bought from Russia (million tonnes)',
          unit: 'billion US dollars; million tonnes',
          period: '2020-2025',
          sources: 'Bruegel; Eurostat; UN Comtrade; CREA.',
        },
      },
      {
        kind: 'p',
        text: "From 2022, the EU almost closes its market to Russian oil, with an embargo on crude carried by sea, then on oil products (figure 2).[^II-6] It also cuts its purchases of Russian gas, then decides in January 2026 to end them in stages.[^II-7] In total, across all goods, its purchases from Russia fall by 84% from 2021 to 2025, and those of the whole coalition by 82%.[^II-8] On the other hand, Asia takes over (figure 3): China becomes Russia's first customer, and India buys twenty times more Russian crude in 2025 than in 2021.[^II-9] According to Kpler, a maritime trade analytics company, two reasons explain this shift:[^II-10]",
      },
      {
        kind: 'li',
        text: '**Price**: Sold at a discount, Russian crude stays cheaper for the buyer;',
      },
      {
        kind: 'li',
        text: '**Politics**: China and India do not apply the sanctions, and their leaders do not want to appear to give in to the United States.',
      },
      {
        kind: 'p',
        text: "Gas takes the same road to Asia: in 2025, Gazprom delivers more gas by pipeline to China than to Europe for the first time.[^II-11] But it is China that sets the terms. To sell gas from the Yamal peninsula, which Europe no longer buys, Russia has only one possible customer, and this customer is in no hurry to close the deal on the new Power of Siberia 2 pipeline: China does not want to depend too much on a single supplier, and it knows that Russia has no other buyer.[^II-12] Already, through the first pipeline, Power of Siberia, signed in 2014, Russia sells its gas cheaper than Turkmenistan, and much cheaper than it used to sell it to Western Europe; according to Sergei Vakulenko, a researcher at the Carnegie centre, these terms are probably the best Gazprom can hope for in a new contract.[^II-13] Under the report's hypothesis, gas sold to China therefore replaces the volumes lost in Europe, but not their revenue.",
      },
      {
        kind: 'p',
        text: 'To measure what Russia loses on each barrel, we compare its oil with Brent, a North Sea oil that serves as the benchmark price. Urals, the main Russian export crude, is heavier and more sulphurous, so slightly cheaper: in 2019, before the war, this price gap, called the discount, stayed below one dollar per barrel.[^II-14]',
      },
      {
        kind: 'p',
        text: 'Since December 2022, a company of the EU or its allies can no longer carry, insure or finance Russian crude sold above a price cap (figure 4).[^II-15] The coalition chooses a cap rather than a full embargo because it pursues two aims at once: according to the US Treasury, to cut the oil profits that let Russia wage the war, and to keep world energy markets stable and well supplied.[^II-16] A full embargo, by contrast, would have taken this oil off the market, at the risk of raising prices for all buyers.',
      },
      {
        kind: 'figure',
        text: 'Figure 4. Brent price, Urals price and EU price cap, December 2022 to September 2026 (dollars per barrel). Sources: Russian government agencies; World Bank; EU regulations.[^II-17]',
        figure: {
          number: 4,
          title: 'Brent price, Urals price and EU price cap',
          unit: 'dollars per barrel',
          period: 'December 2022 to September 2026',
          sources: 'Russian government agencies; World Bank; EU regulations.',
        },
      },
      {
        kind: 'p',
        text: 'Until February 2025, Urals sells above the 60-dollar cap; it then mostly falls below it from March to August 2025, then below the cap lowered to 47.6 dollars in November and December 2025 (figure 4). As long as it is above the cap, it therefore travels mainly on ships and with insurers outside the coalition, which the cap does not bind (next section).[^II-18] Yet its price falls: according to Kpler, the sanctions push it down, far beyond what the quality gap explains.[^II-19] The gap widens further after October 2025 (figure 4), when OFAC designates [[N-P026|Rosneft]] and [[N-P030|Lukoil]], two large Russian oil groups,[^II-20] and several Indian refiners stop buying.[^II-21] The report sees this as a probable effect of this designation, but cannot measure it, because the series only shows a coincidence of dates.',
      },
      {
        kind: 'p',
        text: 'The countries that keep buying take advantage of this fall. According to Kpler, refiners in India, China and Turkey keep buying Russian crude through intermediaries, and the pressure of sanctions on its price improves their margins.[^II-22] China, in particular, has paid less for this crude than for that of its other suppliers since 2022; according to a study by the econ4ua network of economists, Moscow thus hands it a share of its oil rent, because it cannot lose its first customer.[^II-23] Economic theory predicted this: according to a model by economists published by the World Bank, a country that does not join the sanctions weakens their effect on the target country, but it also gains from them.[^II-24]',
      },
      {
        kind: 'p',
        text: 'Now, the tax on oil is calculated on the Urals price.[^II-25] A larger discount therefore reduces what the state, which pays for the war, earns from each barrel: according to the same econ4ua study, a 10% discount on sales to China alone costs the Russian Treasury about 3 billion dollars per year.[^II-26]',
      },
      {
        kind: 'figure',
        text: 'Figure 5. Share of oil and gas in federal revenue (%) and defence spending (trillion 2021 roubles), 2014-2026. Sources: Ministry of Finance of Russia; Reuters; World Bank.[^II-27]',
        figure: {
          number: 5,
          title:
            'Share of oil and gas in federal revenue (%) and defence spending (trillion 2021 roubles)',
          unit: '%; trillion 2021 roubles',
          period: '2014-2026',
          sources: 'Ministry of Finance of Russia; Reuters; World Bank.',
        },
      },
      {
        kind: 'p',
        text: 'Oil and gas weigh less and less in federal revenue (figure 5), for two reasons.',
      },
      {
        kind: 'p',
        text: 'First, what the state earns from oil and gas falls: about a quarter less in current roubles from 2024 to 2025, mainly because the oil price falls, according to the Ministry of Finance.[^II-28] From January to September 2026, this revenue falls by a further 17% year on year, while the Urals price in roubles rises: the ministry puts this down to a strong rouble and to the state paying more to oil companies through the "damper", a payment that rises with world fuel prices and that in September 2026 reaches its highest level since April 2022.[^II-29] Since the ministry also notes that the oil tax reform has been complete since 2024, the report concludes that the fall comes from prices, the rouble and this payment, more than from the tax itself.[^II-31a]',
      },
      {
        kind: 'p',
        text: "Second, other taxes rise: corporate profit tax goes from 20 to 25% in 2025, and VAT from 20 to 22% in 2026.[^II-30] This shift is intended, because the ministry presents the VAT rise as a way to bring the share of revenue that does not come from oil and gas to 80%.[^II-31b] According to the author's calculation, the fall in oil and gas revenue explains about two thirds of the drop in their share in 2025, and the rise in other revenue the rest; in 2026, the two reasons weigh about the same.[^II-32]",
      },
      {
        kind: 'p',
        text: "Under the report's hypothesis, an ever more costly defence therefore rests more and more on the other taxes, paid by Russian companies and households, and on the deficit. Because budget money is fungible, figure 5 does not, however, say that oil pays for defence.",
      },
    ],
    notes: [
      {
        id: 'II-1',
        text: 'Author\'s calculations based on World Bank, "Oil rents (% of GDP)" (NY.GDP.PETR.RT.ZS) and "Natural gas rents (% of GDP)" (NY.GDP.NGAS.RT.ZS), Russia, 2021, update of 8 October 2026: 9.7% and 5.9%.',
      },
      {
        id: 'II-2',
        text: 'World Bank, "Fuel exports (% of merchandise exports)" (TX.VAL.FUEL.ZS.UN), Russia, 2021, update of 8 October 2026. Fuels include oil, gas and coal.',
      },
      {
        id: 'II-3',
        text: "Author's calculations based on Ministry of Finance of Russia, annex 3.1, « Краткая информация об исполнении федерального бюджета », 5 May 2026, lines 1 and 1.1, year 2021.",
      },
      {
        id: 'II-4',
        text: 'Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2; Eurostat (Comext), HS 2709, weight; UN Comtrade, imports reported by China and India, HS 2709, net weight; Centre for Research on Energy and Clean Air (CREA), *Russia Fossil Tracker*, counter by destination country, API query of 26 October 2026. Russia has not published its trade by product since 2022 (KSE Institute, L. Risinger and B. Hilgenstock, *Russian CHP Imports Tracker*, Q2 2026, July 2026, p. 1): the figures are mirror data, that is, the reports of partner countries. A country that does not report, such as Belarus, does not have a zero value. The "coalition" group in the figure follows Bruegel: EU-27, United States, United Kingdom, Japan, South Korea, Switzerland, Norway. Turkey\'s crude is a CREA estimate from tracked cargoes, not a customs report; the 2023 weight for China is a Comtrade estimate. Prices and volumes are not separated.',
      },
      {
        id: 'II-5',
        text: "Author's calculations based on Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2, lines for the coalition countries, India and China; UN Comtrade, imports from Russia reported by India and China, HS 2709, net weight, 2021 and 2025, query of 25 October 2026. In dollars, China and India rise little in the figure: the axis goes up to the coalition's purchases in 2021, China already bought a lot of Russian crude before the war, and the value counts all goods, with crude sold at a discount. From 2021 to 2025, India's purchases are multiplied by 7 in dollars, against 20 in tonnes of crude.",
      },
      {
        id: 'II-6',
        text: 'Council Regulation (EU) 2022/879 of 3 June 2022 amending Regulation (EU) No 833/2014, art. 3m.',
      },
      {
        id: 'II-7',
        text: 'Regulation (EU) 2026/261 of the European Parliament and of the Council of 26 January 2026 on phasing out Russian natural gas imports, *OJ* L of 2 February 2026, recitals 1 and 10: since 2022, the EU has already greatly reduced its dependence on Russian gas, but the remaining volumes are still large.',
      },
      {
        id: 'II-8',
        text: "Author's calculations based on Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2, line 9 (EU) and lines for the coalition countries.",
      },
      {
        id: 'II-9',
        text: "Bruegel (A. Bahí Esteba, M. Barata da Rocha, N. E. Boivin et al.), *Russian foreign trade tracker*, Bruegel Datasets, 35th edition, 21 September 2026, fig. 2 (China); author's calculations based on UN Comtrade, imports from Russia reported by India, HS 2709, net weight, 2021 and 2025, query of 25 October 2026.",
      },
      {
        id: 'II-10',
        text: 'Kpler, "Rosneft and Lukoil sanctions are live: how India, China and Turkey adapt rather than exit", 2 December 2025.',
      },
      {
        id: 'II-11',
        text: 'Interfax, "Gazprom supplies 38.8 bcm of gas to China in 2025, for first time more than towards west – company", 13 January 2026. Gazprom compares China with all the countries of Europe that are not neighbours of Russia, Turkey included.',
      },
      {
        id: 'II-12',
        text: 'S. Vakulenko, "Why Can\'t Russia and China Agree on the Power of Siberia 2 Gas Pipeline?", *Carnegie Politika*, Carnegie Endowment for International Peace, 22 September 2025.',
      },
      {
        id: 'II-13',
        text: 'S. Vakulenko, "Price Analysis Shows China Holds Upper Hand in Russia Gas Supply Talks", *Carnegie Politika*, Carnegie Endowment for International Peace, 23 October 2026 (40 to 60 dollars less per thousand cubic metres than Turkmen gas; up to 30% less than in Western Europe over a long period; based on Chinese customs and an annex published by the Russian Ministry of Economic Development).',
      },
      {
        id: 'II-14',
        text: 'O. Yagova and G. Gorodyankin (Reuters), "IMO 2020 regulations challenge Russian Urals crude", *Hydrocarbon Processing*, 11 October 2019. Urals contains about 1.6 to 1.8% sulphur; when refined, it yields about 28% fuel oil, against 19% for Brent; the average 2019 gap is 0.73 dollars per barrel for Urals loaded in the Baltic.',
      },
      {
        id: 'II-15',
        text: 'Council Regulation (EU) 2022/2367 of 3 December 2022 amending Regulation (EU) No 833/2014, art. 3n.',
      },
      {
        id: 'II-16',
        text: 'US Treasury (OFAC), "Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia\'s War Machine", press release jy1795, 12 October 2023, statement by Deputy Secretary of the Treasury W. Adeyemo and section "The Price Cap".',
      },
      {
        id: 'II-17',
        text: 'Federal Tax Service of Russia (FNS), « Опубликованы данные для расчёта НДПИ… », monthly pages 2024-2026; Ministry of Finance of Russia, « О средней цене на нефть марки Urals », August and December 2023; Ministry of Economic Development of Russia, « О среднем уровне цен нефти сорта “Юралс” за сентябрь 2026 года », 2 October 2026, and the August 2026 notice reproduced by ConsultantPlus; World Bank, *Commodity Markets (Pink Sheet)*, monthly Brent prices, update of 2 October 2026; Council Regulation (EU) 2022/2367 of 3 December 2022 (60 dollars), Council Regulation (EU) 2025/1494 of 18 July 2025 (47.6 dollars from 3 September 2025) and Commission Implementing Regulation (EU) 2026/124 of 14 January 2026, annex, p. 3 (44.1 dollars from 1 February 2026). The Urals price is the tax base price used by the Russian state; the cap applies to the contract price, which no public series gives. December 2022 and ten months of 2023 have no documented price: these months stay empty in the figure.',
      },
      {
        id: 'II-18',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026, p. 3 (share of crude carried by tankers insured by the P&I clubs of the International Group, linked to the coalition).',
      },
      {
        id: 'II-19',
        text: 'Kpler, "Rosneft and Lukoil sanctions are live: how India, China and Turkey adapt rather than exit", 2 December 2025.',
      },
      {
        id: 'II-20',
        text: 'US Treasury (OFAC), "Russia-related Designations; Issuance of New and Amended Russia-related General Licenses", Recent Actions, 22 October 2025.',
      },
      {
        id: 'II-21',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026, p. 2 (Indian refiners MRPL, HPCL and HMEL).',
      },
      {
        id: 'II-22',
        text: 'Kpler, "Rosneft and Lukoil sanctions are live: how India, China and Turkey adapt rather than exit", 2 December 2025.',
      },
      {
        id: 'II-23',
        text: "T. Deryugina and O. Shepotylo, *China's Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4 (discount of 5 to 9% per year since 2022, about 13% in early and mid-2026, based on the unit values of Chinese crude imports, HS 270900).",
      },
      {
        id: 'II-24',
        text: 'F. Ghironi, D. Kim and G. K. Ozhan, *International Trade and Macroeconomic Dynamics with Sanctions*, unpublished working paper, version of 15 December 2022, posted online by the World Bank, p. 1, 5.',
      },
      {
        id: 'II-25',
        text: 'Federal Tax Service of Russia (FNS), « Опубликованы данные для расчёта НДПИ… », monthly pages 2024-2026; Ministry of Economic Development of Russia, « О среднем уровне цен нефти сорта “Юралс” за сентябрь 2026 года », 2 October 2026. The Urals price is the tax base price used by the Russian state.',
      },
      {
        id: 'II-26',
        text: "T. Deryugina and O. Shepotylo, *China's Support for Russia: Implications for Sanctions and European Security*, econ4ua, Policy Brief No. 4, September 2026, p. 4-5 (about 4 dollars per barrel).",
      },
      {
        id: 'II-27',
        text: 'Ministry of Finance of Russia, annex 3.1, « Краткая информация об исполнении федерального бюджета », 5 May 2026, lines 1, 1.1 and 2.2 « Национальная оборона », and « Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года », press release, 9 October 2026; Reuters (D. Korsunskaya), « Траты России на оборону в 25г вырастут до 13,5 трлн р… », 30 September 2024, reproduced by *The Moscow Times*, Russian edition; World Bank, "Inflation, GDP deflator (annual %)" (NY.GDP.DEFL.KD.ZG), Russia, 2014-2025, update of 8 October 2026; author\'s calculations. 2026 covers January to September (preliminary data); defence for 2024 and 2025 in plan values; defence for 2023 not documented; no 2021 roubles for 2026, for lack of a deflator.',
      },
      {
        id: 'II-28',
        text: 'Ministry of Finance of Russia, annex 3.1, « Краткая информация об исполнении федерального бюджета », 5 May 2026, line 1.1 « Нефтегазовые доходы » (11,131 billion roubles in 2024, 8,477 in 2025); Ministry of Finance of Russia, « Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2025 года », press release, 9 October 2025, p. 1.',
      },
      {
        id: 'II-29',
        text: 'Ministry of Finance of Russia, « Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года », press release, 9 October 2026, p. 1 and table (−17.2% year on year for oil and gas revenue; "damper" translates « демпфирующей компоненты », author\'s translation); « Выплаты нефтяникам установили очередной рекорд », *Nezavisimaya Gazeta*, 6 October 2026 (Urals at 5,453 roubles per barrel on average over nine months, +8.8%; damper of 305.5 billion roubles in September, based on Bloomberg).',
      },
      {
        id: 'II-30',
        text: 'Federal Tax Service of Russia (FNS), « Ставка налога на прибыль организаций изменилась с 2025 года », 20 January 2025 (Federal Law No. 176-FZ of 12 July 2024); FNS, « С 2026 года ставка НДС увеличена », 17 December 2025 (Federal Law No. 425-FZ of 28 November 2025).',
      },
      {
        id: 'II-32',
        text: "Author's calculations based on Ministry of Finance of Russia, annex 3.1, « Краткая информация об исполнении федерального бюджета », 5 May 2026, lines 1.1 and 1.2, and « Предварительная оценка исполнения федерального бюджета за январь-сентябрь 2026 года », press release, 9 October 2026, table. Method: the share is recalculated with the other revenue of the previous year; in 2025, it goes from 30.3% to 22.7%, and would be 24.9% without the rise in other revenue; from January to September 2026, it goes from 24.5% to 18.5%, and would be 21.2%.",
      },
      {
        id: 'II-31a',
        text: 'Ministry of Finance of Russia, *Основные направления бюджетной, налоговой и таможенно-тарифной политики на 2026 год и на плановый период 2027 и 2028 годов*, 3 October 2025, p. 21, 30 ("great tax manoeuvre" complete since 2024; damper adjusted for 2026).',
      },
      {
        id: 'II-31b',
        text: 'Ministry of Finance of Russia, *Основные направления бюджетной, налоговой и таможенно-тарифной политики на 2026 год и на плановый период 2027 и 2028 годов*, 3 October 2025, p. 21, 30.',
      },
    ],
  },
  {
    source: 'partie-III.md',
    slug: 'ports-fleet',
    title: 'Exporting through the ports and the fleet',
    nodeIds: ['N-P001', 'N-P002', 'N-P005', 'N-P011', 'N-P007', 'N-P025'],
    blocks: [
      {
        kind: 'p',
        text: 'The EU first sanctions what leaves (the oil), then how it leaves (the ships), and finally where it leaves from (the ports): the sanctions move up the logistics chain (figure 2). In June 2022, the EU decides the embargo on Russian crude and oil products carried by sea. It applies to crude in December 2022 and to products in February 2023.[^III-a] Since December 2022, EU companies can no longer carry, insure or finance this oil if it is sold above a price cap.[^III-b] Next, the tankers themselves become targets: the United States designates them from October 2023, and the EU closes its ports and its maritime services to them since June 2024.[^III-c] Finally, since February 2025, an EU company can no longer deal with the ports through which crude that does not go by pipeline leaves Russia: [[N-P001|Primorsk]] and [[N-P002|Ust-Luga]] on the Baltic, [[N-P005|Novorossiysk]] on the Black Sea, then, since April 2026, [[N-P011|Tuapse]], on the Black Sea, and Murmansk, on the Barents Sea.[^III-2] Like the price cap, these measures bind only coalition companies. Crude also leaves from [[N-P007|Kozmino]], on the Pacific, at the end of the Eastern Siberia-Pacific Ocean (ESPO) pipeline: in 2023, this port loads almost as much crude as Primorsk, the largest of these ports.[^III-1]',
      },
      {
        kind: 'p',
        text: 'Yet traffic at [[N-P001|Primorsk]], Ust-Luga and Novorossiysk holds up: in 2025, it is above its 2021 level. From January to April 2026, however, it falls at Novorossiysk, at Ust-Luga and above all at Tuapse, while the crude loaded across all ports rises a little (figure 6). To explain why traffic held up until 2025, the report relies on the "shadow fleet". This is the name that the KSE Institute, the research centre of the Kyiv School of Economics, gives to tankers linked to a country outside the coalition and without Western insurance;[^III-3] in January 2026, these tankers carry most of the crude exported by sea (figures 6B and 7A). Because these tankers do not use coalition companies, neither the cap nor the port ban affects them. The report\'s hypothesis is that their rise since the embargo explains why port traffic held up.',
      },
      {
        kind: 'figure',
        text: 'Figure 6. Traffic at Russian oil ports, 2014-2025, and its change from January to April 2026. Sources: ASOP; NMTP; KSE, based on Kpler.[^III-4]',
        figure: {
          number: 6,
          title:
            'Traffic at Russian oil ports, 2014-2025, and its change from January to April 2026',
          period: '2014-2025',
          sources: 'ASOP; NMTP; KSE, based on Kpler.',
        },
      },
      {
        kind: 'p',
        text: 'These tankers mostly fly the flags of countries outside the coalition, such as Panama, Barbados, Gabon or Sierra Leone,[^III-5] and the companies that manage them are often based outside Russia. For example, according to the US Treasury, [[N-P025|Sovcomflot]], the Russian state shipowner, transferred the management of tankers to Stream Ship Management, based in the United Arab Emirates, to try to evade sanctions.[^III-6]',
      },
      {
        kind: 'figure',
        text: 'Figure 7. Russian oil exports by sea, by route, fleet and buyer, January 2026. Sources: KSE and CREA, based on Kpler; other sources in the note.[^III-7]',
        figure: {
          number: 7,
          title: 'Russian oil exports by sea, by route, fleet and buyer, January 2026',
          period: 'January 2026',
          sources: 'KSE and CREA, based on Kpler; other sources in the note.',
        },
      },
      {
        kind: 'p',
        text: 'The sanctions also target the ships themselves. A designation targets a ship by its International Maritime Organization (IMO) number, which never changes. But its name, its flag, its owner and the identity it broadcasts in the Automatic Identification System (AIS), the radio signal that gives its position, can change. As a result, a designation tracks a ship that changes identity poorly (figure 8): about eight in ten designated tankers lose the AIS identity linked to their IMO number within a year. A lost identity alone does not prove evasion, though, because the ship may also be out of service or carry a new identity. EU ports, for their part, close to these ships: 37 of these tankers call there in the six months before their designation, against at least 7 in the two years after, because only 55 are tracked long enough to know.[^III-8] Designation does not stop loading, however: according to the KSE, more than one designated tanker in five still loads Russian oil in December 2025.[^III-9]',
      },
      {
        kind: 'figure',
        text: 'Figure 8. AIS identity and port calls of designated ships, before and after their designation (ships). Sources: Global Fishing Watch; OFAC, UK and EU lists.[^III-10]',
        figure: {
          number: 8,
          title:
            'AIS identity and port calls of designated ships, before and after their designation',
          unit: 'ships',
          sources: 'Global Fishing Watch; OFAC, UK and EU lists.',
        },
      },
      {
        kind: 'p',
        text: 'The lists also lag behind one another. For example, in February 2024 the United States designates the tanker GEORGY MASLOV, of the [[N-P025|Sovcomflot]] fleet;[^III-11] the ship then moves to the Russian flag, under a company of the same group,[^III-12] and the United Kingdom designates it only nine months later.[^III-13] More broadly, when the EU and the United States designate the same ship, the United States does so first in almost nine cases out of ten.[^III-14]',
      },
      {
        kind: 'p',
        text: "So a list of ships describes a state that the ship has often already left. The report's hypothesis is that targeting the company that manages the tankers, and the country where it is based, would reach the fleet more surely than targeting each ship.",
      },
    ],
    notes: [
      {
        id: 'III-1',
        text: 'US Treasury (OFAC), « Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia’s War Machine », press release jy1795, 12 October 2023 (ESPO crude exported through Russian Pacific ports, including Kozmino); « Russian Kozmino crude exports jump 9.4% in 2023 amid sanctions: reports », *S&P Global Commodity Insights*, 10 January 2024, based on Transneft, quoted by the TASS agency: 42.8 million tonnes loaded at Kozmino in 2023, against 44.4 million at Primorsk.',
      },
      {
        id: 'III-2',
        text: 'Council Regulation (EU) 2025/395 of 24 February 2025 amending Regulation (EU) No 833/2014, *OJ* L of 24 February 2025, Annex XIV (Annex XLVII, Part A, points 3 to 5); Council Regulation (EU) 2026/506 of 23 April 2026 amending Regulation (EU) No 833/2014, *OJ* L of 23 April 2026, Annex XVI (Annex XLVII, Part A, points 6 and 7). The measure bans transactions with the port; the port itself is on no sanctions list.',
      },
      {
        id: 'III-3',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026 (published online on 2 March 2026), p. 3. The insurance used is that of the clubs of the International Group of P&I Clubs, which brings together the major maritime liability insurers. In January 2026, 20% of the crude exported by sea leaves on tankers insured by these clubs.',
      },
      {
        id: 'III-4',
        text: "Association of Commercial Sea Ports of Russia (ASOP), annual press releases (2017-2026), from « Грузооборот морских портов России за 12 месяцев 2021 г. » (17 January 2022) to « Грузооборот морских портов России за 2025 год » (16 January 2026), reported by *PortNews* for 2017, 2018 and 2020, and « Грузооборот морских портов России за январь-апрель 2026 года », 14 May 2026, p. 1; Novorossiysk port group (NMTP), *Годовой отчет ПАО «НМТП» за 2016 год*, 2017, p. 7-8, and *Годовой отчет ПАО «НМТП» за 2019 год*, 30 April 2020, p. 1; KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026 (published online on 2 March 2026), p. 3, based on Kpler. Units: index 2021 = 100 for traffic, percentage for the 2026 change, thousand barrels per day for crude. A port's traffic counts all its goods, as there is no crude figure per port. Novorossiysk includes the terminal of the Caspian Pipeline Consortium (CPC), mostly Kazakh oil.",
      },
      {
        id: 'III-5',
        text: "Author's calculations on the report's database, which brings together the designations of the OFAC lists (21 October 2026), the UK lists (16 October 2026) and the EU acts, and the flags taken from the ship records: flags of the ships of the selected management companies.",
      },
      {
        id: 'III-6',
        text: 'US Treasury (OFAC), « Treasury Intensifies Sanctions Against Russia by Targeting Russia’s Oil Production and Exports », press release jy2777, 10 January 2025, Annex 2. In it, the Treasury designates Sovcomflot and Stream Ship Management.',
      },
      {
        id: 'III-7',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026 (published online on 2 March 2026), p. 2-8, based on Kpler; Centre for Research on Energy and Clean Air (CREA) (V. Raghunandan, P. Katinas and L. Wickenden), « January 2026 — Monthly analysis of Russian fossil fuel exports and sanctions », 18 February 2026, based on Kpler; Gazprom, according to Interfax, « Gazprom supplies 38.8 bcm of gas to China in 2025, for first time more than towards west – company », 13 January 2026; ENTSOG, according to TASS, « Russian gas exports to Europe via TurkStream up 1.4% in 9M », 1 October 2026; ExPro Consulting, « Transit of Russian oil through Ukraine fell to a new low – 9.7 million tons in 2025 », 2 February 2026; Urgewald, « In 2025, EU imports from the Kremlin’s flagship Yamal LNG project hit €7.2 billion », January 2026, based on Kpler; LSEG, according to Reuters, « Russian LNG exports dip in 2025 as sanctions squeeze logistics », reported by *Baird Maritime*, 30 December 2025; Global Energy Monitor, « Druzhba Oil Pipeline » and « Skovorodino-Mohe Oil pipeline », *GEM.wiki*, pages accessed on 26 October 2026. Oil by sea in January 2026, gas and crude by pipeline in 2025; units: thousand barrels per day, billion cubic metres, million tonnes. "Shadow fleet" and International Group insurance are KSE categories; the share on designated tankers comes from CREA, with a different method. "Other countries" is a residual (author\'s calculations). No published source links a tanker at sea to a buyer, and about 30% of the crude of January 2026 has no known destination in mid-February (KSE Institute, *Russian Oil Tracker*, February 2026, p. 8). The flow of the Eastern Siberia-Pacific Ocean (ESPO) pipeline to China is not documented; the CPC is not counted.',
      },
      {
        id: 'III-8',
        text: "Author's calculations based on Global Fishing Watch, « Port visits » and vessel identity registry, API version 3, data read on 27 October 2026; and the report's database, which brings together the designations of the US Treasury's *Specially Designated Nationals List* (OFAC, version of 21 October 2026), the FCDO's *UK Sanctions List* (version of 16 October 2026) and the EU acts: all designated tankers in the database with an IMO number and a designation date. Lost identity: 356 of the 441 tankers tracked for at least one year. EU port calls: 37 tankers in the six months before designation, at least 7 in the two years after, out of 497; only 55 are tracked for twenty-four months (6 before, 1 after for these). An EU port call is a presence in the port or anchorage of a member state, not a loading.",
      },
      {
        id: 'III-9',
        text: 'KSE Institute (B. Dodonov, B. Hilgenstock et al.), *Russian Oil Tracker*, February 2026 (published online on 2 March 2026), p. 2: 140 of the 621 tankers designated by at least one jurisdiction. The six jurisdictions used by the KSE are the EU, the United States, the United Kingdom, Canada, Australia and New Zealand.',
      },
      {
        id: 'III-10',
        text: "Author's calculations based on Global Fishing Watch, port calls and vessel registry, 2026; designation dates: OFAC's *SDN List*, FCDO's *UK Sanctions List* and Annex XLII of Regulation (EU) No 833/2014. Census of the 502 designated tankers in the database, of which 497 have an AIS identity; each share counts the ships tracked long enough (six, twelve or twenty-four months before 26 October 2026); the timeline shows 11 of these ships as examples. The AIS identity and flag dates come from the registry, of which the report keeps no copy: they are leads. A new identity not linked to the IMO number is out of scope: the identity loss is therefore a ceiling, and the port calls after designation are floors. A port call is a presence in the port or anchorage, not a loading.",
      },
      {
        id: 'III-11',
        text: 'US Treasury (OFAC), « Russia-related Designations; Issuance of Russia-related General Licenses », *Recent Actions*, 23 February 2024; US Treasury (OFAC), *Specially Designated Nationals List*, version of 21 October 2026, entry 46991 (ship linked to Sovcomflot).',
      },
      {
        id: 'III-12',
        text: 'GUR (Ukrainian military intelligence, a party to the conflict), *War & Sanctions* portal, record « GEORGY MASLOV », update of 5 October 2026: owner South Fleet, managed by SKF Arktika, a subsidiary of Sovcomflot.',
      },
      {
        id: 'III-13',
        text: 'FCDO, *UK Sanctions List*, version of 16 October 2026, entry RUS2331: designation of 25 November 2024, Russian flag, owner South Fleet.',
      },
      {
        id: 'III-14',
        text: "Author's calculations based on the US Treasury's *Specially Designated Nationals List* (OFAC, version of 21 October 2026) and Annex XLII of Regulation (EU) No 833/2014 (status at 22 October 2026): the United States designates first in 182 of the 211 cases, with a median gap of 131 days.",
      },
      {
        id: 'III-a',
        text: 'Council Regulation (EU) 2022/879 of 3 June 2022 amending Regulation (EU) No 833/2014, Art. 3m, paras. 1 and 3(a)-(b) (end of the exceptions on 5 December 2022 for crude and on 5 February 2023 for oil products).',
      },
      {
        id: 'III-b',
        text: 'Council Regulation (EU) 2022/2367 of 3 December 2022 amending Regulation (EU) No 833/2014, Art. 3n.',
      },
      {
        id: 'III-c',
        text: 'US Treasury (OFAC), « Treasury Sanctions Entities for Transporting Oil Sold Above the Coalition Price Cap to Restrict Russia’s War Machine », press release jy1795, 12 October 2023; Council Regulation (EU) 2024/1745 of 24 June 2024 amending Regulation (EU) No 833/2014, recital 13.',
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
        text: 'At the top, the State holds the large companies through a few holdings. Rosneftegaz, which the State owns in full, is the largest shareholder of [[N-P026|Rosneft]]. Together with the Federal Agency for State Property Management (Rosimushchestvo), it gives the State nearly half of Gazprom.[^V-3] Gazprom in turn owns almost all of Gazprom Neft[^V-4] and, with its company Gazprom Kapital, nearly half of [[N-M001|Gazprombank]].[^V-5] In the same way, the State has all the voting rights in [[N-P034|Transneft]], which owns the holding of the port of Novorossiysk.[^V-6] A designation of any one of them therefore reaches its subsidiaries owned at 50% or more.',
      },
      {
        kind: 'p',
        text: 'The State fleet follows the same pattern, then escapes it. [[N-P025|Sovcomflot]], the State shipowner, had its tankers managed by SUN Ship Management, which OFAC designated in 2023,[^V-7] then by SKF Arktika, which manages [[N-P052|South Fleet]] and [[N-P053|Invest Fleet]] according to the Council of the EU.[^V-8] [[N-P026|Rosneft]] and Gazprom Neft have their own shipowners, which OFAC designated in 2025.[^V-9] However, according to the US Treasury, Sovcomflot moved the management of tankers to Stream Ship Management to evade sanctions,[^V-10] and according to the Council, Citrine Marine now manages tankers that the group used to manage.[^V-11] No source names the ultimate owner of these two companies: the chain starts at the State and stops at an unknown owner.',
      },
      {
        kind: 'p',
        text: "Outside the State, the large private shareholders form a circle that the designation texts link to the president. According to the Council of the EU, Gennady Timchenko, a long-time acquaintance of Vladimir Putin, shares the majority of Sibur with Leonid Mikhelson and is a shareholder of Bank Rossiya.[^V-12] According to OFAC, he also owns Volga Group and co-founded the trader Gunvor, in which Vladimir Putin allegedly has investments; the report could not verify this 2014 allegation.[^V-13] Mikhelson directly holds about 14% of Novatek;[^V-14] no primary source consulted confirms the stake attributed to Timchenko. Yuri Kovalchuk, another close associate according to the Council, held more than a third of Bank Rossiya in 2013 and controls the insurer SOGAZ.[^V-15] The circle reaches the family: according to OFAC, Kirill Shamalov married Katerina Tikhonova, the president's daughter, in 2013, then bought 17% of Sibur from Timchenko.[^V-16]",
      },
      {
        kind: 'p',
        text: 'Close associates who do not own the State companies run them. According to the Council, Igor Sechin ([[N-P026|Rosneft]]) is a personal friend of the president, and Nikolai Tokarev ([[N-P034|Transneft]]) served with him in the KGB;[^V-17] according to OFAC, Sergei Chemezov (Rostec) met him in East Germany.[^V-18] The chain of shares stops at the State, but the chain of management leads to the same circle.',
      },
      {
        kind: 'p',
        text: 'Among the intermediaries and in the private fleet, the chain stops at an unknown owner:',
      },
      {
        kind: 'li',
        text: "**Oil trading.** According to OFAC, little-known traders with opaque ownership have carried up to half of Russian oil exports since the price cap.[^V-19] In this way, the Council links Nord Axis, which bought Trafigura's stake in Vostok Oil, a [[N-P026|Rosneft]] project, in 2022, to the 2Rivers group, of which Ahmed Kerimov is a shareholder; the ultimate owner of Nord Axis remains not documented.[^V-20]",
      },
      {
        kind: 'li',
        text: '**Ships.** About fifteen shipowners or managers, such as White Agate Marine or Sunne Co, each own or operate at least six sanctioned ships, without a documented ultimate owner.[^V-21]',
      },
      {
        kind: 'li',
        text: "**Surgutneftegaz.** The country's third-largest oil company, run by Vladimir Bogdanov, a close associate of the president according to the Council, has never published its full ownership structure.[^V-22] The report makes the hypothesis that this opacity protects these companies: the 50% rule applies in law, but nobody can apply it without knowing the chain of shares.[^V-23] What remains is to designate each company for its activity and to link each new manager to the group it replaces, as the Council did for Citrine Marine and Nord Axis.",
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
    nodeIds: ['N-P026', 'N-M001', 'N-P034', 'N-P025', 'N-P052', 'N-P053'],
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
