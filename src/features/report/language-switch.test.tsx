import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fr } from './content-fr';
import { LanguageSwitch, switchAddress } from './language-switch';
import { ContentContext } from './use-content';

const BASE = import.meta.env.BASE_URL;

describe('the language switch', () => {
  it('goes to the same anchor in the other locale', () => {
    expect(switchAddress('fr', 'pay')).toBe(`${BASE}fr#pay`);
    expect(switchAddress('fr/bibliography', '#note-pay-23')).toBe(
      `${BASE}fr/bibliography#note-pay-23`,
    );
    expect(switchAddress('', '')).toBe(BASE);
  });

  it('links the English page to the French page and back, with the part in view', () => {
    const english = renderToStaticMarkup(<LanguageSwitch page="report" anchor="finance" />);
    expect(english).toContain(`href="${BASE}fr#finance"`);
    expect(english).toContain('hrefLang="fr"');
    const french = renderToStaticMarkup(
      <ContentContext.Provider value={fr}>
        <LanguageSwitch page="report" anchor="finance" />
      </ContentContext.Provider>,
    );
    expect(french).toContain(`href="${BASE}#finance"`);
    expect(french).toContain('hrefLang="en"');
  });
});
