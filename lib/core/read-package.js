const fs = require('fs-extra-promise');
const path = require('path');

/**
 * Read the package.json for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 * @returns {Object} package json
 */
const readPackage = async (pkgRoot) => {
    const jsonPath = path.join(pkgRoot, 'package.json');
    const content = await fs.readFileAsync(jsonPath)
    return JSON.parse(content);
}

module.exports = readPackage;
