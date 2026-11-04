// psql runs a meta-command of the script too. A meta-command can reach another database (\c), run a
// shell (\!, \o |, \g |, \copy ... program) or read a file (\i). So db:sql lets only the
// meta-commands that show a result. The text of a string or a comment is not read.

const SHOWN = /^(?:x|timing|echo|pset|conninfo|l|d[a-zA-Z]*\+?)$/u;

const withoutText = (script: string): string =>
  script
    .replace(/'(?:[^']|'')*'/gu, "''")
    .replace(/--[^\n]*/gu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '');

/** True when a script holds a meta-command other than one that shows a result. */
export const hasRefusedMetaCommand = (script: string): boolean =>
  [...withoutText(script).matchAll(/\\([a-zA-Z!?]*\+?)/gu)].some(
    ([, name]) => !SHOWN.test(name ?? ''),
  );
