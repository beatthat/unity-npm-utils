const path = require('path');

const _infoForPkg = require('../core/_info-for-pkg')
const readPackage = require('../core/read-package')
const copyFromUnity2Pkg = require('./copy-from-unity-2-pkg')

/**
 * Copy the (editted) source of a module from a unity project
 * to a package source folder.
 *
 * This enables editing packages in a unity project context and then
 * syncing the source from unity back to the package to commit changes.
 *
 * @param {string} unityProjRoot
 *      The absolute path to the root of the unity project
 *      (the directory that contains 'Assets' and the package.json)
 *
 * @param {string} pkgRoot
 *      The root path of the target package we are copying to.
 *
 * @param {Object} options - js object of options
 *
 * @param {string} options.package_scope
 *      scope, when defined, specifies an intermediate directory
 *      where a (group of) package[s] will be installed in unity.
 *
 *      For example, if scope is 'all-my-pkgs', then the pkg source will be
 *      installed in (unity)/Assets/Plugins/all-my-pkgs/my-pkg-1.
 *
 *      Normally scope property should be defined in the pkg's package.json
 *      as config.scope, but this option allows that value to be overridden.
 *
 * @param {bool} options.install_outside_plugins
 *      If set to true, package is installed under (unity)/Assets
 *      instead of the default root, (unity)/Assets/Plugins.
 *      Generally it's better to install packages in plugins,
 *      but if a package has any dependencies to another package that installs
 *      outside of plugins (as do many Unity Asset Store packages)
 *      then the the package can't live in Plugins.
 *
 * @param {regex|function(filename)} options.filter - passed to ncp
 *      a RegExp instance, against which each file name is tested
 *      to determine whether to copy it or not,
 *      or a function taking single parameter:
 *      copied file name, returning true or false,
 *      determining whether to copy file or not.
 *
 *      If nothing is passed defaults to /^[^.]+$|\.(?!(meta)$)([^.]+$)/
 *
 * @param {Boolean} options.overwrite -
 *      if TRUE, deletes the existing contents
 *      of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 *
 * @param {function(err, info)} callback
 */
const copyFromUnity2PkgRoot = async (pkgName, unityProjectRoot, pkgRoot, opts) => {

    opts = opts || {}

    opts.package_root = pkgRoot
    opts.unity_project_root = unityProjectRoot

    if(opts.verbose) {
        console.log(`copyFromUnity2PkgRoot pkgName=${pkgName} unityProjectRoot=${unityProjectRoot} pkgRoot=${pkgRoot}`)
    }

    var info = await _infoForPkg(pkgRoot, opts)

    if(opts.verbose) {
        console.log(`copyFromUnity2PkgRoot unityProjRoot=${pkgName}\ninfo=${JSON.stringify(info, null, 2)}`)

        console.log(`unity_install_path=${info.unity_install_path}`)
        console.log(`package_unity_src=${info.package_unity_src}`)
    }

    return await copyFromUnity2Pkg(pkgName, {
        ...opts,
        unity_install_path: opts.unity_install_path || info.unity_install_path,
        package_target_path: opts.package_unity_src || info.package_unity_src,
        unity_install_samples_path: opts.unity_install_samples_path || info.unity_install_samples_path,
        package_target_samples_path: opts.package_unity_samples || info.package_unity_samples

    })
}

module.exports = copyFromUnity2PkgRoot;
