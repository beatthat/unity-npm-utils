const fs = require('fs-extra')

const path = require('path')
const appRoot = require('app-root-path').path
const readUnpmPackages = require('./read-unpm-packages')

const _transformStringProperties = require('./_transform-string-properties')

/**
 * Find unity path for a package in a unity project.
 * This may be known (written explicitly to unpm-packages.json)
 * or it may be guessed using details about 'scopes'
 * stored elsewhere in unpm-packages.json.
 *
 * When guessing info by scope, we use a details from a 'scopes' element
 * inside unpm-packages.json that contains template info about various scopes,
 * written by the user.
 *
 * {
 *    scopes: {
 *      ape: {
 *        repo: {
 *          type: 'git'
 *          url_template: 'git+https://github.com/beatthat/{package_name}.git'
 *        },
 *          install: { path: 'Assets/Plugins/packages/beatthat/{package_name}' }
 *      }
 *    }
 * }
 *
 * So if the unity path for a requested package
 * isn't explicitly written to unpm-packages.json,
 * but the 'scope' is known *and* template details have been written for that scope,
 * then unpm can use the templates to provide 'guessed' repo info.
 *
 * @param {string} packageName name of the package
 *
 * @returns {string} the unity path (or null)
 */
const findUnityPathForPackage = async (packageName, opts) => {
    opts = opts || {}

    const projRoot = opts.project_root || appRoot

    const unpmPkgs = await readUnpmPackages(projRoot)

    if(opts.verbose) {
      // console.log(`read unpm-packages from ${projRoot} as ${JSON.stringify(unpmPkgs, null, 2)}`)
    }

    if(unpmPkgs && unpmPkgs.packages && unpmPkgs[packageName] && unpmPkgs[packageName].unity_install_path) {
      return path.resolve(projRoot, unpmPkgs[packageName].unity_install_path)
    }

    if(!unpmPkgs.scopes) {
      return null
    }

    var scope = undefined

    if(!scope && unpmPkgs.scopes) {

        const scopesByName = _transformStringProperties(
            unpmPkgs.scopes,
            (s) => s.replace('{package_name}', packageName)
        )

        const scopeNames = Object.getOwnPropertyNames(scopesByName)

        for(var i = 0; i < scopeNames.length; i++) {
            const scopeName = scopeNames[i]

            if(!(scopesByName[scopeName].install && scopesByName[scopeName].install.path)) {
                continue
            }

            if(await fs.exists(path.join(projRoot, scopesByName[scopeName].install.path))) {
                return path.join(projRoot, scopesByName[scopeName].install.path)
            }
        }
    }

    if(opts.verbose) {
        console.log(`findUnityPathForPackage no scope info, returning null`)
    }

    return null
}

module.exports = findUnityPathForPackage
