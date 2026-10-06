const { getInputs, assertRequired } = require('./inputs');
const { addSshKey, removeSshKey, writeKnownHosts, removePassphrase } = require('./ssh');
const { runRemotePurge } = require('./sshPurge');
const { purgeViaApi } = require('./apiPurge');

// path to the written key file — set in purgeViaSsh(), removed on exit
let deployKeyPath = null;
process.on('exit', () => removeSshKey(deployKeyPath));

/**
 * Purge caches over SSH + WP-CLI: write the key and known_hosts, unlock the key, run the purge.
 *
 * @since 1.1.0
 * @param {object} cfg - configuration object from getInputs()
 * @returns {Promise<void>}
 */
async function purgeViaSsh(cfg) {
  const keyPath = addSshKey(cfg.key, cfg.keyName);
  deployKeyPath = keyPath;

  if (cfg.knownHosts) {
    writeKnownHosts(cfg.knownHosts);
  } else {
    console.warn(
      '⚠️  [SSH] KNOWN_HOSTS is not set — host key verification is disabled.'
        + ' Set KNOWN_HOSTS (via ssh-keyscan -H -p 18765 <host>) to protect against MITM attacks.'
    );
  }

  if (cfg.passphrase) {
    await removePassphrase(keyPath, cfg.passphrase);
  }

  await runRemotePurge(cfg, keyPath);
}

/**
 * Dispatch to SSH+WP-CLI mode (default, shared hosting) or the Site Tools API (agency-tier) based on MODE.
 *
 * @since 1.0.0
 * @returns {Promise<void>}
 */
async function main() {
  const cfg = getInputs();
  assertRequired(cfg);

  console.log(`[SiteGround] Mode: ${cfg.mode}`);
  console.log(`[SiteGround] Cache type: ${cfg.cacheType}`);

  if (cfg.mode === 'ssh') {
    await purgeViaSsh(cfg);
  } else {
    await purgeViaApi(cfg);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('⚠️  [SiteGround] Error:', error.message);
    process.exit(1);
  });
