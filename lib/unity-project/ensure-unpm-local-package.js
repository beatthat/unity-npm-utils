const fs = require('fs-extra')
const path = require('path')
const appRoot = require('app-root-path').path

const readUnpmLocal = require('./read-unpm-local')
const writePackageInfoToUnpmLocal = require('./write-package-info-to-unpm-local')
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
        console.log('ensureUnpmLocalPackage projRoot=%j, opts=%j', projRoot, opts)
    }

    var unpmLocal = await readUnpmLocal(projRoot)

    if (opts.verbose) {
        console.log('ensureUnpmLocalPackage after read unpmlocal...')
    }

    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        if (opts.verbose) {
            console.log('ensureUnpmLocalPackage must writePackageInfoToUnpmLocal...')
        }
        await writePackageInfoToUnpmLocal(pkgName, {...opts, project_root: projRoot })

        if (opts.verbose) {
            console.log('ensureUnpmLocalPackage will readUnpmLocal AGAIN...')
        }
        unpmLocal = await readUnpmLocal(projRoot)
    }

    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        if (opts.verbose) {
            console.log('ensureUnpmLocalPackage will throw error...')
        }
        throw new Error(`package ${pkgName} is not installed in project ${projRoot}`)
    }

    if(!opts.disable_ensure_installed_to_unity && !unpmLocal.packages[pkgName].unity_install) {
        if (opts.verbose) {
            console.log('ensureUnpmLocalPackage will installPackageToUnity...')
        }
        const installResult = await installPackageToUnity(pkgName, opts)
        unpmLocal = installResult.unpmLocal || await readUnpmLocal(projRoot)
    }

    if (opts.verbose) {
        console.log(`ensureUnpmLocalPackage final unpmlocal=${JSON.stringify(unpmLocal, null, 2)}`)
    }

    return (unpmLocal && unpmLocal.packages)? unpmLocal.packages[pkgName]: null;
}

module.exports = ensureUnpmLocalPackage
