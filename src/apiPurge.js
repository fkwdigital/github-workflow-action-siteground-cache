/**
 * Map a CACHE_TYPE value to the Site Tools API resource segment(s) to purge.
 *
 * @since 1.0.0
 * @param {string} cacheType - 'all', 'dynamic', or 'memcached'
 * @returns {string[]} list of resource segments (e.g. ['dynamic-cache', 'memcached'])
 */
function resourcesForCacheType(cacheType) {
  switch (cacheType) {
    case 'dynamic':
      return ['dynamic-cache'];
    case 'memcached':
      return ['memcached'];
    case 'all':
    default:
      return ['dynamic-cache', 'memcached'];
  }
}

/**
 * Purge a single cache resource via the Site Tools API.
 *
 * NOTE: The exact endpoint structure is set up to match SiteGround's documented
 * Site Tools API pattern (api.siteground.com/v00). If your agency-tier endpoints
 * differ, override SITEGROUND_API_BASE or fork this function — the rest of the
 * action does not assume any specific request shape.
 *
 * @since 1.0.0
 * @param {string} apiBase  - API base URL (no trailing slash)
 * @param {string} token    - bearer token
 * @param {string} siteId   - Site Tools site ID
 * @param {string} resource - cache resource segment (e.g. 'dynamic-cache')
 * @returns {Promise<void>}
 */
async function purgeOne(apiBase, token, siteId, resource) {
  const url = `${apiBase}/sites/${encodeURIComponent(siteId)}/${resource}/flush`;
  console.log(`[api] POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    body = { raw: text };
  }

  if (!response.ok) {
    const msg = body.message || body.error || text || `HTTP ${response.status}`;
    throw new Error(`Site Tools API ${resource} flush failed: ${msg}`);
  }

  console.log(`✅ [api] ${resource} flush ok`);
}

/**
 * Purge SiteGround caches via the Site Tools API. Iterates over the resources
 * implied by cacheType. If any one fails, the overall run fails.
 *
 * @since 1.0.0
 * @param {object} cfg - configuration object from getInputs()
 * @returns {Promise<void>}
 */
async function purgeViaApi(cfg) {
  const resources = resourcesForCacheType(cfg.cacheType);
  const base = cfg.apiBase.replace(/\/+$/, '');

  // sequential: SG Site Tools rate-limits, and order is informative in logs
  await resources.reduce(
    (chain, resource) => chain.then(() => purgeOne(base, cfg.apiToken, cfg.siteId, resource)),
    Promise.resolve()
  );

  console.log(`✅ [SiteGround] ${cfg.cacheType} cache purge completed via API`);
}

module.exports = {
  purgeViaApi,
  resourcesForCacheType
};
