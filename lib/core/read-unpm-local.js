const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path

/**
 * Read a unity project's unpm-local.json back to a json Object
 * given the path to the root of the unity project.
 *
 * @param {string} projRoot abs path to the unity project root.
 * @returns {Object} json read from unpm-local.json
 */
const readUnpmLocal = async (projRoot) => {
    projRoot = projRoot || appRoot
    const unpmLocalPath = path.join(projRoot, 'unpm-local.json')
    if(!await fs.existsAsync(unpmLocalPath)) {
        return {
            packages: {}
        }
    }
    const content = await fs.readFileAsync(unpmLocalPath)
    return JSON.parse(content)
}

module.exports = readUnpmLocal
