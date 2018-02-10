const fs = require('fs-extra-promise')
const _infoForPkg = require('../core/_info-for-pkg')

/**
 * @deprecated use unpm.installPackageToUnity instead
 *
 * Install a unity package from node_modules/${package_name}
 * to Assets/Plugins/[packages/][${scope}/]${package_name}.
 *
 * Typically, this is called from a postinstall script specified in the package
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
const pkg2UnityInstall = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(pkgRoot, options)
        .then(info => {
            // if we're not under node_modules, don't install
            if (!info.is_module) {
                return resolve(info);
            }

            fs.ensureDirAsync(info.unity_install_path)
            .then(dirExists => fs.copyAsync(info.package_unity_src, info.unity_install_path))
            .then(afterCopy => resolve(info))
            .catch(e => reject(e))
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = pkg2UnityInstall
