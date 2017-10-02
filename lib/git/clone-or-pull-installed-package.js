const promisify = require("es6-promisify");
const cloneOrPull = promisify(require('git-clone-or-pull'));
const fs = require('fs-extra-promise');
const path = require('path');

const _infoForPkg = require('../core/_info-for-pkg.js');
const _resolveCloneDir = require('./_resolve-clone-dir.js');

/**
 * Create or update a clone of an installed package
 * for the purpose of applying changes made within a unity-project context
 * back to the module[s] used by that unity project.
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 * @param {function(err,info)} callback
 *
 * @returns a Promise if no callback passed
 */
const cloneOrPullInstalledPackage = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    if (options.verbose) {
        console.log('cloneOrPullPackage pkgRoot=%j, options=%j', pkgRoot, options);
    }

    const promise = new Promise((resolve, reject) => {

        var info = null;

        _infoForPkg(pkgRoot, options)
        .then(i => {
            info = i;

            const pkg = info.package;

            if (!(pkg && pkg.repository && pkg.repository.url)) {
                throw new Error(`package.json must provice repository.url ${pkgRoot}`);
            }

            info.clone_package_url = pkg.repository.url.replace(/^git\+https/, 'https');

            if (options.verbose) {
                console.log('repository.url=%j', info.clone_package_url);
            }

            info.clone_dir = _resolveCloneDir(options);

            if (options.verbose) {
                console.log(`clone dir=${info.clone_dir}`);
            }

            return fs.ensureDirAsync(info.clone_dir);
        })
        .then(dirExists  => {

            const pkgDir = info.clone_package_path =
                path.join(info.clone_dir, info.package.name);

            if (options.verbose) {
                console.log(`pkg dir=${pkgDir}`);
            }

            return cloneOrPull(info.clone_package_url, {
                path: pkgDir,
                implementation: 'nodegit' //'subprocess'
            });
        })
        .then(done => {
            if (options.verbose) {
                console.log(`clone or pull succeeded: url ${info.clone_package_path}`);
            }

            return resolve(info);
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = cloneOrPullInstalledPackage;
