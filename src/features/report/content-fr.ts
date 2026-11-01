import { reportTitles } from './titles';
import {
  closingUi,
  figureTexts,
  fightUi,
  financeUi,
  methodUi,
  openingUi,
  ownershipUi,
  payUi,
  portsFleetUi,
  report,
  ui,
} from './content';
import { frParts } from './parts-fr';
import { noteTwins } from './source/note-twins';
import type { ReportContent } from './use-content';

// The French copy of the report content. The text, the notes and the figure labels of the
// publication are the words of the author (V4 and the French data of the figures). The words of
// the page itself (controls, table heads, short notes of a chart) have no French source: they are
// written here, and never a note or a sentence of the report.

/** The labels of a figure in French: each French label of the publication as it is, and each
 * English name of the data (the English value of a label) in its French label. */
const french = <T extends Readonly<Record<string, string>>>(labels: T): T => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(labels)) out[key] = key;
  for (const [key, value] of Object.entries(labels)) if (!(value in out)) out[value] = key;
  return out as T;
};

/** The French label of the publication that an English text of a figure translates. */
const back =
  (labels: Readonly<Record<string, string>>) =>
  (english: string): string =>
    Object.entries(labels).find(([, value]) => value === english)?.[0] ?? english;

const f1 = back(figureTexts.figures['1'].labels);
const f2 = back(figureTexts.figures['2'].labels);
const { figures } = figureTexts;

