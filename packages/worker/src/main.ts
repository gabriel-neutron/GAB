// A CLAIM CANNOT BE UNDONE. claim_job moves a row to `running`, no door moves one back, and the
// work behind the ingestion seam is not built, so a run of the loop would take one job out of
// the queue for ever and give nothing for it. This entry point therefore claims nothing.
const NO_WORK = [
  'The worker claims nothing today.',
  'The work behind the ingestion door is not built, and a claim is never released:',
  'one run would take one job out of the queue for ever.',
  'The claim loop stands beside this file, and it starts on the day that work exists.',
].join(' ');

console.error(NO_WORK);
process.exitCode = 1;
