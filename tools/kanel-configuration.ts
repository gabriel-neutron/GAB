// The one place that says how the generated folder is made. Nothing here runs on import.

import { join } from 'node:path';

import type {
  Config,
  GetMetadata,
  GetPropertyMetadata,
  GetRoutineMetadata,
  Output,
  PgTsGeneratorConfig,
  PgTsPreRenderHook,
  TypeMap,
} from 'kanel';
import { makePgTsGenerator, useKanelContext } from 'kanel';
import { makeGenerateZodSchemas } from 'kanel-zod';

import { connectionString } from './db-runtime.ts';
import type { DatabaseName } from './test-database.ts';

/** The folder of generated types that the repository commits. */
export const committedFolder = join(import.meta.dirname, '..', 'src', 'contract');

// A comment block under src is three lines and one hundred characters, and a view comment is
// longer than both. The SQL holds those words and stays the authority, so the generated file
// carries none of them.
const noComment: GetMetadata = (_details, _generateFor, builtin) => ({
  ...builtin,
  comment: undefined,
});

const noRoutineComment: GetRoutineMetadata = (_routine, builtin) => ({
  ...builtin,
  returnTypeComment: undefined,
  // The generator flattens the parameter comments into the comment of the whole type, and a
  // list of nothing is not the same as nothing there: an absent comment renders as an empty one.
  parameters: builtin.parameters.map((parameter) => ({ ...parameter, comment: [] })),
});

// The modes a caller passes. A RETURNS TABLE column and an OUT parameter arrive in the same
// parameter list as an argument, and the generator writes every one of them as a required input.
const ARGUMENT_MODES: readonly string[] = ['IN', 'INOUT', 'VARIADIC'];

// A routine holds the shape of one read, and the metadata hook that takes the null of a view
// column never reaches it. Only `unknown` swallows a null on its own, as it does for a view.
const NEVER_NULL = 'unknown';

interface RoutineParameter {
  readonly name: string;
  readonly mode: string;
  readonly hasDefault: boolean;
}

/** The two halves of the routine shape: what the generator is told, and what it wrote. */
interface RoutineShape {
  readonly stateShape: GetRoutineMetadata;
  readonly correctShape: PgTsPreRenderHook;
}

// The generator reads the type of a parameter by its position in the list, so a parameter is
// dropped after it is written and never before. One pair of maps per generation.
const routineShape = (): RoutineShape => {
  const argumentsOf = new Map<string, ReadonlySet<string>>();
  const optionalOf = new Map<string, ReadonlySet<string>>();
  const returnTypes = new Set<string>();
  const at = (path: string, name: string): string => `${path}|${name}`;

  const stateShape: GetRoutineMetadata = (routine, builtin) => {
    const stated = noRoutineComment(routine, builtin);
    const key = at(stated.path, stated.parametersName);
    const parameters: readonly RoutineParameter[] = routine.parameters;
    const args = parameters
      .filter((found) => ARGUMENT_MODES.includes(found.mode))
      .map((found) => found.name);

    // External constraint: the extractor flags the last parameters of the whole list, and a
    // RETURNS TABLE column sits at that end, so a flag can land on an output column. The count
    // is right, and PostgreSQL gives a default to a trailing run of arguments.
    const withDefault = parameters.filter((found) => found.hasDefault).length;

    argumentsOf.set(key, new Set(args));
    optionalOf.set(key, new Set(args.slice(args.length - withDefault)));
    if (stated.returnTypeName !== undefined)
      returnTypes.add(at(stated.path, stated.returnTypeName));
    return stated;
  };

  const correctShape: PgTsPreRenderHook = (output) => {
    const kept: Output = {};
    for (const [path, file] of Object.entries(output)) {
      if (file.fileType !== 'typescript') {
        kept[path] = file;
        continue;
      }
      kept[path] = {
        ...file,
        declarations: file.declarations.map((declaration) => {
          if (declaration.declarationType !== 'interface') return declaration;
          const args = argumentsOf.get(at(path, declaration.name));
          if (args !== undefined) {
            const optional = optionalOf.get(at(path, declaration.name)) ?? new Set<string>();
            return {
              ...declaration,
              properties: declaration.properties
                .filter((property) => args.has(property.name))
                .map((property) => ({ ...property, isOptional: optional.has(property.name) })),
            };
          }
          if (!returnTypes.has(at(path, declaration.name))) return declaration;
          return {
            ...declaration,
            properties: declaration.properties.map((property) => ({
              ...property,
              isNullable: property.typeName !== NEVER_NULL,
            })),
          };
        }),
      };
    }
    return kept;
  };

  return { stateShape, correctShape };
};

