const fs = require('fs-extra-promise');
const mkdirp = require('mkdirp');
const path = require('path');

const transformPackage = require('../../core/transform-package.js');
const _setSrcPackageName = require('./_set-src-package-name.js');
const _setTestProject2PkgDependency = require('./_set-test-project-2-pkg-dependency.js');

/**
 * Sets the name of the package and also updates that name in the
 * template/example Unity package under test.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {string} options.package_name
 *      new name for the package, if not set defaults to existing package name
 *
 * @param {function(err, packages)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const setPackageName = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    if (options.verbose) {
        console.log(`unity-npm-utils::unityPackage.setPackageName package_root=${pkgRoot}`)
    }

    const promise = new Promise((resolve, reject) => {

        const pkgJsonPath = path.join(pkgRoot, 'package.json');
        const testPkgJsonPath = path.join(pkgRoot, 'test', 'package.json');

        const newPkgName = options.package_name || p.name.name;

        transformPackage({
            package_path: pkgRoot,
            transform: (p, cb) => {
                p.name = newPkgName;

                if(options.package_scope) {
                    p.config = { ...(p.config || {}), scope: options.package_scope }
                }

                return cb(null, p);
            }
        })
        .then(p => {
            return Promise.all([
                _setSrcPackageName(pkgRoot, newPkgName),
                _setTestProject2PkgDependency(pkgRoot)
            ])
        })
        .then(allDone => resolve(pkgRoot))
        .catch(e => reject(e));
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = setPackageName;