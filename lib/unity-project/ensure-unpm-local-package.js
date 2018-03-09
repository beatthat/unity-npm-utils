const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path

const readUnpmLocal = require('./read-unpm-local')
const installPackageToUnity = require('./install-package-to-unity')

/**
 * Ensure that the unpm-local.json file for a unity project
 * includes some package.
 * If it does not, attempt to copy the package info from node_modules.
 * In either successful case, return the package info.
 * If the package isn't installed, throws an Error

 * @param {string} pkgName the name of the package we're ensuring is in unpm-local
 * @param {bool} opts.disable_ensure_installed_to_unity - by default, will check whether this package was installed to unity and run the install if it was not
 * @returns {Object} json read from unpm-local.json
 */
const ensureUnpmLocalPackage = async (pkgName, opts) => {

    opts = opts || {}

    const info = {}

    const projRoot = opts.project_root = opts.project_root|| appRoot

    if (opts.verbose) {
        console.log('cloneOrPullPackage projRoot=%j, opts=%j', projRoot, opts)
    }

    var unpmLocal = await readUnpmLocal(projRoot)
    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        await writePackageInfoToUnpmLocal(pkgName, {...opts, project_root: projRoot })
        unpmLocal = await readUnpmLocal(projRoot)
    }

    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        throw new Error(`package ${pkgName} is not installed in project ${projRoot}`)
    }

    if(!opts.disable_ensure_installed_to_unity && !unpmLocal.packages[pkgName].unity_install) {
        const installResult = await installPackageToUnity(pkgName, opts)
        unpmLocal = installResult.unpmLocal
    }

    return unpmLocal.packages[pkgName]
}

module.exports = ensureUnpmLocalPackage
