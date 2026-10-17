import { openBudget, openModel, type CallRecord, type Message, type Model } from '@gab/model';
import { z } from 'zod';

import { nameKey } from '../name-key.ts';
import type { Queryable } from '../queryable.ts';
import type { RaterConfig } from '../reader-config.ts';
import { recordModelCall } from '../runner.ts';

const AGENT = { name: 'reference-set', version: 'v1' };

// The set holds about thirty authors. The range keeps a build that is far from thirty out of the
// record, and the operator reads the set before the approval.
const LEAST = 20;
const MOST = 40;

// The record refuses any other form of a site: a host name in lower case, with no scheme, path or
// port. The host of an address loses "www." before the match, so a site with it never matches. A
// site of two labels that starts with a common second level of a public suffix ("gov.uk") holds
// the sites of many authors.
const BROAD =
  /^(?:gov|gouv|gc|go|govt|gob|gv|europa|coe|int|service|co|com|org|net|ac|edu|mil)\.[a-z0-9-]+$/u;

const site = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/u,
    'a site is a host name in lower case, with no scheme, path or port',
  )
  .refine((value) => !value.startsWith('www.'), 'a site does not start with www.')
  .refine((value) => !BROAD.test(value), 'a site is too broad: it holds the sites of many authors');

const author = z.strictObject({
  name: z.string().trim().min(1),
  letter: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  reason: z.string().trim().min(1),
  controller: z.string().trim().min(1).nullable(),
  party: z.boolean(),
  sites: z.array(site),
});

/** The rules that every author of a set passes: one name for each author, a controller for a
 * party, and B at most for a party. The answer of the model also gives a site to each author A. */
const setOf = (authors: z.ZodArray<typeof author>, siteOfA: boolean) =>
  z.strictObject({ authors }).check((context) => {
    const names = context.value.authors.map((one) => one.name.replace(/\s+/gu, ' ').toLowerCase());
    if (new Set(names).size !== names.length)
      context.issues.push({ code: 'custom', message: 'two authors share one name', input: names });
    context.value.authors.forEach((one, index) => {
      if (one.party && one.controller === null)
        context.issues.push({
          code: 'custom',
          message: `${one.name}: a party to the conflict has a controller`,
          input: one,
          path: ['authors', index],
        });
      if (one.party && one.letter === 'A')
        context.issues.push({
          code: 'custom',
          message: `${one.name}: a party to the conflict is B at most`,
          input: one,
          path: ['authors', index],
        });
      // A source A counts alone only on a site of its author, so an author A with no site
      // could never count alone.
      if (siteOfA && one.letter === 'A' && one.sites.length === 0)
        context.issues.push({
          code: 'custom',
          message: `${one.name}: an author A has at least one site`,
          input: one,
          path: ['authors', index],
        });
    });
  });

/** The answer of the model: the reference set, each author with a letter and a reason. */
export const referenceAnswer = setOf(z.array(author).min(LEAST).max(MOST), true);

/** A set that experts wrote in a file. It grows when the operator adds authors, so it has no
 * range. An author A of it can have no site, when it publishes only on a site that many authors
 * share: it never counts alone. */
export const writtenSet = setOf(z.array(author).min(1), false);

const row = z.object({
  name_key: z.string(),
  letter: z.string(),
  reason: z.string(),
  controller: z.string().nullable(),
  party: z.boolean(),
  sites: z.array(z.string()),
  approved: z.boolean(),
});

export type ReferenceRow = z.infer<typeof row>;

const READ = `SELECT name_key, letter::text, reason, controller, party, sites, approved
  FROM public.reference_set()`;
const STORE = `SELECT public.store_reference_author($1::text, $2::text, $3::text, $4::text,
  '{}'::text[], $5::text, $6::boolean, $7::text[]) AS id`;
const SITES = 'SELECT public.store_reference_sites($1::text, $2::text[]) AS said';
const APPROVE = 'SELECT public.approve_reference_set() AS n';

