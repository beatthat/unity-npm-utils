const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path

/**
 * Read a unity project's unpm-packages.json back to a json Object
 * given the path to the root of the unity project.
 *
 * @param {string} projRoot abs path to the unity project root.
 * @returns {Object} json read from unpm-packages.json
 */
const readUnpmPackages = async (projRoot) => {
    projRoot = projRoot || appRoot
    const unpmPackagesPath = path.join(projRoot, 'unpm-packages.json')
    if(!await fs.existsAsync(unpmPackagesPath)) {
        return {
            packages: {}
        }
    }
    const content = await fs.readFileAsync(unpmPackagesPath)
    return JSON.parse(content)
}

module.exports = readUnpmPackages
