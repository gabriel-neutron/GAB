# Design references for the report page

This note collects design references for the redesign of the report page. The goal: the page looks like a work of art, and each claim keeps its source. We read each page in October 2026. "Best at" gives the viewport where the technique works best.

## Award-level sites

| Site | Technique to reuse | Best at |
|---|---|---|
| [The Armenian Genocide](https://genocide.greatarmenia.org/) (Awwwards, CSSDA and FWA day badges) | A thin serif title and red full-width date numerals over a dark, grainy archive photo. The caption and a "Photo Credits" link are in the first view. | Desktop |
| [The Other Side of Truth](https://theothersideoftruth.com/) (Awwwards SOTD 2022) | A "World truth / Russian truth" switch, a "War in numbers" chapter and a live "Days of war" counter. The chapter list sits on one line over a giant cut letterform. | Desktop |
| [Sakharov Space](https://www.sakharov.space/en) (Awwwards storytelling) | A black screen with film grain, one quote in a calm serif, a signature and a year. The quote opens the visit. | Desktop, mobile |
| [Decriminalize Poverty](https://decriminalizepoverty.org/) (Awwwards storytelling) | A condensed display title over a layered illustration. A fixed Present / History / Future bar shows the parts. | Desktop |
| [Persepolis Reimagined](https://persepolis.getty.edu/) (Awwwards SOTD) | Three short lines, one per scroll step, then a 3D scene. | Desktop |
| [OceanX 2025](https://2025.oceanx.org/) (Awwwards SOTD) | A large sans title over a 3D globe, small monospace capitals, and a WebGL timeline. The globe is the cover and the map. | Desktop |
| [Searching for Birds](https://searchingforbirds.visualcinnamon.com/) (Awwwards data visualization) | An introduction and six numbered parts. One graphic splits step by step on scroll. Each source has a link in the text. | Desktop, separate mobile layout |
| [Slavery Footprint](https://slaveryfootprint.org/) (Awwwards SOTD) | A supply-chain story told through questions. It ends with one personal number. | Mobile, desktop |
| [In Pieces](http://species-in-pieces.com/) (Awwwards Sites of the Year list) | Thirty species from the same thirty polygons. A dark loader in small serif capitals with one red word. | Desktop |
| [30 Years of Independence of Ukraine](https://30ua.info/en) (Awwwards SOTD) | A huge flared serif title in three lines, flat shapes as accents, and themed chapters in the top bar. | Desktop |
| [Body Layout](https://yourinsides.com/) (FWA) | A dark technical grid behind a 3D model, one orange accent, and a one-line source note under the call to action. | Desktop |
| [EnduroSat Space Service](https://www.endurosat.com/space-service/) (FWA) | A blue wireframe object over a dark planet edge. The object leads the reader from step to step. | Desktop |
| [The Sea We Breathe](https://www.bluemarinefoundation.com/the-sea-we-breathe/) (Awwwards storytelling) | An instrument-style loader (a dial with 25 / 50 / 75 / 100) and live coordinates in monospace capitals. | Desktop |
| [Venus story](https://venus-story.com/) (Awwwards SOTD) | The first letter draws itself as a stroke on a flat grey field. | Desktop |
| [Igloo Inc](https://www.igloo.inc/) (Awwwards SOTD, Sites of the Year list) | Grey 3D scenes, text-decode transitions, two colours. Our scraper did not load the site, so this line comes from the Awwwards page. | Desktop |
| [Type Dither](https://typedither.vercel.app/) (Awwwards nominee) | A generator that cuts type into dithered pixel forms. Use it for chapter numerals only. | Desktop |

The CSS Design Awards gallery showed a bot check to our scraper. We did not try to pass it.

## Data stories

| Piece | Technique to reuse | Best at |
|---|---|---|
| [FT: Inside Russia's shadow war in the Baltics](https://ig.ft.com/baltic-sea/) | A dark full-screen map with yellow vessel points. One text card per scroll step, with the key word in yellow. Each chapter has an icon. | Desktop, mobile |
| [Reuters: the New Zealand insurer and the shadow fleet](https://www.reuters.com/investigations/iran-russia-new-zealand-insurer-that-kept-their-sanctioned-oil-flowing-2025-10-28/) | Satellite images with a full credit line (provider, date, place). A count stands alone between paragraphs. Each figure names its data provider. | Mobile |
| [Washington Post: a Russian missile, filled with U.S. tech](https://www.washingtonpost.com/world/interactive/2025/ukraine-children-missile-kryvyi-rih/) | One human story carries the component-supply story and links each part to a maker. | Mobile |
| [Bellingcat: heading data and grain smuggling](https://www.bellingcat.com/news/2026/06/12/shadow-fleet-russian-grain-stolen-ukraine-libya-ais-technique-grumant/) | The method is part of the story: annotated AIS screenshots and satellite crops, each with its source. | Desktop |
| [The Guardian: tankers carry Russian diesel to the US](https://www.theguardian.com/us-news/2026/oct/29/seven-oil-tankers-288000-tonnes-russian-diesel-sail-us-putin-trump) | A globe route map with separate files for mobile, landscape and dark mode. | Mobile |

The New York Times piece on the dark fleet blocked our scraper. We did not use it.

## The four Met Museum items

We read each object page and its record in the Met Open Access API.

| Id | Title | Artist | Date | CC0 |
|---|---|---|---|---|
| 202506 | Chess set | No name (Russian, Kholmogory) | Late 18th to early 19th century | Yes |
| 24927 | Pair of Flintlock Pistols of Empress Catherine the Great (1729–1796) | Johan Adolph Grecke | 1786 | Yes |
| 294322 | Astapovo Train Station, On the Right is the House in Which Lev Nikolayevich (Tolstoy) Died | Aleksey Ivanovich Saveliev | 1910 | **No** |
| 158372 | Bed curtain border | No name (Russian) | Early 19th century | Yes |

Item 294322 is not public domain, and its image is "restricted". Do not use it. The three other items have a public-domain (CC0) main image.

## Ten moves for our page, in rank order

1. **Chain story on a dark map.** A full-screen dark map, one text card per scroll step, the key term in the accent colour. Source: FT Baltics.
2. **Cover with a big number.** A thin title and a giant accent-colour figure over a grainy, dimmed CC0 image. The caption and credit are in the first view. Source: The Armenian Genocide.
3. **Ports and fleet map as the main object.** The map is the hero, with monospace capitals for ports and dates. Source: OceanX 2025.
4. **Part chapter breaks.** A full-screen break per part: a dithered part numeral, one sentence, a date. Sources: Sakharov Space, Type Dither.
5. **Big-number moments.** Each key count stands alone between paragraphs, with its source on the next line. Sources: Reuters, The Other Side of Truth.
6. **Fixed part bar.** A thin fixed bar shows the parts, so the reader knows where they are. Sources: Decriminalize Poverty, The Other Side of Truth.
7. **A graphic that splits on scroll.** Show the export total first, then split it by route, fleet and buyer. Source: Searching for Birds.
8. **Entity references with a tooltip.** Mark each vessel, company or person. On hover or tap, show a card with the type, the identifier and the source, in the instrument style. Sources: The Sea We Breathe, Bellingcat.
9. **Figure framing.** Each figure sits on a faint grid, with one accent colour and a one-line source note. Each image gets provider, date and place. Sources: Body Layout, Reuters.
10. **Component chain as one object.** Each part of the chain opens its maker and its supply path. Sources: EnduroSat, Washington Post.
