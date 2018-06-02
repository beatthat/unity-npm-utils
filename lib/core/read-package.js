const fs = require('fs-extra');
const path = require('path');

/**
 * Read the package.json for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 * @param {string} opts.file_name abs path to the package root.
 * @returns {Object} package json
 */
const readPackage = async (pkgRoot, opts) => {
    opts = opts || {}
    const fileName = opts.file_name || 'package.json'
    const jsonPath = path.join(pkgRoot, fileName)
    const content = await fs.readFile(jsonPath)
    return JSON.parse(content);
}

module.exports = readPackage;
