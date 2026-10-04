import { readdir, stat } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

/** Which files of a folder the run takes. */
export interface WalkOptions {
  readonly recursive: boolean;
  readonly include: readonly string[];
}

/** The glob of a run that names none. Every other type is taken only when the operator names it. */
export const DEFAULT_INCLUDE: readonly string[] = ['*.pdf'];

// Departure: scripts, .out files and bytecode sit in the corpus beside the evidence, and no glob
// takes them, even `*`. An explicit file argument is never skipped.
const SKIPPED_EXTENSIONS: readonly string[] = ['.py', '.out'];
const SKIPPED_FOLDER = '__pycache__';

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

// An extension on a file system that ignores case, such as Windows, comes as .PDF as often as
// .pdf, so the part after the last dot of the name and of the glob is compared in lower case.
const lowerExtension = (text: string): string => {
  const dot = text.lastIndexOf('.');
  return dot <= text.lastIndexOf('/') ? text : text.slice(0, dot) + text.slice(dot).toLowerCase();
};

/** Whether a glob takes a path relative to the folder. A glob with no slash tests the base name. */
export const matchesInclude = (relativePath: string, glob: string): boolean => {
  const subject = glob.includes('/') ? relativePath : (relativePath.split('/').pop() ?? '');
  return posix.matchesGlob(lowerExtension(subject), lowerExtension(glob));
};

const isSkipped = (relativePath: string): boolean =>
  relativePath.split('/').includes(SKIPPED_FOLDER) ||
  SKIPPED_EXTENSIONS.includes(extensionOf(relativePath));

/** The files of one folder that a glob takes, in sorted order, as paths under that folder. */
export const walkFolder = async (folder: string, options: WalkOptions): Promise<string[]> => {
  const entries = await readdir(folder, { withFileTypes: true, recursive: options.recursive });
  const found = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter(
      (path) => !isSkipped(path) && options.include.some((glob) => matchesInclude(path, glob)),
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return found.map((path) => join(folder, ...path.split('/')));
};

/** A folder becomes the files that the walk takes. Any other path stays, so the run refuses it. */
export const expandPaths = async (
  paths: readonly string[],
  options: WalkOptions,
): Promise<string[]> => {
  const files: string[] = [];
  for (const path of paths) {
    const isFolder = await stat(path).then(
      (info) => info.isDirectory(),
      () => false,
    );
    if (isFolder) files.push(...(await walkFolder(path, options)));
    else files.push(path);
  }
  return files;
};
