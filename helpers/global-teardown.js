/**
 * Runs once after all tests complete (including failures). Sweeps any
 * test data to keep the live site clean.
 */
const { sweep } = require('./cleanup');

module.exports = async () => {
  console.log('[globalTeardown] post-run cleanup starting...');
  const r = await sweep({ verbose: true });
  console.log('[globalTeardown] post-run cleanup done:', r);
};
