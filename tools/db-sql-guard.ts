// psql runs a meta-command of the script too. A meta-command can reach another database (\c), run a
// shell (\!, \o |, \g |, \copy ... program) or read a file (\i). So db:sql lets only the
// meta-commands that show a result. The scan reads the script from left to right, as psql does, and
// does not read a comment, a string, a quoted name or a dollar-quoted body.

const SHOWN = /^(?:x|timing|echo|pset|conninfo|l|d[a-zA-Z]*\+?)$/u;
const WORD = /[\w$]/u;

/** The names of the meta-commands of a script, outside each comment, string and quoted body. */
export const metaCommands = (script: string): string[] => {
  const found: string[] = [];
  let at = 0;
  const skipTo = (end: string, from: number): number => {
    const next = script.indexOf(end, from);
    return next === -1 ? script.length : next + end.length;
  };
  while (at < script.length) {
    const char = script[at] ?? '';
    const before = at === 0 ? '' : (script[at - 1] ?? '');
    if (script.startsWith('--', at)) at = skipTo('\n', at);
    else if (script.startsWith('/*', at)) at = skipTo('*/', at + 2);
    else if (char === "'") {
      // An E string takes a backslash as an escape. In each string, two quotes are one quote.
      const escapes = /[eE]/u.test(before) && !WORD.test(script[at - 2] ?? '');
      at += 1;
      while (at < script.length) {
        if (escapes && script[at] === '\\') at += 2;
        else if (script[at] === "'" && script[at + 1] === "'") at += 2;
        else if (script[at] === "'") break;
        else at += 1;
      }
      at += 1;
    } else if (char === '"') {
      at += 1;
      while (at < script.length && !(script[at] === '"' && script[at + 1] !== '"'))
        at += script[at] === '"' ? 2 : 1;
      at += 1;
    } else if (char === '$' && !WORD.test(before)) {
      const tag = /^\$(?:[A-Za-z_]\w*)?\$/u.exec(script.slice(at))?.[0];
      at = tag === undefined ? at + 1 : skipTo(tag, at + tag.length);
    } else if (char === '\\') {
      const name = /^[a-zA-Z!?]*\+?/u.exec(script.slice(at + 1))?.[0] ?? '';
      found.push(name);
      at += 1 + Math.max(name.length, 1);
    } else at += 1;
  }
  return found;
};

/** True when a script holds a meta-command other than one that shows a result. */
export const hasRefusedMetaCommand = (script: string): boolean =>
  metaCommands(script).some((name) => !SHOWN.test(name));
