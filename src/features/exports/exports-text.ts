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

/** The French text of the exports part. */
export const EXPORTS_TEXT: ExportsText = {
  title: 'Les exportations russes',
  blocks: [
    {
      id: 'recettes',
      kind: 'section',
      title: 'Ce que paient les exportations',
      paragraphs: [
        [
          'Les recettes pétrolières et gazières du budget fédéral russe, qui comprennent notamment l’impôt sur l’extraction, l’impôt sur le revenu additionnel des hydrocarbures et les droits à l’exportation, valent 9 057 milliards de roubles en 2021, 11 586 en 2022, 8 822 en 2023, 11 131 en 2024 et 8 477 en 2025 (ministère des Finances de Russie, 2026). Leur part dans les recettes fédérales est de 41,6 % en 2022, de 30,3 % en 2023 et en 2024, puis de 22,7 % en 2025. De janvier à septembre 2026, elle tombe à 18,5 %, contre 24,5 % sur la même période de 2025, avec 5 471 milliards de roubles contre 6 609, soit une baisse de 17,2 % (évaluation préliminaire du ministère des Finances de Russie, 2026).',
        ],
        [
          'Le montant de ces recettes dépend du cours de l’Urals et du taux de change : le coefficient qui fixe le taux de l’impôt sur l’extraction du pétrole se calcule à partir du prix moyen de l’Urals et du cours du rouble (Code des impôts de la Fédération de Russie, art. 342). Un amortisseur réduit l’impôt lorsque le prix à l’exportation des carburants dépasse leur prix sur le marché intérieur (Code des impôts, art. 200, al. 27). Les droits à l’exportation ne rapportent que 458 milliards de roubles en 2025 (ministère des Finances de Russie, 2026). Le prix de l’Urals retenu pour l’impôt vaut 92,08 dollars le baril en septembre 2026 (ministère du Développement économique de Russie, 2026), et les sources consultées ne donnent pas la cause du recul des recettes cumulées de janvier à septembre.',
        ],
        [
          'La part du rouble dans les recettes d’exportation de biens et de services passe de 14,34 % en 2021 à 41,55 % en 2024 (Banque de Russie, structure par devise des recettes d’exportation). Aucune source consultée ne donne une valeur russe en dollars du pétrole brut, des produits pétroliers, du gaz et du GNL pour 2022-2024 : la Banque de Russie ne publie cette valeur que jusqu’au quatrième trimestre 2021 (Banque de Russie, 2023-2025), et les statistiques miroir de UN Comtrade reposent sur un nombre de pays déclarants du brut qui tombe de 38 en 2022 à 14 en 2024. Le registre qui suit repose donc sur le traceur de CREA.',
        ],
      ],
      attach: 'budget',
    },
    {
      id: 'registre',
      kind: 'section',
      title: 'Le registre des revenus par statut juridique',
      paragraphs: [
        [
          'Le registre range chaque recette d’exportation d’hydrocarbures, définie par un flux, une destination et un mois, dans une seule classe juridique. Il couvre le brut par voie maritime, le brut par oléoduc, les produits pétroliers par voie maritime, le gaz par gazoduc, le GNL et le charbon, pour l’année 2025 et le premier semestre 2026, soit 298,9 milliards d’euros (calculs de l’auteur d’après CREA, 2026). Les classes vont de A1, où aucune mesure ne vise le flux, à E, où les sources ne permettent pas de décider ; B regroupe les flux qui respectent une mesure, C ceux qui passent par un maillon désigné et D les contournements documentés. Les règles sont écrites avant le classement et rattachées au ',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'règlement (UE) n° 833/2014' },
          '.',
        ],
        [
          'En 2025, 82,6 % des recettes ne franchissent aucune mesure ou en respectent une, soit 38,0 % en A1, 19,6 % en A2 et 25,0 % en B ; au premier semestre 2026, cette part est de 47,9 %. Sur l’ensemble des deux périodes, 70,3 % des recettes sont dans ces trois classes, la classe C pèse 16,0 % des recettes, la classe E 13,7 % et la classe D 0 % (calculs de l’auteur d’après CREA, 2026). Dans le scénario de base, la classe E reste sous la limite de 30 % fixée avant le classement ; à la borne haute, elle dépasse cette limite, avec 38,2 % sur les deux périodes et 52,9 % au premier semestre 2026.',
        ],
        [
          'Le recul de la part non contrainte au premier semestre 2026 vient de deux changements. Le prix FOB de l’Urals passe de 43 dollars en février à 76 dollars en mars 2026 (KSE, 2026) et reste au-dessus du plafond de 44,1 dollars, en vigueur depuis le 1er février 2026, de mars à septembre (Règlement d’exécution (UE) 2026/124 ; KSE, 2026), alors que les navires du groupe G7+ portent 23 à 33 % du brut. Le prix du contrat n’étant pas visible, cette tranche relève de la classe E. Les navires inscrits sur une liste portent par ailleurs 56 à 69 % du brut au premier semestre 2026, contre une hypothèse de 12 % en 2025, tirée d’une phrase de CREA pour août 2025 (CREA, 2025). Testée entre 6 % et 20 %, avec la part de produits hors plafond, cette hypothèse donne une classe C de 7,3 % à 12,4 % des recettes de 2025 : les deux périodes ne se comparent pas sans cette réserve.',
        ],
        [
          'La classe C se concentre dans le brut maritime, qui en forme 79 %, tandis que la classe E se compose de produits pétroliers (54 %) et de brut (40 %). La classe D est vide, faute d’acte public qui chiffre une recette obtenue par un contournement ; le registre indique où se trouve le maillon désigné. La borne haute de E suppose que quatre flux que les données ne séparent pas sont tous indécidables : le brut par oléoduc vers la Chine après octobre 2025, le GNL vers la Chine depuis août 2025, le charbon et le gaz par gazoduc hors de l’Union, soit 22 % des recettes.',
        ],
        [
          'Un contrôle sur les douanes porte sur 2025. Le brut vers la Chine atteint 100,7 millions de tonnes chez CREA contre 100,9 dans les douanes chinoises, soit un écart d’environ 0,1 % ; vers l’Inde, les douanes dépassent CREA de 2,8 % en tonnes et de 26,5 % en valeur, CREA appliquant un prix de scénario là où les douanes enregistrent une valeur CIF (CREA, 2026 ; UN Comtrade, 2026). Le charbon vers la Chine pèse 80,6 millions de tonnes dans les douanes contre 61,4 chez CREA, soit 31 % de plus, sans explication dans les sources consultées. Le miroir turc est inférieur de 9,9 % à CREA pour le charbon et de 25,2 % pour les produits pétroliers, en valeur (Eurostat, 2026) ; il ne couvre ni le brut ni le gaz par gazoduc.',
        ],
      ],
      attach: 'ledger',
    },
    {
      id: 'ecart-de-prix',
      kind: 'box',
      title: 'Le test de l’écart de prix',
      paragraphs: [
        [
          'La décote de l’acheteur indien, soit l’écart entre le Brent et la valeur unitaire douanière indienne du brut russe, est décrite ici sans être testée, d’après une règle d’abandon écrite le 18 octobre 2026 avant l’examen des données (calculs de l’auteur). Cette décote vaut environ 11 dollars le baril de janvier à juin 2023, 2,4 de juillet à décembre 2023, 0,9 en 2024 (onze mois) et 0,1 de janvier à juillet 2025 (douanes indiennes, 2026 ; EIA, 2026). D’avril à juillet 2026, la valeur russe dépasse le Brent : 117,9 dollars contre 117,3 en avril, 123,2 contre 107,1 en mai, 112,0 contre 85,4 en juin et 89,8 contre 83,8 en juillet. Le rapport n’avance aucune cause. La valeur unitaire mêle des qualités de brut, le fret reste une fourchette de 10 à 20 dollars le baril (Spiro et al., 2025), la grandeur a été choisie après avoir vu le Brent et le calage de 2024 est partiel.',
        ],
      ],
    },
    {
      id: 'vendeurs',
      kind: 'section',
      title: 'Les vendeurs de première vente',
      paragraphs: [
        [
          'Le dénombrement des vendeurs de première vente de brut et de produits russes, de 2023 à 2026, compte 61 entités nommées : 18 négociants désignés par l’OFAC de 2023 à 2025, 16 désignés par le Royaume-Uni ou par l’Union, 3 filiales de ',
          { entity: 'e9a18aee-cad7-4d65-909a-ddfecb3f3a26', label: 'Gazprom Neft' },
          ', 9 producteurs désignés, dont Gazprom Neft, ',
          { entity: '06160296-0acd-4493-8021-b91f6653d272', label: 'Surgutneftegaz' },
          ', ',
          { entity: '1cb52bd8-6642-4f96-a2fc-73747f2153d6', label: 'Rosneft' },
          ' et ',
          { entity: '5b10592a-b2a2-4f2f-a8c6-5871a9676e20', label: 'Lukoil' },
          ', et 15 vendeurs que seuls KSE ou Kpler nomment (calculs de l’auteur d’après OFAC, 2026 ; Royaume-Uni, 2026 ; Union européenne, 2025-2026 ; KSE, 2026). Le fichier SDN du 15 octobre 2026 ne contient aucune désignation de négociant postérieure au 22 octobre 2025 (OFAC, 2026). Ce nombre est un plancher, car les levées de désignation de l’Union et du Royaume-Uni ne sont pas suivies.',
        ],
        [
          'Dans la série la plus récente de KSE, la part des quatre producteurs désignés par les États-Unis dans les exportations de brut passe de 6 % en mai à 15 % en juillet 2026 (KSE, août 2026). KSE a modifié cette série entre ses éditions de juillet et d’août 2026 sans en donner la raison, de sorte que le rapport cite une seule série. Rusexport arrive en première place des exportateurs de brut en juillet 2026 avec 26 %, puis recule à 22 % en août, chiffre préliminaire (KSE, août 2026 ; KSE, septembre 2026). Le contrôleur n’est établi pour aucune des 52 entités qui ne sont pas des producteurs, la règle exigeant deux documents indépendants ; cinq identités, dont Rusexport, n’ont aucun numéro d’immatriculation dans une source citée, et neuf vendeurs de KSE ne reposent que sur la légende d’un graphique.',
        ],
      ],
      attach: 'sellers',
    },
    {
      id: 'flux-licites',
      kind: 'section',
      title: 'Les flux licites et exemptés',
      paragraphs: [
        [
          'Le GNL russe sous contrat de courte durée est interdit à l’importation dans l’Union depuis le 25 avril 2026, et celui sous contrat de longue durée le sera dès le 1er janvier 2027 (Règlement (UE) 2026/261, art. 4 ; ',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'Règlement (UE) n° 833/2014' },
          ', art. 3ra). Pour le gaz par gazoduc, l’interdiction vaut depuis le 17 juin 2026 sous contrat de courte durée ; sous contrat de longue durée, le dernier jour de l’exemption sera le 29 septembre 2027, ou le 31 octobre 2027 si la Commission confirme un risque pour le stockage avant le 15 septembre 2027 (Règlement (UE) 2026/261, art. 4).',
        ],
        [
          'Le plafond du brut est de 44,1 dollars le baril depuis le 1er février 2026, après 60 dollars jusqu’au 2 septembre 2025 et 47,6 dollars du 3 septembre 2025 au 31 janvier 2026 ; sa révision est suspendue du 24 juillet 2026 au 14 juillet 2027 (Règlement d’exécution (UE) 2026/124). Le ',
          {
            entity: 'c01ec869-4cf5-402a-8c72-06fc476eefa1',
            label: 'Consortium du pipeline de la Caspienne',
          },
          ' a transporté 70,52 millions de tonnes de pétrole en 2025 (CPC, 2026). Dans l’Union, ce transport relève d’une autorisation au cas par cas (Règlement (UE) n° 833/2014, art. 5q) ; le Royaume-Uni l’autorise par une licence valable du 15 octobre 2025 au 14 octobre 2027 (OFSI, licence INT/2025/5635700), et les États-Unis par la licence générale 124B depuis le 14 novembre 2025, sans date de fin dans le texte (OFAC, 2025).',
        ],
        [
          'Le brut livré par oléoduc, dont celui de ',
          { entity: 'f1334667-0a7f-44bc-9586-0c4826e9f2b3', label: 'Droujba' },
          ', bénéficie dans l’Union d’une dérogation de l’article 3m, paragraphe 3, point d, valable jusqu’à une décision du Conseil ; elle a pris fin le 23 juin 2023 pour l’Allemagne et la Pologne, et le 1er juillet 2025 pour la Tchéquie (Règlement (UE) n° 833/2014). La licence britannique de Droujba court du 24 février 2026 au 14 octobre 2027 (OFSI, licence INT/2025/5635700). ',
          { entity: '4cb05d5f-06ee-4f44-8b52-66980a2e1812', label: 'Transneft' },
          ', qui possède Droujba, figure à l’annexe XIX, partie A, du règlement 833/2014, et le Royaume-Uni a gelé ses avoirs le 24 février 2026 (Règlement (UE) 2025/2033 ; Royaume-Uni, 2026). ',
          { entity: '1cb52bd8-6642-4f96-a2fc-73747f2153d6', label: 'Rosneft' },
          ' et ',
          { entity: 'e9a18aee-cad7-4d65-909a-ddfecb3f3a26', label: 'Gazprom Neft' },
          ' figurent à la même annexe ; le règlement 2025/2033, en vigueur depuis le 24 octobre 2025, a supprimé des exemptions de l’article 5aa, paragraphe 3, et en a ajouté une pour le commerce du brut et des produits sous le plafond. L’annexe XXIX exempte enfin le transport maritime et les services liés pour le brut de Sakhalin-2 vers le Japon, du 5 décembre 2022 au 31 mars 2028, et pour son GNL vers le Japon et la Corée du Sud, du 24 juillet 2026 au 31 mars 2028 (Règlement (UE) 2026/1848).',
        ],
      ],
    },
    {
      id: 'autres-biens',
      kind: 'box',
      title: 'Les autres biens',
      paragraphs: [
        [
          'Les autres biens sont décrits sans être classés. Dans l’Union, des dérogations plafonnées en tonnage subsistent pour les brames d’acier, le chlorure de potassium (837 570 tonnes par an) et l’ammoniac (688 000 tonnes par an depuis le 24 avril 2026), et un droit de douane frappe les engrais russes depuis le 1er juillet 2025 (',
          { entity: '52e815f4-c378-4336-add5-ff7ec15a0e80', label: 'Règlement (UE) n° 833/2014' },
          ' ; Règlement (UE) 2025/1227). ',
          { entity: '85a831e7-9c6e-4bae-9cf4-10fc39795c4d', label: 'Severstal' },
          ' et ',
          { entity: '0a088db2-6420-4072-9605-c4d326edc082', label: 'MMK' },
          ' figurent sur la liste de l’OFAC, et le Royaume-Uni les a inscrits le 18 mai 2023 ; leur statut dans l’annexe I du règlement 269/2014 n’est pas vérifié. Kitco rapporte, d’après BullionVault et des données de Hong Kong, 112,7 tonnes d’or d’origine russe importées à Hong Kong en sept mois de 2026 contre 92,1 en 2025 (Kitco, 2026), une analyse d’un tiers.',
        ],
      ],
    },
    {
      id: 'matrice',
      kind: 'section',
      title: 'La matrice de criticité',
      paragraphs: [
        [
          'La matrice aligne les listes de navires de l’Union, de l’OFAC et du Royaume-Uni sur le numéro OMI, jamais sur le nom. Les listes officielles comptent 942 numéros distincts désignés par au moins un régime russe, soit 671 pour l’Union, 443 pour les États-Unis et 645 pour le Royaume-Uni (règlement n° 833/2014, annexe XLII ; OFAC, 2026 ; Royaume-Uni, 2026). La matrice compte 765 numéros, dont un doublon connu du navire Estella, et 690 inscriptions de l’Union, soit plus que les 671 de l’annexe XLII, sans que la différence soit expliquée. Parmi ces numéros, 181 figurent sur les trois listes, 12 sur celles de l’Union et de l’OFAC sans le Royaume-Uni, 75 sont inscrits par l’OFAC ou le Royaume-Uni sans l’être par l’Union, et 497 par l’Union sans l’être par l’OFAC (calculs de l’auteur d’après la matrice du 21 octobre 2026).',
        ],
        [
          'Les dates suivent trois règles : l’entrée en vigueur pour l’Union, la date de l’avis pour l’OFAC et la date de désignation pour le Royaume-Uni. Pour les 193 navires qui portent une date de l’OFAC et une date de l’Union, la date de l’Union est postérieure de 221 jours en moyenne ; 145 de ces navires ont été inscrits par l’OFAC le 10 janvier 2025, avec 118 jours en moyenne, et les 48 autres montrent 533 jours. Cette date compte 168 des 221 inscriptions de l’OFAC. Entre l’Union et le Royaume-Uni, l’écart moyen est de 3 jours sur 592 navires. Les levées de l’OFAC et du Royaume-Uni ne sont pas suivies : Yasa Golden Bosphorus et Astra, levés par l’OFAC, n’ont pas de ligne dans la matrice.',
        ],
      ],
      attach: 'matrix',
    },
  ],
  limits: {
    title: 'Limites',
    paragraph: [
      'Le registre repose sur le seul traceur de CREA : il n’existe pas de miroir pour le brut et le gaz par gazoduc de la Turquie, ni pour l’Union par code de la nomenclature combinée. La classe D est vide, et le charbon vers la Chine garde un écart de 31 % sans explication. Aucune source consultée ne donne une fréquence par type de comportement : la typologie des indices de contournement est donc abandonnée. Le dénombrement des vendeurs est un plancher, et l’écart de prix reste descriptif. Les annexes I du règlement 269/2014 et XLII du règlement 833/2014 ne sont pas lues en entier. Le contrôle manuel de 30 lignes de la matrice a corrigé 7 erreurs.',
    ],
  },
  captions: {
    budget: 'Part des recettes pétrolières et gazières dans le budget fédéral',
    ledger: 'Registre des revenus par statut juridique',
    sellers: 'Vendeurs de première vente, part des exportations de brut en 2026',
    matrix: 'Navires désignés par l’UE, l’OFAC et le Royaume-Uni',
  },
};
