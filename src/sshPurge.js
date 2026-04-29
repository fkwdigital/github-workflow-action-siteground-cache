const { spawn } = require('child_process');

/**
 * Build the WP-CLI command(s) to run on the remote server based on cache type.
 *
 * - all: SG Optimizer dynamic purge + WP object cache flush (memcached)
 * - dynamic: SG Optimizer dynamic purge only (NGINX-level page cache)
 * - memcached: WP object cache flush only
 *
 * The --path flag pins WP-CLI to the WordPress install regardless of cwd.
 *
 * @since 1.0.0
 * @param {string} cacheType - 'all', 'dynamic', or 'memcached'
 * @param {string} sitePath  - absolute path to the WordPress install on the remote
 * @returns {string} shell command to run remotely
 */
function buildWpCommand(cacheType, sitePath) {
  const pathArg = `--path=${JSON.stringify(sitePath)}`;
  switch (cacheType) {
    case 'dynamic':
      return `wp sg purge ${pathArg}`;
    case 'memcached':
      return `wp cache flush ${pathArg}`;
    case 'all':
    default:
      return `wp sg purge ${pathArg} && wp cache flush ${pathArg}`;
  }
}

/**
 * Run the cache-purge command on the remote SiteGround host over SSH.
 * Uses spawn (no shell on the local side) so the key path and host are not
 * subject to shell interpretation. The remote command is run by the remote
 * shell, but its inputs are operator-controlled (cacheType is whitelisted,
 * sitePath is JSON-quoted).
 *
 * @since 1.0.0
 * @param {object} cfg     - configuration object from getInputs()
 * @param {string} keyPath - absolute path to the (unlocked) private key
 * @returns {Promise<void>}
 */
function runRemotePurge(cfg, keyPath) {
  return new Promise((resolve, reject) => {
    const remoteCmd = buildWpCommand(cfg.cacheType, cfg.sitePath);
    const strictHostChecking = cfg.knownHosts ? 'yes' : 'no';

    const args = [
      '-i', keyPath,
      '-p', String(cfg.port),
      '-o', `StrictHostKeyChecking=${strictHostChecking}`,
      '-o', 'BatchMode=yes',
      `${cfg.user}@${cfg.host}`,
      remoteCmd
    ];

    console.log(`[ssh] Connecting to ${cfg.user}@${cfg.host}:${cfg.port}`);
    console.log(`[ssh] Remote command: ${remoteCmd}`);

    const proc = spawn('ssh', args);

    proc.stdout.on('data', (d) => {
      process.stdout.write(d);
    });
    proc.stderr.on('data', (d) => {
      process.stderr.write(d);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh exited with code ${code}`));
        return;
      }
      console.log(`✅ [SiteGround] ${cfg.cacheType} cache purge completed`);
      resolve();
    });
  });
}

module.exports = {
  buildWpCommand,
  runRemotePurge
};
