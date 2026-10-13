/** The share of an ownership link in words. A relation holds the share in percent under
 * `share_pct`. GEM marks a share that it estimated with its "share imputed" flag, which the load
 * keeps under `share_imputed`. */

/** The key of the share in percent, on a relation. */
export const SHARE_KEY = 'share_pct';

/** The key of the GEM flag that says that GEM estimated the share. */
export const SHARE_IMPUTED_KEY = 'share_imputed';

/** The words that mark a share that GEM estimated. A reader never reads an estimate as a
 * published fact. */
export const ESTIMATED_BY_GEM = 'estimated by GEM';

type HeldAttrs = Readonly<Record<string, { readonly v: unknown } | undefined>>;

/** The share of a relation in words, for example "share 40.4%" or "share 40.4%, estimated by
 * GEM". Null when the relation holds no share. */
export const shareWords = (attrs: HeldAttrs): string | null => {
  const share = attrs[SHARE_KEY]?.v;
  const estimated = attrs[SHARE_IMPUTED_KEY]?.v === true;
  const amount = typeof share === 'number' && Number.isFinite(share) ? `${String(share)}%` : null;
  if (amount === null) return estimated ? `share ${ESTIMATED_BY_GEM}` : null;
  return estimated ? `share ${amount}, ${ESTIMATED_BY_GEM}` : `share ${amount}`;
};
