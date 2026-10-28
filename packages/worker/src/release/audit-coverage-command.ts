import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { SubCommand } from '../command.ts';
import { auditCoverage, auditText, stepsShape } from './audit-coverage.ts';

const USAGE = 'Usage: pnpm worker audit-coverage <release-folder> <steps.json>';

/** Prints the coverage and the depth of each step of a chain on a frozen release folder, as one
 * JSON text. The folder holds the files of a release. The reference file of a step stands beside
 * the steps file. It reads files and writes nothing. */
export const auditCoverageCommand: SubCommand = async (args) => {
  const [folder, stepsFile] = args;
  if (folder === undefined || stepsFile === undefined || args.length !== 2) {
    console.error(USAGE);
    return 2;
  }
  try {
    const steps = stepsShape.parse(JSON.parse(await readFile(stepsFile, 'utf8')));
    const read = (name: string): Promise<string> => readFile(join(folder, name), 'utf8');
    const references = new Map<string, string>();
    for (const step of steps) {
      if (step.reference !== null) {
        references.set(
          step.name,
          await readFile(join(dirname(stepsFile), step.reference.file), 'utf8'),
        );
      }
    }
    const report = auditCoverage(
      {
        entities: await read('entities.csv'),
        relations: await read('relations.csv'),
        claims: await read('claims.csv'),
        manifest: await read('manifest.json'),
        references,
      },
      steps,
    );
    process.stdout.write(auditText(report));
    return 0;
  } catch (error) {
    console.error(`The audit stops: ${(error as Error).message}`);
    return 2;
  }
};
