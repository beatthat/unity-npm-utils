const fs = require('fs-extra-promise')
const path = require('path')

const readPackage = require('./read-package.js')

/**
 * Transform function passed to transformPackage
 * takes a package, transforms the package, and then makes a callback.
 *
 * @callback infoCallback
 * @param {Error} err Error or null
 * @param {Boolean} info.is_module
 * @param {Object} info.package - the parsed package
 * @param {Object} info.unity_project_root - the unity project root
 * @param {Boolean} info.install_outside_plugins - if true installs at root of unity Assets instead of Assets/Plugins
 * @param {string} info.scope - if set installs in this sub directory, e.g. Assets/Plugins/${scope}
 * @param {string} info.unity_install_path - abs path to where this plugin installs in it's unity project
 * @param {string} info.package_unity_src - abs path to the package source that gets installed to Unity
 */

/**
 * Internal function used to resolve paths, e.g. Unity install path for a package
 * based on a module's root and options.
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 *
 * @param {string} options.package_scope - the scope the package
 *      that will be copied back from under Assets/Plugins,
 *      so the actual package path is (unity)/Assets/Plugins/$scope/$package_name.
 *      If nothing passed, takes the value from package.json 'scope' property.
 *
 * @param {string} options.package_name - the name of the package
 *      that will be copied back from under Assets/Plugins,
 *      so the actual package path is (unity)/Assets/Plugins/$scope/$package_name.
 *      If nothing passed, takes the value from package.json 'name' property.
 *
 * @param {string} options.src_path - name (or rel path)
 *      of the folder within the package that contains the pkg source for unity.
 *      If nothing passed, defaults to 'Runtime'.
 *
 * @param {infoCallback} callback
 */
const infoForPkg = async (pkgRoot, options) => {

    options = options || {}

    const info = {}

    info.is_module = pkgRoot.split(path.sep).filter((i) => {
        return i == 'node_modules'
    }).length > 0

    const pkgPath = info.package_path = path.join(pkgRoot, 'package.json')

    var pkg = await readPackage(pkgRoot)

    info.package = Object.assign({}, pkg)
    info.package_original = Object.assign({}, pkg)

    if (!(pkg && pkg.name)) {
        throw new Error("Not a valid package.json at " + pkgPath)
    }

    const unityProjectRoot = info.unity_project_root = options.unity_project_root ?
        options.unity_project_root : path.join(pkgRoot, '..', '..')

    const unityInstallPath = [unityProjectRoot, 'Assets']
    const unityInstallSamplesPath = [...unityInstallPath, 'Samples']

    // by default packages install under Unity/Assets/Plugins.
    // but sometimes you can't install there
    // (because, say, pkg depends on another package that installs to the Assets root)
    info.install_outside_plugins = options.install_outside_plugins ?
        options.install_outside_plugins : pkg.config ?
        pkg.config.install_outside_plugins : false

    if (!info.install_outside_plugins) {
        unityInstallPath.push('Plugins')
    }

    unityInstallPath.push('packages')
    unityInstallSamplesPath.push('packages')

    // the package may be installed within a scope directory,
    // usually pulled from a {pkg_root}.scope or {pkg_root}.config.scope.
    info.scope = options.package_scope ?
        options.package_scope : pkg.scope ?
        pkg.scope : pkg.config ?
        pkg.config.scope : undefined

    if (info.scope) {
        unityInstallPath.push(info.scope)
        unityInstallSamplesPath.push(info.scope)
    }

    unityInstallPath.push(info.package.name)
    unityInstallSamplesPath.push(info.package.name)

    info.unity_install_path = path.join(...unityInstallPath)
    info.unity_install_samples_path = path.join(...unityInstallSamplesPath)

    info.package_unity_src_rel = (pkg.config && pkg.config.src_path) ?
        pkg.config.src_path : 'Runtime'

    info.package_unity_src = path.join(pkgRoot, info.package_unity_src_rel, pkg.name)
    info.package_unity_samples = path.join(pkgRoot, 'Samples', pkg.name)

    // handle legacy packages that have source under 'src' instead of 'Runtime'
    if(! await fs.existsAsync(info.package_unity_src) && await fs.existsAsync(path.join(pkgRoot, 'src', pkg.name))) {
        info.package_unity_src_rel = 'src'
        info.package_unity_src = path.join(pkgRoot, info.package_unity_src_rel, pkg.name)
    }

    return info
}

module.exports = infoForPkg
