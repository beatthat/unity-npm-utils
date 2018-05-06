const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path

const readUnpmPackages = require('./read-unpm-local')
const writePackageInfoToUnpmPackages = require('./write-package-info-to-unpm-packages')
const installPackageToUnity = require('./install-package-to-unity')

/**
 * Ensure that the unpm-packages.json file for a unity project
 * includes some package.
 * If it does not, attempt to copy the package info from node_modules.
 * In either successful case, return the package info.
 * If the package isn't installed, throws an Error

 * @param {string} pkgName the name of the package we're ensuring is in unpm-local
 * @param {bool} opts.disable_ensure_installed_to_unity - by default, will check whether this package was installed to unity and run the install if it was not
 * @returns {Object} json read from unpm-local.json
 */
const ensureUnpmPackage = async (pkgName, opts) => {

    opts = opts || {}

    const info = {}

    const projRoot = opts.project_root = opts.project_root|| appRoot

    if (opts.verbose) {
        console.log('ensureUnpmPackage projRoot=%j, opts=%j', projRoot, opts)
    }

    var unpmPkgs = await readUnpmPackages(projRoot)

    if (opts.verbose) {
        console.log('ensureUnpmPackage after read unpm-packages...')
    }

    if(!(unpmPkgs && unpmPkgs.packages && unpmPkgs.packages[pkgName])) {
        if (opts.verbose) {
            console.log('ensureUnpmPackage must writePackageInfoToUnpmPackages...')
        }
        await writePackageInfoToUnpmPackages(pkgName, {...opts, project_root: projRoot })

        if (opts.verbose) {
            console.log('ensureUnpmPackage will readUnpmPackages AGAIN...')
        }
        unpmPkgs = await readUnpmPackages(projRoot)
    }

    if(!(unpmPkgs && unpmPkgs.packages && unpmPkgs.packages[pkgName])) {
        if (opts.verbose) {
            console.log('ensureUnpmPackage will throw error...')
        }
        throw new Error(`package ${pkgName} is not installed in project ${projRoot}`)
    }

    if(!opts.disable_ensure_installed_to_unity && !unpmPkgs.packages[pkgName].unity_install) {
        if (opts.verbose) {
            console.log('ensureUnpmPackage will installPackageToUnity...')
        }
        const installResult = await installPackageToUnity(pkgName, opts)
        unpmPkgs = installResult.unpmLocal
    }

    if (opts.verbose) {
        console.log(`ensureUnpmPackage final unpmlocal=${JSON.stringify(unpmPkgs, null, 2)}`)
    }

    return unpmPkgs.packages[pkgName]
}

module.exports = ensureUnpmLocalPackage
