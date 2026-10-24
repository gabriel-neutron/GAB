/** A part of a paragraph: plain text, a company, a vessel or an act that has a page, or a claim
 * with its ADMIRALTY pair. A mention keeps its own words when the release does not hold it. */
export type TextPart =
  | string
  | { readonly entity: string; readonly label: string }
  | { readonly claim: string; readonly text: string };

export type Paragraph = readonly TextPart[];

/** The figure or the table that closes a block. */
export type Attachment = 'budget' | 'ledger' | 'sellers' | 'matrix';

export interface TextBlock {
  readonly id: string;
  /** A section runs in the text. A box holds a part that the report keeps short. */
  readonly kind: 'section' | 'box';
  readonly title: string;
  readonly paragraphs: readonly Paragraph[];
  readonly attach?: Attachment;
}

export interface ExportsText {
  readonly title: string;
  readonly blocks: readonly TextBlock[];
  readonly limits: { readonly title: string; readonly paragraph: Paragraph };
  /** The title of each figure and of the table, in the caption. */
  readonly captions: Readonly<Record<Attachment, string>>;
}

/** The English text of the exports part. */
export const EXPORTS_TEXT: ExportsText = {
  title: 'Russian exports',
  blocks: [
    {
      id: 'recettes',
      kind: 'section',
      title: 'What the exports pay',
      paragraphs: [
        [
          'The oil and gas revenue of the Russian federal budget includes the mineral extraction tax, the additional income tax on hydrocarbons and the export duties. It is 9,057 billion roubles in 2021, 11,586 in 2022, 8,822 in 2023, 11,131 in 2024 and 8,477 in 2025 (Russian Ministry of Finance, 2026). Its share of federal revenue is 41.6% in 2022, 30.3% in 2023 and 2024, and 22.7% in 2025. From January to September 2026 the share falls to 18.5%, against 24.5% in the same period of 2025. The amount is 5,471 billion roubles against 6,609, a fall of 17.2% (preliminary estimate of the Russian Ministry of Finance, 2026).',
        ],
        [
          'The amount of this revenue depends on the Urals price and on the exchange rate. The coefficient that sets the rate of the oil extraction tax is calculated from the average Urals price and the rouble rate (Tax Code of the Russian Federation, art. 342). A damper reduces the tax when the export price of fuels is higher than their price on the domestic market (Tax Code, art. 200, para. 27). The export duties bring only 458 billion roubles in 2025 (Russian Ministry of Finance, 2026). The Urals price used for the tax is 92.08 dollars a barrel in September 2026 (Russian Ministry of Economic Development, 2026). The sources that we read do not give the cause of the fall in the revenue from January to September.',
        ],
        [
          'The share of the rouble in the export revenue of goods and services goes from 14.34% in 2021 to 41.55% in 2024 (Bank of Russia, currency structure of export revenue). No source that we read gives a Russian dollar value of crude oil, oil products, gas and LNG for 2022-2024. The Bank of Russia publishes this value only up to the fourth quarter of 2021 (Bank of Russia, 2023-2025). The mirror statistics of UN Comtrade rest on a number of crude reporting countries that falls from 38 in 2022 to 14 in 2024. The ledger that follows therefore rests on the CREA tracker.',
        ],
      ],
      attach: 'budget',
    },
    {
      id: 'registre',
      kind: 'section',
      title: 'The revenue ledger by legal status',
      paragraphs: [
        [
          'The ledger puts each hydrocarbon export revenue, defined by a flow, a destination and a month, in one legal class. It covers crude by sea, crude by pipeline, oil products by sea, gas by pipeline, LNG and coal, for 2025 and the first half of 2026. The total is 298.9 billion euros (author’s calculations from CREA, 2026). The classes go from A1, where no measure targets the flow, to E, where the sources do not let us decide. B holds the flows that obey a measure, C the flows that pass through a designated link, and D the documented circumventions. The rules were written before the classification and are tied to ',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'Regulation (EU) No 833/2014' },
          '.',
        ],
        [
          'In 2025, 82.6% of the revenue crosses no measure or obeys one: 38.0% in A1, 19.6% in A2 and 25.0% in B. In the first half of 2026 this share is 47.9%. Over the two periods, 70.3% of the revenue is in these three classes. Class C is 16.0% of the revenue, class E is 13.7% and class D is 0% (author’s calculations from CREA, 2026). In the base scenario, class E stays under the limit of 30% that was set before the classification. At the high bound it is over this limit, with 38.2% over the two periods and 52.9% in the first half of 2026.',
        ],
        [
          'The fall of the unconstrained share in the first half of 2026 comes from two changes. The FOB price of Urals goes from 43 dollars in February to 76 dollars in March 2026 (KSE, 2026). From March to September it stays above the cap of 44.1 dollars, in force since 1 February 2026 (Implementing Regulation (EU) 2026/124; KSE, 2026), while G7+ vessels carry 23% to 33% of the crude. The contract price is not visible, so this part is in class E. Also, listed vessels carry 56% to 69% of the crude in the first half of 2026. For 2025 the ledger assumes 12%, taken from one sentence of CREA for August 2025 (CREA, 2025). The test of this assumption between 6% and 20%, with the share of products outside the cap, gives a class C of 7.3% to 12.4% of the revenue of 2025. Do not compare the two periods without this reserve.',
        ],
        [
          'Class C is concentrated in sea crude, which forms 79% of it. Class E is made of oil products (54%) and crude (40%). Class D is empty because no public act gives a figure for revenue that a circumvention obtained. The ledger shows where the designated link is. The high bound of E assumes that four flows that the data do not separate are all undecidable: crude by pipeline to China after October 2025, LNG to China since August 2025, coal, and gas by pipeline outside the Union. Together they are 22% of the revenue.',
        ],
        [
          'A check against customs data covers 2025. Crude to China is 100.7 million tonnes in CREA against 100.9 in Chinese customs, a difference of about 0.1%. For India, customs exceed CREA by 2.8% in tonnes and by 26.5% in value, because CREA uses a scenario price where customs record a CIF value (CREA, 2026; UN Comtrade, 2026). Coal to China is 80.6 million tonnes in customs against 61.4 in CREA, 31% more, with no explanation in the sources that we read. The Turkish mirror is lower than CREA by 9.9% for coal and by 25.2% for oil products, in value (Eurostat, 2026). It covers neither crude nor gas by pipeline.',
        ],
      ],
      attach: 'ledger',
    },
    {
      id: 'ecart-de-prix',
      kind: 'box',
      title: 'The price gap test',
      paragraphs: [
        [
          'The discount of the Indian buyer is the gap between Brent and the Indian customs unit value of Russian crude. This report describes it and does not test it. A rule to drop the test was written on 18 October 2026, before the data were examined (author’s calculations). The discount is about 11 dollars a barrel from January to June 2023, 2.4 from July to December 2023, 0.9 in 2024 (eleven months) and 0.1 from January to July 2025 (Indian customs, 2026; EIA, 2026). From April to July 2026 the Russian value is above Brent: 117.9 dollars against 117.3 in April, 123.2 against 107.1 in May, 112.0 against 85.4 in June and 89.8 against 83.8 in July. The report gives no cause. The unit value mixes crude grades. Freight stays a range of 10 to 20 dollars a barrel (Spiro et al., 2025). The measure was chosen after Brent was seen, and the calibration of 2024 is partial.',
        ],
      ],
    },
    {
      id: 'vendeurs',
      kind: 'section',
      title: 'The first-sale sellers',
      paragraphs: [
        [
          'The count of first-sale sellers of Russian crude and products, from 2023 to 2026, has 61 named entities. They are 18 traders designated by OFAC from 2023 to 2025, 16 designated by the United Kingdom or by the Union, 3 subsidiaries of ',
          { entity: 'e9a18aee-cad7-4d65-909a-ddfecb3f3a26', label: 'Gazprom Neft' },
          ', 9 designated producers (among them Gazprom Neft, ',
          { entity: '06160296-0acd-4493-8021-b91f6653d272', label: 'Surgutneftegaz' },
          ', ',
          { entity: '1cb52bd8-6642-4f96-a2fc-73747f2153d6', label: 'Rosneft' },
          ' and ',
          { entity: '5b10592a-b2a2-4f2f-a8c6-5871a9676e20', label: 'Lukoil' },
          ') and 15 sellers that only KSE or Kpler name (author’s calculations from OFAC, 2026; United Kingdom, 2026; European Union, 2025-2026; KSE, 2026). The SDN file of 15 October 2026 has no trader designation after 22 October 2025 (OFAC, 2026). This number is a floor, because the delistings of the Union and the United Kingdom are not tracked.',
        ],
        [
          'In the most recent KSE series, the share of the four producers designated by the United States in crude exports goes from 6% in May to 15% in July 2026 (KSE, August 2026). KSE changed this series between its July and August 2026 editions and gave no reason, so the report cites one series. Rusexport is the first crude exporter in July 2026 with 26%, then falls to 22% in August, a preliminary figure (KSE, August 2026; KSE, September 2026). The controller is not established for any of the 52 entities that are not producers, because the rule needs two independent documents. Five identities, among them Rusexport, have no registration number in a cited source, and nine KSE sellers rest only on the legend of a chart.',
        ],
      ],
      attach: 'sellers',
    },
    {
      id: 'flux-licites',
      kind: 'section',
      title: 'The lawful and exempt flows',
      paragraphs: [
        [
          'Russian LNG under a short-term contract has been banned from import into the Union since 25 April 2026. LNG under a long-term contract will be banned from 1 January 2027 (Regulation (EU) 2026/261, art. 4; ',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'Regulation (EU) No 833/2014' },
          ', art. 3ra). For gas by pipeline, the ban applies since 17 June 2026 under a short-term contract. Under a long-term contract, the last day of the exemption will be 29 September 2027, or 31 October 2027 if the Commission confirms a risk to storage before 15 September 2027 (Regulation (EU) 2026/261, art. 4).',
        ],
        [
          'The cap on crude is 44.1 dollars a barrel since 1 February 2026. It was 60 dollars until 2 September 2025 and 47.6 dollars from 3 September 2025 to 31 January 2026. Its review is suspended from 24 July 2026 to 14 July 2027 (Implementing Regulation (EU) 2026/124). The ',
          {
            entity: 'c01ec869-4cf5-402a-8c72-06fc476eefa1',
            label: 'Caspian Pipeline Consortium',
          },
          ' moved 70.52 million tonnes of oil in 2025 (CPC, 2026). In the Union, this transport needs an authorisation case by case (Regulation (EU) No 833/2014, art. 5q). The United Kingdom allows it with a licence valid from 15 October 2025 to 14 October 2027 (OFSI, licence INT/2025/5635700). The United States allow it with general licence 124B since 14 November 2025, with no end date in the text (OFAC, 2025).',
        ],
        [
          'Crude delivered by pipeline, among it the crude of ',
          { entity: 'f1334667-0a7f-44bc-9586-0c4826e9f2b3', label: 'Druzhba' },
          ', has an exemption in the Union under article 3m, paragraph 3, point d, valid until a decision of the Council. It ended on 23 June 2023 for Germany and Poland, and on 1 July 2025 for Czechia (Regulation (EU) No 833/2014). The British licence for Druzhba runs from 24 February 2026 to 14 October 2027 (OFSI, licence INT/2025/5635700). ',
          { entity: '4cb05d5f-06ee-4f44-8b52-66980a2e1812', label: 'Transneft' },
          ', which owns Druzhba, is in Annex XIX, part A, of Regulation 833/2014, and the United Kingdom froze its assets on 24 February 2026 (Regulation (EU) 2025/2033; United Kingdom, 2026). ',
          { entity: '1cb52bd8-6642-4f96-a2fc-73747f2153d6', label: 'Rosneft' },
          ' and ',
          { entity: 'e9a18aee-cad7-4d65-909a-ddfecb3f3a26', label: 'Gazprom Neft' },
          ' are in the same annex. Regulation 2025/2033, in force since 24 October 2025, removed exemptions from article 5aa, paragraph 3, and added one for the trade of crude and products under the cap. Annex XXIX also exempts maritime transport and related services for Sakhalin-2 crude to Japan, from 5 December 2022 to 31 March 2028, and for its LNG to Japan and South Korea, from 24 July 2026 to 31 March 2028 (Regulation (EU) 2026/1848).',
        ],
      ],
    },
    {
      id: 'autres-biens',
      kind: 'box',
      title: 'The other goods',
      paragraphs: [
        [
          'The other goods are described and not classified. In the Union, exemptions with a tonnage cap remain for steel slabs, potassium chloride (837,570 tonnes a year) and ammonia (688,000 tonnes a year since 24 April 2026). A customs duty applies to Russian fertilisers since 1 July 2025 (',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'Regulation (EU) No 833/2014' },
          '; Regulation (EU) 2025/1227). ',
          { entity: '85a831e7-9c6e-4bae-9cf4-10fc39795c4d', label: 'Severstal' },
          ' and ',
          { entity: '0a088db2-6420-4072-9605-c4d326edc082', label: 'MMK' },
          ' are on the OFAC list, and the United Kingdom listed them on 18 May 2023. We did not check their status in Annex I of Regulation 269/2014. Kitco reports, from BullionVault and Hong Kong data, 112.7 tonnes of Russian-origin gold imported into Hong Kong in seven months of 2026 against 92.1 in 2025 (Kitco, 2026). This is an analysis by a third party.',
        ],
      ],
    },
    {
      id: 'matrice',
      kind: 'section',
      title: 'The criticality matrix',
      paragraphs: [
        [
          'The matrix aligns the vessel lists of the Union, OFAC and the United Kingdom on the IMO number, never on the name. The official lists have 942 distinct numbers designated by at least one Russia regime: 671 for the Union, 443 for the United States and 645 for the United Kingdom (Regulation No 833/2014, Annex XLII; OFAC, 2026; United Kingdom, 2026). The matrix has 765 numbers, with one known duplicate, the vessel Estella, and 690 Union entries. This is more than the 671 of Annex XLII, and the difference is not explained. Among these numbers, 194 are on the three lists and 16 are on the lists of the Union and OFAC without the United Kingdom. 75 are listed by OFAC or the United Kingdom and not by the Union, and 480 by the Union and not by OFAC (author’s calculations from the dry release of 21 October 2026).',
        ],
        [
          'The dates follow three rules: the entry into force for the Union, the date of the notice for OFAC and the date of designation for the United Kingdom. For the 210 vessels that have an OFAC date and a Union date, the Union date is later by 273 days on average. 148 of these vessels were listed by OFAC on 10 January 2025, with 123 days on average, and the other 62 show 632 days. This date accounts for 173 of the 256 OFAC entries. Between the Union and the United Kingdom, the mean gap is 3 days over 592 vessels. The delistings of OFAC and the United Kingdom are not tracked. Yasa Golden Bosphorus and Astra, delisted by OFAC, have no line in the matrix.',
        ],
      ],
      attach: 'matrix',
    },
  ],
  limits: {
    title: 'Limits',
    paragraph: [
      'The ledger rests on the CREA tracker alone. There is no mirror for the crude and the gas by pipeline of Turkey, and none for the Union by Combined Nomenclature code. Class D is empty, and coal to China keeps a gap of 31% with no explanation. No source that we read gives a frequency for each type of behaviour, so the typology of circumvention signs is dropped. The count of sellers is a floor, and the price gap stays descriptive. Annexes I of Regulation 269/2014 and XLII of Regulation 833/2014 are not read in full. The manual check of 30 lines of the matrix corrected 7 errors.',
    ],
  },
  captions: {
    budget: 'Share of oil and gas revenue in the federal budget',
    ledger: 'Revenue ledger by legal status',
    sellers: 'First-sale sellers, share of crude exports in 2026',
    matrix: 'Vessels designated by the EU, OFAC and the United Kingdom',
  },
};