/** The reference set as the record holds it, for the operator to read. */
export const readReferenceSet = async (app: Queryable): Promise<readonly ReferenceRow[]> =>
  z.array(row).parse((await app.query(READ)).rows);

/** The operator approves the set. It gives the number of authors that it approved. */
export const approveReferenceSet = async (app: Queryable): Promise<number> =>
  z.object({ n: z.number().int() }).parse((await app.query(APPROVE)).rows[0]).n;

type Authors = z.infer<typeof referenceAnswer>['authors'];

const refuseSecondSet = async (app: Queryable, ending: string): Promise<void> => {
  if ((await readReferenceSet(app)).length > 0)
    throw new Error(`The record holds a reference set already. ${ending}`);
};

type Author = Authors[number];

/** Stores one author of the set. It gives false when the name is a name of an author that the
 * worker rated: the rated author stands, and the set does not hold the name. */
const storeAuthor = async (app: Queryable, one: Author, model: string): Promise<boolean> => {
  const [stored] = z
    .array(z.object({ id: z.string().nullable() }))
    .length(1)
    .parse(
      (
        await app.query(STORE, [
          one.name,
          one.letter,
          model,
          one.reason,
          one.controller,
          one.party,
          one.sites,
        ])
      ).rows,
    );
  return stored?.id !== null;
};

const storeAuthors = async (
  app: Queryable,
  authors: Authors,
  model: string,
): Promise<readonly ReferenceRow[]> => {
  for (const one of authors) await storeAuthor(app, one, model);
  return readReferenceSet(app);
};

/** The text that the model column holds for a set that experts wrote and no model made. */
export const WRITTEN_SET_MODEL = 'expert-written set';

/** Stores a set that experts wrote, from the text of a JSON file. The text passes the same rules
 * as the answer of the model. No model is called. The set is not used until the operator
 * approves it. A record that holds a reference set refuses a load. The caller wraps the call in
 * one transaction, so a set is stored whole or not at all. */
export const loadReferenceSet = async (
  app: Queryable,
  text: string,
): Promise<readonly ReferenceRow[]> => {
  const set = writtenSet.parse(JSON.parse(text));
  await refuseSecondSet(app, 'It is loaded once. Add new authors with add.');
  return storeAuthors(app, set.authors, WRITTEN_SET_MODEL);
};

const filled = z.object({ said: z.enum(['filled', 'same', 'other', 'not_in_set']) });

/** What the record did with the sites of one author of the file. */
export interface SitesOfAuthor {
  readonly name: string;
  readonly said: z.infer<typeof filled>['said'];
}

/** Gives its sites to each author of the reference set that has none, from the text of a JSON file
 * in the shape of the reference answer. A set stored before the sites existed has no site, and
 * its authors A count alone only when they have one. The record never changes sites that an
 * author holds, and it reports an author of the file that the set does not hold. The caller wraps
 * the call in one transaction. */
export const fillReferenceSites = async (
  app: Queryable,
  text: string,
): Promise<{ readonly sites: readonly SitesOfAuthor[]; readonly set: readonly ReferenceRow[] }> => {
  const set = writtenSet.parse(JSON.parse(text));
  const sites: SitesOfAuthor[] = [];
  for (const one of set.authors)
    if (one.sites.length > 0) {
      const row = filled.parse((await app.query(SITES, [one.name, one.sites])).rows[0]);
      sites.push({ name: one.name, said: row.said });
    }
  return { sites, set: await readReferenceSet(app) };
};

/** What the record did with one author of the file: `stored` it as a new author, or `kept` the
 * author that the set holds already. `differs` names each field of a kept author whose value in
 * the record is not the value of the file. The record keeps its value, because a letter is
 * written once. */
export interface AddedAuthor {
  readonly name: string;
  readonly said: 'stored' | 'kept';
  readonly differs: readonly string[];
}

/** A refusal of the add, for the operator to read. */
export class ReferenceSetRefusal extends Error {}

