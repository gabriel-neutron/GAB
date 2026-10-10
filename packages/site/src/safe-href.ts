// A source address comes from an untrusted page. Only a web address and a mail address open
// something that the reader expects; a script, a data address or a path into the site do not.
const SAFE = /^(https?:\/\/[^\s"<>]+|mailto:[^\s"<>]+@[^\s"<>]+)$/u;

/** The address as a link target, or null when it must stay text. */
export const safeHref = (address: string): string | null => (SAFE.test(address) ? address : null);
