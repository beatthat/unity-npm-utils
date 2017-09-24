const fs = require('fs-extra-promise');
const mkdirp = require('mkdirp');
const path = require('path');
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

    if (options.verbose) {
        console.log(`unity-npm-utils::unityPackage.setPackageName package_root=${pkgRoot}`)
    }

    const promise = new Promise((resolve, reject) => {

        const pkgJsonPath = path.join(pkgRoot, 'package.json');
        const testPkgJsonPath = path.join(pkgRoot, 'test', 'package.json');

        Promise.all([
                fs.existsAsync(pkgJsonPath)
            ])
            .then((existsResults) => {

                if (!existsResults[0]) {
                    return reject(new Error(`package.json file is missing at path ${pkgJsonPath}`))
                }

                const pkgs = [{
                    path: pkgJsonPath
                }];

                Promise.all(pkgs.map(p => fs.readFileAsync(p.path)))
                    .then((readResults) => {

                        for (var i = 0; i < readResults.length; i++) {
                            try {
                                pkgs[i].package = JSON.parse(readResults[i]);
                            } catch (err) {
                                return reject(new Error(`not valid package.json as path ${pkgs[i].path}`));
                            }
                        }

                        const writePkgs = [];

                        const mainPkg = pkgs[0];
                        const newPkgName = options.package_name || mainPkg.name;

                        if (mainPkg.package.name !== newPkgName) {
                            mainPkg.package.name = newPkgName;
                            writePkgs.push(mainPkg);
                        }

                        Promise.all([
                                ...
                                writePkgs.map(p => {
                                    fs.writeFileAsync(p.path, JSON.stringify(p.package, null, 2));
                                }),
                                _setSrcPackageName(pkgRoot, newPkgName),
                                _setTestProject2PkgDependency(pkgRoot)
                            ])
                            .then((writeResults) => {
                                return resolve(pkgs);
                            })
                            .catch((writeErr) => {
                                return reject(writeErr);
                            })
                    })
                    .catch((readResultsErr) => {
                        return reject(existsErr);
                    });

            })
            .catch((existsErr) => {
                return reject(existsErr);
            });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = setPackageName;
