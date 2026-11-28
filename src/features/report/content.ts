import { reportTitles } from './titles';

export const report = {
  title: reportTitles.en,
  // The authors sign the report: the first screen, the end of the page and the PDF show it.
  byline: 'By Tomas Arden and Gabriel',
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
    'The flows shown here describe loading basins only. No published source in the report links a fleet category to an individual buyer. The authors read and reviewed the whole report; the facts of the database are checked by rules and by AI agents, not one by one by a person.',
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
        text: '**The problem.** Since 2022, the European Union, the United States, the United Kingdom and their allies (the coalition) have imposed wide-ranging sanctions on Russia, from oil and gas to military technology. Yet the war goes on, and it costs more and more: at constant prices (adjusted for inflation), the defence budget planned for 2025 is 2.6 times the spending of 2021. Where do the money and the technology that let Russia fight come from?',
      },
      {
        kind: 'p',
        text: '**The method.** The authors built a database of more than 7,100 entities, where every fact points to an archived document. In it, the report looks for the nodes, that is the companies, ports, ships, banks and payment channels through which the money and the goods of the war move, that were exposed to sanctions at some time in 2024-2026, active in 2024-2026 and tied to a country that does not apply them.',
      },
      {
        kind: 'p',
        text: '**The result.** Sanctions make the war more costly for Russia, but they do not cut its money or its goods: trade moves to partners that do not apply the sanctions, and to a parallel market of tankers, payment relays (banks and agents that pass on payments for Russia) and companies with no documented owner.',
      },
      { kind: 'p', text: '**What the report measures.**' },
      {
        kind: 'li',
        text: '**Designations:** When the EU and the United States designate (put on a sanctions list) the same tanker, the United States does so first in more than eight cases out of ten; for tankers on two or more lists, the median gap from the first designation to the second is 87 days.',
      },
      {
        kind: 'li',
        text: '**Port calls:** Of 711 tankers with a dated designation, 318 called at a port at least once after it, and 22 of them called in the EU or the United Kingdom.',
      },
      {
        kind: 'li',
        text: '**Owners and managers:** In the private fleet and in oil trading, the ownership chains often end at a company with no documented owner: according to the sanctions lists and, for part of them, to Ukrainian military intelligence (GUR), a party to the conflict, sixteen shipowners or managers (firms that run ships for their owners) each own or operate at least six designated vessels with no documented ultimate owner (the person or state at the top of the chain). On the archived pages of GUR, 427 of 757 ships that give both dates show an owner or manager that started after the designation.',
      },
      { kind: 'p', text: '**What the sources show.**' },
      {
        kind: 'li',
        text: "**Customers:** From 2021 to 2025, EU purchases from Russia fell by 84%[^1]; China became Russia's first customer, and India bought twenty times as much Russian crude by weight.",
      },
      {
        kind: 'li',
        text: '**Oil:** According to the KSE Institute of the Kyiv School of Economics, the tankers of the so-called "shadow fleet", tied to a country outside the coalition and with no Western insurance, carried 79% of the crude exported by sea in January 2026[^2]. From August 2023 to October 2025, Urals, the main Russian export crude, sold $10 to $16 below Brent, the North Sea reference crude, each month; since November 2025, after the designation of [[N-P026|Rosneft]] and [[N-P030|Lukoil]] by OFAC, the US Treasury sanctions office, it has sold $19 to $27 below.',
      },
      {
        kind: 'li',
        text: '**Budget:** The share of oil and gas in federal revenue falls from 51% in 2014 to 18.5% in January–September 2026, partly because that revenue is shrinking[^3].',
      },
      {
        kind: 'li',
        text: '**Currency:** The rouble was the currency of payment of 53% of Russian exports in 2025, against 14% in 2021[^4], and, according to the Russian government, the rouble and the yuan settle almost all payments with China.',
      },
      {
        kind: 'li',
        text: '**Components:** Of the priority goods for weapons that its partners declared as sold to Russia in 2025, China supplied 77% and Hong Kong 11%[^5], and parts made after the invasion turned up in Russian weapons in 2023.',
      },

      {
        kind: 'p',
        text: '*The authors are solely responsible for the content and conclusions presented. This report is under CC BY 4.0, except figure 8 (CC BY-NC 4.0): name the authors, link the licence and mark each change.*',
      },
    ],
    notes: [
      { id: '1', text: "authors' calculations based on @bruegel-tracker, fig. 2" },
      { id: '2', text: '@kse-rot-feb26, p. 3' },
      {
        id: '3',
        text: "authors' calculations based on @minfin-annual, lines 1, 1.1 and 1.2; @minfin-2026-09",
      },
      { id: '4', text: '@cbr-currency' },
      { id: '5', text: "authors' calculations based on @comtrade" },
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
        text: 'Sanctions against Russia did not begin in 2022. In 2014, after Russia annexed Crimea, the European Union froze the assets of 21 Russian and Crimean officials, barred the five largest Russian state banks from raising debt on its markets with a maturity above 90 days, and restricted sales of oil technology and of dual-use goods (civilian goods, such as chips, that an army can also use) meant for the army[^6]. In December 2016, the United States kept its sanctions in place until Russia implemented the Minsk agreements, signed in 2014 and 2015 to stop the fighting in eastern Ukraine[^7]. After the invasion of 24 February 2022, the measures changed scale: an embargo on Russian oil, a price cap on Russian oil sold elsewhere (coalition firms may not carry, insure or finance oil sold above it), and bans on ports and banks (figure 1).',
      },
      {
        kind: 'p',
        text: 'Yet the war goes on in 2026, and the Russian state pays for it: at constant prices, the defence budget planned for 2025 is 2.6 times the spending of 2021[^8], while over the same period oil and gas revenue falls by 36%[^9]. Which channels then carry the money and the goods of the war?',
      },
      {
        kind: 'li',
        text: 'Which nodes (companies, infrastructure, ships, banks) make it possible to finance the war?',
      },
      { kind: 'li', text: 'Who owns them?' },
      { kind: 'li', text: 'How do they get around the sanctions?' },
      {
        kind: 'p',
        text: 'The report shows which routes stay open after each measure; open sources rarely show circumvention itself, so it gives each mechanism as a claim of its source or as a hypothesis.',
      },
    ],
    notes: [
      { id: '6', text: '@eu-269-2014, Annex I; @eu-833-2014, Arts. 2–5' },
      { id: '7', text: '@ust-jl0688' },
      {
        id: '8',
        text: 'authors\' calculations based on @minfin-annual, line 2.2 "Национальная оборона" [National defence], year 2021; @korsunskaya-2024; @wb-deflator',
      },
      { id: '9', text: "authors' calculations based on @minfin-annual, line 1.1; @wb-deflator" },
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
        text: 'To wage a long war, Russia needs two flows: the foreign currency that its exports bring in, and the imported goods that its factories need to make weapons. The report starts not from national totals but from the points through which this money and these goods must pass.',
      },
      { kind: 'h3', text: 'The three layers' },
      {
        kind: 'p',
        text: 'These points are the nodes: sites (a port, a factory, a gas field), companies, fleets of ships or payment channels (a bank, a payment agent, or a token, a digital unit of value, such as A7A5, section 3.2). Each node serves one of three functions, which the report calls layers:',
      },
      {
        kind: 'li',
        text: '**Pay:** Earn the foreign currency that pays for the war, mainly by selling oil and gas;',
      },
      { kind: 'li', text: '**Finance:** Move that money, through banks and payment channels;' },
      { kind: 'li', text: '**Fight:** Import the components and make the weapons.' },
      {
        kind: 'p',
        text: 'The foreign-currency revenue of the pay layer settles the imports of the fight layer, and this settlement passes through the finance layer (figure 2). The money also takes a second, domestic path: taxes on oil and gas fill the federal budget, which orders weapons from Russian factories.',
      },
      { kind: 'h3', text: 'Nodes under watch' },
      {
        kind: 'p',
        text: 'A node is under watch when it meets three conditions; this is a filter, not a ranking:',
      },
      {
        kind: 'li',
        text: '**Exposed to sanctions:** The European Union (EU), the American Office of Foreign Assets Control (OFAC) or the United Kingdom designates it, or designated it at some time in 2024-2026, or a designated person owns 50% or more of it;',
      },
      {
        kind: 'li',
        text: '**Active in 2024-2026:** A dated production, transit or new designation shows it;',
      },
      {
        kind: 'li',
        text: '**Tied to a third country:** Its head office, the flag of its ships or a counterparty is in a country that does not apply the sanctions of the coalition (the EU, the United States, the United Kingdom and their allies). An oil exporter meets it through a buyer in such a country.',
      },
      {
        kind: 'figure',
        text: 'Figure 2: The three layers of the Russian war economy and their links. Diagram by the authors.',
        figure: {
          number: 2,
          title: 'The three layers of the Russian war economy and their links',
          unit: '',
          period: '',
          sources: 'Diagram by the authors.',
        },
      },
      {
        kind: 'p',
        text: 'These are the nodes where sanctions apply but activity goes on with a third country: where circumvention may be at work, and where a new measure could have an effect.',
      },
      {
        kind: 'p',
        text: 'The period follows the calendar of the sanctions: by 2024, the embargo, the price cap and the first designations of shipowners that break that cap are in place[^11]. The years 2024-2026 show how trade has adapted to them.',
      },
      {
        kind: 'figure',
        text: 'Figure 1: Timeline of the main sanctions, 2014-2026. Data: Regulations (EU) No 269/2014 and No 833/2014; Regulations (EU) 2022/879, 2022/2367, 2023/250, 2025/395, 2025/1494 and 2026/506; Implementing Regulations (EU) 2022/2368, 2023/251 and 2026/124; U.S. Department of the Treasury (2023); Office of Foreign Assets Control (2025)[^10].',
        figure: {
          number: 1,
          title: 'Timeline of the main sanctions',
          unit: '',
          period: '2014-2026',
          sources:
            'Regulations (EU) No 269/2014 and No 833/2014; Regulations (EU) 2022/879, 2022/2367, 2023/250, 2025/395, 2025/1494 and 2026/506; Implementing Regulations (EU) 2022/2368, 2023/251 and 2026/124; U.S. Department of the Treasury (2023); Office of Foreign Assets Control (2025)[^10].',
        },
      },
      { kind: 'h3', text: 'The data and its control' },
      {
        kind: 'p',
        text: 'The authors built a database of more than 7,100 entities (companies, ships, sites, ports, banks, people, legal acts) and of the relations between them, such as a designation, an ownership, a port call or a payment. These facts are taken from the official sanctions lists, company registers and published investigations, and each one points to the archived document that establishes it. The ADMIRALTY scale rates each issuer with a letter, from A (official) to F (cannot be judged; Annex A.2).',
      },
      {
        kind: 'p',
        text: 'In total, 637 nodes are under watch, counting the ships of one management company as a single node. The pay layer holds the most, because the lists of designated ships are long and well documented. For 572 of them, each of the three conditions rests on a document from an official issuer. In the data release, 12 of the 637 nodes no longer have an open designation. A semi-automated verification system checks the facts: automatic rules, AI reviewers, fixed checks of each excerpt and checks by the authors. Annex A describes the collection, the checks and the count.',
      },
    ],
    notes: [
      {
        id: '10',
        text: '@eu-269-2014; @eu-833-2014; @eu-2022-879; @eu-2022-2367; @eu-2022-2368; @eu-2023-250; @eu-2023-251; @eu-2025-395; @eu-2025-1494; @eu-2026-506; @eu-2026-124; @ust-jy1795; @ofac-20251022',
      },
      { id: '11', text: '@ust-jy1795' },
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
        text: 'Oil and gas carry the Russian economy. In 2021, their rent (what they earn beyond their cost of production) was worth 15.5% of GDP[^12]; fuels made up more than 40% of goods exports[^13], and oil and gas brought in more than a third of federal budget revenue[^14]. If sanctions were to dry up the money of the war, this is where they should bite first.',
      },
      { kind: 'h3', text: 'The buyers' },
      {
        kind: 'p',
        text: "From 2022, the EU almost closed its market to Russian oil, with an embargo on crude carried by sea, then on oil products[^15]. It also cut its purchases of Russian gas, then decided in January 2026 to stop them in stages[^16]. By contrast, Asia took over (figure 3): China became Russia's first customer, and India bought twenty times as much Russian crude by weight in 2025 as in 2021[^17]. Two reasons explain this shift[^18]:",
      },
      {
        kind: 'li',
        text: '**Price:** With fewer buyers allowed to take it, and more risk for those who do, Russian crude must be sold at a discount, so it is cheaper for the buyers that stay;',
      },
      {
        kind: 'li',
        text: '**Politics:** China and India do not apply the sanctions, and their leaders do not want to look as if they yield to the United States.',
      },
      {
        kind: 'p',
        text: 'Gas follows the same path to Asia: in 2025, for the first time, Gazprom delivered more gas by pipeline to China than to Europe[^19].',
      },
      {
        kind: 'p',
        text: "But China sets the terms: for the gas of the Yamal peninsula, which Europe no longer buys, it is the only possible customer, and it is in no hurry to seal a deal on the new Power of Siberia 2 pipeline, because it does not want to depend on a single supplier. In 2021, Gazprom sold 148.8 bcm (billion cubic metres) by pipeline to Europe, 26.7 to Turkey and 10 to China; in 2025, all Russian pipeline exports came to about 115 bcm, of which 38.8 went to China. Over the same period, Russian gas production fell from 762.3 to 663 bcm, and in 2025 exports of liquefied natural gas (LNG) fell by 2.5%, to 31.3 million tonnes[^20]. The report's hypothesis is that most of the gas that Europe no longer buys is not sold elsewhere but stays in the ground, and that the gas sold to China brings in less revenue than the gas once sold in Europe.",
      },
      {
        kind: 'figure',
        text: "Figure 3: Russian exports by buyer and crude bought from Russia, 2020-2025. Data: Bahí Esteba et al. (2026); Eurostat (2026); UN Comtrade (2026); CREA (2026). Authors' calculations[^21].",
        figure: {
          number: 3,
          title: 'Russian exports by buyer and crude bought from Russia',
          unit: 'billion US dollars; million tonnes',
          period: '2020-2025',
          sources:
            "Bahí Esteba et al. (2026); Eurostat (2026); UN Comtrade (2026); CREA (2026). Authors' calculations[^21].",
        },
      },
      { kind: 'h3', text: 'The price and the cap' },
      {
        kind: 'p',
        text: 'To measure what Russia loses on each barrel, the report compares Urals, the main Russian export crude, with Brent, the North Sea reference crude. Urals is heavier and higher in sulphur, so before the war it usually sold a little below Brent. In 2019, this price gap, called the discount, averaged $0.73 a barrel for Urals loaded in the Baltic, from January to early October[^22].',
      },
      {
        kind: 'p',
        text: 'Since December 2022, an EU company or a company of its allies can no longer carry, insure or finance Russian crude sold above a price cap (figure 4)[^23]. The coalition chose a cap rather than a full embargo to cut the oil profits that let Russia wage the war while keeping world energy markets supplied[^24].',
      },
      {
        kind: 'figure',
        text: 'Figure 4: Brent, Urals and the EU price cap, 2022-2026. Data: Federal Tax Service of Russia (2023-2026); Ministry of Finance of Russia (2023); Ministry of Economic Development of Russia (2026); World Bank (2026); EU regulations (2022-2026)[^25].',
        figure: {
          number: 4,
          title: 'Brent, Urals and the EU price cap',
          unit: 'dollars per barrel',
          period: '2022-2026',
          sources:
            'Federal Tax Service of Russia (2023-2026); Ministry of Finance of Russia (2023); Ministry of Economic Development of Russia (2026); World Bank (2026); EU regulations (2022-2026)[^25].',
        },
      },
      {
        kind: 'p',
        text: 'As long as Urals stays above the cap, it travels mostly on ships and with insurers outside the coalition, which the cap does not bind (section 2.5)[^26]. Its price falls all the same, well beyond what the quality gap explains: sanctions push it down[^27]. The gap widened again after October 2025, when OFAC designated [[N-P026|Rosneft]] and [[N-P030|Lukoil]], two large Russian oil groups[^28], and several Indian refiners stopped buying[^29]. From August 2023 to October 2025, in each month of the series, Urals was worth $10 to $16 less than Brent; since November 2025, it has been worth $19 to $27 less[^30]. The report sees a probable effect of this designation, without being able to measure it, because the series shows only a coincidence of dates.',
      },
      {
        kind: 'p',
        text: 'For the buyers who stayed, this fall is a windfall: refiners in India, China and Turkey keep buying Russian crude through intermediaries, and the pressure of sanctions on its price improves their margins[^31]. Since 2022, China has paid less for this crude than for that of its other suppliers: Moscow yields part of its oil rent to its first customer, which it cannot lose[^32].',
      },
      { kind: 'h3', text: 'The budget' },
      {
        kind: 'p',
        text: 'Russia taxes its oil on the market price of Urals at its export ports, and since 2025 no floor linked to Brent has limited that price[^33]. A bigger discount therefore cuts what the state, which pays for the war, draws from each barrel: a 10% discount on sales to China alone costs the Russian Treasury about $3 billion a year[^34].',
      },
      {
        kind: 'p',
        text: 'The share of oil and gas in federal revenue falls (figure 5) for two reasons, and the first is a real decline in that revenue. In current roubles, it fell by about a quarter from 2024 to 2025, mostly because of a lower oil price, then fell again from January to September 2026[^35]. This time, according to the Ministry of Finance, the fall comes from a lower average dollar exchange rate (a strong rouble) and from a rise in the "damper" (in Russian *dempfer*), a payment from the state to oil companies that increases with world fuel prices[^36].',
      },
      {
        kind: 'figure',
        text: "Figure 5: Oil, gas and defence in the federal budget, 2014-2026. Data: Ministry of Finance of Russia (2026); Korsunskaya (2024); World Bank (2026). Authors' calculations[^37].",
        figure: {
          number: 5,
          title: 'Oil, gas and defence in the federal budget',
          unit: '%; trillion 2021 roubles',
          period: '2014-2026',
          sources:
            "Ministry of Finance of Russia (2026); Korsunskaya (2024); World Bank (2026). Authors' calculations[^37].",
        },
      },
      {
        kind: 'p',
        text: 'The rest of the economy also pays more, and this is the second reason for the fall. Profit tax went from 20 to 25% in 2025, and VAT from 20 to 22% in 2026[^38]. This shift is deliberate: the budget guidelines of the Ministry of Finance for 2026-2028 present the VAT rise as one way to raise non-oil-and-gas revenue to 80% of federal revenue[^39].',
      },
      {
        kind: 'p',
        text: "The report's hypothesis is that an ever more expensive defence rests more and more on other taxes and on the deficit. Because budget money is fungible (a rouble of oil revenue cannot be told from any other), figure 5 does not say that oil pays for defence.",
      },
    ],
    notes: [
      {
        id: '12',
        text: "authors' calculations based on @wb-oil-rents; @wb-gas-rents | Oil rents (9.67%) plus natural gas rents (5.86%) in 2021.",
      },
      { id: '13', text: '@wb-fuel-exports' },
      {
        id: '14',
        text: "authors' calculations based on @minfin-annual, lines 1 and 1.1, year 2021",
      },
      { id: '15', text: '@eu-2022-879, Art. 3m' },
      { id: '16', text: '@eu-2026-261, recitals 1 and 10' },
      {
        id: '17',
        text: "@bruegel-tracker, fig. 2; authors' calculations based on @comtrade | Crude oil (HS 2709) imported from Russia, as India reports it: 88.7 Mt in 2025 against 4.5 Mt in 2021, that is 19.5 times by weight and 19.6 times by CIF value.",
      },
      { id: '18', text: '@kpler-rosneft' },
      { id: '19', text: '@interfax-gazprom-china' },
      { id: '20', text: '@carnegie-pos2; @osw-gas-2021; @interfax-gas-forecast; @reuters-lng' },
      { id: '21', text: '@bruegel-tracker, fig. 2; @eurostat-comext; @comtrade; @crea-tracker' },
      { id: '22', text: '@reuters-urals-2019' },
      { id: '23', text: '@eu-2022-2367, Art. 3n' },
      { id: '24', text: '@ust-jy1795' },
      {
        id: '25',
        text: '@fts-mineral-tax; @mined-urals; @wb-pink-sheet; @eu-2022-2367; @eu-2022-2368; @eu-2025-1494; @eu-2026-124',
      },
      { id: '26', text: '@kse-rot-feb26, p. 3' },
      { id: '27', text: '@kpler-rosneft' },
      { id: '28', text: '@ofac-20251022' },
      { id: '29', text: '@kse-rot-feb26, p. 2' },
      {
        id: '30',
        text: "authors' calculations based on @wb-pink-sheet; @fts-mineral-tax; @mined-urals | Urals: monthly average price published by the Ministry of Economic Development; Brent: World Bank monthly average. The series has no Urals value for September to November 2023.",
      },
      { id: '31', text: '@kpler-rosneft' },
      { id: '32', text: '@econ4ua-china, p. 4' },
      { id: '33', text: '@fts-mineral-tax; @mined-urals; @ru-tax-code, Art. 342(3)' },
      { id: '34', text: '@econ4ua-china, pp. 4–5' },
      {
        id: '35',
        text: '@minfin-annual, line 1.1 "Нефтегазовые доходы" [Oil and gas revenue]; @minfin-2025-09, p. 1',
      },
      { id: '36', text: '@minfin-2026-09, p. 1 and table; @ng-damper' },
      {
        id: '37',
        text: "authors' calculations based on @minfin-annual, lines 1, 1.1 and 2.2; @minfin-2026-09; @korsunskaya-2024; @wb-deflator",
      },
      { id: '38', text: '@fts-profit-tax; @fts-vat' },
      { id: '39', text: '@minfin-guidelines, pp. 21, 30' },
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
        text: 'Russian crude that does not leave by pipeline leaves Russia through a few ports, mainly [[N-P001|Primorsk]] and [[N-P002|Ust-Luga]] on the Baltic, [[N-P005|Novorossiysk]] on the Black Sea and [[N-P007|Kozmino]] on the Pacific[^40]. Traffic at the first three, all goods included, held up despite the embargo: in 2025, it exceeded its 2021 level (figure 6)[^41].',
      },
      {
        kind: 'p',
        text: 'Sanctions ended up targeting these ports themselves. Since February 2025, an EU company can no longer deal, save for listed exceptions, with these three ports, since April 2026 with [[N-P011|Tuapse]] and Murmansk, and since July 2026 with Vysotsk[^42]. Like the price cap, these measures bind only EU companies.',
      },
      { kind: 'h3', text: 'The fleet' },
      {
        kind: 'p',
        text: 'To leave ports closed to companies of the coalition, the crude needs ships that do not depend on them. These are mostly the tankers of the so-called "shadow fleet", tied to a country outside the coalition and with no Western insurance[^43]. Neither the cap nor the port ban touches them. The report\'s hypothesis is that their growth since the embargo helps explain why port traffic, all goods included, held up until 2025.',
      },
      {
        kind: 'figure',
        text: 'Figure 6: Traffic at Russian oil ports, 2014-2026. Data: ASOP (2022; 2026); PortNews (2018; 2019; 2021); NMTP (2017; 2020); Dodonov et al. (2026)[^44].',
        figure: {
          number: 6,
          title: 'Traffic at Russian oil ports',
          period: '2014-2026',
          sources:
            'ASOP (2022; 2026); PortNews (2018; 2019; 2021); NMTP (2017; 2020); Dodonov et al. (2026)[^44].',
        },
      },
      {
        kind: 'p',
        text: 'Most Russian crude exported by sea travels on these ships (figure 7). Among the designated tankers, the most common flags are those of Panama, Russia, Barbados and Gabon (figure 9). Apart from Russia, these are flags of convenience (of states that register foreign-owned ships with few checks); they also serve ordinary trade, so a flag alone does not signal circumvention. The companies that manage the tankers say more, because they are often based outside Russia. According to the US Treasury, [[N-P025|Совкомфлот (Sovcomflot)]], the Russian state shipowner, transferred the management of tankers to Stream Ship Management, based in the United Arab Emirates, to circumvent sanctions. In January 2025, the United States designated that company for its activity in the Russian energy sector[^45].',
      },
      {
        kind: 'figure',
        text: 'Figure 7: Russian oil exported by sea, January 2026. Data: Dodonov et al. (2026); Raghunandan et al. (2026), based on Kpler[^48].',
        figure: {
          number: 7,
          title: 'Russian oil exported by sea',
          period: 'January 2026',
          sources: 'Dodonov et al. (2026); Raghunandan et al. (2026), based on Kpler[^48].',
        },
      },
      { kind: 'h3', text: 'Vessel sanctions' },
      {
        kind: 'p',
        text: "Sanctions also target the ships themselves, by their International Maritime Organization (IMO) number, which never changes, while their name, flag, owner and AIS (automatic identification system, the radio signal that gives a ship's name and position) identity can change. Designation, however, does not stop port calls (figure 8)[^46]: of 711 tankers with a dated designation, 318 called at a port at least once after it, and 22 of them called in the EU or the United Kingdom. In December 2025, more than one designated tanker in five still loads Russian oil[^47].",
      },
      {
        kind: 'figure',
        text: "Figure 8: Port calls of designated tankers after their designation. Data: Global Fishing Watch (2026); Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Authors' calculations. Powered by Global Fishing Watch[^50].",
        figure: {
          number: 8,
          title: 'Port calls of designated tankers after their designation',
          unit: 'ships',
          sources:
            "Global Fishing Watch (2026); Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Authors' calculations. Powered by Global Fishing Watch[^50].",
        },
      },
      {
        kind: 'p',
        text: 'The three sanctions regimes do not move at the same pace. When the EU and the United States designate the same ship, the United States does so first for 168 of the 198 tankers that both designate, more than eight cases out of ten (figure 9)[^49]. For tankers on two or more of the three lists, the median gap from the first designation to the second is 87 days[^130].',
      },
      {
        kind: 'p',
        text: 'A designated ship also often changes hands. On the archived pages of Ukrainian military intelligence (GUR), a party to the conflict, 427 of 757 ships that give both a designation date and an owner or manager date show an owner or manager that started after the designation[^51].',
      },
      {
        kind: 'p',
        text: "A list of ships therefore describes a situation that the ship has often already left. The report's hypothesis is that targeting the company that manages the tankers, and the country where it is based, would reach the fleet more surely than targeting each ship.",
      },
      {
        kind: 'figure',
        text: "Figure 9: Tankers designated by the EU, the United Kingdom and OFAC. Data: Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Authors' calculations[^52].",
        figure: {
          number: 9,
          title: 'Tankers designated by the EU, the United Kingdom and OFAC',
          sources:
            "Office of Foreign Assets Control (2026); FCDO (2026); Council Regulation (EU) No 833/2014, Annex XLII (2026). Authors' calculations[^52].",
        },
      },
    ],
    notes: [
      { id: '40', text: '@ust-jy1795; @sp-kozmino' },
      {
        id: '41',
        text: '@asop, p. 1; @portnews; @nmtp-2017, pp. 7–8; @nmtp-2020, p. 1; @kse-rot-feb26, p. 3',
      },
      {
        id: '42',
        text: '@eu-2025-395, Annex XIV; @eu-2026-506, Annex XVI; @eu-2026-1848, Annex IX',
      },
      { id: '43', text: '@kse-rot-feb26, p. 3' },
      {
        id: '44',
        text: '@asop, p. 1; @portnews; @nmtp-2017, pp. 7–8; @nmtp-2020, p. 1; @kse-rot-feb26, p. 3',
      },
      { id: '45', text: '@ust-jy2777, Annex 2' },
      {
        id: '46',
        text: "authors' calculations based on @gfw-port-visits; @ofac-sdn; @uk-list; @eu-833-2014 | Rule: the tankers with a dated designation in the stored lists, and their AIS port calls in the Global Fishing Watch data after the first dated designation.",
      },
      { id: '47', text: '@kse-rot-feb26, p. 2' },
      { id: '48', text: '@kse-rot-feb26, pp. 2–8; @crea-jan26' },
      {
        id: '49',
        text: "authors' calculations based on @ofac-sdn; @eu-833-2014 | Rule: the first dated designation of each regime for each tanker of the fleet data. Of the 198 tankers that both the EU and OFAC designate, OFAC is first for 168 (84.8%) and the EU for 30, with no designation on the same day. For 394 of these 396 first designations, one stored act, notice or press release that the fleet data cite gives both the IMO number and the date. For the other 2, the press release gives the date and the vessel name, and the stored OFAC list gives the IMO number for that name (53 documents).",
      },
      {
        id: '130',
        text: "authors' calculations based on @ofac-sdn; @uk-list; @eu-833-2014-cons-2026 | Rule: for each tanker that at least two of the three regimes designate, the days from the first dated designation by one regime to the first dated designation by a second regime.",
      },
      {
        id: '50',
        text: "authors' calculations based on @gfw-port-visits; @ofac-sdn; @uk-list; @eu-833-2014",
      },
      {
        id: '51',
        text: "authors' calculations based on @gur-fleet | Replay with tools/gur-owner-change.ts in the project repository.",
      },
      {
        id: '52',
        text: "authors' calculations based on @ofac-sdn; @uk-list; @eu-833-2014-cons-2026",
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
        text: 'Selling oil is not enough: Russia must also be paid, and pay its foreign suppliers. Before the war, most of these payments went through the dollar and the euro, and so through banks that the coalition controls. Where does the money flow when those banks shut Russia out?',
      },
      { kind: 'h3', text: 'The rouble and the yuan' },
      {
        kind: 'p',
        text: 'From 2022, the large Russian banks, including [[N-M002|VTB]] and [[N-M008|Sberbank]], had their assets frozen by the United States[^53] and by the United Kingdom[^54], and the EU removed several of them, VTB and Sberbank among them, from SWIFT, the network that banks use to send payment orders[^55]. Russian firms then moved from the currencies of "unfriendly" countries (as Moscow calls the countries that apply sanctions), such as the dollar and the euro, to the rouble and to other currencies, such as the yuan (figure 10)[^56].',
      },
      {
        kind: 'figure',
        text: 'Figure 10: Settlement currency of Russian exports and imports, 2019-2025. Data: Central Bank of Russia (2026)[^57].',
        figure: {
          number: 10,
          title: 'Settlement currency of Russian exports and imports',
          unit: 'percentage of total',
          period: '2019-2025',
          sources: 'Central Bank of Russia (2026)[^57].',
        },
      },
      {
        kind: 'p',
        text: "With China, the shift goes further. At the end of 2023, the yuan settled as large a share of all Russian export revenue as the rouble (35.8% and 35.7% in December)[^58], and, according to the Russian government, the rouble and the yuan settle almost all payments between the two countries[^59]. This choice protects the trade from sanctions, but it ties Russia to a partner that accounts for about 40% of its trade, while Russia accounts for only a few per cent of Chinese trade[^60]. On the report's hypothesis, China can therefore set its terms.",
      },
      { kind: 'h3', text: 'Payment relays' },
      {
        kind: 'p',
        text: 'A payment in yuan is still exposed to US sanctions, because the bank that settles it still needs the dollar for the rest of its business. US Executive Order 14114 of December 2023 exposes to sanctions any foreign bank that helps the Russian military-industrial base, and from June 2024 any significant transaction with VTB or Sberbank[^61]. Banks in third countries therefore withdrew. According to Vedomosti, a Russian business daily, the Chinese bank that served as the main channel for Russian importers cut its ties with them in February 2024[^62], Turkish and Emirati banks returned transfers or closed accounts[^63], and in August 2024, according to a US congressional commission and to a source close to the Russian government quoted by Reuters, Chinese banks cancelled or paused Russian payments en masse[^64]. Payments moved to other relays, and the sanctions followed:',
      },
      {
        kind: 'li',
        text: '**Subsidiaries of Russian banks (China, India, Kazakhstan, Belarus):** The [[N-M003|VTB branch in Shanghai]] became the main route for payments to China[^65]. From June 2024, the US Treasury included the VTB and Sberbank offices in China and India in their designations[^66]; the EU then banned transactions with VTB Shanghai and with the VTB subsidiaries in [[N-M004|Kazakhstan]] and Belarus[^67], and then, in 2026, with [[N-M009|Sberbank India]] and [[N-M007|India VTB]][^68].',
      },
      {
        kind: 'li',
        text: '**Small Chinese border banks (Heihe, Suifenhe):** According to Reuters, a handful of small banks near the border took over from the large banks. The EU listed two banks of border cities, Heihe Rural Commercial Bank and Suifenhe Rural Commercial Bank, in 2025 and removed them in 2026[^69].',
      },
      {
        kind: 'li',
        text: '**Banks in Central Asia and Armenia (Kyrgyzstan, Kazakhstan, Armenia):** In 2024, Armenian and Kazakh banks stopped accepting the Russian Mir card, because of the risk of secondary sanctions (US sanctions on a foreign firm that deals with a designated party)[^70]. Kyrgyzstan then concentrated rouble payments in two banks: Capital Bank, which the state has owned in full since April 2025, and Keremet Bank, in which the state kept 22% after it sold 75% in December 2024[^71]. The EU targeted both banks in 2026, after two other Kyrgyz banks[^72].',
      },
      {
        kind: 'li',
        text: "**Payment agents (Russia, China, Hong Kong, Kazakhstan):** Some sit in Russia and some on the supplier's side. They receive the importer's roubles and pay in its place; in 2024, their share of cross-border payments rose from under 20% to up to 80%, according to Vedomosti, quoted by The Bell, an independent Russian newsletter[^73].",
      },
      {
        kind: 'li',
        text: '**SPFS:** The Russian equivalent of SWIFT is open to foreign banks, which OFAC threatens to designate if they join it[^74].',
      },
      {
        kind: 'p',
        text: 'According to FinCEN, the US Treasury office against financial crime, [[N-M037|A7]], the best-known payment agent, pays the foreign counterparty through a sub-agent in a third country, such as Hong Kong or Kyrgyzstan, from a bank account outside Russia, and records the value inside its network in bills of exchange (written orders to pay). Where bank channels are restricted, A7 can also move value in [[N-M040|A7A5]], a digital token advertised as backed by rouble deposits at Promsvyazbank[^75]. After the US, UK and EU designations in the second half of 2025, then new Russian rules on crypto-assets and the loss of its points of access, the daily volume of this token fell by 96% between July 2025 and June 2026[^76].',
      },
      {
        kind: 'p',
        text: 'According to the European Council on Foreign Relations, the United Arab Emirates welcomes Russian capital and companies without applying Western sanctions. The war against Iran, which has hit the Emirates since February 2026, has not changed this: in August, they cut their trade with Iran, not with Russia[^77]. Their banks limit some payments with Russia for fear of US sanctions, but no measure by the Emirati state against Russia is known.',
      },
      {
        kind: 'p',
        text: 'The report therefore hypothesises that each wave of designations does not close a channel, but pushes payments towards a smaller relay, further from the dollar. The dollar does not disappear, because the sub-agents of [[N-M037|A7]] still pay in dollars, yuan, dirhams and euros[^78]. The lever therefore remains the bank that keeps this access, and that bank can leave the channel: in 2026, the EU removed three Tajik banks from its list, because they took measures[^79].',
      },
    ],
    notes: [
      { id: '53', text: '@ust-jy0608, p. 1; @ust-jy0705, p. 1' },
      { id: '54', text: '@uk-list' },
      { id: '55', text: '@eu-2022-345, Art. 5h; @eu-833-2014-cons-2026, Annex XIV' },
      { id: '56', text: '@bell-middlemen' },
      { id: '57', text: '@cbr-currency' },
      { id: '58', text: '@cbr-risks-2024, p. 6' },
      { id: '59', text: '@tass-yuan' },
      { id: '60', text: '@econ4ua-china, p. 4' },
      { id: '61', text: '@ust-jy2011; @ust-jy2404' },
      { id: '62', text: '@mt-chinese-bank; @bell-china' },
      { id: '63', text: '@bloomberg-turkish-banks; @mt-uae-banks' },
      { id: '64', text: '@uscc-2025; @reuters-payment-hurdles' },
      { id: '65', text: '@bell-middlemen' },
      { id: '66', text: '@ust-jy2404' },
      { id: '67', text: '@eu-2025-395, Annex XI, p. 383; @eu-2025-2033, p. 115' },
      { id: '68', text: '@eu-2026-1848, Annex VIII' },
      {
        id: '69',
        text: '@reuters-workaround; @eu-833-2014-cons-2025, Annex XLV, Part A; @eu-2026-506, Annex XV; @scmp-banks | Reuters does not name the banks; the names come from the EU list.',
      },
      { id: '70', text: '@rferl-armenia; @interfax-mir-kz' },
      { id: '71', text: '@24kg-ruble; @timesca-president; @akchabar-keremet; @24kg-capital' },
      {
        id: '72',
        text: '@eu-2025-2033, Annex XIV, p. 116; @eu-2026-506, Annex XV, Part B, p. 70; @timesca-eu',
      },
      { id: '73', text: '@bell-middlemen' },
      { id: '74', text: '@cbr-annual-2025, p. 187; @ofac-spfs' },
      { id: '75', text: '@fincen-a7, pp. 2–5' },
      { id: '76', text: '@ust-sb0225, p. 1; @elliptic-a7a5' },
      {
        id: '77',
        text: '@ecfr-uae; @ifi-aug-2026; @mt-uae-banks | The Moscow Times supports only the last sentence of the paragraph, on the limits on payments by Emirati banks.',
      },
      { id: '78', text: '@fincen-a7, p. 5' },
      { id: '79', text: '@eu-2026-506, recital 14, p. 2, and Annex XV, p. 70' },
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
        text: 'A Russian cruise missile or attack drone contains chips, sensors and engines that Russia does not make, or not in sufficient numbers. Oil money must buy these parts abroad, although the coalition has closed its own markets. Who now sells them, at what price, and by which routes do they reach the arms factories?',
      },
      { kind: 'h3', text: 'The suppliers' },
      {
        kind: 'p',
        text: 'Since 2022, the coalition no longer sells to Russia either its military technologies or its dual-use technologies[^80]. Those most useful to its weapons are gathered in a shared list called CHP (Common High Priority), such as integrated circuits or computer numerical control machine tools, which a computer steers[^81]. The report measures these sales through the declarations of the selling countries.',
      },
      {
        kind: 'p',
        text: 'China and Hong Kong take the place of the coalition (figure 11), but in two different roles. China is above all a producer: for most of the dual-use technologies it sells to Russia, its exports rise without its imports rising, and re-export affects only a dozen high-technology products[^82]. Targeting China therefore hits production.',
      },
      {
        kind: 'p',
        text: 'Hong Kong plays another role, that of a platform. It takes a rising share of Russian imports of processors and integrated circuits, in place of the coalition, which may signal re-exported Western chips[^83]. Hong Kong applies only the sanctions decided by the UN Security Council, which do not target Russia: EU and US sanctions are not part of its law, although US export controls (legal limits on exports, enforced by licences) still follow goods of US origin. This financial centre also lets a company hide its owner, and lets new companies be created or dissolved quickly. It is therefore a convenient place of transit for shell companies, which have no real activity of their own[^84]. Targeting Hong Kong therefore hits the transit and the payment.',
      },
      {
        kind: 'figure',
        text: "Figure 11: Exports of CHP goods to Russia, 2021-2025. Data: UN Comtrade (2026); Risinger et al. (2026). Authors' calculations[^85].",
        figure: {
          number: 11,
          title: 'Exports of CHP goods to Russia',
          unit: 'million current US dollars',
          period: '2021-2025',
          sources: "UN Comtrade (2026); Risinger et al. (2026). Authors' calculations[^85].",
        },
      },
      { kind: 'h3', text: 'The price of the goods' },
      {
        kind: 'p',
        text: 'This change of suppliers has a price: from the spring of 2022, Russian imports became more expensive, and the main cause is neither transport nor the detour through neighbouring countries. According to the CEPII, a French research centre on the world economy, it is probably the margins of the suppliers that stayed on the market, which the departure of Western competitors lets them raise, in particular for strategic goods[^86]. Dependence on China sharpens this effect: the premium that Russia pays China for priority goods rises with the Chinese share of its purchases, and for computer numerical control machine tools, with no other seller, Russia must accept the Chinese price[^87]. Sanctions therefore do not cut off access to these goods, but they make them more costly, and this cost is highest for goods bought from China.',
      },
      { kind: 'h3', text: 'The routes of the components' },
      {
        kind: 'p',
        text: "Russia's neighbours can also serve as a route. Armenia, Kazakhstan and Kyrgyzstan form a customs union with it[^88]. Kazakhstan and Kyrgyzstan have sold it far more CHP goods since 2021; Armenia's sales peaked in 2022 and fell below their 2021 level in 2025[^89]. To learn which goods end up in weapons, investigators take apart Russian weapons that have fallen in Ukraine and record the brand and date of each component[^90]. Most parts with a date of manufacture were made between 2014 and 2021, but investigators also find parts made after the invasion, such as twelve components of two Geran-2 attack drones, reported in 2023: purchases continue despite the controls[^91]. They go through intermediaries, such as [[N-F097|Pixel Devices]] in Hong Kong, which, according to OFAC, shipped at least $210 million of electronics to Russia from April 2022, and which the EU lists among the entities that support Russia's defence and security sector[^92]. Sanctions lists name many intermediaries and few makers of the parts[^93].",
      },
      {
        kind: 'p',
        text: "Yet weapon debris gives a biased picture of where the parts come from. The public catalogue of the GUR, a party to the conflict, attributes a US-headquartered brand to two thirds of its components. The report hypothesises that the catalogue first records the coalition's brands, on which sanctions can bear, while a Chinese part with no legible brand more often stays unattributed. Above all, the brand does not say where the part is made. From January to October 2023, by value, 61% of Russian imports of critical components of the brands found in weapons came from companies headquartered in the United States. Only 8% were produced there, against 35% in China[^94]. Tracing a part back along its chain, from factory to weapon, therefore takes shipment-level data, which this report does not have.",
      },
    ],
    notes: [
      { id: '80', text: '@eu-833-2014, Arts. 2 and 4; @ec-chp-list' },
      { id: '81', text: '@kse-chp-q1, pp. 1, 9' },
      { id: '82', text: '@econ4ua-china, p. 9' },
      { id: '83', text: '@kse-chp-q2, p. 3; @carnegie-hk' },
      { id: '84', text: '@hk-lcq2-2019; @uscc-2025' },
      { id: '85', text: "authors' calculations based on @comtrade; @kse-chp-q1, p. 3" },
      { id: '86', text: '@cepii-2025, pp. 1, 6, 8' },
      { id: '87', text: '@kse-chp-q2, pp. 5–6' },
      { id: '88', text: '@kse-chp-q1, p. 7' },
      {
        id: '89',
        text: "authors' calculations based on @comtrade | CHP goods exported to Russia, as each country reports them (figure 11, million USD), from 2021 to 2025: Kazakhstan 62.5 to 186.8, Kyrgyzstan 1.8 to 15.8, Armenia 5.3 to 3.3, with a peak of 94.6 in 2022.",
      },
      { id: '90', text: '@rusi-silicon, p. 24' },
      { id: '91', text: '@car-components; @car-shahed' },
      {
        id: '92',
        text: '@ust-jy2318, Annex 1; @eu-833-2014-cons-2026, Annex IV, entry 925 "Pixel Devices Limited"',
      },
      { id: '93', text: '@ust-jy2651; @state-2025-01-15' },
      {
        id: '94',
        text: "authors' calculations based on @gur-components; @kse-export-controls, p. 16 | In the GUR catalogue, 4,206 of 6,252 components (67.3%) carry the brand of a maker headquartered in the United States.",
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
        text: 'Behind every port, tanker and bank stands an owner: the state, a person close to power, or nobody who can be named.',
      },
      {
        kind: 'p',
        text: 'A sanction does not hit only the companies it names. In the United States, a company owned 50% or more, in aggregate (all designated owners added together), by designated persons is blocked as well: its assets are frozen and US persons may not deal with it[^95]. The EU applies a test of 50% or more, in aggregate, and the United Kingdom a test of more than 50% that adds control[^96]. The report therefore traces each chain of shares up to the state, a person, or a company with no documented ultimate owner (figure 12).',
      },
      { kind: 'h3', text: 'The state and its holdings' },
      {
        kind: 'p',
        text: 'According to the latest disclosures, at the top, the state holds the large companies through a few holding companies. A public holding that it owns outright is the first shareholder of [[N-P026|Rosneft]] and, together with the Federal Agency for State Property Management ([[N-O003|Rosimushchestvo]]), gives the state close to half of [[N-O005|Gazprom]][^97]. Gazprom in turn owns almost all of [[N-O010|Gazprom Neft]][^98] and is a main shareholder of [[N-M001|Gazprombank]][^99]. Likewise, the state holds all the voting rights of [[N-P034|Transneft]], which owns the holding of the port of Novorossiysk[^100]. A designation of any of them therefore reaches its subsidiaries owned 50% or more.',
      },
      {
        kind: 'figure',
        text: "Figure 12: Who owns oil, gas and the fleet. Data: OFAC (2026); Regulation (EU) No 269/2014 (2026); FCDO (2026); Rosneft (2021); Gazprom (2024); Gazprombank (2022); TASS (2024). Authors' calculations[^101].",
        figure: {
          number: 12,
          title: 'Who owns oil, gas and the fleet',
          sources:
            "OFAC (2026); Regulation (EU) No 269/2014 (2026); FCDO (2026); Rosneft (2021); Gazprom (2024); Gazprombank (2022); TASS (2024). Authors' calculations[^101].",
        },
      },
      { kind: 'h3', text: 'The fleet' },
      {
        kind: 'p',
        text: "The state fleet follows the same pattern, then slips away from it. [[N-P025|Sovcomflot]], the state shipowner, had its tankers managed by [[N-O015|SUN Ship Management]], which OFAC designated in 2023[^102], and, according to the EU, the group company [[N-O016|SKF Arktika]] manages [[N-P052|South Fleet]] and [[N-P053|Invest Fleet]], which operate tankers with prior long-standing ties to Sovcomflot[^103]. Later, the management of the group's tankers passed to [[N-O017|Stream Ship Management]] (section 2.5)[^104] and to [[N-O019|Citrine Marine]], which, according to its EU listing, manages tankers previously managed by the Sovcomflot group[^105]. No source that we found names the ultimate owner of these two companies: the chain starts at the state and stops at an unknown owner.",
      },
      { kind: 'h3', text: "The president's associates" },
      {
        kind: 'p',
        text: 'After 2000, keeping a large company meant staying out of politics. According to NPR, in 2000 Vladimir Putin received 21 of the richest men in Russia at the Kremlin and offered them a deal: they could keep their assets if they bent to his authority[^106]. Mikhail Khodorkovsky, who had publicly accused officials of corruption, was arrested in October 2003, and in December 2004 the main production subsidiary of his oil group, Yukos, was sold at auction to a little-known company that Rosneft bought four days later[^107]. In July 2014, an arbitral tribunal ruled in three parallel cases that Russia had taken measures with an effect equivalent to expropriation[^108].',
      },
      {
        kind: 'p',
        text: 'Loyalty, by contrast, opens public contracts. According to the BBC, Concord, the company of Yevgeny Prigozhin, won the Kremlin\'s catering contracts[^109]. According to the US Treasury, which designated the Internet Research Agency in 2018, he funded the operations of that agency; according to Reuters, in 2022 he admitted that he had founded the Wagner group in 2014[^110]. NPR writes that Putin "didn\'t actually eliminate the oligarchy"; he "only targeted individual oligarchs who threatened his power"[^112].',
      },
      {
        kind: 'p',
        text: "Outside the state, the large private shareholders form a circle that the designation texts link to the president. [[N-O023|Gennady Timchenko]], a long-time acquaintance of [[N-O024|Vladimir Putin]], holds, with [[N-O032|Leonid Mikhelson]], the majority stakes in a large petrochemical group and is a shareholder of [[N-O029|Bank Rossiya]][^113]. Mikhelson directly holds about 14% of the gas producer [[N-O027|Novatek]][^114]. [[N-O030|Yuri Kovalchuk]], another long-time acquaintance of the president, held more than a third of Bank Rossiya in 2013 and controls the insurer [[N-O031|SOGAZ]][^115]. The circle reaches the family: according to the US Treasury, in 2013 [[N-O033|Kirill Shamalov]] married [[N-O034|Katerina Tikhonova]], the president's daughter, and then bought 17% of the same petrochemical group from Timchenko[^116].",
      },
      {
        kind: 'p',
        text: 'State companies are run by associates who do not own them. The EU states in its reasons for listing that [[N-O037|Igor Sechin]] ([[N-P026|Rosneft]]) is a personal friend of the president and that [[N-O038|Nikolay Tokarev]] ([[N-P034|Transneft]]) served with him in the KGB[^117]; according to the US Treasury, [[N-O039|Sergei Chemezov]] ([[N-O021|Rostec]]) has known him since the 1980s in East Germany[^118]. According to Tatiana Stanovaya of the Carnegie Endowment, these friends and former colleagues were handed large state assets to manage, which made them "state oligarchs"[^119].',
      },
      {
        kind: 'p',
        text: "State banks follow the same rule. As the EU listing and a Kremlin decree state, the head of VEB.RF is appointed by the head of state and takes his instructions directly from him; since a presidential decree of 2023, VTB also manages in trust 10% of the state's shares in the United Shipbuilding Corporation[^120]. According to the US Treasury in 2022, a deputy president of VTB was the son of the director of the FSB, and Promsvyazbank, nationalised in 2018, was run by the son of a former director of foreign intelligence[^121]. The chain of shares stops at the state, but the chain of management leads to the same circle, and the 50% rule follows shares, not these appointments.",
      },
      { kind: 'h3', text: 'Unknown owners' },
      {
        kind: 'p',
        text: 'Among the intermediaries, in the private fleet and in some large private companies, the chain stops at an unknown owner:',
      },
      {
        kind: 'li',
        text: '**Oil trading:** In December 2023, the US Treasury stated that little-known traders with opaque ownership had carried, since the price cap, up to half of Russian oil exports[^122]. The Council of the EU thus links the company [[N-O049|Nord Axis]] to the oil-trading group 2Rivers; the ultimate owner of Nord Axis remains undocumented[^123].',
      },
      {
        kind: 'li',
        text: '**Vessels:** According to the sanctions lists and, for part of them, to GUR, a party to the conflict, sixteen shipowners or managers each own or operate at least six designated vessels, with no documented ultimate owner[^124].',
      },
      {
        kind: 'li',
        text: "**[[N-O042|Surgutneftegaz]]:** The country's third-largest oil company, run by [[N-O041|Vladimir Bogdanov]], whom the EU lists as a close associate of the president, had not published its full ownership structure, according to The Moscow Times (2013)[^125].",
      },
      {
        kind: 'p',
        text: 'The report hypothesises that this opacity protects these companies: the 50% rule applies in law, but nobody can apply it without knowing the chain of shares[^126]. What remains is to designate each company for its activity and to attach each new manager to the group it replaces, as the Council did for Citrine Marine and Nord Axis.',
      },
    ],
    notes: [
      { id: '95', text: '@ofac-guidance-2014; @ofac-faq-401' },
      { id: '96', text: '@eu-council-best-practices, points 63–64; @hmt-ofsi-guidance, section 4' },
      { id: '97', text: '@rosneft-shareholders, p. 1; @gazprom-equity, p. 1' },
      { id: '98', text: '@tass-gazpromneft, p. 1' },
      { id: '99', text: '@gazprombank-shareholders, p. 1' },
      { id: '100', text: '@transneft-company, p. 1; @vedomosti-nmtp, p. 1' },
      {
        id: '101',
        text: '@rosneft-shareholders; @gazprom-equity; @gazprombank-shareholders; @tass-gazpromneft',
      },
      { id: '102', text: '@ust-jy2008, p. 1' },
      { id: '103', text: '@eu-2025-389, Annex, entries 530 to 532, pp. 44–45' },
      { id: '104', text: '@ust-jy2777, Annex 2' },
      { id: '105', text: '@eu-269-2014-cons, Annex I, entry 685 "Citrine Marine SPC"' },
      { id: '106', text: '@bbc-yukos-timeline; @npr-oligarchy' },
      { id: '107', text: '@bbc-yukos-grab; @bbc-yukos-timeline' },
      { id: '108', text: '@reuters-khodorkovsky; @pca-yukos' },
      { id: '109', text: '@bbc-prigozhin' },
      { id: '110', text: '@ust-sm0312; @reuters-wagner-link' },
      { id: '112', text: '@npr-oligarchy' },
      {
        id: '113',
        text: '@eu-269-2014-cons, Annex I, entries 694 "Gennady Nikolayevich TIMCHENKO" and 731 "Dmitry Vladimirovich KONOV"',
      },
      { id: '114', text: '@uk-list, entry RUS1126; @interfax-novatek, p. 1' },
      {
        id: '115',
        text: '@eu-269-2014-cons, Annex I, entries 94 "Yuriy Valentinovich KOVALCHUK" and 1381 "Stepan Kirillovich KOVALCHUK"',
      },
      { id: '116', text: '@ust-sm0338, p. 1' },
      {
        id: '117',
        text: '@eu-269-2014-cons, Annex I, entries 671 "Igor Ivanovich SECHIN" and 672 "Nikolay Petrovich TOKAREV"',
      },
      { id: '118', text: '@ust-jl2369, p. 1' },
      { id: '119', text: '@carnegie-elites' },
      {
        id: '120',
        text: '@eu-269-2014-cons, Annex I, part Entities, entries 55 "VEB.RF" and 63 "JSC United Shipbuilding Corporation"; @kremlin-veb-2018; @kremlin-usc-2023',
      },
      { id: '121', text: '@ust-jy0602' },
      { id: '122', text: '@ust-jy2008, p. 1, section "Under-the-radar traders of Russian oil"' },
      {
        id: '123',
        text: '@eu-2025-1476, Annex, entries 625 "2Rivers DMCC" and 626 "2Rivers PTE Ltd", p. 25; @uk-list, entry RUS2541',
      },
      {
        id: '124',
        text: "authors' calculations based on @ofac-sdn; @uk-list; @eu-833-2014; @gur-fleet | The companies that own or operate at least six designated vessels, and whose owner the release does not name. Count on the data release data-2026-11-30: 21 companies have an owns or operates relation to at least six vessels with a designation; 5 of them have an owner or a parent company in the release, which leaves 16.",
      },
      {
        id: '125',
        text: '@eu-269-2014-cons, Annex I, entry "Vladimir Leonidovich BOGDANOV"; @mt-surgut',
      },
      { id: '126', text: '@ofac-guidance-2014; @ofac-faq-401' },
    ],
  },
  {
    source: 'report-en.md, 6 Limitations',
    slug: 'limits',
    title: 'Limits',
    nodeIds: ['N-M037'],
    blocks: [
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
        text: '**Reliability of sources:** The letter rates the issuer, not the truth of each claim. The report shows it only for official issuers: the letters of the press and of think tanks are not shown, so the reader cannot weigh their facts.',
      },
      {
        kind: 'li',
        text: '**Mirror data:** Because Russia no longer publishes its trade by product, the report reads the declarations of its partners, which therefore cover only part of the trade. The United Arab Emirates reports no product-level data to UN Comtrade, the UN trade database; the last monthly data date from December 2023 for Vietnam, February 2024 for Kazakhstan and February 2025 for Thailand[^127].',
      },
      {
        kind: 'li',
        text: "**The fleet:** Changes of owner and manager come from the GUR, a party to the conflict. It gives the vessel's current owner or manager and the date it took up the role, but rarely the first change after designation[^128]. The loss of the AIS identity tied to the IMO number, visible in the Global Fishing Watch registry, remains a lead: the report does not measure it, and the database has archived that registry only since 28 October 2026.",
      },
      {
        kind: 'p',
        text: 'Finally, the authors read and reviewed the whole report, but the facts of the database are checked by rules and by AI agents, not one by one by a person (Annex A). As a result, each fact must be checked at its source before it is used for a designation.',
      },
      { kind: 'h3', text: 'Research leads' },
      { kind: 'p', text: 'These limits point to directions for research:' },
      {
        kind: 'li',
        text: '**Measure the effect of sanctions:** Compare monthly series of prices and export volumes with the dates of designation, to test whether a designation really widens the discount on Russian crude.',
      },
      {
        kind: 'li',
        text: "**Document payments and components:** Link the companies of the database to payments and components, with amounts, using FinCEN alerts, US Treasury press releases and studies that take Russian weapons apart, to learn what volume passes through Kyrgyz banks and [[N-M037|A7]]'s sub-agents.",
      },
    ],
    notes: [
      { id: '127', text: '@comtrade; @kse-chp-q1, p. 3' },
      { id: '128', text: '@gur-fleet; @gfw-port-visits' },
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
        text: 'Sanctions weigh on the Russian economy, but they do not stop it: oil and gas revenue falls while other taxes rise to pay for an ever costlier defence, the discount on Russian crude has widened, and imported goods cost more. The war costs more to wage, but it can still be financed.',
      },
      {
        kind: 'p',
        text: "Russia adapts in two ways. It relies on a parallel market on the margins of Western sanctions: tankers outside the coalition, managers based in third countries, payment agents and short-lived shell companies. And, legally, it turns to partners that do not apply the sanctions: China and India buy its oil, and China sells it most of the priority goods for weapons. These partners pay less for its oil and charge more for their goods, because Russia has few other choices. Part of the cost of sanctions for Russia thus becomes, according to the report's hypothesis, a gain for its new partners.",
      },
      {
        kind: 'p',
        text: 'EU sanctions follow this shift step by step. They go up the chain: the product, then the means, then the source. The EU first targeted oil, through the embargo and the price cap, then the vessels that carry it, then the ports it leaves from. Each step answers the circumvention of the one before and arrives late; the report assumes that the parallel market re-forms faster than the lists grow.',
      },
    ],
    notes: [],
  },
  {
    source: 'report-en.md, Recommendations',
    slug: 'recommendations',
    title: 'Recommendations',
    nodeIds: [],
    blocks: [
      {
        kind: 'li',
        text: 'A sanctions authority of the EU can use each new OFAC tanker designation as an early signal for its own review, because OFAC lists a tanker that both designate first in more than eight cases out of ten.',
      },
      {
        kind: 'li',
        text: 'A sanctions authority of the EU or the United Kingdom can check the port calls in its own ports of the 22 designated tankers that called there after their designation.',
      },
      {
        kind: 'li',
        text: 'An authority that lists ships can check, at each update, the current owner and manager of the ships it has already listed, because, on the pages of Ukrainian military intelligence (GUR), a party to the conflict, 427 of 757 ships show an owner or manager that started after the designation.',
      },
      {
        kind: 'li',
        text: 'Where no source names the ultimate owner, an authority can designate each company for its activity and attach each new manager or trader to the group it replaces, as the Council of the EU did for Citrine Marine and Nord Axis.',
      },
      {
        kind: 'li',
        text: 'A researcher can complete the mirror data with customs data for the United Arab Emirates, Vietnam, Kazakhstan and Thailand (section 6.1), to learn what share of the priority goods for weapons passes through them.',
      },
      {
        kind: 'li',
        text: "A funder can pay for the archiving of AIS identity histories, to learn how long a designated vessel takes to change identity, and for a check of the fleet facts by a person, because the report's findings on changes of owner rest on one source that is a party to the conflict, the record of AIS identities starts only on 28 October 2026, and no person has checked each fact of the database against its source.",
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
        text: 'The report rests on a database of entities (such as companies, vessels, sites, ports, banks, persons, legal acts) and of the relations between them, such as a designation, a shareholding, the management of a vessel, a port call, an oil flow or a bank settlement. Each fact in the database points to an archived document (web page, official act, data file, register response), with the page and the excerpt that establish it. On 30 November 2026, the date of the snapshot, the database holds 7,162 entities in its public data release (data-2026-11-30). The count of nodes under watch runs on this release. A legal act or an event is no node, so the count tests 6,660 entities.',
      },
      {
        kind: 'p',
        text: 'These documents come from the official sanctions lists (OFAC, United Kingdom, EU acts), from company registers, from public statistics (UN Comtrade, Eurostat, World Bank, Bank of Russia, Russian Ministry of Finance), from research institutes (KSE, CREA, Bruegel) and from investigative press. Leads came from web and news searches (SearXNG, GDELT) and from the registers; a search result was never cited, and the queries were not logged. The documents of the data release were retrieved between 7 October and 27 November 2026; the last corrections of the database date from 28 November 2026.',
      },
      {
        kind: 'p',
        text: 'Each document is stored as received, under its SHA-256 hash, which also forms its document id. The database records the address and the date of retrieval, with no time of day. The raw files are kept in a private store, where the accounts of the application can add a file but cannot delete it, and which keeps no older version of a file; they are not published, and no web archive copy is recorded.',
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
        text: 'The reliability of the issuer of each source follows a scale adapted from the NATO grading system, also called the ADMIRALTY scale, from A (an official issuer on its own record) to F (cannot be judged)[^129]; a party to the conflict is rated C at most. A separate digit from 1 to 6 rates each fact by the number of independent issuers that give it. The report shows the letter of official issuers only; the data release gives the letter and the digit of each claim that has both. The rating tells the reader how much to trust a source; it does not remove a source.',
      },
      {
        kind: 'li',
        text: 'Each source has a level set from its terms of use, which were read. A source whose terms forbid reuse stays internal: a fact can cite it, but its data are not republished.',
      },
      { kind: 'h3', text: 'A.3 Selecting the nodes under watch' },
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
        text: "**Tied to a third country:** The entity's country of registration, any flag of its vessels that the release gives, or the country of a direct counterparty is a country other than Russia that does not apply the coalition's sanctions. A country read only from a company's name or address does not count.",
      },
      {
        kind: 'p',
        text: 'Vessels of one management company, or failing that of one owner, form a single node. One act of designation can meet more than one condition; where no activity is observed, a new designation stands as a sign of activity: it dates an act of enforcement, not an observed flow.',
      },
      {
        kind: 'p',
        text: 'The count of nodes under watch is 637. It is the result of the script tools/critical-nodes-replay.ts on the data release data-2026-11-30. The command pnpm critical:replay downloads that release, checks its SHA-256 and gives the same count. A node that the release does not hold is not counted. A date that the release gives as a claim of a relation is a date of that relation. A designation with no date takes the date of its act. Russia is the target of the sanctions, so it is not a third country. For 572 of the 637 nodes, each condition rests on a document of an official issuer (ADMIRALTY letter A). The script derives the layer of a node from its entities, because the release gives no layer: Pay 413, Finance 7, Fight 217. The count changes with the rule: 1,323 nodes if Russia counts as a third country, 574 with no country of a counterparty. An earlier count of 493 (450 nodes of the record and 43 of a first list) and the figure of 416 cannot be rebuilt, because their query was not kept. In the data release, a port call carries no date (the dated calls of figure 8 come from the Global Fishing Watch file), so most nodes are active only by a dated designation. The script and its command keep the older name "critical".',
      },
      { kind: 'h3', text: 'A.4 Checking facts and text' },
      {
        kind: 'p',
        text: "The authors read and reviewed the whole report. AI was used for four jobs: to tag the sources, to run the verification and cross-check loops, to assist the drafting and the translation, and to search for blind spots. The facts of the database go through a semi-automated verification system. AI agents collect and archive the sources, then propose each fact with the excerpt of its source. Fixed checks in code test that each excerpt appears in the archived source. Automatic rules weigh the strength of the sources. The ADMIRALTY scale rates the issuer of each source (Annex A.2). A fact needs more than one independent source when the level of its source asks for it. Independent AI reviewers decide each fact in doubt and check that the excerpt supports it. They start with a fresh context, and they did not propose the fact. A failed check does not block the acceptance of a fact. Other facts still wait for a check or a better source. A fixed check tests the facts that the report cites. The stored excerpt of each one must hold its value, both ends of its relation or the identifier that the text names. Each failure goes back to the authors. Some facts come only from a state body of one party to the conflict (Russia or Ukraine). Such a fact carries a mark of that origin in the data release and in the report. The few facts entered by hand carry a label that sets them apart from the facts produced by the agents. The counts, shares and medians are the authors' calculations, which no review agent validates one by one. Each part of the text was reviewed by agents distinct from its writer, and those agents checked its sources one by one. The authors did not check each fact of the database against its source.",
      },
      { kind: 'h3', text: 'A.5 Ethics, security and independence' },
      {
        kind: 'li',
        text: '**Persons:** A natural person appears in the data release only when a sanctions act designates that person. No personal address, telephone number or e-mail is collected. Extracts of company registers and court files name legal persons only.',
      },
      {
        kind: 'li',
        text: '**Contact:** No subject was contacted, and no right of reply was offered before publication, because the report brings together public information only. Each page and each data file gives an address to report an error and an address for a right of reply.',
      },
      {
        kind: 'li',
        text: '**AI:** Language models were used for four tasks only: tagging the sources, the verification loops, help with drafting and translation, and the search for blind spots. Their providers read the full text of the stored documents.',
      },
      {
        kind: 'li',
        text: '**Independence:** The authors are solely responsible for the content. Claims of the GUR remain attributed to it.',
      },
    ],
    notes: [{ id: '129', text: '@uk-mod-jdp, paras 3.39–3.40 and table 3.1' }],
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
      note: '“Other countries” is a balance calculated by the authors.',
      noteB:
        'Gas to the EU: EU and South-East Europe (TurkStream). Crude to the EU: Druzhba south, through Ukraine. Druzhba north: no more Russian crude to Poland and Germany since 2023 (Reuters, 2023); to Belarus, 2025 volume not documented. “Other countries” is a balance calculated by the authors. Pipeline gas and LNG do not add up: no conversion factor is recorded. Hatching: designated project (Arctic LNG 2, designated by OFAC and the United Kingdom).',
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
          'owns or operates the vessels of {n} shipowners or managers, according to GUR, a party to the conflict:',
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
    'possède ou exploite (selon le GUR, partie à la guerre)':
      'owns or operates (according to GUR, a party to the conflict)',
    'possède ou exploite (en partie selon le GUR, partie à la guerre)':
      'owns or operates (partly according to GUR, a party to the conflict)',
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
    'dont 17 % supplémentaires achetés à G. Timtchenko (part totale non chiffrée)':
      'of which a further 17% bought from G. Timchenko (total stake not quantified)',
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
  // The language of the page, and the locale of the numbers of the charts.
  lang: 'en',
  numberLocale: 'en-US',
  // The addresses of the report and of its notes in this locale, from the base of the site.
  paths: { report: '', notes: 'bibliography' },
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
  note: {
    label: 'Reference',
    all: 'In the bibliography',
    // The small marker of a reference in a figure source line or beside a value.
    mark: 'src',
    documents: 'Documents of the record',
    retrieved: 'retrieved',
    // The name of the marker that opens the credit of an image.
    image: 'Image',
  },
  index: {
    title: 'All nodes of the report',
    // The layer of the data, and its name on the page.
    layers: [
      { layer: 'Pay', label: 'Pay' },
      { layer: 'Finance', label: 'Finance' },
      { layer: 'Fight', label: 'Fight' },
      { layer: 'Ownership', label: 'Ownership' },
    ],
  },
  bibliography: {
    title: 'Bibliography',
    back: 'Back to the report',
    label: 'Report bibliography',
    intro:
      'Each reference of the text names a source of this list, and its page, article, annex entry, table line or figure. One entry stands for each source. A legal act, a list or a press release of a government carries its own number. "Accessed" is the day the record stored the document, and "stored" gives the identifier of the stored copy, the SHA-256 hash of the file.',
    notes: 'Notes',
    accessed: 'Accessed',
    stored: 'stored',
    // The art of the report page. Each line is the credit of public/report-media/credits.json, and
    // `file` is the start of the name of the image file that it credits.
    images: {
      title: 'Images',
      items: [
        {
          credit:
            '"Crude Oil Tanker in Port Arthur, Texas" by Quintin Soloviev, CC0, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Crude_Oil_Tanker_in_Port_Arthur,_Texas.jpg',
          file: 'crude-oil-tanker-in-port-arthur-texas',
        },
        {
          credit:
            '"1829 map of the Black Sea by the Russian Hydrographic Depot" by Russian Hydrographic Depot, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:1829_map_of_the_Black_Sea_by_the_Russian_Hydrographic_Depot.jpg',
          file: 'black-sea-map-1829',
        },
        {
          credit:
            '"Crude oil tanker Eagle San Diego" by Jordanroderick, CC0, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Crude_oil_tanker_Eagle_San_Diego.jpg',
          file: 'crude-oil-tanker-eagle-san-diego',
        },
        {
          credit: '"1903 Baku Oil Wells" by Unknown author, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:1903_Baku_Oil_Wells.jpg',
          file: 'baku-oil-wells-1903',
        },
        {
          credit:
            '"Caucasus Novorossiysk general view Postcard 1900-1904" by Brothers Borisov Publishing House, Novorossiysk, public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Caucasus_Novorossiysk_general_view_Postcard_1900-1904.jpg',
          file: 'novorossiysk-postcard-1900-1904',
        },
        {
          credit:
            '"Russia 1771 Sestroretsk Rouble" by Russia (coin), National Numismatic Collection (image), public domain, via Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Russia_1771_Sestroretsk_Rouble.jpg',
          file: 'sestroretsk-rouble-1771',
        },
        {
          credit:
            '"Pair of Flintlock Pistols of Empress Catherine the Great (1729–1796)", Johan Adolph Grecke, 1786. The Metropolitan Museum of Art, Open Access, CC0',
          href: 'https://www.metmuseum.org/art/collection/search/24927',
          file: 'met-24927-flintlock-pistols',
        },
        {
          credit:
            '"Chess set", Unknown maker (Russian, Kholmogory), late 18th–early 19th century. The Metropolitan Museum of Art, Open Access, CC0',
          href: 'https://www.metmuseum.org/art/collection/search/202506',
          file: 'met-202506-chess-set',
        },
      ],
    },
  },
} as const;