const frFigureTexts = {
  fig1: {
    layers: figureTexts.fig1.layers.map((layer) => ({
      k: f1(layer.k),
      d: f1(layer.d),
      items: layer.items.map(f1),
    })),
    conditions: figureTexts.fig1.conditions.map((one) => ({
      letter: one.letter,
      title: f1(one.title),
      text: f1(one.text),
    })),
    arrows: figureTexts.fig1.arrows.map((arrow) => ({
      from: f1(arrow.from),
      to: f1(arrow.to),
      lines: arrow.lines.map(f1),
    })),
    budgetPath: f1(figureTexts.fig1.budgetPath),
  },
  fig2: {
    events: figureTexts.fig2.events.map((event) => ({
      ...event,
      title: f2(event.title),
      detail: f2(event.detail),
    })),
    legend: {
      EU: f2(figureTexts.fig2.legend.EU),
      US: f2(figureTexts.fig2.legend.US),
      COAL: f2(figureTexts.fig2.legend.COAL),
      WAR: f2(figureTexts.fig2.legend.WAR),
    },
  },
  figures: {
    '1': { ...figures['1'], labels: french(figures['1'].labels) },
    '2': { ...figures['2'], labels: french(figures['2'].labels) },
    '3': {
      panels: [
        { id: 'a', title: 'Exportations russes par acheteur', unit: 'milliards de dollars' },
        { id: 'b', title: 'Brut acheté à la Russie', unit: 'millions de tonnes' },
      ],
      note: 'Données miroirs, déclarées par le pays acheteur. Coalition (a) : UE, États-Unis, Royaume-Uni, Japon, Corée du Sud, Suisse, Norvège ; UE (b) : les 27 États membres. Brut de la Turquie : estimation du CREA ; Chine 2023 : estimation de Comtrade.',
      labels: french(figures['3'].labels),
    },
    '4': {
      panels: [{ id: 'a', title: 'Brent, Oural et plafond de prix', unit: 'dollars par baril' }],
      note: 'Oural : prix moyen mensuel retenu pour l’impôt russe sur l’extraction. Brent : prix mensuel de la Banque mondiale. La zone bleue est l’écart entre les deux ; elle comprend aussi la qualité et le fret. Plafond : prix maximal, fixé par l’UE, d’un brut russe transporté ou assuré par une société de la coalition.',
      labels: french(figures['4'].labels),
    },
    '5': {
      panels: [
        { id: 'a', title: 'Part du pétrole et du gaz dans les recettes', unit: '%' },
        {
          id: 'b',
          title: 'Recettes du pétrole et du gaz, et défense',
          unit: 'billions de roubles de 2021',
        },
      ],
      note: 'Prix constants : valeurs divisées par le déflateur du PIB (base 2021). Défense : section « Défense nationale » du budget ; le ministère n’en publie plus le détail depuis 2022 ; 2022 d’après Reuters, 2024 et 2025 : budget prévu.',
      labels: french(figures['5'].labels),
    },
    '6': {
      panels: [
        {
          id: 'a',
          title: 'Trafic des ports pétroliers',
          unit: 'toutes marchandises, indice 2021 = 100',
        },
        { id: 'b', title: 'Janvier-avril 2026 / janvier-avril 2025', unit: 'variation en %' },
        { id: 'c', title: '', unit: '' },
      ],
      note: 'Novorossiisk comprend le terminal du CPC (surtout du pétrole kazakh). Touapsé : pas de chiffre pour 2014 et 2015.',
      noteB:
        '« Flotte fantôme » et « IG » (assurance par un club de l’International Group) sont des catégories de la KSE, pas des désignations ; la petite flotte de la coalition sans assurance IG n’est pas montrée.',
      labels: french(figures['6'].labels),
    },
    '7': {
      panels: [
        {
          id: 'a',
          title: 'Pétrole par mer, janvier 2026',
          unit: 'milliers de barils par jour (kb/j)',
        },
        { id: 'b1', title: 'GAZ PAR GAZODUC', unit: 'Md m³' },
        { id: 'b2', title: 'GAZ NATUREL LIQUÉFIÉ', unit: 'Mt' },
        { id: 'c', title: 'BRUT PAR OLÉODUC', unit: 'Mt' },
      ],
      note: '« Autres pays » est un solde calculé par l’auteur.',
      noteB:
        'Gaz vers l’UE : UE et Europe du Sud-Est (TurkStream). Brut vers l’UE : Droujba sud, par l’Ukraine. Droujba nord : plus de brut russe vers la Pologne et l’Allemagne depuis 2023 (GEM) ; vers la Biélorussie, volume 2025 non documenté. « Autres pays » est un solde calculé par l’auteur. Le gaz par gazoduc et le GNL ne s’additionnent pas : aucun facteur de conversion n’est enregistré. Hachures : projet désigné (Arctic LNG 2, désigné par l’OFAC et le Royaume-Uni).',
      labels: french(figures['7'].labels),
    },
    '8': {
      panels: [],
      note: 'Recensement des {F.census.read} pétroliers désignés de la base, dont {F.census.ais} ont une identité AIS ; chaque part compte les navires suivis assez longtemps (6, 12 ou 24 mois avant le 26 octobre 2026). Les {lanesN} navires de la frise sont des exemples choisis pour montrer chaque profil. Barres : identité AIS d’après les dates du registre (pistes). Une nouvelle identité non liée au numéro OMI sort du suivi : les escales après la désignation sont des minimums. Les escales dans l’UE comptent les {F.census.ais} navires, dont seulement {F.census.fol24} sont suivis 24 mois ({F.census.eu24b} avant, {F.census.eu24a} après pour ceux-ci).',
      labels: french(figures['8'].labels),
    },
    '9': {
      panels: [
        { id: 'a', title: 'Exportations', unit: '%' },
        { id: 'b', title: 'Importations', unit: '%' },
      ],
      note: 'Devises de pays « inamicaux » : « pays inamicaux » est le terme du gouvernement russe (liste 430-r) ; la série additionne les devises de ces pays. Parts de tous les règlements, en %.',
      labels: french(figures['9'].labels),
    },
    '10': {
      panels: [{ id: 'a', title: '', unit: 'millions de dollars' }],
      note: 'Données miroirs, déclarées par le pays vendeur : des minimums, car des partenaires ont cessé de déclarer (le Kazakhstan depuis février 2024, la Thaïlande depuis février 2025, d’après la KSE). Biens CHP : 55 codes à six chiffres du Système harmonisé.',
      labels: french(figures['10'].labels),
    },
    '11': {
      panels: [],
      note: 'Les largeurs comptent les chaînes (une chaîne = 1, partagée entre ses routes), pas un volume ni une valeur : ce sont des cas enquêtés, pas des parts du commerce. {F.doc} des {F.routes * 3} étapes sont documentées (liens documentés et source du gouvernement ukrainien). Les {F.chains} chaînes montrées suivent {F.routes} routes, soit {F.routes * 3} liens (trois par route). Passage non documenté : les deux étapes sont documentées, pas le passage de l’une à l’autre. {F.chains} des {F.all} chaînes enregistrées sont montrées. Une route n’est pas une vente du fabricant.',
      labels: french(figures['11'].labels),
    },
    '12': { ...figures['12'], labels: french(figures['12'].labels) },
  },
  dataLabels: french(figureTexts.dataLabels),
};

