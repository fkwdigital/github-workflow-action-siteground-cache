const fs = require('fs');

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
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', { encoding: 'utf8', mode: 0o600 });
}

module.exports = {
  validateDir,
  validateFile
};