// A trigger function takes no parameter, so the generator writes an interface with no property,
// and such an interface accepts a number and a string. The database calls a trigger and no
// caller can, so the whole file it writes is empty of a shape anybody can use.
const withoutEmptyShape: PgTsPreRenderHook = (output) => {
  const kept: Output = {};
  for (const [path, file] of Object.entries(output)) {
    if (file.fileType !== 'typescript') {
      kept[path] = file;
      continue;
    }
    const declarations = file.declarations.filter(
      (found) => found.declarationType !== 'interface' || found.properties.length > 0,
    );
    if (declarations.length > 0) kept[path] = { ...file, declarations };
  }
  return kept;
};

// A driver returns a PostGIS geometry as hexadecimal EWKB and a transaction identifier as
// digits, because it parses neither. The api views publish GeoJSON, which arrives as an object.
const DRIVER_TYPES: TypeMap = {
  'public.geometry': 'string',
  'pg_catalog.xid8': 'string',
  'public.doc_id': 'string',
};

// A view column carries no count of the array dimensions, and only a table column carries one.
// The zod plugin reads that count, and writes a scalar schema for an array column without it.
// A PostgreSQL array column holds one dimension, which is where the number below comes from.
const ARRAY_DIMENSIONS = 1;

const columnsWithDimensions = <Column extends { readonly isArray: boolean }>(
  columns: readonly Column[],
): Column[] =>
  columns.map((column) => (column.isArray ? { ...column, dimensions: ARRAY_DIMENSIONS } : column));

const withArrayDimensions: PgTsPreRenderHook = (output) => {
  for (const schema of Object.values(useKanelContext().schemas)) {
    for (const view of schema.views) view.columns = columnsWithDimensions(view.columns);
    for (const view of schema.materializedViews) view.columns = columnsWithDimensions(view.columns);
  }
  return output;
};

// PostgREST answers in JSON, so the contract states what JSON carries and never what PostgreSQL
// holds. A date arrives as a string, a wide number and a numeric arrive as a JSON number, and a
// jsonb column holds any JSON value: one column measured a string, a number, an array and a bool.
const WIRE_TYPES: TypeMap = {
  'pg_catalog.jsonb': 'unknown',
  'pg_catalog.json': 'unknown',
  jsonb: 'unknown',
  'pg_catalog.date': 'string',
  'pg_catalog.timestamp': 'string',
  'pg_catalog.timestamptz': 'string',
  'pg_catalog.int8': 'number',
  'pg_catalog.numeric': 'number',
};

const CONTRACT_TYPES: TypeMap = { ...DRIVER_TYPES, ...WIRE_TYPES };

const CONTRACT_ZOD_TYPES: TypeMap = {
  'pg_catalog.jsonb': 'z.unknown()',
  'pg_catalog.json': 'z.unknown()',
  'pg_catalog.date': 'z.string()',
  'pg_catalog.timestamp': 'z.string()',
  'pg_catalog.timestamptz': 'z.string()',
  'pg_catalog.int8': 'z.number()',
  'pg_catalog.numeric': 'z.number()',
  'public.doc_id': 'z.string()',
};

// `unknown` already admits a null, in the type and in the schema alike, and a union of the two
// is refused as redundant. Every other column takes the null, so the generator claims only what
// the transport proves and a refinement per view states what a human knows.
const admitsNullAlone = (property: { readonly type: { readonly fullName: string } }): boolean =>
  WIRE_TYPES[property.type.fullName] === 'unknown';

const nullableWireColumn: GetPropertyMetadata = (property, _details, _generateFor, builtin) => ({
  ...builtin,
  comment: undefined,
  nullableOverride: property.isArray || !admitsNullAlone(property),
});

// A domain becomes a bare alias of its base type, which holds none of the CHECK, and the
// generator gives that alias a default export, which the strict module syntax here refuses.
// The map above names the base type of each one, so no file is needed.
const notADomain: NonNullable<PgTsGeneratorConfig['filter']> = (pgType) => pgType.kind !== 'domain';

// A dropped view must leave no file behind, or the drift check can never see a deletion.
// A view is read as a view: resolving one writes the base tables beside it and crosses the seam.
const SHAPE = { preDeleteOutputFolder: true, resolveViews: false } as const;

/** The Kanel configuration that writes the types of the api schema of `database` to `folder`. */
export const kanelConfiguration = (folder: string, database: DatabaseName): Config => {
  const routine = routineShape();
  return {
    ...SHAPE,
    // The read role holds nothing on the public schema, so it cannot introspect one column.
    connection: connectionString('superuser', database),
    schemaNames: ['api'],
    outputPath: folder,
    generators: [
      makePgTsGenerator({
        customTypeMap: CONTRACT_TYPES,
        filter: notADomain,
        getMetadata: noComment,
        getPropertyMetadata: nullableWireColumn,
        getRoutineMetadata: routine.stateShape,
        preRenderHooks: [
          routine.correctShape,
          withoutEmptyShape,
          withArrayDimensions,
          // A cast is an escape hatch this repository refuses, and the plugin writes one by
          // default around every schema it emits.
          makeGenerateZodSchemas({ zodTypeMap: CONTRACT_ZOD_TYPES, castToSchema: false }),
        ],
      }),
    ],
  };
};
