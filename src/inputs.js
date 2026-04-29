const VALID_MODES = ['ssh', 'api'];
const VALID_CACHE_TYPES = ['all', 'dynamic', 'memcached'];

/**
 * Read an input value from the environment.
 * Looks for the bare key first, then `INPUT_<key>` (the convention GitHub Actions uses).
 *
 * @since 1.0.0
 * @param {string} key      - environment variable name
 * @param {string} fallback - value to return if the key is unset or empty
 * @returns {string}
 */
function fromEnv(key, fallback = '') {
  const has = Object.prototype.hasOwnProperty.call(process.env, key);
  const v = has ? process.env[key] : process.env[`INPUT_${key}`];
  return v === undefined || v === null || v === '' ? fallback : v;
}

/**
 * Build the configuration object from action inputs.
 *
 * @since 1.0.0
 * @returns {object}
 */
function getInputs() {
  return {
    mode: fromEnv('MODE', 'ssh').toLowerCase(),
    cacheType: fromEnv('CACHE_TYPE', 'all').toLowerCase(),

    // ssh mode
    key: fromEnv('SSH_PRIVATE_KEY'),
    passphrase: fromEnv('SSH_PASSPHRASE', ''),
    knownHosts: fromEnv('KNOWN_HOSTS', ''),
    host: fromEnv('REMOTE_HOST'),
    user: fromEnv('REMOTE_USER'),
    port: fromEnv('REMOTE_PORT', '18765'),
    sitePath: fromEnv('REMOTE_PATH'),

    // api mode
    apiToken: fromEnv('SITEGROUND_API_TOKEN'),
    siteId: fromEnv('SITEGROUND_SITE_ID'),
    apiBase: fromEnv('SITEGROUND_API_BASE', 'https://api.siteground.com/v00')
  };
}

/**
 * Validate inputs for the selected mode. Throws if anything required is missing.
 *
 * @since 1.0.0
 * @param {object} cfg - configuration object from getInputs()
 * @returns {void}
 */
function assertRequired(cfg) {
  if (!VALID_MODES.includes(cfg.mode)) {
    throw new Error(`Invalid MODE '${cfg.mode}'. Must be one of: ${VALID_MODES.join(', ')}`);
  }

  if (!VALID_CACHE_TYPES.includes(cfg.cacheType)) {
    throw new Error(`Invalid CACHE_TYPE '${cfg.cacheType}'. Must be one of: ${VALID_CACHE_TYPES.join(', ')}`);
  }

  const missing = [];

  if (cfg.mode === 'ssh') {
    if (!cfg.key) missing.push('SSH_PRIVATE_KEY');
    if (!cfg.host) missing.push('REMOTE_HOST');
    if (!cfg.user) missing.push('REMOTE_USER');
    if (!cfg.sitePath) missing.push('REMOTE_PATH');
  } else if (cfg.mode === 'api') {
    if (!cfg.apiToken) missing.push('SITEGROUND_API_TOKEN');
    if (!cfg.siteId) missing.push('SITEGROUND_SITE_ID');
  }

  if (missing.length) {
    throw new Error(`Missing required inputs for MODE=${cfg.mode}: ${missing.join(', ')}`);
  }
}

module.exports = {
  getInputs,
  assertRequired,
  VALID_MODES,
  VALID_CACHE_TYPES
};