/** The French copy of the report content: the French text (V4) with the note ids of the English
 * text, and the words of the page in French. */
export const fr: ReportContent = {
  // The page shows only the title and the byline of this block.
  report: { ...report, title: reportTitles.fr, byline: 'Par Tomas Arden et Gabriel' },
  parts: frParts,
  untwinned: Object.entries(noteTwins).flatMap(([id, twin]) => (twin === null ? [id] : [])),
  figureTexts: frFigureTexts,
  ui: {
    ...ui,
    reportLabel: 'Rapport de recherche',
    lang: 'fr',
    numberLocale: 'fr-FR',
    paths: { report: 'fr', notes: 'fr/bibliography' },
    switch: { lang: 'en', text: 'EN', label: 'Read in English', report: '', notes: 'bibliography' },
    counters: {
      label: 'Ampleur de la recherche',
      nodes: 'Nœuds',
      relations: 'Relations',
      documents: 'Documents',
      sources: 'Notes',
    },
    part: { nodes: 'Nœuds de cette partie' },
    figure: {
      name: 'Figure',
      unit: 'Unité',
      period: 'Période',
      sources: 'Sources',
      note: 'Note',
      pending: 'Le graphique de cette figure vient dans une version suivante de la page.',
    },
    node: {
      open: 'Ouvrir la fiche',
      evidence: 'Score de preuve',
      outOf: 'sur 11',
      relations: 'Relations',
      documents: 'Documents',
    },
    panel: {
      close: 'Fermer',
      drag: 'Glisser vers le bas pour fermer',
      relations: 'Relations',
      noRelation: 'Aucune relation ne relie ce nœud à un autre nœud du rapport.',
      neighbours: 'Voisins',
      neighboursLabel: 'Le nœud et ses voisins dans le graphe du rapport',
      place: 'Lieu',
      placeLabel: 'Position du nœud sur une carte',
      sources: 'Documents',
      noSource: 'Aucun identifiant de document n’est enregistré pour ce nœud.',
      record: 'Fiche',
      entity: 'Ouvrir la page de l’entité',
      graph: 'Ouvrir dans le graphe',
    },
    note: {
      label: 'Source',
      all: 'Toutes les notes',
      documents: 'Documents de la base',
      retrieved: 'récupéré le',
      missing: 'Notes du texte anglais',
      noTwin: 'pas de source FR',
      image: 'Image',
    },
    index: {
      title: 'Tous les nœuds du rapport',
      layers: ['Payer', 'Financer', 'Combattre', 'Possession'],
    },
    bibliography: {
      ...ui.bibliography,
      title: reportTitles.frNotes,
      back: 'Retour au rapport',
      label: 'Notes du rapport',
    },
  },
  openingUi: {
    ...openingUi,
    partBar: { label: 'Parties du rapport', of: '/' },
    links: {
      label: 'Liens du rapport',
      read: 'Faire défiler pour lire',
      data: 'Données',
      pdf: 'Télécharger le rapport',
      chain: 'Voir la chaîne du pétrole',
      graph: 'Explorer le graphe',
    },
    summary: {
      ...openingUi.summary,
      chart: {
        ...openingUi.summary.chart,
        title: 'Exportations réglées en roubles',
        label: 'Exportations réglées en roubles, en pourcentage des règlements, par année',
        unit: '% des règlements des exportations',
        source: 'Source : Banque de Russie (2026).',
      },
      // The words of a finding with no number, exactly as in the French item.
      values: [
        { words: '', note: '1' },
        { words: '', note: '2' },
        { words: 'presque doublé', note: '' },
        { words: 'moins d’un cinquième', note: '3' },
        { words: '', note: '4' },
        { words: '', note: '5' },
      ],
    },
  },
  methodUi: {
    layers: {
      ...methodUi.layers,
      label: 'Couches',
      unit: 'Nœuds critiques, un carré par nœud',
      critical: 'Critiques, sans fiche dans la page',
      inData: 'Critiques et dans les données de la page',
      examined: 'Dans les données de la page, moins de trois conditions documentées',
      open: 'Ouvrir les nœuds des données de la page',
      conditions: 'Trois conditions d’un nœud critique',
      schematic: 'Schéma de l’argument du rapport, pas une relation mesurée.',
    },
    timeline: {
      ...methodUi.timeline,
      label: 'Sanctions, 2014-2026',
      // Quoted from the French text of the part.
      period: 'Les années 2024-2026',
      gap: '2015-2021 : aucun événement dans cette figure',
      unit: 'Événement, daté',
      actors: { COAL: 'COALITION' },
      cursor: 'Curseur de temps : événement',
      counters:
        'Pétroliers désignés par chaque régime jusqu’à la fin du trimestre de l’événement. Données : les listes de sanctions de l’UE, du Royaume-Uni et de l’OFAC ; calculs de l’auteur',
      table: 'Événements et pétroliers désignés, en tableau',
      date: 'Date',
      event: 'Événement',
    },
  },
  payUi: {
    ...payUi,
    estimate: 'Point vide : estimation (autre mesure que la douane)',
    crossingNote:
      'Anneau : là où une ligne passe sous une autre, entre deux valeurs de fin d’année.',
    crossing: '{a} sous {b}',
    year: 'Année',
    estimated: 'estimation',
    table: 'Valeurs de toutes les années',
    f4: {
      label: 'Prix du Brent, prix de l’Oural et plafond de prix de l’UE, par mois',
      note: 'Oural : prix moyen mensuel retenu pour l’impôt russe sur l’extraction. Brent : prix mensuel de la Banque mondiale. La zone grisée est l’écart entre les deux ; elle comprend aussi la qualité et le fret. Plafond : prix maximal, fixé par l’UE, d’un brut russe transporté ou assuré par une société de la coalition.',
      // Each card quotes the French text of the part.
      steps: [
        {
          text: 'Depuis décembre 2022, une société de l’UE ou de ses alliés ne peut plus transporter, assurer ou financer un brut russe vendu au-dessus d’un plafond de prix (figure 4).[^23]',
        },
        {
          text: 'Tant que l’Oural dépasse le plafond, il voyage surtout sur des navires et avec des assureurs hors de la coalition, que le plafond ne lie pas (section 2.5).[^26]',
        },
        {
          text: 'L’écart s’élargit encore après octobre 2025, quand l’OFAC désigne [[N-P026|Rosneft]] et [[N-P030|Lukoil]], deux grands groupes pétroliers russes,[^28] et que plusieurs raffineurs indiens cessent d’acheter.[^29] D’août 2023 à octobre 2025, l’Oural vaut chaque mois de 10 à 16 dollars de moins que le Brent ; depuis novembre 2025, il en vaut de 19 à 27 de moins.[^30]',
        },
      ],
      whatIf: {
        title: 'Ligne d’hypothèse, pas un modèle',
        slider: 'Ligne d’hypothèse, en $ par baril',
        line: 'hypothèse {v} $',
        above: 'Oural au-dessus de la ligne : {n} sur {k} mois avec une valeur.',
        none: 'L’Oural n’est au-dessus de la ligne aucun mois.',
        missing: 'Mois sans valeur de l’Oural : {n}. Ils restent vides.',
        table: 'Oural moins la ligne d’hypothèse, chaque mois',
        month: 'Mois',
        urals: 'Oural ($ par baril)',
        gap: 'Oural moins la ligne ($)',
      },
    },
  },
  portsFleetUi: {
    ...portsFleetUi,
    chain: {
      open: 'Ouvrir la chaîne du pétrole sur le globe',
      hint: 'Du gisement à l’oléoduc, à la raffinerie, au terminal et au port de sortie. La carte du registre GAB s’ouvre en plein écran.',
    },
    map: {
      ...portsFleetUi.map,
      label: 'Carte des terminaux d’exportation de pétrole du rapport',
      named: 'Nommé dans cette étape',
      other: 'Autre terminal du rapport',
      ban: 'Interdiction de transactions de l’UE avec le port : date de début à chaque port',
      banDates: {
        'N-P001': 'février 2025',
        'N-P002': 'février 2025',
        'N-P005': 'février 2025',
        'N-P011': 'avril 2026',
        'N-P009': 'avril 2026',
      },
      pacific: 'Ports d’exportation de brut sur la Baltique, la mer Noire et le Pacifique',
      change: 'Trafic, janvier-avril 2026 / janvier-avril 2025, variation en %',
      throughput: 'Aire du cercle : trafic toutes marchandises en',
      visits: {
        label: 'Escales AIS des pétroliers nommés dans ce rapport, GFW, date de la requête',
        powered: 'Données de Global Fishing Watch.',
        counted: 'Escales :',
        by: 'escales de',
        listed: 'pétroliers listés',
        of: 'des',
        sources: 'Sources de cette carte',
        port: 'Port',
        count: 'Escales',
        tankers: 'Pétroliers',
        table: 'Les escales, en tableau',
        limit: 'Une présence au port, pas un chargement.',
        range: 'du {from} au {to}',
      },
      flows: 'Brut par mer par bassin de chargement et flotte, janvier 2026, kb/j',
      open: 'Ouvrir la fiche de',
      data: 'Données :',
      basemap: 'Fond de carte :',
      banSource: 'Dates : texte du rapport, note 42 (février 2025 à avril 2026)',
      schematic:
        'Schéma : chaque colonne se tient au-dessus de sa mer et donne le total du bassin, pas le volume d’un terminal.',
      fleetTags: {
        '“Shadow fleet”': 'flotte fantôme',
        'IG-insured': 'IG',
        'Coalition, no IG cover': 'coalition',
      },
    },
    traffic: {
      embargoDate: 'déc. 2022',
      cTitle: 'c. Brut par mer par catégorie de flotte',
      cUnit: 'kb/j',
      bannedPorts: 'Primorsk, Oust-Louga, Novorossiisk',
    },
    flows: {
      table: 'Valeurs du graphique',
      from: 'De',
      to: 'Vers',
      value: 'Valeur',
      state: 'État',
      notDocumented: 'non documenté',
    },
    lives: {
      period: 'De 6 mois avant à 24 mois après chaque désignation',
      lost: 'pétroliers désignés, un point chacun',
      after: 'Escale après la désignation',
      label: 'Frise de {n} navires désignés, de 6 mois avant à 24 mois après leur désignation',
      table: {
        summary: 'Valeurs de la frise',
        ship: 'Navire',
        group: 'Profil',
        ids: 'Identité AIS : pavillon, jours depuis la désignation',
        before: 'Escales avant',
        after: 'Escales après',
        span: '{flag} de {from} à {to}',
        kinds: { R: 'russes', O: 'autres', E: 'UE' },
      },
    },
    waves: {
      regimes: { EU: 'UE', UK: 'Royaume-Uni', OFAC: 'OFAC' },
      unit: 'pétroliers',
      filters: 'Régimes montrés',
      aTitle: 'a. Nouvelles désignations, par trimestre',
      aUnit: 'un pétrolier désigné par deux régimes compte deux fois',
      aLabel: 'Nouvelles désignations de pétroliers par trimestre, par régime',
      earlier: '{n} désignations avant 2022 ne sont pas tracées.',
      bTitle: 'b. Pétroliers, par les régimes qui les désignent',
      bUnit: 'chaque pétrolier compte une fois',
      tankers: '{n} pétroliers désignés par les régimes montrés',
      none: 'Aucun régime n’est montré. Choisir UE, Royaume-Uni ou OFAC.',
      quarter: 'Trimestre',
      partialRow: '{q}, jusqu’au {date}',
      partial: 'Colonne en tirets : {q}, désignations jusqu’au {date} seulement.',
    },
  },
  financeUi: {
    ...financeUi,
    figure: {
      ...financeUi.figure,
      stepLabel: 'Part du rouble dans les règlements',
      exports: 'Exportations',
      imports: 'Importations',
      tableCaption: 'Données de la figure 10, en pourcentage du total',
      year: 'Année',
      inspect: 'Parts d’une année',
    },
    relays: { label: 'Relais de paiement' },
  },
  fightUi: {
    ...fightUi,
    suppliers: {
      a: 'a. Par pays déclarant',
      b: 'b. Neuf pays tiers',
      bScale: 'Une échelle pour les neuf pays : la barre la plus haute vaut {max}.',
      year: 'Année',
      country: 'Pays déclarant',
      noValue: 'Hachures : aucune valeur déclarée',
      noValueShort: 'n.d.',
      sanctionYear: 'Bande : 2023, l’année du décret 14114',
      countries: {
        Kazakhstan: 'Kazakhstan',
        Kyrgyzstan: 'Kirghizstan',
        Armenia: 'Arménie',
        Türkiye: 'Turquie',
        'United Arab Emirates': 'Émirats arabes unis',
        India: 'Inde',
        Malaysia: 'Malaisie',
        Thailand: 'Thaïlande',
        'Viet Nam': 'Viêt Nam',
      },
    },
    chain: {
      ...fightUi.chain,
      title: 'De la marque à l’arme',
      step: 'Étape',
      mapLabel: 'Carte des lieux nommés par l’étape à l’écran',
      openSite: 'Ouvrir la fiche du site',
      imports:
        'Importations russes de biens CHP du champ de bataille, janvier–octobre 2023, part de la valeur en %',
      brands: 'Marques de la coalition, millions de dollars US',
      document: 'Document',
      page: 'p.',
      source: 'Source',
      unit: 'Unité',
      routesTitle: 'Du fabricant à l’intermédiaire',
      buyersTitle: 'De l’intermédiaire à l’arme',
      byIntermediary: 'Chaînes par intermédiaire',
      byBuyer: 'Chaînes par acheteur',
      byUse: 'Chaînes par usage final',
      sites: 'Nœuds de la couche combattre avec un site connu',
      states: 'Trait : documenté. Tirets : piste. Points : aucune source trouvée.',
      stepsByState: 'Étapes des routes, par état',
      chinaShare: 'Chine, Hong Kong : part de la valeur',
      record: 'Fiche',
      siteCount: '{n} sites sur la carte',
      flowColumns: [
        'Pays du fabricant du composant',
        'Pays de l’intermédiaire',
        'Acheteur',
        'Usage final',
      ],
      flowText:
        'Chaque bande est un ensemble de chaînes. Sa largeur compte les chaînes, sur une échelle pour les quatre colonnes. La Chine et Hong Kong portent l’accent.',
      unitChains: 'Chaînes',
      urals: 'Oural',
      russia: 'Russie',
      chainUnit: 'une chaîne = 1, partagée entre ses routes',
      arcNote:
        'Carte : les arcs relient le pays de fabrication au pays de l’intermédiaire. Les chaînes avec le même pays ou sans pays nommé ne sont pas tracées : les arcs portent {drawn} des {all} chaînes.',
      unplaced: 'Carte : un groupe sans lieu unique n’est pas tracé.',
      from: 'De',
      to: 'Vers',
      fromTo: '{a} vers {b}',
      dataNames: {
        'Brand (producer headquarters)': 'Marque (siège du producteur)',
        'Country of manufacture': 'Pays de fabrication',
        'Final seller to Russia': 'Dernier vendeur à la Russie',
        Coalition: 'Coalition',
        'China, Hong Kong': 'Chine, Hong Kong',
        Other: 'Autre',
        'Not identified': 'Non identifié',
        'n/d': 'n.d.',
        'US 25.5, Taiwan 7.0, EU 6.1, other coalition 5.4':
          'États-Unis 25,5, Taïwan 7,0, UE 6,1, autre coalition 5,4',
        'Malaysia 5.8, Vietnam 2.5, other 7.7': 'Malaisie 5,8, Viêt Nam 2,5, autre 7,7',
        'EU 3.7, other coalition 5.9': 'UE 3,7, autre coalition 5,9',
        'China 38.0, Hong Kong 30.9': 'Chine 38,0, Hong Kong 30,9',
        'Turkey 6.9, UAE 3.3, EEU 2.0, other 9.3': 'Turquie 6,9, EAU 3,3, UEEA 2,0, autre 9,3',
        'United States': 'États-Unis',
        Taiwan: 'Taïwan',
        EU: 'UE',
        Europe: 'Europe',
        UK: 'Royaume-Uni',
        Switzerland: 'Suisse',
        China: 'Chine',
        'Hong Kong': 'Hong Kong',
        Malaysia: 'Malaisie',
        Vietnam: 'Viêt Nam',
        Turkey: 'Turquie',
        UAE: 'Émirats arabes unis',
        Iran: 'Iran',
        'Central Asia': 'Asie centrale',
        'Importer / trader': 'Importateur ou négociant',
        'Procurement agent': 'Agent d’achat',
        'Producer / subsystem maker': 'Producteur de sous-systèmes',
        'Iranian or North Korean producer': 'Producteur iranien, nord-coréen',
        'Not named': 'Non nommé',
        'None (direct)': 'Aucun (achat direct)',
        Drones: 'Drones',
        Missiles: 'Missiles',
        'Guided bombs': 'Bombes guidées',
        'Other or not stated': 'Autre, non précisé',
      },
      routeTable: 'Toutes les routes de la carte, en tableau',
      routeColumns: ['Pays de fabrication', 'Pays de l’intermédiaire', 'État', 'Chaînes'],
      stateWords: {
        documented: 'documenté',
        'documented (Ukrainian government source only)':
          'documenté (source du gouvernement ukrainien seulement)',
        'documented (Russian importer named; foreign intermediary not named)':
          'documenté (importateur russe nommé ; intermédiaire étranger non nommé)',
        lead: 'piste',
        'no source found': 'aucune source trouvée',
      },
    },
    plants: {
      ...fightUi.plants,
      title: 'Usines d’armement et intégrateurs russes par arme principale',
      unit: 'un point = une usine ou un intégrateur',
      sources:
        'Fiche GAB : positions des usines (enregistrées ou approchées) et résultat du contrôle sur les listes de l’UE, du Royaume-Uni et des États-Unis ; certaines usines ne sont pas contrôlées',
      mapLabel:
        'Carte des usines d’armement et intégrateurs russes par arme principale ; sur un grand écran, six usines principales sont nommées ; les points vides sont approchés',
      legend: [
        ['drone', 'Drones'],
        ['cruise missile', 'Missiles'],
        ['guided bomb', 'Bombes guidées'],
        ['armour', 'Blindés'],
        ['aircraft', 'Avions'],
        ['other', 'Autre'],
      ],
      approximate: 'Vide : point approché',
      table: 'Toutes les usines et tous les intégrateurs, en tableau',
      columns: [
        'Usine ou intégrateur',
        'Ville',
        'Arme',
        'Point',
        'UE',
        'Royaume-Uni',
        'États-Unis',
      ],
      words: {
        stored: 'position enregistrée',
        lead: 'approchée',
        none: 'pas sur la carte',
        yes: 'oui',
        no: 'non',
        'not checked': 'non contrôlé',
        'no match by name': 'aucune correspondance par nom',
        'BIS Entity List (not SDN)': 'BIS Entity List (pas SDN)',
        drone: 'drone',
        'cruise missile': 'missile de croisière',
        'ballistic missile': 'missile balistique',
        'guided bomb': 'bombe guidée',
        armour: 'blindé',
        aircraft: 'avion',
        'air defence': 'défense aérienne',
        'communications/EW': 'communications, guerre électronique',
        other: 'autre',
      },
    },
    noPeriod: 'Non donnée par la source de la figure',
    routes: {
      title: 'Routes des composants étrangers des armes russes',
      unit: 'nombre de chaînes',
      sources: 'RUSI, CAR, IISS ; autorités américaines et ukrainiennes ; presse.[^91][^93]',
    },
  },
  ownershipUi: {
    ...ownershipUi,
    figure: {
      legend: 'Légende',
      links: 'liens',
      more: 'Montrer {n} de plus',
      fewer: 'Montrer moins',
      table: 'Tous les liens de la figure 12, en tableau',
      rows: '{n} lignes',
      columns: {
        owner: 'Propriétaire',
        relation: 'Relation',
        share: 'Part',
        owned: 'Possédé',
        state: 'État',
      },
    },
    owners: {
      ...ownershipUi.owners,
      title: 'Qui détient les sites de la carte',
      unit: 'un point = un site',
      sources: 'Fiche GAB : les documents de chaque ligne, dans le tableau.',
      checked: 'contrôlé contre la base le {date}',
      asOf: 'au {date}',
      outsideFigure:
        'La figure 12 n’a aucun nœud de cette couche sous ce groupe ; la base documente ce détenteur.',
      mapLabel: 'Carte des sites du rapport, par le contrôleur de leur détenteur',
      table: 'Les sites de la carte, en tableau',
      rows: '{n} lignes',
      columns: {
        site: 'Site',
        holder: 'Détenteur',
        relation: 'Relation',
        controller: 'Contrôleur',
        documents: 'Documents',
      },
      relations: {
        owns: 'possède',
        owns_majority: 'possède la majorité de',
        owns_operator: 'possède l’exploitant de',
        operates: 'exploite',
      },
      labels: {
        'Russian federal state': 'État fédéral russe',
        'Private shareholders': 'Actionnaires privés',
        Transneft: 'Transneft',
        Rosneft: 'Rosneft',
        Rostec: 'Rostec',
        'Other holdings': 'Autres holdings',
        'Named persons': 'Personnes nommées',
      },
    },
  },
  closingUi: {
    limits: {
      limitsLabel: 'Limites des preuves',
      leadsLabel: 'Pistes',
      checkLabel: 'À vérifier avant usage',
    },
    annex: {
      ...closingUi.annex,
      locale: 'fr-FR',
      record: 'Dans la base',
      entities: 'Entités',
      critical: 'Nœuds critiques',
      official: 'Nœuds critiques sur une source officielle, au moins',
      recordSource: 'Source : le texte de ce rapport, chiffres au {date}',
      report: 'Dans ce rapport',
    },
  },
};
