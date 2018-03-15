const fs = require('fs-extra-promise');
const path = require('path');

/**
 * Read the a json file
 *
 * @param {string} pkgRoot abs path to the package root.
 * @param {string} opts.file_name abs path to the package root.
 * @returns {Object} package json
 */
const readJson = async (pathRoot, opts) => {
    opts = opts || {}
    const fileName = opts.file_name || 'package.json'
    const jsonPath = path.join(pathRoot, fileName)

    if(!await fs.existsAsync(jsonPath)) {
        return null
    }
    
    const content = await fs.readFileAsync(jsonPath)
    return JSON.parse(content);
}

module.exports = readJson;
