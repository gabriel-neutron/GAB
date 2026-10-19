/** The readable name of an attribute key, by the fixed rule of the labels: each underscore
 * becomes a space, and the first letter becomes a capital. */
export const attributeName = (key: string): string => {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
