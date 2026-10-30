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
