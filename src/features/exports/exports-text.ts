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

const TO_COME: Paragraph = ['Texte à venir.'];

/** The French text of the exports part. The writing step replaces these words. */
export const EXPORTS_TEXT: ExportsText = {
  title: 'Les exportations russes',
  blocks: [
    {
      id: 'recettes',
      kind: 'section',
      title: 'Ce que paient les exportations',
      paragraphs: [TO_COME],
      attach: 'budget',
    },
    {
      id: 'registre',
      kind: 'section',
      title: 'Le registre des revenus par statut juridique',
      paragraphs: [TO_COME],
      attach: 'ledger',
    },
    {
      id: 'ecart-de-prix',
      kind: 'box',
      title: 'Le test de l’écart de prix',
      paragraphs: [TO_COME],
    },
    {
      id: 'vendeurs',
      kind: 'section',
      title: 'Les vendeurs de première vente',
      paragraphs: [TO_COME],
      attach: 'sellers',
    },
    {
      id: 'flux-licites',
      kind: 'section',
      title: 'Les flux licites et exemptés',
      paragraphs: [TO_COME],
    },
    {
      id: 'autres-biens',
      kind: 'box',
      title: 'Les autres biens',
      paragraphs: [TO_COME],
    },
    {
      id: 'matrice',
      kind: 'section',
      title: 'La matrice de criticité',
      paragraphs: [TO_COME],
      attach: 'matrix',
    },
  ],
  limits: { title: 'Limites', paragraph: TO_COME },
  captions: {
    budget: 'Part des recettes pétrolières et gazières dans le budget fédéral',
    ledger: 'Registre des revenus par statut juridique',
    sellers: 'Vendeurs de première vente, 2023-2026',
    matrix: 'Navires désignés par l’UE, l’OFAC et le Royaume-Uni',
  },
};
