import type { ReportPart } from './content';

// The parts of the French page: the French text (V4), word for word, in the blocks, figures and
// node marks of the English page. The note ids are those of the English text (source/note-twins.ts).
export const frParts: ReportPart[] = [
  {
    source: 'report-fr.md, Synthèse',
    slug: 'summary',
    title: 'Synthèse',
    blocks: [
      {
        kind: 'p',
        text: '**Le problème.** Depuis 2022, l’Union européenne, les États-Unis, le Royaume-Uni et leurs alliés imposent à la Russie de larges sanctions, du pétrole et du gaz aux technologies militaires. Pourtant, la guerre continue, et elle coûte de plus en plus cher : à prix constants, le budget de défense prévu pour 2025 vaut 2,6 fois la dépense de 2021. D’où viennent l’argent et la technologie qui permettent à la Russie de la mener ?',
      },
      {
        kind: 'p',
        text: '**La méthode.** Dans une base de près de 5 200 entités, dont chaque fait renvoie à un document archivé, le rapport cherche les nœuds (sociétés, ports, flottes, banques, canaux de paiement) exposés aux sanctions, actifs en 2024-2026 et reliés à un pays qui ne les applique pas.',
      },
      {
        kind: 'p',
        text: '**Le résultat.** La Russie résiste, et le rapport l’explique par de nouvelles relations commerciales avec des pays non alignés sur la coalition, qui usent de leur autonomie stratégique tout en tirant parti de leur position de force dans les négociations avec la Russie.',
      },
      {
        kind: 'li',
        text: '**Clients :** De 2021 à 2025, les achats de l’UE à la Russie baissent de 84 %[^1] ; la Chine devient le premier client russe et l’Inde multiplie par vingt ses achats de brut russe.',
      },
      {
        kind: 'li',
        text: '**Navires :** Les pétroliers dits de la « flotte fantôme », liés à un pays hors de la coalition et sans assurance occidentale, transportent 79 % du brut exporté par mer en janvier 2026.[^2]',
      },
      {
        kind: 'li',
        text: '**Prix :** Depuis novembre 2025, la décote du brut russe sur le Brent a presque doublé, ce que le rapport relie, par hypothèse, aux sanctions américaines contre [[N-P026|Rosneft]] et [[N-P030|Lukoil]]. Les partenaires en profitent : la Chine achète le brut russe avec une remise et vend les composants des armes avec une forte prime.',
      },
      {
        kind: 'li',
        text: '**Budget :** La part du pétrole et du gaz dans les recettes fédérales passe de la moitié en 2014 à moins d’un cinquième en 2026, en partie parce que ces recettes reculent.[^3]',
      },
      {
        kind: 'li',
        text: '**Monnaie :** Le rouble règle 53 % des exportations russes en 2025, contre 14 % en 2021,[^4] et le rouble et le yuan règlent presque tous les paiements avec la Chine.',
      },
      {
        kind: 'li',
        text: '**Composants :** Enfin, la Chine fournit 77 % des biens prioritaires pour l’armement vendus à la Russie en 2025, et Hong Kong 11 %.[^5]',
      },
      {
        kind: 'p',
        text: 'Les sources des autres chiffres sont données dans le corps du rapport.',
      },
      {
        kind: 'p',
        text: '*This investigation was supported by FNF through the OSINT+ Investigation Competition 2026. The author(s) are solely responsible for the content and conclusions presented.*',
      },
    ],
    notes: [
      {
        id: '1',
        text: 'Calculs de l’auteur d’après Bahí Esteba, A. et al. (2026, 21 septembre). *Russian foreign trade tracker* (35ᵉ éd.) [Données]. Bruegel. https://www.bruegel.org, fig. 2.',
      },
      {
        id: '2',
        text: 'Dodonov, B., Hilgenstock, B. et al. (2026, 2 mars). *Russian Oil Tracker*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/03/ROT_FEB26.pdf, p. 3.',
      },
      {
        id: '3',
        text: 'Calculs de l’auteur d’après Ministère des Finances de Russie. (2026a). [Exécution du budget fédéral, annexe 3.1]. minfin.gov.ru, lignes 1, 1.1 et 1.2 ; Ministère des Finances de Russie. (2026b). [Exécution du budget, janvier-septembre 2026]. minfin.gov.ru/ru/press-center/?id_4=40677.',
      },
      {
        id: '4',
        text: 'Banque de Russie. (2026, 15 octobre). *Currency composition of settlements* [Données]. https://cbr.ru/vfs/eng/statistics/credit_statistics/cur_str_new_e.xlsx.',
      },
      {
        id: '5',
        text: 'Calculs de l’auteur d’après UN Comtrade. (2026, 25 octobre). *UN Comtrade database* [Données]. https://comtradeplus.un.org/.',
      },
    ],
    nodeIds: ['N-P026', 'N-P030'],
  },
  {
    source: 'report-fr.md, Introduction',
    slug: 'introduction',
    title: 'Introduction',
    blocks: [
      {
        kind: 'p',
        text: 'Les sanctions contre la Russie ne datent pas de 2022. Dès 2014, au moment de l’annexion de la Crimée, l’Union européenne gèle les avoirs de 21 responsables russes et criméens, puis interdit aux cinq grandes banques publiques russes de lever des fonds à plus de 90 jours sur ses marchés, et encadre la vente de technologies pétrolières et de biens à double usage destinés à l’armée.[^6] Ensuite, en décembre 2016, les États-Unis maintiennent leurs sanctions jusqu’à ce que la Russie applique les accords de Minsk, signés en 2014 et 2015 pour arrêter les combats dans l’est de l’Ukraine.[^7] En revanche, après l’invasion de l’Ukraine, le 24 février 2022, les mesures changent d’échelle : embargo sur le pétrole russe, plafond de prix sur le pétrole vendu ailleurs, interdictions faites aux ports et aux banques (figure 1).',
      },
      {
        kind: 'p',
        text: 'Pourtant, la guerre continue en 2026, et l’État russe parvient à la payer : à prix constants, le budget prévu pour la défense en 2025 vaut 2,6 fois la dépense de 2021,[^8] alors que, sur la même période, les recettes du pétrole et du gaz baissent de 36 %.[^9] Si ces recettes reculent tandis que la dépense de guerre augmente, par où passent donc l’argent et les biens de la guerre ?',
      },
      {
        kind: 'li',
        text: 'Quels nœuds (sociétés, ports, flottes, banques) permettent de financer la guerre ?',
      },
      {
        kind: 'li',
        text: 'Qui les possède ?',
      },
      {
        kind: 'li',
        text: 'Comment contournent-ils les sanctions ?',
      },
    ],
    notes: [
      {
        id: '6',
        text: 'CELEX 32014R0269, annexe I ; CELEX 32014R0833, art. 2 à 5 ; https://eur-lex.europa.eu.',
      },
      {
        id: '7',
        text: 'Département du Trésor des États-Unis. (2016, 20 décembre). *Treasury Sanctions Individuals and Entities In Connection with Russia’s Occupation of Crimea and the Conflict in Ukraine* (communiqué jl0688). https://home.treasury.gov/news/press-releases/jl0688.',
      },
      {
        id: '8',
        text: 'Calculs de l’auteur d’après Ministère des Finances de Russie (2026a), op. cit., n. 3, ligne 2.2 « Национальная оборона » ; Korsounskaïa, D. (2024). https://ru.themoscowtimes.com ; Banque mondiale (2026). https://api.worldbank.org.',
      },
      {
        id: '9',
        text: 'Calculs de l’auteur d’après Ministère des Finances de Russie (2026a), op. cit., n. 3, ligne 1.1 ; Banque mondiale (2026), op. cit., n. 9.',
      },
    ],
    nodeIds: [],
  },
  {
    source: 'report-fr.md, Méthode',
    slug: 'method-chronology',
    title: 'Méthode',
    blocks: [
      {
        kind: 'p',
        text: 'Une guerre longue se paie deux fois : avec l’argent qui entre, et avec les biens qu’il faut acheter pour produire les armes. Pour suivre ce double flux malgré les sanctions, le rapport ne part pas des agrégats de l’économie russe, mais des points précis par lesquels l’argent et les biens doivent passer.',
      },
      {
        kind: 'h3',
        text: 'Les trois couches',
      },
      {
        kind: 'p',
        text: 'Le rapport découpe donc l’économie russe en nœuds, c’est-à-dire en sites (un port, une usine, un champ gazier), en sociétés, en flottes de navires ou en canaux de paiement (une banque, une plateforme, un jeton numérique). Chaque nœud sert à l’une de trois fonctions, que le rapport appelle des couches :',
      },
      {
        kind: 'li',
        text: '**Payer :** Gagner les devises qui paient la guerre, surtout par la vente de pétrole et de gaz ;',
      },
      {
        kind: 'li',
        text: '**Financer :** Faire circuler cet argent, par des banques et des canaux de paiement ;',
      },
      {
        kind: 'li',
        text: '**Combattre :** Importer les composants et produire les armes.',
      },
      {
        kind: 'p',
        text: 'Ces trois couches suivent le chemin de l’argent (figure 2). Les recettes en devises de la couche payer règlent les importations de la couche combattre, et ce règlement passe par la couche financer. En parallèle, les taxes sur le pétrole et le gaz remplissent le budget, qui commande les armes aux usines russes. Une sanction peut donc viser l’entrée de l’argent, son passage ou sa sortie, et le rapport examine les trois.',
      },
      {
        kind: 'h3',
        text: 'Les nœuds critiques',
      },
      {
        kind: 'p',
        text: 'Un nœud est dit critique quand il réunit trois conditions :',
      },
      {
        kind: 'li',
        text: '**Exposé aux sanctions :** L’Union européenne (UE), l’Office of Foreign Assets Control (OFAC) américain ou le Royaume-Uni le désigne, ou une personne désignée le détient à 50 % ou plus ;',
      },
      {
        kind: 'li',
        text: '**Actif en 2024-2026 :** Une production, un transit ou une désignation nouvelle, datés, le montrent ;',
      },
      {
        kind: 'li',
        text: '**Passe par un pays tiers :** Son siège, le pavillon de ses navires ou une contrepartie se trouve dans un pays qui n’applique pas les sanctions de la coalition (l’UE, les États-Unis, le Royaume-Uni et leurs alliés).',
      },
      {
        kind: 'figure',
        text: 'Figure 2: Les trois couches de l’économie de guerre russe et leurs liens. Schéma de l’auteur.',
        figure: {
          number: 2,
          title: 'Les trois couches de l’économie de guerre russe et leurs liens',
          unit: '',
          period: '',
          sources: 'Schéma de l’auteur.',
        },
      },
      {
        kind: 'p',
        text: 'Ces conditions désignent les nœuds où les sanctions sont en place mais où l’activité continue par un pays tiers : là où le contournement se voit, et là où une nouvelle mesure pourrait porter.',
      },
      {
        kind: 'p',
        text: 'Le choix de la période tient au calendrier des sanctions. En 2024, les grandes mesures sur le pétrole sont en place : l’embargo, le plafond de prix, puis les premières désignations d’armateurs qui ne respectent pas ce plafond.[^11] Les années 2024-2026 montrent donc comment les échanges se sont adaptés à ces sanctions. Après chaque mesure, le rapport cherche les corrélations entre les sanctions et les échanges, puis propose des explications, chacune attribuée à sa source, ou présentée comme une hypothèse quand aucune source ne l’établit.',
      },
      {
        kind: 'figure',
        text: 'Figure 1: Chronologie des principales sanctions, 2014-2026. Données : Règlement (UE) n° 269/2014 ; Règlement (UE) n° 833/2014 ; Règlements (UE) 2022/879, 2022/2367, 2023/250, 2025/395 et 2026/506 ; Règlement d’exécution (UE) 2026/124 ; Département du Trésor des États-Unis (2023) ; Office of Foreign Assets Control (2025).[^10]',
        figure: {
          number: 1,
          title: 'Chronologie des principales sanctions',
          unit: '',
          period: '2014-2026',
          sources:
            'Règlement (UE) n° 269/2014 ; Règlement (UE) n° 833/2014 ; Règlements (UE) 2022/879, 2022/2367, 2023/250, 2025/395 et 2026/506 ; Règlement d’exécution (UE) 2026/124 ; Département du Trésor des États-Unis (2023) ; Office of Foreign Assets Control (2025).[^10]',
        },
      },
      {
        kind: 'h3',
        text: 'Les données et leur contrôle',
      },
      {
        kind: 'p',
        text: 'Les données viennent d’une base de près de 5 200 entités (sociétés, navires, sites, ports, banques, personnes et actes juridiques) et des relations entre elles, comme une désignation, une propriété, la gestion d’un navire, une escale, un flux de pétrole ou un paiement. Ces faits sont tirés des listes officielles de sanctions, des registres de sociétés et d’enquêtes publiées, et chacun renvoie au document archivé qui l’établit. La fiabilité de chaque source officielle suit l’échelle ADMIRALTY qui note l’émetteur par une lettre, de A pour un émetteur officiel (liste de sanctions, registre de sociétés, journal officiel) à F quand rien ne permet de le juger.',
      },
      {
        kind: 'p',
        text: 'Au total, 493 nœuds sont critiques, sachant que les navires d’une même société de gestion forment un seul nœud. La couche payer en compte le plus, parce que les listes de navires désignés sont longues et bien documentées. Pour au moins 416 d’entre eux, les trois conditions reposent sur un document d’un émetteur officiel. L’annexe A décrit la collecte et le contrôle des faits.',
      },
    ],
    notes: [
      {
        id: '10',
        text: 'UE. (2014-2026). *Règlements (UE) 269/2014, 833/2014, 2022/879, 2022/2367, 2022/2368, 2023/250, 2025/395, 2026/124, 2026/506*. eur-lex.europa.eu ; Trésor des États-Unis. (2023). *Communiqué jy1795*. home.treasury.gov ; OFAC. (2025). *Recent Actions 20251022*. ofac.treasury.gov.',
      },
      {
        id: '11',
        text: 'Département du Trésor des États-Unis (2023), op. cit., n. 8.',
      },
    ],
    nodeIds: [],
  },
  {
    source: 'report-fr.md, Payer, sections 2.1 à 2.3',
    slug: 'pay',
    title: 'Payer',
    blocks: [
      {
        kind: 'p',
        text: 'Commençons par l’éléphant dans la pièce, le sujet à la fois le plus discuté et souvent le plus mal compris : le pétrole et le gaz, qui portent l’économie russe. En 2021, leur rente (ce qu’ils rapportent au-delà de leur coût de production) vaut environ un sixième du PIB ;[^12] les combustibles font plus de 40 % des exportations de biens,[^13] et le pétrole et le gaz apportent plus du tiers des recettes du budget fédéral.[^14] Si les sanctions devaient tarir l’argent de la guerre, c’est ici qu’elles devraient porter d’abord.',
      },
      {
        kind: 'h3',
        text: 'Les acheteurs',
      },
      {
        kind: 'p',
        text: 'Dès 2022, l’UE ferme presque son marché au pétrole russe, par un embargo sur le brut transporté par mer, puis sur les produits pétroliers.[^15] Elle réduit aussi ses achats de gaz russe, puis décide en janvier 2026 de les arrêter par étapes.[^16] En revanche, l’Asie prend le relais (figure 3) : la Chine devient le premier client de la Russie, et l’Inde achète vingt fois plus de brut russe en 2025 qu’en 2021.[^17] Deux raisons expliquent ce report :[^18]',
      },
      {
        kind: 'li',
        text: '**Le prix :** Vendu avec une remise, le brut russe reste moins cher pour l’acheteur ;',
      },
      {
        kind: 'li',
        text: '**La politique :** La Chine et l’Inde n’appliquent pas les sanctions, et leurs dirigeants ne veulent pas paraître céder aux États-Unis.',
      },
      {
        kind: 'p',
        text: 'Le gaz prend le même chemin vers l’Asie : en 2025, Gazprom livre pour la première fois plus de gaz par gazoduc à la Chine qu’à l’Europe.[^19]',
      },
      {
        kind: 'p',
        text: 'Mais c’est la Chine qui fixe les conditions. Pour vendre le gaz de la péninsule de Yamal, que l’Europe n’achète plus, la Russie n’a qu’un client possible, et ce client n’est pas pressé de conclure le nouveau gazoduc Force de Sibérie 2 : la Chine ne veut pas trop dépendre d’un seul fournisseur, et elle sait que la Russie n’a pas d’autre acheteur.[^20] Selon l’hypothèse du rapport, le gaz vendu à la Chine remplace donc les volumes perdus en Europe, mais pas leurs recettes.',
      },
      {
        kind: 'figure',
        text: 'Figure 3: Exportations russes par acheteur et brut acheté à la Russie, 2020-2025. Données : Bahí Esteba et al. (2026) ; Eurostat (2026) ; UN Comtrade (2026) ; CREA (2026). Calculs de l’auteur.[^21]',
        figure: {
          number: 3,
          title: 'Exportations russes par acheteur et brut acheté à la Russie',
          unit: 'milliards de dollars US ; millions de tonnes',
          period: '2020-2025',
          sources:
            'Bahí Esteba et al. (2026) ; Eurostat (2026) ; UN Comtrade (2026) ; CREA (2026). Calculs de l’auteur.[^21]',
        },
      },
      {
        kind: 'h3',
        text: 'Le prix et le plafond',
      },
      {
        kind: 'p',
        text: 'Pour mesurer ce que la Russie perd sur chaque baril, on compare son pétrole au Brent, pétrole de la mer du Nord qui sert de prix de référence. L’Oural (Urals), principal brut russe exporté, est plus lourd et plus soufré, donc un peu moins cher : en 2019, avant la guerre, cet écart de prix, appelé décote, restait sous un dollar le baril.[^22]',
      },
      {
        kind: 'p',
        text: 'Depuis décembre 2022, une société de l’UE ou de ses alliés ne peut plus transporter, assurer ou financer un brut russe vendu au-dessus d’un plafond de prix (figure 4).[^23] La coalition choisit un plafond plutôt qu’un embargo complet parce qu’elle poursuit deux buts à la fois : réduire les profits pétroliers qui permettent à la Russie de mener la guerre, et garder les marchés mondiaux de l’énergie stables et bien approvisionnés.[^24]',
      },
      {
        kind: 'figure',
        text: 'Figure 4: Brent, Oural et plafond de prix de l’UE, 2022-2026. Données : Service fédéral des impôts de Russie (2023-2026) ; ministère des Finances de Russie (2023) ; ministère du Développement économique de Russie (2026) ; Banque mondiale (2026) ; règlements de l’UE (2022-2026).[^25]',
        figure: {
          number: 4,
          title: 'Brent, Oural et plafond de prix de l’UE',
          unit: 'dollars par baril',
          period: '2022-2026',
          sources:
            'Service fédéral des impôts de Russie (2023-2026) ; ministère des Finances de Russie (2023) ; ministère du Développement économique de Russie (2026) ; Banque mondiale (2026) ; règlements de l’UE (2022-2026).[^25]',
        },
      },
      {
        kind: 'p',
        text: 'Tant que l’Oural dépasse le plafond, il voyage surtout sur des navires et avec des assureurs hors de la coalition, que le plafond ne lie pas (section 2.5).[^26] Son prix baisse pourtant, bien au-delà de ce qu’explique l’écart de qualité : les sanctions le poussent vers le bas.[^27] L’écart s’élargit encore après octobre 2025, quand l’OFAC désigne [[N-P026|Rosneft]] et [[N-P030|Lukoil]], deux grands groupes pétroliers russes,[^28] et que plusieurs raffineurs indiens cessent d’acheter.[^29] D’août 2023 à octobre 2025, l’Oural vaut chaque mois de 10 à 16 dollars de moins que le Brent ; depuis novembre 2025, il en vaut de 19 à 27 de moins.[^30] Le rapport y voit un effet probable de cette désignation, sans pouvoir le mesurer, car la série ne montre qu’une coïncidence de dates.',
      },
      {
        kind: 'p',
        text: 'Pour les acheteurs restés fidèles, cette baisse est une aubaine. Les raffineurs de l’Inde, de la Chine et de la Turquie continuent d’acheter le brut russe par des intermédiaires, et la pression des sanctions sur son prix améliore leurs marges.[^31] La Chine, en particulier, paie ce brut moins cher que celui de ses autres fournisseurs depuis 2022 : Moscou lui cède ainsi une part de sa rente pétrolière, car il ne peut pas perdre son premier client.[^32]',
      },
      {
        kind: 'h3',
        text: 'Le budget',
      },
      {
        kind: 'p',
        text: 'L’imposition du pétrole en Russie se calcule sur le prix de l’Oural.[^33] Une remise plus forte réduit donc ce que l’État, qui paie la guerre, tire de chaque baril : une remise de 10 % sur les seules ventes à la Chine coûte au Trésor russe environ 3 milliards de dollars par an.[^34]',
      },
      {
        kind: 'p',
        text: 'La part du pétrole et du gaz dans les recettes fédérales baisse (figure 5) pour deux raisons, et la première est un vrai recul de ces recettes. En roubles courants, elles baissent d’environ un quart de 2024 à 2025, surtout à cause d’un prix du pétrole plus bas, puis elles reculent encore de janvier à septembre 2026.[^35] Cette fois pourtant, le prix de l’Oural en roubles monte. La baisse tient alors à un rouble fort et à la hausse de l’« amortisseur » (en russe *dempfer*), un versement de l’État aux pétroliers qui augmente avec les prix mondiaux des carburants.[^36]',
      },
      {
        kind: 'figure',
        text: 'Figure 5: Pétrole, gaz et défense dans le budget fédéral, 2014-2026. Données : ministère des Finances de Russie (2026) ; Korsounskaïa (2024) ; Banque mondiale (2026). Calculs de l’auteur.[^37]',
        figure: {
          number: 5,
          title: 'Pétrole, gaz et défense dans le budget fédéral',
          unit: '% ; billions de roubles de 2021',
          period: '2014-2026',
          sources:
            'ministère des Finances de Russie (2026) ; Korsounskaïa (2024) ; Banque mondiale (2026). Calculs de l’auteur.[^37]',
        },
      },
      {
        kind: 'p',
        text: 'Le reste de l’économie paie aussi davantage, et c’est la seconde raison de cette baisse. L’impôt sur les bénéfices passe de 20 à 25 % en 2025, et la TVA de 20 à 22 % en 2026.[^38] Ce déplacement est voulu : les orientations budgétaires du ministère des Finances pour 2026-2028 présentent la hausse de la TVA comme un moyen de porter à 80 % la part des recettes hors pétrole et gaz.[^39]',
      },
      {
        kind: 'p',
        text: 'Selon l’hypothèse du rapport, une défense de plus en plus chère repose donc de plus en plus sur les autres impôts et sur le déficit. Comme l’argent du budget est fongible, la figure 5 ne dit pas pour autant que le pétrole paie la défense.',
      },
    ],
    notes: [
      {
        id: '12',
        text: 'Calculs de l’auteur d’après Banque mondiale. (2026). *Oil rents (% of GDP) – Russian Federation (NY.GDP.PETR.RT.ZS)*. https://api.worldbank.org ; Banque mondiale. (2026). *Natural gas rents (% of GDP) – Russian Federation (NY.GDP.NGAS.RT.ZS)*. https://api.worldbank.org.',
      },
      {
        id: '13',
        text: 'Banque mondiale. (2026, 8 octobre). *Fuel exports (% of merchandise exports) – Russian Federation (TX.VAL.FUEL.ZS.UN)* [Données]. https://api.worldbank.org.',
      },
      {
        id: '14',
        text: 'Calculs de l’auteur d’après Ministère des Finances de Russie (2026a), op. cit., n. 3, lignes 1 et 1.1, année 2021.',
      },
      {
        id: '15',
        text: 'CELEX 32022R0879, art. 3 m ; https://eur-lex.europa.eu.',
      },
      {
        id: '16',
        text: 'CELEX 32026R0261, considérants 1 et 10 ; https://eur-lex.europa.eu.',
      },
      {
        id: '17',
        text: 'Bahí Esteba et al. (2026), op. cit., n. 1, fig. 2 ; Calculs de l’auteur d’après UN Comtrade (2026), op. cit., n. 5.',
      },
      {
        id: '18',
        text: 'Kpler. (2025, 2 décembre). *Rosneft and Lukoil sanctions are live*. Kpler. https://www.kpler.com.',
      },
      {
        id: '19',
        text: 'Interfax. (2026, 13 janvier). *Gazprom supplies 38.8 bcm of gas to China in 2025, for first time more than towards west – company*. Interfax. https://interfax.com/newsroom/top-stories/115552/.',
      },
      {
        id: '20',
        text: 'Vakulenko, S. (2025, 22 septembre). *Why Can’t Russia and China Agree on the Power of Siberia 2 Gas Pipeline?* Carnegie Politika. Carnegie Endowment for International Peace. https://carnegieendowment.org/russia-eurasia/politika/2025/09/russia-china-gas-deals.',
      },
      {
        id: '21',
        text: 'Bahí Esteba et al. (2026), op. cit., n. 1, fig. 2 ; Eurostat. (2026). *International trade of EU and non-EU countries since 2002 by CN8 (DS-045409)*. https://ec.europa.eu ; UN Comtrade (2026), op. cit., n. 5 ; CREA. (2026). *Russia Fossil Tracker*. https://api.russiafossiltracker.com.',
      },
      {
        id: '22',
        text: 'Yagova, O., & Gorodyankin, G. (2019, 11 octobre). *IMO 2020 regulations challenge Russian Urals crude*. Reuters, repris par Hydrocarbon Processing. https://www.hydrocarbonprocessing.com.',
      },
      {
        id: '23',
        text: 'CELEX 32022R2367, art. 3 n ; https://eur-lex.europa.eu.',
      },
      {
        id: '24',
        text: 'Département du Trésor des États-Unis (2023), op. cit., n. 8.',
      },
      {
        id: '25',
        text: 'Service fédéral des impôts de Russie. (2026). [Données de calcul de l’impôt sur l’extraction]. nalog.gov.ru/rn77/news/activities_fts/16643613 ; Banque mondiale. (2026). *Commodity markets outlook*. worldbank.org/en/research/commodity-markets ; CELEX 32022R2367, 32025R1494, 32026R0124.',
      },
      {
        id: '26',
        text: 'Dodonov et al. (2026), op. cit., n. 2, p. 3.',
      },
      {
        id: '27',
        text: 'Kpler (2025), op. cit., n. 18.',
      },
      {
        id: '28',
        text: 'Office of Foreign Assets Control (2025), op. cit., n. 8.',
      },
      {
        id: '29',
        text: 'Dodonov et al. (2026), op. cit., n. 2, p. 2.',
      },
      {
        id: '30',
        text: 'Calculs de l’auteur d’après Banque mondiale. (2026). *Commodity markets outlook*. worldbank.org/en/research/commodity-markets ; Service fédéral des impôts de Russie. (2026). [Données de calcul de l’impôt sur l’extraction]. nalog.gov.ru/rn77/news/activities_fts/16643613.',
      },
      {
        id: '31',
        text: 'Kpler (2025), op. cit., n. 18.',
      },
      {
        id: '32',
        text: 'Deryugina, T., & Shepotylo, O. (2026, septembre). *China’s Support for Russia* (Policy Brief n° 4). econ4ua. https://econ4ua.org/wp-content/uploads/2026/09/Chinas-Support-for-Russia-Final.pdf, p. 4.',
      },
      {
        id: '33',
        text: 'Service fédéral des impôts de Russie (2026), op. cit., n. 25 ; Ministère russe du Développement économique. (2026, 2 octobre). [Sur le prix moyen du pétrole Oural en septembre 2026]. economy.gov.ru.',
      },
      {
        id: '34',
        text: 'Deryugina et Shepotylo (2026), op. cit., n. 32, p. 4-5.',
      },
      {
        id: '35',
        text: 'Ministère des Finances de Russie (2026a), op. cit., n. 3, ligne 1.1 « Нефтегазовые доходы » ; Ministère des Finances de Russie. (2025, 9 octobre). [Estimation préliminaire de l’exécution du budget fédéral, janvier-septembre 2025]. https://minfin.gov.ru, p. 1.',
      },
      {
        id: '36',
        text: 'Ministère des Finances de Russie (2026b), op. cit., n. 3, p. 1 et tableau ; Nezavissimaïa Gazeta. (2026, 6 octobre). *Выплаты нефтяникам установили очередной рекорд* [Les versements aux pétroliers battent un nouveau record]. https://www.ng.ru/economics/2026-10-06/1_9597_price.html.',
      },
      {
        id: '37',
        text: 'Calculs de l’auteur d’après Ministère des Finances de Russie (2026a), op. cit., n. 3, lignes 1, 1.1 et 2.2 ; Ministère des Finances de Russie (2026b), op. cit., n. 3 ; Korsounskaïa (2024), op. cit., n. 9 ; Banque mondiale (2026), op. cit., n. 9.',
      },
      {
        id: '38',
        text: 'Service fédéral des impôts russe. (2025, 20 janvier). [Le taux de l’impôt sur les bénéfices change en 2025]. https://www.nalog.gov.ru ; Service fédéral des impôts russe. (2025, 17 décembre). [Le taux de TVA augmente en 2026]. https://www.nalog.gov.ru.',
      },
      {
        id: '39',
        text: 'Ministère des Finances de Russie. (2025, 3 octobre). [Orientations de la politique budgétaire, fiscale et douanière pour 2026-2028]. Garant. https://base.garant.ru, p. 21, 30.',
      },
    ],
    nodeIds: ['N-P026', 'N-P030'],
  },
  {
    source: 'report-fr.md, Payer, sections 2.4 à 2.6',
    slug: 'ports-fleet',
    title: 'Exporter par les ports et la flotte',
    blocks: [
      {
        kind: 'h3',
        text: 'Les ports',
      },
      {
        kind: 'p',
        text: 'Le brut russe qui ne part pas par oléoduc quitte la Russie par quelques ports, surtout [[N-P001|Primorsk]] et [[N-P002|Oust-Louga]] sur la Baltique, [[N-P005|Novorossiisk]] sur la mer Noire et [[N-P007|Kozmino]] sur le Pacifique.[^40] Le trafic des trois premiers, toutes marchandises comprises, tient malgré l’embargo : en 2025, il dépasse son niveau de 2021 (figure 6).[^41]',
      },
      {
        kind: 'p',
        text: 'Les sanctions ont fini par viser ces ports eux-mêmes. Depuis février 2025, une société de l’UE ne peut plus traiter avec ceux de la Baltique et de la mer Noire, et depuis avril 2026 avec [[N-P011|Touapsé]] et Mourmansk.[^42] Comme le plafond de prix, ces mesures ne lient que les sociétés de la coalition.',
      },
      {
        kind: 'h3',
        text: 'La flotte',
      },
      {
        kind: 'p',
        text: 'Pour quitter des ports fermés aux sociétés de la coalition, le brut a besoin de navires qui ne dépendent pas d’elles. Ce sont surtout les pétroliers dits de la « flotte fantôme », liés à un pays hors de la coalition et sans assurance occidentale.[^43] Ni le plafond ni l’interdiction des ports ne les touchent. Selon l’hypothèse du rapport, c’est leur montée depuis l’embargo qui explique que le trafic des ports ait tenu jusqu’en 2025.',
      },
      {
        kind: 'figure',
        text: 'Figure 6: Trafic des ports pétroliers russes, 2014-2026. Données : ASOP (2022 ; 2026) ; PortNews (2018 ; 2019 ; 2021) ; NMTP (2017 ; 2020) ; Dodonov et al. (2026).[^44]',
        figure: {
          number: 6,
          title: 'Trafic des ports pétroliers russes',
          period: '2014-2026',
          sources:
            'ASOP (2022 ; 2026) ; PortNews (2018 ; 2019 ; 2021) ; NMTP (2017 ; 2020) ; Dodonov et al. (2026).[^44]',
        },
      },
      {
        kind: 'p',
        text: 'Sur la poupe de ces navires, qui transportent la plus grande partie du brut exporté par mer (figure 7), flottent surtout les pavillons du Panama, de la Barbade, du Gabon ou de la Sierra Leone ; comme ces pavillons de complaisance servent aussi au commerce ordinaire, ils ne signalent pas, à eux seuls, un contournement. Les sociétés qui gèrent ces pétroliers sont plus parlantes, car elles sont souvent établies hors de Russie. [[N-P025|Sovcomflot]], l’armateur d’État russe, a ainsi transféré la gestion de pétroliers à Stream Ship Management, établie aux Émirats arabes unis, que les États-Unis désignent pour ce motif.[^45]',
      },
      {
        kind: 'figure',
        text: 'Figure 7: Pétrole russe exporté par mer, janvier 2026. Données : Dodonov et al. (2026) ; Raghunandan et al. (2026), d’après Kpler.[^48]',
        figure: {
          number: 7,
          title: 'Pétrole russe exporté par mer',
          period: 'janvier 2026',
          sources: 'Dodonov et al. (2026) ; Raghunandan et al. (2026), d’après Kpler.[^48]',
        },
      },
      {
        kind: 'h3',
        text: 'Les sanctions des navires',
      },
      {
        kind: 'p',
        text: 'Les sanctions visent aussi les navires eux-mêmes, par leur numéro de l’Organisation maritime internationale (OMI), qui ne change jamais, alors que leur nom, leur pavillon, leur propriétaire et leur identité AIS (système d’identification automatique) peuvent changer. La désignation n’arrête pourtant pas les escales (figure 8).[^46] En décembre 2025, plus d’un pétrolier désigné sur cinq charge encore du pétrole russe.[^47]',
      },
      {
        kind: 'figure',
        text: 'Figure 8: Escales des pétroliers désignés après leur désignation. Données : Global Fishing Watch (2026) ; Office of Foreign Assets Control (2026) ; FCDO (2026) ; Règlement (UE) n° 833/2014, annexe XLII (2026). Calculs de l’auteur.[^50]',
        figure: {
          number: 8,
          title: 'Escales des pétroliers désignés après leur désignation',
          unit: 'navires',
          sources:
            'Global Fishing Watch (2026) ; Office of Foreign Assets Control (2026) ; FCDO (2026) ; Règlement (UE) n° 833/2014, annexe XLII (2026). Calculs de l’auteur.[^50]',
        },
      },
      {
        kind: 'p',
        text: 'Les trois régimes de sanctions n’avancent pas au même pas. Quand l’UE et les États-Unis désignent le même navire, les États-Unis le font en premier dans près de neuf cas sur dix (figure 9).[^49]',
      },
      {
        kind: 'p',
        text: 'Un navire désigné change aussi souvent de main. Dans un échantillon non aléatoire de 100 navires désignés, le renseignement militaire ukrainien (GUR), partie au conflit, date pour 81 d’entre eux un changement de propriétaire ou de gestionnaire après la désignation.[^51]',
      },
      {
        kind: 'p',
        text: 'Une liste de navires décrit donc un état que le navire a souvent déjà quitté. Selon l’hypothèse du rapport, viser la société qui gère les pétroliers, et le pays où elle est établie, atteindrait la flotte plus sûrement que viser chaque navire.',
      },
      {
        kind: 'figure',
        text: 'Figure 9: Pétroliers désignés par l’UE, le Royaume-Uni et l’OFAC. Données : Office of Foreign Assets Control (2026) ; FCDO (2026) ; Règlement (UE) n° 833/2014, annexe XLII (2026). Calculs de l’auteur.[^52]',
        figure: {
          number: 9,
          title: 'Pétroliers désignés par l’UE, le Royaume-Uni et l’OFAC',
          sources:
            'Office of Foreign Assets Control (2026) ; FCDO (2026) ; Règlement (UE) n° 833/2014, annexe XLII (2026). Calculs de l’auteur.[^52]',
        },
      },
    ],
    notes: [
      {
        id: '40',
        text: 'Département du Trésor des États-Unis (2023), op. cit., n. 8 ; S&P Global Commodity Insights. (2024, 10 janvier). *Russian Kozmino crude exports jump 9.4% in 2023 amid sanctions*. https://www.spglobal.com.',
      },
      {
        id: '41',
        text: 'ASOP (2022 ; 2026 ; 2026). https://www.morport.com, p. 1 ; PortNews (2018 ; 2019 ; 2021). https://portnews.ru ; NMTP (2017). https://en.portnews.ru, p. 7-8 ; NMTP (2020). https://fs.moex.com, p. 1 ; Dodonov et al. (2026), op. cit., n. 2, p. 3.',
      },
      {
        id: '42',
        text: 'CELEX 32025R0395, annexe XIV ; CELEX 32026R0506, annexe XVI ; https://eur-lex.europa.eu.',
      },
      {
        id: '43',
        text: 'Dodonov, B., Hilgenstock, B. et al. (2026, 2 mars). *Russian Oil Tracker*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/03/ROT_FEB26.pdf, p. 3.',
      },
      {
        id: '44',
        text: 'ASOP (2022 ; 2026 ; 2026). https://www.morport.com, p. 1 ; PortNews (2018 ; 2019 ; 2021). https://portnews.ru ; NMTP (2017). https://en.portnews.ru, p. 7-8 ; NMTP (2020). https://fs.moex.com, p. 1 ; Dodonov et al. (2026), op. cit., n. 2, p. 3.',
      },
      {
        id: '45',
        text: 'Département du Trésor des États-Unis. (2025, 10 janvier). *Treasury Intensifies Sanctions Against Russia by Targeting Russia’s Oil Production and Exports* (communiqué jy2777). https://home.treasury.gov/news/press-releases/jy2777, annexe 2.',
      },
      {
        id: '46',
        text: 'Calculs de l’auteur d’après Global Fishing Watch (2026). https://globalfishingwatch.org ; OFAC (2026). https://sanctionslistservice.ofac.treas.gov ; FCDO (2026). https://sanctionslist.fcdo.gov.uk ; CELEX 32014R0833 ; https://eur-lex.europa.eu.',
      },
      {
        id: '47',
        text: 'Dodonov et al. (2026), op. cit., n. 2, p. 2.',
      },
      {
        id: '48',
        text: 'Dodonov et al. (2026), op. cit., n. 2, p. 2-8 ; Raghunandan, V. et al. (2026, 18 février). *January 2026 — Monthly analysis of Russian fossil fuel exports and sanctions*. Centre for Research on Energy and Clean Air. https://energyandcleanair.org.',
      },
      {
        id: '49',
        text: 'Calculs de l’auteur d’après Office of Foreign Assets Control (2026), op. cit., n. 45 ; CELEX 32014R0833 ; https://eur-lex.europa.eu.',
      },
      {
        id: '50',
        text: 'Calculs de l’auteur d’après Global Fishing Watch (2026). https://globalfishingwatch.org ; OFAC (2026). https://sanctionslistservice.ofac.treas.gov ; FCDO (2026). https://sanctionslist.fcdo.gov.uk ; CELEX 32014R0833 ; https://eur-lex.europa.eu.',
      },
      {
        id: '51',
        text: 'Calculs de l’auteur d’après GUR. (2026). *War & Sanctions*. https://war-sanctions.gur.gov.ua ; OFAC (2026), op. cit., n. 45 ; FCDO (2026), op. cit., n. 45 ; CELEX 32014R0833 ; https://eur-lex.europa.eu.',
      },
      {
        id: '52',
        text: 'Calculs de l’auteur d’après Office of Foreign Assets Control (2026), op. cit., n. 45 ; Foreign, Commonwealth & Development Office (2026), op. cit., n. 45 ; CELEX 32014R0833, lue le 30 octobre 2026 ; https://eur-lex.europa.eu.',
      },
    ],
    nodeIds: ['N-P001', 'N-P002', 'N-P005', 'N-P011', 'N-P007', 'N-P025'],
  },
  {
    source: 'report-fr.md, Financer',
    slug: 'finance',
    title: 'Financer : le rouble remplace le dollar et l’euro',
    blocks: [
      {
        kind: 'p',
        text: 'Vendre du pétrole ne suffit pas : encore faut-il être payé, puis payer à son tour les fournisseurs étrangers. Avant la guerre, la plupart de ces paiements passaient par le dollar et l’euro, donc par des banques que la coalition contrôle. La question est alors de savoir par où l’argent circule quand ces banques se ferment.',
      },
      {
        kind: 'h3',
        text: 'Le rouble et le yuan',
      },
      {
        kind: 'p',
        text: 'Dès 2022, les grandes banques russes, dont [[N-M002|VTB]] et [[N-M008|Sberbank]], sont désignées par les États-Unis[^53] et par le Royaume-Uni,[^54] et plusieurs sont retirées de SWIFT, en plus du gel de leurs actifs.[^55] Les entreprises russes passent alors des devises des pays « inamicaux », comme le dollar et l’euro, au rouble et à d’autres devises, comme le yuan (figure 10).[^56]',
      },
      {
        kind: 'figure',
        text: 'Figure 10: Devise de règlement des exportations et des importations russes, 2019-2025. Données : Banque de Russie (2026).[^57]',
        figure: {
          number: 10,
          title: 'Devise de règlement des exportations et des importations russes',
          unit: 'pourcentage du total',
          period: '2019-2025',
          sources: 'Banque de Russie (2026).[^57]',
        },
      },
      {
        kind: 'p',
        text: 'Avec la Chine, la bascule va plus loin. Fin 2023, le yuan règle autant d’exportations que le rouble,[^58] et le rouble et le yuan règlent presque tous les paiements entre les deux pays.[^59] Ce choix protège ce commerce des sanctions, mais il lie la Russie à un partenaire qui pèse environ 40 % de son commerce, alors qu’elle ne pèse que quelques pour cent du commerce chinois.[^60] Selon l’hypothèse du rapport, la Chine peut donc fixer ses conditions.',
      },
      {
        kind: 'h3',
        text: 'Les relais de paiement',
      },
      {
        kind: 'p',
        text: 'Un paiement en yuans reste exposé aux sanctions américaines. Une banque qui règle en yuans a encore besoin du dollar pour le reste de ses affaires, et le décret américain 14114, de décembre 2023, expose aux sanctions toute banque étrangère qui aide la base militaro-industrielle russe ; en juin 2024, ce risque s’étend à toute transaction avec VTB ou Sberbank.[^61] Les banques des pays tiers se retirent donc : la banque chinoise qui servait de principal canal aux importateurs russes rompt avec eux en février 2024,[^62] des banques turques et émiriennes renvoient des virements ou ferment des comptes,[^63] et à l’été 2024 les banques d’État chinoises bloquent les paiements russes « en masse ».[^64] Les paiements passent alors par d’autres relais, que les sanctions suivent ensuite :',
      },
      {
        kind: 'li',
        text: '**Filiales des banques russes (Chine, Inde, [[N-M004|Kazakhstan]], Biélorussie) :** La [[N-M003|succursale de VTB à Shanghai]] devient la voie principale des paiements vers la Chine.[^65] Dès juin 2024, le Trésor américain inclut les implantations de VTB et de Sberbank en Chine et en Inde dans leurs désignations ;[^66] l’UE interdit ensuite les transactions avec VTB Shanghai et avec les filiales de VTB au Kazakhstan et en Biélorussie,[^67] puis, en 2026, avec [[N-M009|Sberbank India]] et [[N-M007|India VTB]].[^68]',
      },
      {
        kind: 'li',
        text: '**Petites banques frontalières chinoises (Heihe, Suifenhe) :** Elles prennent le relais des banques d’État, et l’UE en vise deux en 2025.[^69]',
      },
      {
        kind: 'li',
        text: '**Banques d’Asie centrale et d’Arménie (Kirghizstan, Kazakhstan, Arménie) :** En 2024, les banques arméniennes et kazakhes cessent d’accepter la carte russe Mir, à cause du risque de sanctions secondaires.[^70] Le Kirghizstan concentre ensuite les paiements en roubles sur deux banques d’État,[^71] que l’UE vise en 2026, après deux autres banques kirghizes.[^72]',
      },
      {
        kind: 'li',
        text: '**Agents de paiement (Russie, Chine, Hong Kong, Kazakhstan) :** Établis en Russie et chez le fournisseur, ils reçoivent les roubles de l’importateur et paient à sa place ; leur part dans les paiements transfrontaliers quadruple en quelques mois en 2024.[^73]',
      },
      {
        kind: 'li',
        text: '**SPFS :** L’équivalent russe de SWIFT est ouvert aux banques étrangères, que l’OFAC menace de désigner si elles le rejoignent.[^74]',
      },
      {
        kind: 'p',
        text: 'Le plus connu des agents de paiement, [[N-M037|A7]], confie chaque paiement à un sous-agent d’un pays tiers, comme Hong Kong ou le Kirghizstan, et règle la contrepartie en [[N-M040|A7A5]], un jeton numérique qui vaut un rouble.[^75] Après la désignation d’A7 par l’OFAC en août 2025, le volume quotidien de ce jeton s’effondre.[^76]',
      },
      {
        kind: 'p',
        text: 'Certains États tiers laissent faire. Les Émirats arabes unis accueillent capitaux et sociétés russes sans appliquer les sanctions occidentales, et la guerre contre l’Iran, qui les frappe dès février 2026, ne change pas cette ligne : en août, ils rompent leur commerce avec l’Iran, pas avec la Russie.[^77] Leurs banques limitent certains paiements avec la Russie par crainte des sanctions américaines, mais aucune mesure de l’État émirien contre la Russie n’est connue.',
      },
      {
        kind: 'p',
        text: 'Le rapport fait donc l’hypothèse que chaque vague de désignations ne ferme pas un canal, mais pousse les paiements vers un relais plus petit et plus éloigné du dollar. Le dollar ne disparaît pas, car les sous-agents d’[[N-M037|A7]] paient encore en dollars, en yuans, en dirhams et en euros.[^78] Le levier reste donc la banque qui garde cet accès, et elle peut sortir du canal : en 2026, l’UE retire trois banques tadjikes de sa liste, car elles ont pris des mesures.[^79]',
      },
    ],
    notes: [
      {
        id: '53',
        text: 'Trésor des États-Unis. (2022). communiqué jy0608. https://home.treasury.gov, p. 1 ; Trésor des États-Unis. (2022). communiqué jy0705. https://home.treasury.gov, p. 1.',
      },
      {
        id: '54',
        text: 'Foreign, Commonwealth & Development Office (2026), op. cit., n. 45.',
      },
      {
        id: '55',
        text: 'CELEX 32022R0345, art. 5 nonies ; https://eur-lex.europa.eu.',
      },
      {
        id: '56',
        text: 'Prokopenko, A., & Kolyandr, A. (2024, 2 novembre). *The rise of Russia’s foreign trade middlemen*. Inside the Russian Economy. The Bell. https://en.thebell.io/the-rise-of-russias-foreign-trade-middlemen/.',
      },
      {
        id: '57',
        text: 'Banque de Russie (2026), op. cit., n. 4.',
      },
      {
        id: '58',
        text: 'Banque de Russie. (2024, janvier). *Обзор рисков финансовых рынков* [Revue des risques des marchés financiers] (n° 1). https://www.cbr.ru/collection/collection/file/48852/orfr_2024-01.pdf, p. 6.',
      },
      {
        id: '59',
        text: 'TASS. (2026, 23 octobre). *National currencies account for nearly 100% of Russia-China settlements*. TASS. https://tass.com/economy/2206739.',
      },
      {
        id: '60',
        text: 'Deryugina et Shepotylo (2026), op. cit., n. 32, p. 4.',
      },
      {
        id: '61',
        text: 'Trésor des États-Unis. (2023). communiqué jy2011. https://home.treasury.gov ; Trésor des États-Unis. (2024). communiqué jy2404. https://home.treasury.gov.',
      },
      {
        id: '62',
        text: 'The Moscow Times. (2024, 7 février). *Major Chinese Bank Halts All Settlements With Russia – Vedomosti*. https://www.themoscowtimes.com ; The Bell. (2024, 20 février). *How Russia uses China to get round sanctions*. https://en.thebell.io/how-russia-uses-china-to-get-round-sanctions/.',
      },
      {
        id: '63',
        text: 'Bloomberg. (2024, 17 janvier). *Turkish Banks Tighten Screws on Russia Over Fear of US Sanctions*. https://www.bloomberg.com ; The Moscow Times. (2024, 19 février). *UAE Banks Limit Payments With Russia Over Secondary Sanctions Threat – Vedomosti*. https://www.themoscowtimes.com.',
      },
      {
        id: '64',
        text: 'Reuters. (2024, 30 août). *Russia payment hurdles with China partners intensified in August, sources say*. The Standard (Hong Kong). https://www.thestandard.com.hk.',
      },
      {
        id: '65',
        text: 'Prokopenko et Kolyandr (2024), op. cit., n. 53.',
      },
      {
        id: '66',
        text: 'Département du Trésor des États-Unis (2024), op. cit., n. 58.',
      },
      {
        id: '67',
        text: 'CELEX 32025R0395, annexe XI, p. 383 ; CELEX 32025R2033, p. 115 ; https://eur-lex.europa.eu.',
      },
      {
        id: '68',
        text: 'CELEX 32026R1848, annexe VIII ; https://eur-lex.europa.eu.',
      },
      {
        id: '69',
        text: 'Reuters. (2024, juin). *Russia, China find payments workaround as US sanctions net widens, sources say*. Yahoo News. https://www.yahoo.com/news/russia-china-payments-workaround-us-150733803.html ; CELEX 02014R0833-20250720, annexe XLV, partie A ; https://eur-lex.europa.eu.',
      },
      {
        id: '70',
        text: 'RFE/RL. (2024, 29 mars). *Armenian Banks To Ditch Russian Cards Over U.S. Sanctions*. https://www.rferl.org ; Interfax. (2024, 3 avril). *Most Kazakh banks not servicing Russian Mir cards due to sanctions*. https://interfax.com/newsroom/top-stories/101016/.',
      },
      {
        id: '71',
        text: '24.kg. (2025, avril). *New procedure for Russian ruble transactions to be introduced in Kyrgyzstan*. https://24.kg ; The Times of Central Asia. (2025, août). *Kyrgyz President Denounces “Politicized” Sanctions on Banks*. https://timesca.com.',
      },
      {
        id: '72',
        text: 'CELEX 32025R2033, annexe XIV, p. 116 ; CELEX 32026R0506, annexe XV, partie B, p. 70 ; https://eur-lex.europa.eu.',
      },
      {
        id: '73',
        text: 'Prokopenko et Kolyandr (2024), op. cit., n. 53.',
      },
      {
        id: '74',
        text: 'Banque de Russie. (2026). *Bank of Russia Annual Report for 2025*. https://www.cbr.ru, p. 187 ; OFAC. (2024). *Sanctions Risk for Foreign Financial Institutions that Join Russian Financial Messaging System, System for Transfer of Financial Messages*. https://ofac.treasury.gov.',
      },
      {
        id: '75',
        text: 'Financial Crimes Enforcement Network. (2026, 1er octobre). *FinCEN Alert on the A7 Network* (FIN-2026-Alert007). https://www.fincen.gov/system/files/2026-10/FinCEN-Alert-A7-Network.pdf, p. 2-5.',
      },
      {
        id: '76',
        text: 'Département du Trésor des États-Unis. (2025, 14 août). *Treasury Sanctions Cryptocurrency Exchange and Network Enabling Sanctions Evasion and Cyber Criminals* (communiqué sb0225). https://home.treasury.gov, p. 1 ; Elliptic. (2026, 29 juillet). *The fall of A7A5*. https://www.elliptic.co.',
      },
      {
        id: '77',
        text: 'Bianco, C. (2026). *Little Venice, little Sparta*. European Council on Foreign Relations. https://ecfr.eu ; Institute for Financial Integrity. (2026). *August monthly sanctions and export controls report*. https://finintegrity.org ; The Moscow Times (2024), op. cit., n. 60.',
      },
      {
        id: '78',
        text: 'Financial Crimes Enforcement Network (2026), op. cit., n. 72, p. 5.',
      },
      {
        id: '79',
        text: 'CELEX 32026R0506, considérant 14, p. 2, et annexe XV, p. 70 ; https://eur-lex.europa.eu.',
      },
    ],
    nodeIds: ['N-M002', 'N-M008', 'N-M003', 'N-M004', 'N-M009', 'N-M007', 'N-M037', 'N-M040'],
  },
  {
    source: 'report-fr.md, Combattre',
    slug: 'fight',
    title: 'Combattre : les mêmes biens, d’autres vendeurs',
    blocks: [
      {
        kind: 'p',
        text: 'Aucune armée moderne ne se passe de l’électronique embarquée. Un missile de croisière ou un drone d’attaque russe contient des puces, des capteurs et des moteurs que la Russie ne fabrique pas, ou pas assez. L’argent du pétrole doit donc acheter ces pièces à l’étranger, alors même que la coalition a fermé ses propres marchés. Reste à savoir qui vend désormais ces biens, à quel prix, et par quelles routes ils arrivent jusqu’aux usines d’armement.',
      },
      {
        kind: 'h3',
        text: 'Les fournisseurs',
      },
      {
        kind: 'p',
        text: 'Depuis 2022, la coalition ne vend plus à la Russie ni ses technologies militaires, ni ses technologies à double usage, c’est-à-dire des produits civils, comme les puces, que l’armée russe peut employer.[^80] Les plus utiles à ses armes sont réunis dans une liste commune dite CHP (Common High Priority), comme les circuits intégrés ou les machines-outils à commande numérique.[^81] Le rapport mesure ces ventes par les déclarations des pays vendeurs.',
      },
      {
        kind: 'p',
        text: 'La Chine et Hong Kong prennent la place de la coalition (figure 11), mais avec deux rôles différents. La Chine est surtout un producteur : pour la plupart des technologies à double usage qu’elle vend à la Russie, ses exportations montent sans que ses importations montent, et le réexport ne touche qu’une douzaine de produits de haute technologie.[^82] Viser la Chine touche donc la production.',
      },
      {
        kind: 'p',
        text: 'Hong Kong joue un autre rôle, celui d’une plateforme. Premier importateur mondial de puces, il remplace la coalition pour les processeurs, ce qui peut signaler des puces occidentales réexportées.[^83] Hong Kong n’applique que les sanctions décidées par le Conseil de sécurité de l’ONU, qui ne visent pas la Russie : les sanctions de l’UE et des États-Unis n’y ont aucune force légale. Cette place financière permet aussi de masquer le propriétaire d’une société et d’en créer ou d’en dissoudre vite, ce qui en fait un lieu de passage commode pour les sociétés-écrans.[^84] Viser Hong Kong touche donc le passage et le paiement.',
      },
      {
        kind: 'figure',
        text: 'Figure 11: Exportations de biens CHP vers la Russie, 2021-2025. Données : UN Comtrade (2026) ; Risinger et al. (2026). Calculs de l’auteur.[^85]',
        figure: {
          number: 11,
          title: 'Exportations de biens CHP vers la Russie',
          unit: 'millions de dollars US courants',
          period: '2021-2025',
          sources: 'UN Comtrade (2026) ; Risinger et al. (2026). Calculs de l’auteur.[^85]',
        },
      },
      {
        kind: 'h3',
        text: 'Le prix des biens',
      },
      {
        kind: 'p',
        text: 'Ce changement de fournisseurs a un prix. Dès le printemps 2022, les importations russes deviennent plus chères ; la cause principale n’est ni le transport ni le détour par des pays voisins, mais les marges des fournisseurs restés sur le marché, que le départ des concurrents occidentaux leur permet d’augmenter, en particulier pour les biens stratégiques.[^86] La dépendance envers la Chine accentue cet effet : la prime que la Russie paie à la Chine pour les biens prioritaires augmente avec la part chinoise de ses achats, et pour les machines-outils à commande numérique, sans autre vendeur, la Russie doit accepter le prix chinois.[^87] Les sanctions ne coupent donc pas l’accès à ces biens, mais elles le rendent plus coûteux, et ce coût est le plus fort pour les biens achetés à la Chine.',
      },
      {
        kind: 'h3',
        text: 'Les routes des composants',
      },
      {
        kind: 'p',
        text: 'Les voisins de la Russie peuvent aussi servir de route. L’Arménie, le Kazakhstan et le Kirghizstan, qui forment avec elle une union douanière,[^88] lui vendent beaucoup plus de machines et de matériel électrique depuis 2021.[^89] Pour savoir quels biens finissent dans les armes, des enquêteurs démontent les armes russes tombées en Ukraine et relèvent la marque et la date de chaque composant.[^90] Deux tiers des pièces datées sont fabriquées après l’invasion : les achats continuent malgré les contrôles.[^91] Ils passent par des intermédiaires, comme [[N-F097|Pixel Devices]] à Hong Kong.[^92] Les listes de sanctions nomment ces intermédiaires, rarement le fabricant.[^93]',
      },
      {
        kind: 'p',
        text: 'Les débris d’armes donnent pourtant une image biaisée de l’origine des pièces. Le catalogue public du GUR, partie au conflit, attribue à deux tiers de ses composants une marque dont le siège est aux États-Unis ; l’hypothèse du rapport est qu’il relève d’abord les marques de la coalition, sur lesquelles les sanctions peuvent peser, alors qu’une pièce chinoise sans marque lisible reste plus souvent non attribuée. Surtout, la marque ne dit pas où la pièce est fabriquée. En valeur, de janvier à octobre 2023, 61 % des importations russes de composants critiques des marques trouvées dans les armes viennent de sociétés dont le siège est aux États-Unis, mais 8 % seulement y sont produites, contre 35 % en Chine.[^94] Remonter la chaîne d’une pièce, de l’usine à l’arme, demande donc des données par expédition, que ce rapport n’a pas.',
      },
    ],
    notes: [
      {
        id: '80',
        text: 'CELEX 32014R0833, art. 2 et 4 ; Commission européenne. (2024, février). *List of common high priority items*. https://finance.ec.europa.eu/system/files/2023-09/list-common-high-priority-items_en.pdf ; https://eur-lex.europa.eu.',
      },
      {
        id: '81',
        text: 'Risinger, L. et al. (2026, avril). *Russian CHP Imports Tracker*. KSE Institute. https://sanctions.kse.ua/wp-content/uploads/2026/04/KSE_CHP_tracker_Q1_2026-1.pdf, p. 1, 9.',
      },
      {
        id: '82',
        text: 'Deryugina et Shepotylo (2026), op. cit., n. 32, p. 9.',
      },
      {
        id: '83',
        text: 'Risinger, L., & Hilgenstock, B. (2026, juillet). *Russian CHP Imports Tracker: Q2 2026*. KSE Institute. https://sanctions.kse.ua, p. 3 ; Kot, B. (2023, 17 mai). *Hong Kong’s Technology Lifeline to Russia*. Carnegie Endowment. carnegieendowment.org.',
      },
      {
        id: '84',
        text: 'Gouvernement de Hong Kong. (2019). *LCQ2: Implementation of sanctions imposed by United Nations Security Council*. info.gov.hk/gia/general/201901/23/P2019012300436.htm ; USCC. (2025). *China’s facilitation of sanctions and export control evasion*. uscc.gov/research.',
      },
      {
        id: '85',
        text: 'Calculs de l’auteur d’après UN Comtrade (2026), op. cit., n. 5 ; Risinger et al. (2026), op. cit., n. 78, p. 3.',
      },
      {
        id: '86',
        text: 'Emlinger, C., & Lefebvre, K. (2025, février). *Working Around Sanctions. What Cost to Russia?* (Policy Brief n° 50). CEPII. https://www.cepii.fr, p. 1, 6, 8.',
      },
      {
        id: '87',
        text: 'Risinger et Hilgenstock (2026), op. cit., n. 81, p. 5-6.',
      },
      {
        id: '88',
        text: 'Risinger et al. (2026), op. cit., n. 78, p. 7.',
      },
      {
        id: '89',
        text: 'Calculs de l’auteur d’après UN Comtrade (2026), op. cit., n. 5.',
      },
      {
        id: '90',
        text: 'Byrne, J. et al. (2022, août). *Silicon Lifeline*. Royal United Services Institute. https://static.rusi.org/RUSI-Silicon-Lifeline-final-updated-web_1.pdf, p. 24.',
      },
      {
        id: '91',
        text: 'Calculs de l’auteur d’après Conflict Armament Research, & Hayes, D. (2025). *Tracking the Components of Missiles and UAVs Used by Russia in Ukraine* IISS. https://www.iiss.org ; Byrne et al. (2022), op. cit., n. 87 ; GUR. (2026). *War & Sanctions*. https://war-sanctions.gur.gov.ua.',
      },
      {
        id: '92',
        text: 'Département du Trésor des États-Unis. (2024, 1er mai). *U.S. Continues to Degrade Russia’s Military-Industrial Base and Target Third-Country Support with Nearly 300 New Sanctions* (communiqué jy2318). https://home.treasury.gov/news/press-releases/jy2318, annexe 1.',
      },
      {
        id: '93',
        text: 'Trésor des États-Unis. (2024, 17 octobre). *Communiqué jy2651*. home.treasury.gov/news/press-releases/jy2651 ; Département d’État. (2025, 15 janvier). *Sanctions to disrupt Russia’s military industrial base and sanctions evasion*. state.gov.',
      },
      {
        id: '94',
        text: 'Calculs de l’auteur d’après GUR. (2026, 28 octobre). *Components in the aggressor’s weapon*. War & Sanctions. https://war-sanctions.gur.gov.ua ; Bilousova, O., Hilgenstock, B. et al. (2024, janvier). *Challenges of Export Controls Enforcement*. KSE Institute. https://kse.ua, p. 16.',
      },
    ],
    nodeIds: ['N-F097'],
  },
  {
    source: 'report-fr.md, Qui possède quoi',
    slug: 'ownership',
    title: 'Qui possède quoi, et ce que l’on ne sait pas',
    blocks: [
      {
        kind: 'p',
        text: 'Derrière chaque port, chaque pétrolier et chaque banque se tient un propriétaire, parfois l’État, parfois un proche du pouvoir, parfois personne que l’on puisse nommer. Qui détient ces nœuds, et jusqu’où une sanction les atteint-elle ?',
      },
      {
        kind: 'p',
        text: 'Une sanction ne touche pas seulement les sociétés désignées par leur nom. Aux États-Unis, une société détenue à 50 % ou plus, en cumul, par des personnes désignées est bloquée elle aussi.[^95] L’UE et le Royaume-Uni retiennent une propriété de plus de 50 % et y ajoutent le contrôle.[^96] Savoir qui possède une société dit donc jusqu’où une sanction l’atteint ; le rapport remonte ainsi chaque chaîne de parts jusqu’à l’État, à une personne ou à une société sans propriétaire ultime documenté (figure 12).',
      },
      {
        kind: 'h3',
        text: 'L’État et ses holdings',
      },
      {
        kind: 'p',
        text: 'Au sommet, l’État tient les grandes sociétés par quelques holdings. Une holding publique, qu’il détient en entier, est le premier actionnaire de [[N-P026|Rosneft]] et, avec l’Agence fédérale de gestion des biens de l’État ([[N-O003|Rosimouchtchestvo]]), lui donne près de la moitié de [[N-O005|Gazprom]].[^97] Gazprom possède à son tour presque toute [[N-O010|Gazprom Neft]][^98] et, avec une de ses filiales, près de la moitié de [[N-M001|Gazprombank]].[^99] De même, l’État a tous les droits de vote de [[N-P034|Transneft]], qui possède la holding du port de Novorossiisk.[^100] Une désignation de l’une d’elles atteint donc ses filiales à 50 % ou plus.',
      },
      {
        kind: 'figure',
        text: 'Figure 12: Qui possède le pétrole, le gaz et la flotte. Données : Office of Foreign Assets Control (2026) ; Règlement (UE) n° 269/2014 (2026) ; FCDO (2026) ; Rosneft (2021) ; Gazprom (2024) ; Gazprombank (2022) ; TASS (2024). Calculs de l’auteur.[^101]',
        figure: {
          number: 12,
          title: 'Qui possède le pétrole, le gaz et la flotte',
          sources:
            'Office of Foreign Assets Control (2026) ; Règlement (UE) n° 269/2014 (2026) ; FCDO (2026) ; Rosneft (2021) ; Gazprom (2024) ; Gazprombank (2022) ; TASS (2024). Calculs de l’auteur.[^101]',
        },
      },
      {
        kind: 'h3',
        text: 'La flotte',
      },
      {
        kind: 'p',
        text: 'La flotte d’État suit le même schéma, puis s’en échappe. [[N-P025|Sovcomflot]], l’armateur d’État, fait gérer ses pétroliers par [[N-O015|SUN Ship Management]], que l’OFAC désigne en 2023,[^102] puis par [[N-O016|SKF Arktika]], qui gère [[N-P052|South Fleet]] et [[N-P053|Invest Fleet]].[^103] En revanche, la gestion de pétroliers du groupe passe ensuite à [[N-O017|Stream Ship Management]] (section 2.5)[^104] et à [[N-O019|Citrine Marine]], que l’UE désigne pour cette reprise de gestion.[^105] Aucune source ne nomme le propriétaire ultime de ces deux sociétés : la chaîne part de l’État et s’arrête sur un propriétaire inconnu.',
      },
      {
        kind: 'h3',
        text: 'Les proches du président',
      },
      {
        kind: 'p',
        text: 'Après 2000, garder une grande entreprise suppose de rester hors de la politique. En juillet 2000, Vladimir Poutine reçoit au Kremlin une vingtaine des grands patrons des années 1990 et leur laisse leurs actifs à cette condition.[^106] Mikhaïl Khodorkovski, qui avait accusé en public des responsables de corruption, est arrêté en octobre 2003. En décembre 2004, la principale filiale de production de son groupe pétrolier, Ioukos, est vendue aux enchères à une société inconnue, que Rosneft rachète quatre jours plus tard.[^107] Gracié en 2013, Khodorkovski vit aujourd’hui à Londres, et trois tribunaux arbitraux jugent en 2014 que la Russie a pris des mesures d’effet équivalent à une expropriation.[^108]',
      },
      {
        kind: 'p',
        text: 'La loyauté, elle, ouvre les contrats publics. Evgueni Prigojine sort de prison, ouvre des stands de hot-dogs à Saint-Pétersbourg, puis un restaurant où le président, une fois élu, reçoit ses hôtes étrangers ; sa société Concord obtient ensuite les contrats de restauration du Kremlin.[^109] Il finance l’Internet Research Agency, que le Trésor américain désigne en 2018, et reconnaît en 2022 avoir fondé le groupe Wagner en 2014.[^110] Il meurt dans l’écrasement de son avion le 23 août 2023, deux mois jour pour jour après sa mutinerie.[^111] Les deux trajectoires suivent une même règle : le président n’a pas supprimé l’oligarchie, il a visé les seuls oligarques qui menaçaient son pouvoir.[^112]',
      },
      {
        kind: 'p',
        text: 'Hors de l’État, les grands actionnaires privés forment un cercle que les textes de désignation relient au président. [[N-O023|Guennadi Timtchenko]], vieille connaissance de [[N-O024|Vladimir Poutine]], partage avec [[N-O032|Leonid Mikhelson]] la majorité d’un grand groupe pétrochimique et est actionnaire de [[N-O029|Bank Rossiya]].[^113] Mikhelson détient en direct environ 14 % de [[N-O027|Novatek]].[^114] [[N-O030|Iouri Kovaltchouk]], autre proche du président, détenait plus d’un tiers de Bank Rossiya en 2013 et contrôle l’assureur [[N-O031|SOGAZ]].[^115] Le cercle touche la famille : [[N-O033|Kirill Chamalov]] a épousé en 2013 [[N-O034|Katerina Tikhonova]], fille du président, puis a racheté à Timtchenko 17 % du même groupe pétrochimique.[^116]',
      },
      {
        kind: 'p',
        text: 'Les sociétés d’État sont dirigées par des proches qui ne les possèdent pas. [[N-O037|Igor Setchine]] ([[N-P026|Rosneft]]) est un ami personnel du président et [[N-O038|Nikolaï Tokarev]] ([[N-P034|Transneft]]) a servi avec lui au KGB ;[^117] [[N-O039|Sergueï Tchemezov]] ([[N-O021|Rostec]]) l’a connu en Allemagne de l’Est.[^118] Ces amis et anciens collègues ont reçu de grands actifs publics à gérer, ce qui en a fait des « oligarques d’État ».[^119]',
      },
      {
        kind: 'p',
        text: 'Les banques d’État suivent la même règle. Le président de VEB.RF est nommé par le chef de l’État et reçoit ses instructions directement de lui, celui de VTB a été nommé par lui, et un vice-président de VTB est le fils du directeur du FSB. Depuis 2023, VTB gère aussi en fiducie la United Shipbuilding Corporation, par décret présidentiel.[^120] Promsvyazbank, nationalisée en 2018, est dirigée par le fils d’un ancien directeur du renseignement extérieur.[^121] La chaîne des parts s’arrête à l’État, mais la chaîne de direction mène au même cercle, et la règle des 50 % suit les parts, pas ces nominations.',
      },
      {
        kind: 'h3',
        text: 'Les propriétaires inconnus',
      },
      {
        kind: 'p',
        text: 'Chez les intermédiaires et dans la flotte privée, la chaîne s’arrête sur un propriétaire inconnu :',
      },
      {
        kind: 'li',
        text: '**Négoce du pétrole :** Des négociants peu connus, à la propriété opaque, transportent depuis le plafond de prix jusqu’à la moitié des exportations de pétrole russe.[^122] Le Conseil de l’UE rattache ainsi la société [[N-O049|Nord Axis]] au [[N-O044|groupe 2Rivers]] ; le propriétaire ultime de Nord Axis reste non documenté.[^123]',
      },
      {
        kind: 'li',
        text: '**Navires :** Une quinzaine d’armateurs ou de gestionnaires possèdent ou exploitent chacun au moins six navires sanctionnés, sans propriétaire ultime documenté.',
      },
      {
        kind: 'li',
        text: '**[[N-O042|Surgutneftegaz]] :** Le troisième pétrolier du pays, dirigé par [[N-O041|Vladimir Bogdanov]], proche du président, n’a jamais publié sa structure de propriété entière.[^124]',
      },
      {
        kind: 'p',
        text: 'Le rapport fait l’hypothèse que cette opacité protège ces sociétés : la règle des 50 % s’applique en droit, mais personne ne peut l’appliquer sans connaître la chaîne des parts.[^125] Il reste alors à désigner chaque société pour son activité et à rattacher chaque nouveau gestionnaire au groupe qu’il remplace, comme le Conseil l’a fait pour Citrine Marine et Nord Axis.',
      },
    ],
    notes: [
      {
        id: '95',
        text: 'Office of Foreign Assets Control. (2014, 13 août). *Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked*. https://ofac.treasury.gov ; Office of Foreign Assets Control. (s. d.). *FAQ 401*. https://ofac.treasury.gov/faqs/401.',
      },
      {
        id: '96',
        text: 'Conseil de l’UE (2022). https://data.consilium.europa.eu, p. 23-24, points 62 à 64 ; HM Treasury, Office of Financial Sanctions Implementation. (s. d.). *UK financial sanctions general guidance*, section 4. https://www.gov.uk.',
      },
      {
        id: '97',
        text: 'Rosneft. (2021). *Shareholder structure*. rosneft.com, p. 1 ; Gazprom. (2024). *Equity capital structure*. gazprom.com, p. 1.',
      },
      {
        id: '98',
        text: 'TASS. (2024). *Gazprom Neft to pay out record 2023 dividends*. tass.com, p. 1.',
      },
      {
        id: '99',
        text: 'Gazprombank. (2022). [Actionnaires de Gazprombank]. gazprombank.ru, p. 1.',
      },
      {
        id: '100',
        text: 'Transneft. (2022, 13 janvier). *Company* [Version archivée]. https://web.archive.org, p. 1 ; Vedomosti. (2018, 9 octobre). *«Транснефть» консолидировала 62% акций НМТП* [Transneft consolide 62 % des actions de NMTP]. https://www.vedomosti.ru, p. 1.',
      },
      {
        id: '101',
        text: 'Rosneft (2021) et Gazprom (2024), op. cit., n. 95 ; Gazprombank (2022), op. cit., n. 97 ; TASS (2024), op. cit., n. 96.',
      },
      {
        id: '102',
        text: 'Département du Trésor des États-Unis. (2023, 20 décembre). *Treasury Tightens the Price Cap with New Sanctions and Updated Guidance* (communiqué jy2008). https://home.treasury.gov/news/press-releases/jy2008, p. 1.',
      },
      {
        id: '103',
        text: 'CELEX 32025R0389, annexe, entrées 530 à 532, p. 44-45 ; https://eur-lex.europa.eu.',
      },
      {
        id: '104',
        text: 'Département du Trésor des États-Unis (2025), op. cit., n. 44, annexe 2.',
      },
      {
        id: '105',
        text: 'CELEX 02014R0269-20260928, annexe I, entrée 685 « Citrine Marine SPC » ; https://eur-lex.europa.eu.',
      },
      {
        id: '106',
        text: 'BBC News. (2005, 31 mai). *Timeline: The rise and fall of Yukos*. http://news.bbc.co.uk/2/hi/business/4041551.stm ; NPR Planet Money. (2022, 29 mars). *How Putin conquered Russia’s oligarchy*. KPBS Public Media. https://www.kpbs.org.',
      },
      {
        id: '107',
        text: 'BBC News. (2004, 23 décembre). *Putin backs state grab for Yukos*. http://news.bbc.co.uk/2/hi/business/4120339.stm ; BBC News (2005), op. cit., n. 103.',
      },
      {
        id: '108',
        text: 'Reuters (2025). https://www.reuters.com ; Cour permanente d’arbitrage (2014). https://pca-cpa.org.',
      },
      {
        id: '109',
        text: 'Shevchenko, V. (2023, 25 juin). *Yevgeny Prigozhin*. BBC News. https://www.bbc.com/news/world-europe-64976080.',
      },
      {
        id: '110',
        text: 'Trésor des États-Unis. (2018). communiqué sm0312. https://home.treasury.gov ; Reuters. (2022). *Russia’s Prigozhin admits link to Wagner mercenaries for first time*. https://www.reuters.com.',
      },
      {
        id: '111',
        text: 'Reuters. (2023, 24 août). *Wagner boss Yevgeny Prigozhin listed in Russian plane crash with no survivors*. https://www.reuters.com/world/europe/ten-killed-private-jet-crash-north-moscow-tass-2023-08-23/.',
      },
      {
        id: '112',
        text: 'BBC News. (2005, 31 mai). *Timeline: The rise and fall of Yukos*. http://news.bbc.co.uk/2/hi/business/4041551.stm ; NPR Planet Money. (2022, 29 mars). *How Putin conquered Russia’s oligarchy*. KPBS Public Media. https://www.kpbs.org.',
      },
      {
        id: '113',
        text: 'CELEX 02014R0269-20260928, annexe I, entrée 694 « Gennady Nikolayevich TIMCHENKO » ; https://eur-lex.europa.eu.',
      },
      {
        id: '114',
        text: 'Foreign, Commonwealth & Development Office (2026), op. cit., n. 45, entrée RUS1126 ; Interfax. (2022, 21 mars). *Mikhelson transfers around 14% stake in Novatek to direct ownership, eliminates Cyprus ‘layer’*. https://interfax.com/newsroom/top-stories/77137/, p. 1.',
      },
      {
        id: '115',
        text: 'CELEX 02014R0269-20260928, annexe I, entrées 94 « Yuriy Valentinovich KOVALCHUK » et 1381 « Stepan Kirillovich KOVALCHUK » ; https://eur-lex.europa.eu.',
      },
      {
        id: '116',
        text: 'Département du Trésor des États-Unis. (2018, 6 avril). *Treasury Designates Russian Oligarchs, Officials, and Entities in Response to Worldwide Malign Activity* (communiqué sm0338). https://home.treasury.gov/news/press-releases/sm0338, p. 1.',
      },
      {
        id: '117',
        text: 'CELEX 02014R0269-20260928, annexe I, entrées 671 « Igor Ivanovich SECHIN » et 672 « Nikolay Petrovich TOKAREV » ; https://eur-lex.europa.eu.',
      },
      {
        id: '118',
        text: 'Trésor des États-Unis. (2014, 28 avril). *Communiqué jl2369*. home.treasury.gov/news/press-releases/jl2369, p. 1.',
      },
      {
        id: '119',
        text: 'Stanovaya, T. (2020, 11 février). *Unconsolidated: The five Russian elites shaping Putin’s transition*. Carnegie Endowment for International Peace. https://carnegieendowment.org.',
      },
      {
        id: '120',
        text: 'CELEX 02014R0269-20260928, annexe I ; https://eur-lex.europa.eu.',
      },
      {
        id: '121',
        text: 'Département du Trésor des États-Unis. (2022, 22 février). *U.S. Treasury imposes immediate economic costs in response to actions in the Donetsk and Luhansk regions* (communiqué jy0602). https://home.treasury.gov/news/press-releases/jy0602.',
      },
      {
        id: '122',
        text: 'Département du Trésor des États-Unis (2023), op. cit., n. 99, p. 1, section « Under-the-radar traders of Russian oil ».',
      },
      {
        id: '123',
        text: 'CELEX 32025R1476, annexe, entrées 625 « 2Rivers DMCC » et 626 « 2Rivers PTE Ltd », p. 25 ; FCDO (2026), op. cit., n. 45, entrée RUS2541 ; https://eur-lex.europa.eu.',
      },
      {
        id: '124',
        text: 'CELEX 02014R0269-20260928, annexe I, entrée « Vladimir Leonidovich BOGDANOV » ; The Moscow Times. (2013, 30 avril). *Surgut Discloses $29Bln Cash Hoard*. https://www.themoscowtimes.com/2013/04/30/surgut-discloses-29bln-cash-hoard-a23733 ; https://eur-lex.europa.eu.',
      },
      {
        id: '125',
        text: 'Office of Foreign Assets Control (2014), op. cit., n. 92 ; Office of Foreign Assets Control (s. d.), op. cit., n. 92.',
      },
    ],
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
  },
  {
    source: 'report-fr.md, Limites',
    slug: 'limits',
    title: 'Limites',
    blocks: [
      {
        kind: 'p',
        text: 'Un rapport fondé sur des sources ouvertes voit ce que ces sources publient, et pas davantage. Avant de tirer des conclusions, il faut donc dire ce que les faits réunis ici ne permettent pas d’établir.',
      },
      {
        kind: 'h3',
        text: 'Les limites des preuves',
      },
      {
        kind: 'p',
        text: 'Le rapport ne mesure pas l’effet des sanctions : quand aucune source n’établit un lien de cause, ce lien reste une hypothèse. Quatre limites pèsent en outre sur les faits eux-mêmes :',
      },
      {
        kind: 'li',
        text: '**La couverture de la base :** Elle couvre bien le transport maritime, mais mal les banques et l’armement. Elle relie peu de sociétés à un paiement ou à un composant, et elle ne donne de montant pour presque aucune d’elles ; la partie sur les paiements repose donc sur moins de faits que celle sur la flotte.',
      },
      {
        kind: 'li',
        text: '**La fiabilité des sources :** Seules les sources officielles reçoivent une note de fiabilité. Les rapports d’instituts et la presse ne sont pas notés : le poids des faits qui en viennent n’est donc pas mesuré.',
      },
      {
        kind: 'li',
        text: '**Les données miroirs :** Comme la Russie ne publie plus ses échanges par produit, le rapport lit les déclarations de ses partenaires, qui donnent donc un minimum. Les Émirats arabes unis et le Viêt Nam ne déclarent aucun bien prioritaire pour l’armement en 2024-2025, et le Kazakhstan et la Thaïlande n’en déclarent qu’une partie.[^126]',
      },
      {
        kind: 'li',
        text: '**La flotte :** Les changements de propriétaire et de gestionnaire viennent du GUR, partie au conflit. Il donne le titulaire actuel d’un navire et la date de son entrée en fonction, mais rarement le premier changement après la désignation.[^127] La perte de l’identité AIS liée au numéro OMI, que le registre de Global Fishing Watch laisse voir, reste une piste, car ce registre n’est pas archivé.',
      },
      {
        kind: 'p',
        text: 'Enfin, aucun fait n’a été relu par une personne : les contrôles sont faits par des règles et par des agents (annexe A). En conséquence, chaque fait doit être vérifié à sa source avant de servir à une désignation.',
      },
      {
        kind: 'h3',
        text: 'Les pistes de recherche',
      },
      {
        kind: 'p',
        text: 'Ces limites donnent des directions de recherche :',
      },
      {
        kind: 'li',
        text: '**Mesurer l’effet des sanctions :** Comparer les séries mensuelles de prix et de volumes exportés aux dates de désignation, pour tester si une désignation fait vraiment monter la décote du brut russe.',
      },
      {
        kind: 'li',
        text: '**Documenter les paiements et les composants :** Relier les sociétés de la base aux paiements et aux composants, avec des montants, à partir des alertes du Financial Crimes Enforcement Network (FinCEN), des communiqués du Trésor américain et des études qui démontent les armes russes, pour savoir quel volume passe par les banques kirghizes et les sous-agents d’[[N-M037|A7]].',
      },
      {
        kind: 'li',
        text: '**Compléter les données miroirs :** Chercher des données douanières qui couvrent les Émirats arabes unis, le Viêt Nam, le Kazakhstan et la Thaïlande, pour savoir quelle part des biens prioritaires pour l’armement passe par ces pays.',
      },
      {
        kind: 'li',
        text: '**Dater les changements de la flotte :** Archiver l’historique des identités AIS et le comparer aux registres des pavillons, pour savoir combien de temps un navire désigné met à changer d’identité.',
      },
    ],
    notes: [
      {
        id: '126',
        text: 'UN Comtrade (2026), op. cit., n. 5 ; Risinger et al. (2026), op. cit., n. 78, p. 3.',
      },
      {
        id: '127',
        text: 'Direction principale du renseignement du ministère de la Défense de l’Ukraine (GUR) (2026), op. cit., n. 49 ; Global Fishing Watch (2026), op. cit., n. 45.',
      },
    ],
    nodeIds: ['N-M037'],
  },
  {
    source: 'report-fr.md, Conclusion',
    slug: 'conclusion',
    title: 'Conclusion',
    blocks: [
      {
        kind: 'p',
        text: 'Les sanctions pèsent sur l’économie russe, mais elles ne l’arrêtent pas. Les recettes que l’État tire du pétrole et du gaz reculent, tandis qu’il relève ses autres impôts pour payer une défense toujours plus chère. La décote du brut russe s’élargit après les sanctions américaines de 2025, et les biens que la Russie doit importer coûtent plus cher. La guerre coûte donc plus cher à mener, mais elle reste finançable.',
      },
      {
        kind: 'p',
        text: 'La Russie s’adapte de deux façons. D’une part, elle s’appuie sur un marché parallèle en marge des sanctions occidentales : des pétroliers hors de la coalition, des gestionnaires établis dans des pays tiers, des agents de paiement et des sociétés-écrans créées et dissoutes vite. D’autre part, et de façon légale, elle se tourne vers des partenaires qui n’appliquent pas les sanctions. La Chine et l’Inde achètent son pétrole, et la Chine lui vend la plupart des biens prioritaires pour l’armement. Ces partenaires ne rendent pas ce service sans contrepartie : la Russie a peu d’autres choix, et ils paient son pétrole moins cher et lui vendent leurs biens plus cher. Une partie du coût des sanctions pour la Russie devient ainsi, selon l’hypothèse du rapport, un gain pour ses nouveaux partenaires.',
      },
      {
        kind: 'p',
        text: 'Les sanctions de l’UE suivent ce déplacement pas à pas. On remonte la chaîne : le produit, puis le moyen, puis la source. L’UE a d’abord visé le pétrole, par l’embargo et le plafond de prix, puis les navires qui le transportent, puis les ports d’où il part. Chaque étape répond au contournement de la précédente et arrive avec du retard ; le rapport suppose que le marché parallèle se reforme plus vite que les listes ne s’allongent.',
      },
      {
        kind: 'p',
        text: 'Ces deux voies appellent deux réponses. Contre le marché parallèle, désigner les sociétés une à une laisse le temps d’en créer d’autres ; viser en une fois tout un réseau, du propriétaire à l’agent de paiement, et aligner les listes de la coalition réduirait ce délai. Contre les nouveaux partenaires, en revanche, seule la menace de sanctions secondaires semble peser, car elle touche l’accès de leurs banques et de leurs entreprises au dollar.',
      },
    ],
    notes: [],
    nodeIds: ['N-P026', 'N-P030', 'N-M037', 'N-F097'],
  },
  {
    source: 'report-fr.md, Annexe A. Méthode de recherche',
    slug: 'annex-method',
    title: 'Annexe A. Méthode de recherche',
    blocks: [
      {
        kind: 'h3',
        text: 'A.1 La base de données',
      },
      {
        kind: 'p',
        text: 'Le rapport repose sur une base de données d’entités (sociétés, navires, sites, ports, banques, personnes, actes juridiques) et des relations entre elles, comme une désignation, une propriété, la gestion d’un navire, une escale, un flux de pétrole ou un règlement bancaire. Chaque fait de la base renvoie à un document archivé (page web, acte officiel, fichier de données, réponse d’un registre), avec la page et l’extrait qui l’établissent. Au 27 octobre 2026, la base compte 6 327 entités ; comme la sélection n’utilise pas les 1 165 unités militaires, près de 5 200 entités sont testées.',
      },
      {
        kind: 'p',
        text: 'Ces documents viennent des listes officielles de sanctions (OFAC, Royaume-Uni, actes de l’UE), de registres de sociétés, de statistiques publiques (UN Comtrade, Eurostat, Banque mondiale, Banque de Russie, ministère russe des Finances), d’instituts de recherche (KSE, CREA, Bruegel) et de la presse d’enquête.',
      },
      {
        kind: 'h3',
        text: 'A.2 Les règles de source',
      },
      {
        kind: 'li',
        text: 'Une désignation se cite depuis la ligne officielle de la liste de l’OFAC, de la liste britannique ou de l’acte de l’UE.',
      },
      {
        kind: 'li',
        text: 'Le portail du renseignement militaire ukrainien (GUR) se cite fiche par fiche, et ses affirmations restent attribuées au GUR, partie au conflit.',
      },
      {
        kind: 'li',
        text: 'Comme la Russie ne publie plus ses échanges par produit depuis 2022, ceux-ci se lisent dans les déclarations de ses partenaires (données miroirs).',
      },
      {
        kind: 'li',
        text: 'Aucune donnée issue d’une fuite n’est citée, mais un article de presse sur une fuite peut l’être.',
      },
      {
        kind: 'li',
        text: 'Une source connue mais non archivée reste une piste et ne compte pas comme un fait ; de même, une valeur sans source reste non documentée.',
      },
      {
        kind: 'li',
        text: 'La fiabilité de l’émetteur de chaque source suit l’échelle ADMIRALTY, de A (émetteur officiel) à F (impossible à juger).',
      },
      {
        kind: 'h3',
        text: 'A.3 La sélection des nœuds critiques',
      },
      {
        kind: 'p',
        text: 'Les trois conditions de la partie Méthode s’appliquent de la même façon à toutes les entités de la base :',
      },
      {
        kind: 'li',
        text: '**Exposé aux sanctions :** Une relation de désignation vers une liste de l’UE, de l’OFAC ou du Royaume-Uni, ou une détention à 50 % ou plus par une entité désignée ;',
      },
      {
        kind: 'li',
        text: '**Actif en 2024-2026 :** Une relation datée de cette période (désignation, escale, transbordement, événement) ;',
      },
      {
        kind: 'li',
        text: '**Passe par un pays tiers :** Le pays d’enregistrement de l’entité, le pavillon d’un de ses navires ou une contrepartie directe est un pays qui n’applique pas les sanctions de la coalition. Un pays lu seulement dans le nom d’une société ne compte pas tant qu’aucun document archivé n’en donne l’adresse.',
      },
      {
        kind: 'p',
        text: 'Les navires d’une même société de gestion, ou à défaut d’un même propriétaire, forment un seul nœud. Un même acte de désignation peut remplir plus d’une condition ; quand aucune activité n’est observée, une désignation nouvelle tient lieu de preuve d’activité.',
      },
      {
        kind: 'h3',
        text: 'A.4 Le contrôle des faits et du texte',
      },
      {
        kind: 'p',
        text: 'Aucun fait n’a été relu par une personne : c’est un choix de méthode. Des agents d’IA collectent et archivent les sources, puis proposent chaque fait avec l’extrait de sa source. D’autres agents, à contexte neuf et qui n’ont pas proposé ce fait, contrôlent que l’extrait figure dans la source archivée et soutient le fait, avant de le valider. D’autres faits attendent encore un contrôle ou une meilleure source. Les quelques faits saisis à la main portent une étiquette qui les distingue des faits produits par les agents. Les comptes, les parts et les médianes sont des calculs de l’auteur, qu’aucun agent de relecture ne valide un à un. Chaque partie du texte a été relue par des agents distincts de son rédacteur, qui ont vérifié ses sources une à une, et l’auteur a relu le texte, pas chaque fait contre sa source.',
      },
    ],
    notes: [],
    nodeIds: [],
  },
];
