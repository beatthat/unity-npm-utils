const path = require('path');
const readPackage = require('../core/read-package.js');
const transformPackage = require('../core/transform-package.js');

/**
 * @private
 *
 * The test Unity project contained in every Unity package
 * Needs its package.json to depend on (an npm-packed tgz version of)
 * the main package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const _setTestProject2PkgDependency = (pkgRoot, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {}
    }

    options = options || {};

    const promise = new Promise((resolve, reject) => {

        readPackage(pkgRoot)
            .then(mainPkg => {
                const testPkgRoot = path.join(pkgRoot, 'test');
                return transformPackage({
                    package_read_path: testPkgRoot,
                    package_write_path: testPkgRoot,
                    transform: (testPkg, transformCB) => {
                        // filter out existing _latest.tgz dependencies (presumably old names for package)
                        testPkg.dependencies = Object.getOwnPropertyNames(testPkg.dependencies || {}).reduce((cur, acc) => {
                            const v = testPkg.dependencies[cur];
                            if (!v || typeof v.match === 'function' && v.match(/^.*_latest.tgz$/)) {
                                return acc;
                            }
                            acc[cur] = v;
                            return acc;
                        }, {});

                        testPkg.dependencies[mainPkg.name] = `../${mainPkg.name}-latest.tgz`;

                        transformCB(null, testPkg);
                    }
                })
            })
            .then(testPkg => resolve(testPkg))
            .catch(e => reject(e));
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = _setTestProject2PkgDependency
