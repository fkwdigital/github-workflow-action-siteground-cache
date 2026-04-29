const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Ensure a directory exists, creating it (recursively) if not.
 *
 * @since 1.0.0
 * @param {string} dir - absolute directory path
 * @returns {void}
 */
function validateDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Ensure a file exists, creating an empty one with mode 0600 if not.
 *
 * @since 1.0.0
 * @param {string} filePath - absolute file path
 * @returns {void}
 */
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', { encoding: 'utf8', mode: 0o600 });
  }
}

/**
 * Write a private key to ~/.ssh/<name> with mode 0600 and return its path.
 *
 * @since 1.0.0
 * @param {string} key  - raw private key contents
 * @param {string} name - filename to use under ~/.ssh
 * @returns {string} absolute path to the written key file
 */
function addSshKey(key, name) {
  const home = process.env.HOME || os.homedir();
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  validateFile(path.join(sshDir, 'known_hosts'));
  const filePath = path.join(sshDir, name || 'siteground_cache_key');
  fs.writeFileSync(filePath, key, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

/**
 * Append known_hosts content to ~/.ssh/known_hosts so ssh can verify the
 * remote host fingerprint. Obtain via: ssh-keyscan -H -p 18765 <host>
 *
 * @since 1.0.0
 * @param {string} knownHosts - raw known_hosts lines
 * @returns {void}
 */
function writeKnownHosts(knownHosts) {
  const home = process.env.HOME || os.homedir();
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  const knownHostsPath = path.join(sshDir, 'known_hosts');
  const entry = knownHosts.endsWith('\n') ? knownHosts : `${knownHosts}\n`;
  fs.appendFileSync(knownHostsPath, entry, { encoding: 'utf8', mode: 0o600 });
  console.log('[SSH] known_hosts written — strict host key verification enabled');
}

/**
 * Strip the passphrase from a private key file in-place so ssh can use it
 * directly with -i. Uses spawn to avoid shell injection with special characters.
 *
 * @since 1.0.0
 * @param {string} keyPath    - absolute path to the private key file
 * @param {string} passphrase - current passphrase protecting the key
 * @returns {Promise<void>}
 */
function removePassphrase(keyPath, passphrase) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ssh-keygen', ['-p', '-P', passphrase, '-N', '', '-f', keyPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh-keygen failed (exit ${code}): ${stderr}`));
        return;
      }
      console.log('[SSH] Key unlocked for cache purge');
      resolve();
    });
  });
}

module.exports = {
  addSshKey,
  writeKnownHosts,
  removePassphrase,
  validateDir,
  validateFile
};
