const NO_WORK = [
  'The worker claims nothing today.',
  'The work behind the ingestion door is not built, so a claim would take a job',
  'and give nothing for it.',
].join(' ');

console.error(NO_WORK);
process.exitCode = 1;