export const openingUi = {
  // The dithered photograph in two tones, black and the accent, as the art of the chapters.
  cover: {
    src: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-in-port-arthur-texas-dither.png',
    // The photograph itself, for a phone: the dither is too coarse at that size. A grey copy at twice
    // the width of a phone, because the page shows it in grey.
    photo:
      import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-in-port-arthur-texas-phone.jpg',
  },
  partBar: { label: 'Parts of the report', of: '/' },
  // The actions of the first screen, one row. The PDF action shows only when the build copied it.
  links: {
    label: 'Report links',
    read: 'Scroll down to read',
    data: 'Data',
    pdf: 'Download the report',
    // The two ways into the record, under the actions.
    chain: 'See the oil chain',
    graph: 'Explore the graph',
  },
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
    // text; words, when given, are written exactly as in the item.
    values: [
      { words: '87 days', note: '' },
      { words: '318', note: '' },
      { words: '427 of 757', note: '' },
      { words: '', note: '1' },
      { words: '', note: '2' },
      { words: '18.5%', note: '3' },
      { words: '', note: '4' },
      { words: '', note: '5' },
    ],
  },
  introduction: {
    // The art of the chapter opening, a photograph that the break draws in ASCII.
    art: import.meta.env.BASE_URL + 'report-media/crude-oil-tanker-eagle-san-diego.jpg',
  },
} as const;

