// A bot challenge or a "not found" page can come with a success status. Its bytes come from the
// origin, but they are no record of the source, and a stored copy could be cited as one.

/** A text longer than this is an article or a record, and an article can mention a captcha. */
export const SHORT_PAGE = 1500;

// External constraint: the words are those of the challenge pages and the error pages of the
// common filters and servers. A page that holds one of them and little else is not read.
const CHALLENGE = [
  /just a moment\.\.\./iu,
  /checking your browser/iu,
  /verify (?:that )?you are (?:a )?human/iu,
  /enable javascript and cookies to continue/iu,
  /attention required/iu,
  /are you a (?:robot|human)/iu,
  /\bcaptcha\b/iu,
  /\bddos protection\b/iu,
  /access denied/iu,
  /request unsuccessful/iu,
  /unusual traffic/iu,
] as const;

const MISSING = [
  /\b404\b[\s\S]{0,40}not found/iu,
  /not found[\s\S]{0,40}\b404\b/iu,
  /page (?:was |is )?not found/iu,
  /page (?:can(?:no|')t|could not) be found/iu,
  /no longer (?:available|exists?)/iu,
] as const;

/** The sentence that says why an answer is no record of the source, or null when it may be one. */
export const unreadablePage = (mime: string, pages: readonly string[]): string | null => {
  if (mime !== 'text/html') return null;
  const text = pages.join('\n').trim();
  if (text.length > SHORT_PAGE) return null;
  if (CHALLENGE.some((word) => word.test(text)))
    return 'the page is a challenge of a bot filter or a refusal, and it is not the page of the source';
  if (MISSING.some((word) => word.test(text)))
    return 'the page says it is missing, although the server answered with a success, and it is not the page of the source';
  return null;
};
