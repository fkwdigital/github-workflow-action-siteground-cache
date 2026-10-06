const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const { validateDir, validateFile } = require('./helpers');

/**
 * Write a private key into ~/.ssh with 0600 permissions and make sure known_hosts exists.
 *
 * @since 1.0.0
 * @param {string} key    - raw private key contents
 * @param {string} [name] - key file name inside ~/.ssh
 * @param {string} [home] - home directory to use
 * @returns {string} absolute path to the written key file
 */
function addSshKey(key, name = 'siteground_cache_key', home = process.env.HOME || os.homedir()) {
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  validateFile(path.join(sshDir, 'known_hosts'));

  // openssh rejects keys with crlf endings or no trailing newline, which pasted secrets often have
  const normalized = `${key.replace(/\r\n?/g, '\n').trim()}\n`;
  const filePath = path.join(sshDir, name);
  fs.writeFileSync(filePath, normalized, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

/**
 * Delete a private key file, ignoring a key that is already gone.
 *
 * @since 1.1.0
 * @param {string|null} filePath - absolute path to the key file
 * @returns {void}
 */
function removeSshKey(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    // already gone
  }
}

/**
 * Append known_hosts content to ~/.ssh/known_hosts so ssh can verify the
 * remote host fingerprint. Obtain via: ssh-keyscan -H -p 18765 <host>
 *
 * @since 1.0.0
 * @param {string} knownHosts - raw known_hosts lines
 * @param {string} [home]     - home directory to use
 * @returns {void}
 */
function writeKnownHosts(knownHosts, home = process.env.HOME || os.homedir()) {
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  const entry = `${knownHosts.replace(/\r\n?/g, '\n').trim()}\n`;
  fs.appendFileSync(path.join(sshDir, 'known_hosts'), entry, { encoding: 'utf8', mode: 0o600 });
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
    proc.on('error', reject);
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
  removeSshKey,
  writeKnownHosts,
  removePassphrase
};