export const methodUi = {
  layers: {
    label: 'Layers',
    unit: 'Nodes of the page data, one square for each node',
    // The figure counts the nodes of the report, so its period is the period of the report.
    period: '2024-2026',
    inData: 'In the page data, three conditions documented',
    examined: 'In the page data, fewer than three conditions documented',
    open: 'Open the nodes of the page data',
    conditions: 'Three conditions of a node under watch',
    // The arrows and the budget path show the argument of the report; no edge of the data backs them.
    schematic: 'Schematic of the argument of the report, not a measured relation.',
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
      "Tankers designated by each regime to the end of the quarter of the event. Data: the sanctions lists of the EU, the UK and OFAC; authors' calculations",
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
  f4: {
    label: 'Brent price, Urals price and EU price cap, monthly',
    // The note of figure 4, with the shaded area of this chart in place of a colour name.
    note: 'Urals: monthly average price used for the Russian mineral extraction tax. Brent: monthly price of the World Bank. The shaded area is the gap between the two; it also includes quality and freight. Cap: maximum price, set by the EU, of a Russian crude transported or insured by a coalition company.',
    // Each card quotes the text of the part: the first cap, the cap and the fleet, then the gap
    // after the designation of Rosneft and Lukoil.
    steps: [
      {
        text: 'Since December 2022, an EU company or a company of its allies can no longer carry, insure or finance Russian crude sold above a price cap (figure 4)[^23].',
      },
      {
        text: 'As long as Urals stays above the cap, it travels mostly on ships and with insurers outside the coalition, which the cap does not bind (section 2.5)[^26].',
      },
      {
        text: 'The gap widened again after October 2025, when OFAC designated [[N-P026|Rosneft]] and [[N-P030|Lukoil]], two large Russian oil groups[^28], and several Indian refiners stopped buying[^29]. From August 2023 to October 2025, in each month of the series, Urals was worth $10 to $16 less than Brent; since November 2025, it has been worth $19 to $27 less[^30].',
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
  // The link to the chain mode of the map: the oil goes from the field to the port of exit.
  chain: {
    open: 'Open the oil chain on the globe',
    hint: 'From the oil field to the pipeline, the refinery, the terminal and the port of exit. The map of the GAB record opens full screen.',
  },
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
      table: 'The port visits, as a table',
      limit: 'A presence in port, not a loading.',
      range: '{from} to {to}',
    },
    flows: 'Seaborne crude by loading basin and fleet, January 2026, kb/d',
    open: 'Open the record of',
    data: 'Data:',
    basemap: 'Basemap:',
    // The dates of the ban step come from the text of the part. The Pacific step has no note.
    banSource: 'Dates: text of the report, note 42 (February 2025 to April 2026)',
    schematic:
      'Schematic: each column stands above its sea and gives the basin total, not the volume of a terminal.',
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
    // The three ports that the EU bans from February 2025, as figure 1 names them.
    bannedPorts: 'Primorsk, Ust-Luga, Novorossiysk',
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
    // The data table of the timeline.
    table: {
      summary: 'Values of the timeline',
      ship: 'Ship',
      group: 'Profile',
      ids: 'AIS identity: flag, days from the designation',
      before: 'Port calls before',
      after: 'Port calls after',
      span: '{flag} {from} to {to}',
      kinds: { R: 'Russian', O: 'other', E: 'EU' },
    },
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
    stepLabel: 'Rouble share of settlements',
    exports: 'Exports',
    imports: 'Imports',
    tableCaption: 'Data of figure 10, percentage of total',
    year: 'Year',
    inspect: 'Shares of one year',
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
    // The names of the nine third countries of the data, in the words of the page.
    countries: {
      Kazakhstan: 'Kazakhstan',
      Kyrgyzstan: 'Kyrgyzstan',
      Armenia: 'Armenia',
      Türkiye: 'Türkiye',
      'United Arab Emirates': 'United Arab Emirates',
      India: 'India',
      Malaysia: 'Malaysia',
      Thailand: 'Thailand',
      'Viet Nam': 'Viet Nam',
    } as Readonly<Partial<Record<string, string>>>,
  },
  chain: {
    title: 'From the brand to the weapon',
    step: 'Step',
    mapLabel: 'Map of the places named by the step in view',
    openSite: 'Open the record of the site',
    imports:
      'Russian imports of CHP battlefield goods, January–October 2023, share of the value in %',
    brands:
      'Russian imports of goods of these brands, 2023, million USD (KSE, 2024). A brand is not the seller.',
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
    arcNote:
      'Map: arcs join the country of manufacture to the country of the intermediary. Chains with the same country or no named country are not drawn: the arcs carry {drawn} of the {all} chains.',
    unplaced: 'Map: a group with no single place is not drawn.',
    // The columns of the data table of the routes flow.
    from: 'From',
    to: 'To',
    fromTo: '{a} to {b}',
    // The names of the chain data (stages, groups, places, routes) in the words of the page. A name
    // that is not here shows as the data writes it.
    dataNames: {} as Readonly<Partial<Record<string, string>>>,
    routeTable: 'All the routes of the map, as a table',
    routeColumns: ['Country of manufacture', 'Country of the intermediary', 'State', 'Chains'],
    // The states of the routes data, for the cells of the route table.
    stateWords: {
      documented: 'documented',
      'documented (Ukrainian government source only)':
        'documented (Ukrainian government source only)',
      'documented (Russian importer named; foreign intermediary not named)':
        'documented (Russian importer named; foreign intermediary not named)',
      lead: 'lead',
      'no source found': 'no source found',
    },
  },
  // The defence plants of the data file on the chain map, with a table of all of them.
  plants: {
    title: 'Russian defence plants and integrators by main weapon',
    unit: 'one point = one plant or integrator',
    sources:
      'GAB record: plant positions (stored or approximate) and the result of the check on the EU, UK and US lists; some plants are not checked',
    mapLabel:
      'Map of the Russian defence plants and integrators by main weapon; on a wide screen six main plants are named; hollow points are approximate',
    legend: [
      ['drone', 'Drones'],
      ['cruise missile', 'Missiles'],
      ['guided bomb', 'Guided bombs'],
      ['armour', 'Armour'],
      ['aircraft', 'Aircraft'],
      ['other', 'Other'],
    ],
    approximate: 'Hollow: approximate point',
    table: 'All the plants and integrators, as a table',
    columns: ['Plant or integrator', 'City', 'Weapon', 'Point', 'EU', 'UK', 'US'],
    // The words of the data file, for the cells of the table. A word that is not here shows as the file writes it.
    words: {
      stored: 'stored position',
      lead: 'approximate',
      none: 'not on the map',
      yes: 'yes',
      no: 'no',
      'not checked': 'not checked',
      'no match by name': 'no match by name',
      'BIS Entity List (not SDN)': 'BIS Entity List (not SDN)',
      drone: 'drone',
      'cruise missile': 'cruise missile',
      'ballistic missile': 'ballistic missile',
      'guided bomb': 'guided bomb',
      armour: 'armour',
      aircraft: 'aircraft',
      'air defence': 'air defence',
      'communications/EW': 'communications, EW',
      other: 'other',
    },
  },
  noPeriod: 'Not given in the source of the figure',
  // The routes of the components: a figure of the page with no number, because the final text
  // has no such figure. Its notes are the notes of the final text on the teardowns and the lists.
  routes: {
    title: 'Routes of the foreign components of Russian weapons',
    unit: 'number of chains',
    sources: 'RUSI, CAR, IISS; US and Ukrainian authorities; press[^91][^93].',
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
  // The owners map: a figure of the page with no number, because the final text has no such
  // figure. Each site comes from a committed join that a reviewer checks against the record.
  owners: {
    title: 'Who holds the sites on the map',
    unit: 'one point = one site',
    sources: 'GAB record: the documents of each row, in the table.',
    checked: 'checked against the record on {date}',
    // The day of a share in the record, after the share.
    asOf: 'on {date}',
    // A row whose holding the owners figure does not have in the layer of the site.
    outsideFigure:
      'Figure 12 has no node of this layer under this holding; the record documents this holder.',
    mapLabel: 'Map of the sites of the report, by the controller of their holder',
    table: 'The sites of the map, as a table',
    rows: '{n} rows',
    columns: {
      site: 'Site',
      holder: 'Holder',
      relation: 'Relation',
      controller: 'Controller',
      documents: 'Documents',
    },
    relations: {
      owns: 'owns',
      owns_majority: 'owns the majority of',
      owns_operator: 'owns the operator of',
      operates: 'operates',
    },
    // The controller classes and holdings of controllers.csv that the map uses.
    labels: {
      'Russian federal state': 'Russian federal state',
      'Private shareholders': 'Private shareholders',
      Transneft: 'Transneft',
      Rosneft: 'Rosneft',
      Rostec: 'Rostec',
      'Other holdings': 'Other holdings',
      'Named persons': 'Named persons',
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
    critical: 'Nodes under watch',
    official: 'Nodes under watch on an official source',
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
