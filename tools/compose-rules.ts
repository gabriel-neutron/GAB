// The two rules of the local compose file that a quiet edit can break: a port that leaves the
// loopback address, and an image that a later pull can change. The checker reads text and opens
// no socket, so it runs on every machine and needs no Docker.

import { parse } from 'yaml';

const LOOPBACK_PREFIX = '127.0.0.1:';

// A tag after the last slash of the name, or a digest. A variable in the tag is not pinned,
// because the value of the variable is outside the file.
const hasPinnedTag = (image: string): boolean => {
  if (image.includes('${')) return false;
  if (image.includes('@sha256:')) return true;
  const lastPart = image.slice(image.lastIndexOf('/') + 1);
  const colon = lastPart.indexOf(':');
  if (colon === -1) return false;
  const tag = lastPart.slice(colon + 1);
  return tag !== '' && tag !== 'latest';
};

const portText = (port: unknown): string => {
  if (typeof port === 'string') return port;
  if (typeof port === 'object' && port !== null && 'host_ip' in port)
    return `${String(port.host_ip)}:`;
  return String(port);
};

const servicesOf = (text: string): Record<string, Record<string, unknown>> => {
  const document: unknown = parse(text);
  return typeof document === 'object' && document !== null && 'services' in document
    ? (document.services as Record<string, Record<string, unknown>>)
    : {};
};

/** Every violation of the loopback rule and the pin rule, over all services of the file. */
export const composeViolations = (text: string): string[] => {
  const violations: string[] = [];

  for (const [name, service] of Object.entries(servicesOf(text))) {
    const image = service['image'];
    if (typeof image !== 'string' || !hasPinnedTag(image))
      violations.push(`${name}: the image has no pinned tag (${String(image)})`);

    const ports = service['ports'];
    for (const port of Array.isArray(ports) ? ports : [])
      if (!portText(port).startsWith(LOOPBACK_PREFIX))
        violations.push(`${name}: the port ${portText(port)} is not bound to 127.0.0.1`);
  }
  return violations;
};

/** The names of the services of the file. */
export const composeServiceNames = (text: string): string[] => Object.keys(servicesOf(text));