const differences = (one: Author, held: ReferenceRow): string[] => {
  const differs: string[] = [];
  const field = (named: string, file: unknown, record: unknown): void => {
    if (JSON.stringify(file) !== JSON.stringify(record))
      differs.push(
        `${named}: the file says ${JSON.stringify(file)}, the record ${JSON.stringify(record)}`,
      );
  };
  field('letter', one.letter, held.letter);
  field('reason', one.reason, held.reason);
  field('controller', one.controller, held.controller);
  field('party', one.party, held.party);
  field('sites', [...one.sites].sort(), [...held.sites].sort());
  return differs;
};

/** Stores each author of the file that the reference set does not hold, from the text of a JSON
 * file in the shape of a written set. An author whose name the set holds is kept as it is. The
 * new authors are not used until the operator approves them. The model column says that experts
 * wrote them, and the date of the addition. A name that the worker rated is refused, because the
 * rated author stands: the operator gives the author another name in the file and moves the rated
 * names to it after the approval. The caller wraps the call in one transaction, so the file is
 * added whole or not at all. */
export const addReferenceAuthors = async (
  app: Queryable,
  text: string,
  today: string,
): Promise<{ readonly added: readonly AddedAuthor[]; readonly set: readonly ReferenceRow[] }> => {
  const set = writtenSet.parse(JSON.parse(text));
  const held = new Map((await readReferenceSet(app)).map((one) => [one.name_key, one]));
  const model = `${WRITTEN_SET_MODEL} (addition ${today})`;
  const added: AddedAuthor[] = [];
  for (const one of set.authors) {
    const kept = held.get(nameKey(one.name));
    if (kept !== undefined) {
      added.push({ name: one.name, said: 'kept', differs: differences(one, kept) });
      continue;
    }
    if (!(await storeAuthor(app, one, model)))
      throw new ReferenceSetRefusal(
        `The name "${one.name}" is a name of an author that the worker rated, so the set cannot ` +
          'hold it. Give the author another name in the file, add the file again, approve the ' +
          'set, and move the rated names with: pnpm worker author-names move <name> <author>',
      );
    added.push({ name: one.name, said: 'stored', differs: [] });
  }
  return { added, set: await readReferenceSet(app) };
};

export interface BuildDeps {
  /** The connection of the agent role: it records the call of the model. */
  readonly agent: Queryable;
  /** The connection of the operator role: it stores the set. The caller wraps it in one
   * transaction, so a set is stored whole or not at all. */
  readonly app: Queryable;
  readonly config: RaterConfig;
  /** The pinned model, made by the caller. */
  readonly language: Parameters<typeof openModel>[0];
  readonly prompt: string;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

/** Asks the strongest model once for the reference set, and stores each author with its letter and
 * its reason. The set is stored but is not used until the operator approves it. A record that
 * holds a reference set refuses a second build. */
export const buildReferenceSet = async (deps: BuildDeps): Promise<readonly ReferenceRow[]> => {
  await refuseSecondSet(deps.app, 'It is built once.');

  const line: Model = openModel(deps.language, deps.config.model.line, {
    record: (call: CallRecord) => recordModelCall(deps.agent, AGENT, null, call),
    sleep: deps.sleep,
    now: deps.now,
  });
  const messages: Message[] = [
    { role: 'system', content: deps.prompt },
    {
      role: 'user',
      content: `Build the reference set of ${String(LEAST)} to ${String(MOST)} authors.`,
    },
  ];
  const answer = await line.ask({
    messages,
    shape: referenceAnswer,
    budget: openBudget(deps.config.tokenCap),
  });
  if (!answer.ok) throw new Error(`The model gave no reference set: ${answer.failure.reason}`);
  if ('call' in answer)
    throw new Error('The model answered with a tool call, and the build offers none.');

  return storeAuthors(deps.app, answer.value.authors, answer.served ?? deps.config.model.model);
};
