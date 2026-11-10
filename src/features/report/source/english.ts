import type { Source } from '../parity';
import en from './report-en.md?raw';

// The final English text, as the author delivers it, and where each part of the page starts in
// it. The web cuts "2 Pay" in two parts: pay (2.1 to 2.3) and ports-fleet (2.4 to 2.6).
export const englishSource: Source = {
  text: en,
  starts: [
    ['summary', '## Summary'],
    ['introduction', '## Introduction'],
    ['method-chronology', '## 1 Method'],
    ['pay', '## 2 Pay'],
    ['ports-fleet', '### 2.4 The ports'],
    ['finance', '## 3 Finance'],
    ['fight', '## 4 Fight'],
    ['ownership', '## 5 Who owns what'],
    ['limits', '## 6 Limitations'],
    ['conclusion', '## Conclusion'],
    ['annex-method', '## Annex A Research method'],
  ],
};
