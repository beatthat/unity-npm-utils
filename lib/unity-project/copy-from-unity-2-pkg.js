const fs = require('fs-extra-promise')
const path = require('path')
const promisify = require("es6-promisify")
const rimraf = require('rimraf')
const rimrafAsync = promisify(rimraf)
const appRoot = require('app-root-path').path

const readPackage = require('../core/read-package')
const _infoForPkg = require('../core/_info-for-pkg')

const ensureUnpmLocalPackage = require('./ensure-unpm-local-package')
const readUnpmLocal = require('./read-unpm-local')

const ensureUnpmPackage = require('./ensure-unpm-package')
const readUnpmPackages = require('./read-unpm-packages')


/**
 * Copy the (editted) source of a module from a unity project
 * to a package source folder.
 *
 * This enables editting packages in a unity project context and then
 * syncing the source from unity back to the package to commit changes.
 *
 * @param {string} pkgName
 *      The name of the package
 *      which by convention should be both the package.json name and
 *      directory name where the package is installed under unity Assets.
 *
 * @param {Object} opts - js object of opts
 *
 * @param {string} opts.package_scope
 *      scope, when defined, specifies an intermediate directory
 *      where a (group of) package[s] will be installed in unity.
 *
 *      For example, if scope is 'all-my-pkgs', then the pkg source will be
 *      installed in (unity)/Assets/Plugins/all-my-pkgs/my-pkg-1.
 *
 *      Normally scope property should be defined in the pkg's package.json
 *      as config.scope, but this option allows that value to be overridden.
 *
 * @param {bool} opts.install_outside_plugins
 *      If set to true, package is installed under (unity)/Assets
 *      instead of the default root, (unity)/Assets/Plugins.
 *      Generally it's better to install packages in plugins,
 *      but if a package has any dependencies to another package that installs
 *      outside of plugins (as do many Unity Asset Store packages)
 *      then the the package can't live in Plugins.
 *
 * @param {string} opts.package_target_path
 *      If set, then the target/copy-to package is at this absolute path.
 *
 *      By default will assume the path is
 *      ${unityProjectRoot}/node_modules/${pkgName}
 *
 * @param {regex|function(filename)} opts.filter - passed to ncp
 *      a RegExp instance, against which each file name is tested
 *      to determine whether to copy it or not,
 *      or a function taking single parameter:
 *      copied file name, returning true or false,
 *      determining whether to copy file or not.
 *
 *      If nothing is passed defaults to /^[^.]+$|\.(?!(meta)$)([^.]+$)/
 *
 * @param {bool} opts.overwrite -
 *      if TRUE, deletes the existing contents of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 *
 * @param {function(err, info)} callback
 */
const copyFromUnity2Pkg = async (pkgName, opts) => {

    opts = opts || {};

    opts.verbose = true

    if (opts.verbose) {
        console.log(`copyFromUnity2Pkg(${pkgName}) opts=:\n ${JSON.stringify(opts, null, 2)}`)
    }

    opts.project_root = opts.project_root || appRoot


    var unitySrc = opts.unity_install_path;
    var pkgTgtSrc = opts.package_target_path //|| path.join(pkgEntry.clone.path, 'Runtime');

    if(!(unitySrc && pkgTgtSrc)) {
        const localPkgEntry = await ensureUnpmLocalPackage(pkgName, opts)
        const pkgEntry = await ensureUnpmPackage(pkgName, opts)

        if (opts.verbose) {
            console.log(`copyFromUnity2Pkg(${pkgName}) read unpm-local package entry:\n ${JSON.stringify(localPkgEntry, null, 2)}`)
            console.log(`copyFromUnity2Pkg(${pkgName}) read unpm-packages entry:\n ${JSON.stringify(pkgEntry, null, 2)}`)
        }

        unitySrc = unitySrc || pkgEntry.unity_install.path
        pkgTgtSrc = pkgTgtSrc || path.join(pkgEntry.clone.path, 'Runtime')
    }

    const copy = async () => {

        if (opts.verbose) {
            console.log(`will copy from ${unitySrc} to ${pkgTgtSrc} with opts ${JSON.stringify(opts)}`)
        }

        await fs.copyAsync(unitySrc, pkgTgtSrc, {
            filter: opts.filter ? opts.filter : (src, dst) => {
                return String(src).match(/^[^.]+$|\.(?!(meta)$)([^.]+$)/)
            },
            overwrite: opts.no_clobber ? false : true
        })

        return {
            unpmLocal: await readUnpmLocal(opts.project_root),
            unpmPackages: await readUnpmPackages(opts.project_root)
        }
    }

    if (opts.overwrite) {
        if (opts.verbose) {
            console.log(`copyFromUnity2Pkg(${pkgName}) DELETING TARGET SRC (because overwrite option is set)`)
        }

        const pkgTgtDel = path.join(pkgTgtSrc, '*');

        if (opts.verbose) {
            console.log(`option 'overwrite' is set. deleting  ${pkgTgtDel}...`)
        }

        await rimrafAsync(pkgTgtDel)

        return await copy()

    } else {
        return await copy()
    }
}


module.exports = copyFromUnity2Pkg;
