/** True when a script holds the psql meta-command \c, \connect or \! anywhere. */
export const hasRefusedMetaCommand = (script: string): boolean =>
  /\\(?:c(?:onnect)?(?!\w)|!)/u.test(script);
