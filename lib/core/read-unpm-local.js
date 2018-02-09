const fs = require('fs-extra-promise');
const path = require('path');

/**
 * Read a unity project's unpm-local.json back to a json Object
 * given the path to the root of the unity project.
 *
 * @param {string} projRoot abs path to the unity project root.
 * @returns {Object} json read from unpm-local.json
 */
const readUnpmLocal = async (pkgRoot) => {
    const jsonPath = path.join(pkgRoot, 'unpm-local.json');
    const content = await fs.readFileAsync(jsonPath)
    return JSON.parse(content);
}

module.exports = readUnpmLocal;
