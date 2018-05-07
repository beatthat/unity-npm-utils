const fs = require('fs-extra-promise')

const path = require('path')
const appRoot = require('app-root-path').path
const readUnpmPackages = require('./read-unpm-packages')

const _transformStringProperties = require('./_transform-string-properties')

/**
 * Find repoistory info for a package in a unity project.
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
 *        }
 *      }
 *    }
 * }
 *
 * So if the repo info for a requested package
 * isn't explicitly written to unpm-packages.json,
 * but the 'scope' is known *and* template details have been written for that scope,
 * then unpm can use the templates to provide 'guessed' repo info.
 *
 * One scenario for guessing is taking a package that is installed
 * to unity and adding it to the user's own github.
 * Usually all your packages belong to a common scope
 * and are installed to unity under a common path, e.g.
 *
 * /Assets/Plugins/packages/${scope-name}
 *
 * The package_install_path info above can be passed in opts and used to get scope
 *
 * @param {string} packageName name of the package
 *
 * @param {string} opts.package_install_path path where the package
 *    is already installed in Unity. Can be used to determine 'scope'
 *
 * @returns {Object} json read from unpm-local.json
 *    that include repo type and url (if found or guessed)
 */
const findRepoInfoForPackage = async (packageName, opts) => {
    opts = opts || {}

    const projRoot = opts.project_root || appRoot

    const unpmPkgs = await readUnpmPackages(projRoot)

    if(opts.verbose) {
      // console.log(`read unpm-packages from ${projRoot} as ${JSON.stringify(unpmPkgs, null, 2)}`)
    }

    if(unpmPkgs && unpmPkgs.packages && unpmPkgs[packageName] && unpmPkgs[packageName].repository) {
      return unpmPkgs[packageName].repository
    }

    if(!unpmPkgs.scopes) {
      return null
    }

    var scope = undefined

    if(opts.package_install_path) {
      const parts = opts.package_install_path.split(path.sep)

      if(parts.length >= 2) {
        scope = parts[parts.length - 2] // TODO: have an optional regex in unpm-packages.json for each scope?

        if(opts.verbose) {
          console.log(`findRepoInfoForPackage scope determined as ${scope} from package_install_path ${opts.package_install_path}`)
        }
      }
      else {
        if(opts.verbose) {
          console.log(`findRepoInfoForPackage cannot parse scope from package_install_path ${opts.package_install_path}`)
        }
      }
    }

    if(!scope && unpmPkgs.scopes) {

        const scopesByName = _transformStringProperties(
            unpmPkgs.scopes,
            (s) => s.replace('{package_name}', packageName)
        )

        const scopeNames = Object.getOwnPropertyNames(scopesByName)

        for(var i = 0; i < scopeNames.length; i++) {
            const scopeName = scopeNames[i]
            console.log('unpmPkgs.scopes[%j]=%j', scopeName, scopesByName[scopeName])
            if(!(scopesByName[scopeName].install && scopesByName[scopeName].install.path)) {
                continue
            }

            if(await fs.existsAsync(path.join(projRoot, scopesByName[scopeName].install.path))) {
                scope = scopeName
                break
            }
        }
    }

    if(!scope) {
      if(opts.verbose) {
        console.log(`findRepoInfoForPackage no scope info, returning null`)
      }
      return null
    }

    const scopeInfo = unpmPkgs.scopes[scope]

    if(!(scopeInfo && scopeInfo.repository)) {
      if(opts.verbose) {
        console.log(`findRepoInfoForPackage no scope info for '${scope}', returning null`)
      }
      return null
    }

    const result = _transformStringProperties(scopeInfo.repository,
      (s) => s.replace('{package_name}', packageName))

    if(opts.verbose) {
      console.log(`findRepoInfoForPackage result='${JSON.stringify(result, null, 2)}`)
    }

    return result
}

module.exports = findRepoInfoForPackage
