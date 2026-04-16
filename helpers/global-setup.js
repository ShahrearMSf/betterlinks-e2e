/**
 * Runs once before all tests. Sweeps any leftover test data from previous runs
 * (safe: only deletes slugs/names matching known test prefixes).
 */
const { sweep } = require('./cleanup');

module.exports = async () => {
  console.log('[globalSetup] pre-run cleanup starting...');
  const r = await sweep({ verbose: true });
  console.log('[globalSetup] pre-run cleanup done:', r);
};
