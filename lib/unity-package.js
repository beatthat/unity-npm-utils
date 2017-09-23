const mkdirp = require('mkdirp');
const path = require('path');
const ncp = require('ncp');
const rimraf = require('rimraf');
const homeOrTmp = require('home-or-tmp');
const cloneOrPull = require('git-clone-or-pull');
const spawn = require('child_process').spawn;
const fs = require('fs-extra-promise');
const request = require('request');
const tmp = require('tmp');
const unzip = require('unzip');
const semver = require('semver');
const unpm = require('./unpm-core.js');

tmp.setGracefulCleanup();

/**
 * Add files under the src directory for a unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {[Object]} files array of file-info objects, e.g.
 * <code>{ name: 'Foo.cs', content: 'public class Foo {}' }
 *
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const addSrcFiles = (pkgRoot, files, callback) => {
    const promise = new Promise((resolve, reject) => {
        unpm.readPackage(pkgRoot, (readErr, pkg) => {
            if (readErr) {
                return reject(readErr);
            }

            const srcPath = path.join(pkgRoot, 'src', pkg.name);
            mkdirp(srcPath, (mkdirErr) => {
                if (mkdirErr) {
                    return reject(mkdirErr);
                }

                Promise.all(
                        files.map(f => fs.writeFileAsync(path.join(srcPath, f.name), f.content))
                    )
                    .then((pw) => resolve(files))
                    .catch((pe) => reject(pe));
            });
        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

/**
 * Install template files for a Unity package
 *
 * @param {string} installPath abs path where the package will install
 * @param {Object} options
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const installTemplate = (installPath, options, callback) => {

    const promise = new Promise((resolve, reject) => {
        mkdirp(installPath, (mkdirErr) => {
            if (mkdirErr) {
                return reject(mkdirErr);
            }

            _installTemplateToTmp((installErr, tmpInstallPath) => {
                if(installErr) {
                    return reject(installErr);
                }

                ncp(tmpInstallPath, installPath, (cpErr) => {
                    if (cpErr) {
                        console.error('failed to copy archive %j', cpErr);
                        return reject(cpErr);
                    }

                    return resolve();
                });
            });
        });

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

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

/**
 * Updates package.json scripts and template files for a Unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const updateTemplate = (pkgRoot, callback) => {
    const promise = new Promise((resolve, reject) => {
        _installTemplateToTmp((installErr, tmpInstallPath) => {
            if(installErr) {
                return reject(installErr);
            }

            unpm.readPackage(pkgRoot, (readErr, pkgBefore) => {
                if(readErr) {
                    return reject(readErr);
                }

                unpm.transformPackage({
                    package_read_path: tmpInstallPath,
                    package_write_path: tmpInstallPath,
                    transform: (pkgTemplate, cb) => {
                        const pkgAfter = { ...pkgBefore };
                        pkgAfter.scripts = { ...pkgBefore.scripts, ...pkgTemplate.scripts };
                        pkgAfter.dependencies = { ...pkgBefore.dependencies, ...pkgTemplate.dependencies };
                        pkgAfter.devDependencies = { ...pkgBefore.devDependencies, ...pkgTemplate.devDependencies };
                        cb(null, pkgAfter);
                    }
                }, (e, p) => {
                    ncp(tmpInstallPath, pkgRoot, (cpErr) => {
                        if (cpErr) {
                            console.error('failed to copy archive %j', cpErr);
                            return reject(cpErr);
                        }

                        return resolve();
                    });
                });
            });

        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


/**
 * @private
 *
 * Install template files for a Unity package to a tmp dir
 *
 * @param {Object} options
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const _installTemplateToTmp = (callback) => {

    const promise = new Promise((resolve, reject) => {


        tmp.dir((tmpDirErr, tmpDirPath, tmpDirCleanup) => {
            if (tmpDirErr) {
                console.error('failed to create tmp dir: %j', tmpDirErr);
                return reject(tmpDirErr);
            }

            const templateReq = request.get('https://github.com/beatthat/unity-npm-package-template/archive/master.zip');

            templateReq.on('error', (templateErr) => {
                console.log('ERROR: %j', templateErr);
                return reject(`Failed to load template: ${templateErr}`);
            });

            const tmpArchive = path.join(tmpDirPath, 'template_archive.zip');
            templateReq.pipe(fs.createWriteStream(tmpArchive));

            templateReq.on('response', (res) => {

                if (Number(res['statusCode']) != 200) {
                    return reject(`Error loading template archive: ${JSON.stringify(res)}`);
                }

                templateReq.on('end', () => {

                    fs.createReadStream(tmpArchive)
                        .pipe(unzip.Extract({
                            path: tmpDirPath
                        }))
                        .on('close', () => {
                            return resolve(path.join(tmpDirPath, 'unity-npm-package-template-master'));
                        });
                });
            });
        });

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


/**
 * @private
 *
 * Sets the name root for a package's Unity src
 * e.g. (package_root)/src/${package.name}
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {string} pkgName new name for the package
 *
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const _setSrcPackageName = (pkgRoot, pkgName, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    const promise = new Promise((resolve, reject) => {
        const pkgSrcRoot = path.join(pkgRoot, 'src');
        const pkgSrcDir = path.join(pkgSrcRoot, pkgName);

        const results = {
            package_src_name: pkgSrcDir
        };

        mkdirp(pkgSrcRoot, (srcRootErr) => {
            if (srcRootErr) {
                return reject(srcRootErr);
            }

            fs.readdir(pkgSrcRoot, (readErr, dirFiles) => {
                if (readErr) {
                    return reject(readErr);
                }

                const curName = results.package_src_name_before = dirFiles.find((f) => {
                    return f && f.length > 0 && f[0] !== '.'
                });

                if (curName === pkgName) {
                    return resolve(results);
                }

                if (!curName) {
                    return mkdirp(pkgSrcDir, (srcDirErr) => {
                        if (srcDirErr) {
                            return reject(srcDirErr);
                        }
                        return resolve(results);
                    });
                }

                fs.rename(path.join(pkgSrcRoot, curName), pkgSrcDir, (renameErr) => {
                    if (renameErr) {
                        return reject(renameErr);
                    }
                    return resolve(results);
                });
            });
        })

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

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

        unpm.readPackage(pkgRoot)
            .then(mainPkg => {
                const testPkgRoot = path.join(pkgRoot, 'test');
                unpm.transformPackage({
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
                    .then(testPkg => {
                        resolve(testPkg);
                    })
                    .catch(tErr => {
                        reject(tErr);
                    });
            })
            .catch(mainPkgErr => {
                return reject(mainPkgErr);
            })
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = {
    addSrcFiles: addSrcFiles,
    installTemplate: installTemplate,
    setPackageName: setPackageName,
    updateTemplate: updateTemplate,
}
