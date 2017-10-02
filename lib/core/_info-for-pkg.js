const fs = require('fs-extra-promise');
const path = require('path');

const readPackage = require('./read-package.js')

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
 *      If nothing passed, defaults to 'src'.
 *
 * @param {function(err, info)} callback
 */
const infoForPkg = (pkgRoot, options, callback) => {
    if(typeof options === 'function') {
        callback = options;
        options = null;
    }

    options = options || {};

    const info = {};

    const promise = new Promise((resolve, reject) => {
        info.is_module = pkgRoot.split(path.sep).filter((i) => {
            return i == 'node_modules';
        }).length > 0;

        const pkgPath = info.package_path = path.join(pkgRoot, 'package.json');

        readPackage(pkgRoot)
        .then(pkg => {
            info.package = Object.assign({}, pkg);
            info.package_original = Object.assign({}, pkg);

            if (!(pkg && pkg.name)) {
                throw new Error("Not a valid package.json at " + pkgPath);
            }

            const unityProjectRoot = info.unity_project_root = options.unity_project_root ?
                options.unity_project_root : path.join(pkgRoot, '..', '..');

            const unityInstallPath = [unityProjectRoot, 'Assets'];

            // by default packages install under Unity/Assets/Plugins.
            // but sometimes you can't install there
            // (because, say, pkg depends on another package that installs to the Assets root)
            info.install_outside_plugins = options.install_outside_plugins ?
                options.install_outside_plugins : pkg.config ?
                pkg.config.install_outside_plugins : false;

            if (!info.install_outside_plugins) {
                unityInstallPath.push('Plugins');
            }

            unityInstallPath.push('packages');

            // the package may be installed within a scope directory,
            // usually pulled from a {pkg_root}.scope or {pkg_root}.config.scope.
            info.scope = options.package_scope ?
                options.package_scope : pkg.scope ?
                pkg.scope : pkg.config ?
                pkg.config.scope : undefined;

            if (info.scope) {
                unityInstallPath.push(info.scope);
            }

            unityInstallPath.push(info.package.name);

            info.unity_install_path = path.join(...unityInstallPath);

            info.package_unity_src_rel = (pkg.config && pkg.config.src_path) ?
                pkg.config.src_path : "src";

            info.package_unity_src = path.join(pkgRoot, info.package_unity_src_rel, pkg.name);

            return resolve(info);
        })
        .catch(e => reject(e))

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = infoForPkg;
