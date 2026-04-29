const fs = require('fs');

const { getInputs, assertRequired } = require('./inputs');
const { addSshKey, writeKnownHosts, removePassphrase } = require('./ssh');
const { runRemotePurge } = require('./sshPurge');
const { purgeViaApi } = require('./apiPurge');

// path to the written key file — set in main(), scrubbed on exit
let deployKeyPath = null;

/**
 * Delete the private key file on process exit.
 *
 * @since 1.0.0
 * @returns {void}
 */
function cleanup() {
  if (deployKeyPath) {
    try {
      fs.unlinkSync(deployKeyPath);
    } catch (e) {
      /* already gone */
    }
  }
}
process.on('exit', cleanup);

/**
 * Main entry point.
 *
 * Dispatches to either SSH+WP-CLI mode (default, shared hosting) or the
 * Site Tools API (agency-tier) based on the MODE input.
 *
 * @since 1.0.0
 * @returns {Promise<void>}
 */
async function main() {
  try {
    const cfg = getInputs();
    assertRequired(cfg);

    console.log(`[SiteGround] Mode: ${cfg.mode}`);
    console.log(`[SiteGround] Cache type: ${cfg.cacheType}`);

    if (cfg.mode === 'ssh') {
      const keyPath = addSshKey(cfg.key, 'siteground_cache_key');
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
    } else {
      await purgeViaApi(cfg);
    }

    process.exit(0);
  } catch (error) {
    console.error('⚠️  [SiteGround] Error:', error.message);
    process.exit(1);
  }
}

main();
