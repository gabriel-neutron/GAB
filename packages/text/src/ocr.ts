// Tesseract reads Russian, Ukrainian and English from pinned data packages, so a run fetches
// nothing and one version gives one text. The extractor name holds the engine and data versions,
// so a new version is a new text set and never an edit of an old one.

import { copyFile, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createWorker, OEM } from 'tesseract.js';

const require = createRequire(import.meta.url);

const LANGUAGES = ['rus', 'ukr', 'eng'] as const;

// External constraint: the packages hold two sets, and the LSTM engine reads the integer set.
const DATA_SET = '4.0.0_best_int';

const ENGINE_VERSION = (require('tesseract.js/package.json') as { version: string }).version;

/** The name of the text set of an OCR run: the engine and the language data, both pinned. */
export const OCR_EXTRACTOR = `tesseract:${ENGINE_VERSION}:${DATA_SET}`;

const dataFileOf = (language: string): string =>
  path.join(
    path.dirname(require.resolve(`@tesseract.js-data/${language}/package.json`)),
    DATA_SET,
    `${language}.traineddata.gz`,
  );

// External constraint: the engine reads every language from one folder, and each package holds
// one language, so the three files are copied into one folder at the first run.
let folder: Promise<string> | undefined;

const languageFolder = (): Promise<string> => {
  folder ??= (async () => {
    const made = await mkdtemp(path.join(tmpdir(), 'gab-tessdata-'));
    await Promise.all(
      LANGUAGES.map((language) =>
        copyFile(dataFileOf(language), path.join(made, `${language}.traineddata.gz`)),
      ),
    );
    return made;
  })();
  return folder;
};

/** The text of one image, as one page. An image with no text gives an empty page. */
export const ocrPage = async (bytes: Uint8Array): Promise<string> => {
  const worker = await createWorker([...LANGUAGES], OEM.LSTM_ONLY, {
    langPath: await languageFolder(),
    gzip: true,
    cacheMethod: 'none',
    // External constraint: with no handler the engine throws a bad image outside the promise, and
    // the process sees an uncaught error. The handler leaves the refusal to the promise alone.
    errorHandler: () => undefined,
  });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data.text
      .replaceAll('\u0000', '')
      .replace(/[ \t]+\n/gu, '\n')
      .trim();
  } finally {
    await worker.terminate();
  }
};
