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

tmp.setGracefulCleanup();

/**
 * Read the package.json for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(err, package)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const unityPackage_readPackage = (pkgRoot, callback) => {
    const promise = new Promise((resolve, reject) => {
        const jsonPath = path.join(pkgRoot, 'package.json');
        fs.readFile(jsonPath, (err, content) => {
            if(err) { return reject(err); }
            try {
                return resolve(JSON.parse(content));
            } catch(pErr) {
                return reject(pErr);
            }
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

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
const unityPackage_addSrcFiles = (pkgRoot, files, callback) => {
    const promise = new Promise((resolve, reject) => {
        unityPackage_readPackage(pkgRoot, (readErr, pkg) => {
            if(readErr) { return reject(readErr); }

            const srcPath = path.join(pkgRoot, 'src', pkg.name);
            mkdirp(srcPath, (mkdirErr) => {
                if(mkdirErr) { return reject(mkdirErr); }

                Promise.all(
                    files.map(f => fs.writeFileAsync(path.join(srcPath, f.name), f.content))
                )
                .then((pw) => resolve(files))
                .catch((pe) => reject(pe));
            });
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * @private
 */
const unityPackage_setTestProject2PkgDependency_transformDependenciesDefault = (mainPkg, testPkg) => {

    const result = JSON.parse(JSON.stringify(testPkg));

    // filter out existing _latest.tgz dependencies (presumably old names for package)
    const resultDeps = Object.getOwnPropertyNames(result.dependencies || {}).reduce((cur, acc) => {
        const v = result.dependencies[cur];
        if(!v || typeof v.match === 'function' && v.match(/^.*_latest.tgz$/)) {
            return acc;
        }
        acc[cur] = v;
        return acc;
    }, {});

    resultDeps[mainPkg.name] = `../${mainPkg.name}-latest.tgz`;

    result.dependencies = resultDeps;

    return result;
}

/**
 * The test Unity project contained in every Unity package
 * Needs its package.json to depend on (an npm-packed tgz version of)
 * the main package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(dependencies)} options.transform_dependencies
 *      A function that transforms the dependencies for the test project.
 *      Default is unityPackage_setTestProject2PkgDependency_transformDependenciesDefault
 *
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const unityPackage_setTestProject2PkgDependency = (pkgRoot, options, callback) => {
    if(typeof options === 'function') {
        callback = options;
        options = {}
    }

    options = options || {};

    const promise = new Promise((resolve, reject) => {
        const testPkgRoot = path.join(pkgRoot, 'test');

        Promise.all([
            unityPackage_readPackage(pkgRoot),
            unityPackage_readPackage(testPkgRoot)
        ])
        .then((readResults) => {

            const mainPkg = readResults[0];
            const testPkgBefore = readResults[1];

            const transform = options.transform_dependencies ||
            unityPackage_setTestProject2PkgDependency_transformDependenciesDefault;

            const testPkgAfter = transform(mainPkg, testPkgBefore);

            fs.writeFile(
                path.join(testPkgRoot, 'package.json'),
                JSON.stringify(testPkgAfter, null, 2),
                (writeErr) => {

                if(writeErr) { return reject(writeErr); }

                return resolve({
                    package: mainPkg,
                    package_test_before: testPkgBefore,
                    package_test_after: testPkgAfter
                });
            });
        })
        .catch(readErr => reject(readErr));
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
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
const unityPackage_setSrcPackageName = (pkgRoot, pkgName, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    const promise = new Promise((resolve, reject) => {
        const pkgSrcRoot = path.join(pkgRoot, 'src');
        const pkgSrcDir = path.join(pkgSrcRoot, pkgName);

        const results = { package_src_name: pkgSrcDir };

        mkdirp(pkgSrcRoot, (srcRootErr) => {
            if(srcRootErr) {
                return reject(srcRootErr);
            }

            fs.readdir(pkgSrcRoot, (readErr, dirFiles) => {
                if(readErr) {
                    return reject(readErr);
                }

                const curName = results.package_src_name_before = dirFiles.find((f) => {
                    return f && f.length > 0 && f[0] !== '.'
                });

                if(curName === pkgName) {
                    return resolve(results);
                }

                if(!curName) {
                    return mkdirp(pkgSrcDir, (srcDirErr) => {
                        if(srcDirErr) { return reject(srcDirErr); }
                        return resolve(results);
                    });
                }

                fs.rename(path.join(pkgSrcRoot, curName), pkgSrcDir, (renameErr) => {
                    if(renameErr) { return reject(renameErr); }
                    return resolve(results);
                });
            });
        })

    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
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
const unityPackage_setPackageName = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    if(options.verbose) {
        console.log(`unity-npm-utils::unityPackage.setPackageName package_root=${pkgRoot}`)
    }

    const promise = new Promise((resolve, reject) => {

        const pkgJsonPath = path.join(pkgRoot, 'package.json');
        const testPkgJsonPath = path.join(pkgRoot, 'test', 'package.json');

        Promise.all([
            fs.existsAsync(pkgJsonPath)
        ])
        .then((existsResults) => {

            if(!existsResults[0]) {
                return reject(new Error(`package.json file is missing at path ${pkgJsonPath}`))
            }

            const pkgs = [{ path: pkgJsonPath }];

            Promise.all(pkgs.map(p => fs.readFileAsync(p.path)))
            .then((readResults) => {

                for(var i = 0; i < readResults.length; i++) {
                    try {
                        pkgs[i].package = JSON.parse(readResults[i]);
                    }
                    catch(err) {
                        return reject(new Error(`not valid package.json as path ${pkgs[i].path}`));
                    }
                }

                const writePkgs = [];

                const mainPkg = pkgs[0];
                const newPkgName = options.package_name || mainPkg.name;

                if(mainPkg.package.name !== newPkgName) {
                    mainPkg.package.name = newPkgName;
                    writePkgs.push(mainPkg);
                }

                Promise.all([
                    ...
                    writePkgs.map(p => {
                        fs.writeFileAsync(p.path, JSON.stringify(p.package, null, 2));
                    }),
                    unityPackage_setSrcPackageName(pkgRoot, newPkgName),
                    unityPackage_setTestProject2PkgDependency(pkgRoot)
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

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
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
const unityPackage_installTemplate = (installPath, options, callback) => {

    const promise = new Promise((resolve, reject) => {
        mkdirp(installPath, (mkdirErr) => {
            if (mkdirErr) {
                return reject(mkdirErr);
            }

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

                                ncp(path.join(tmpDirPath, 'unity-npm-package-template-master'), installPath, (cpErr) => {
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
        });

    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * Increments (or sets) the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkg abs path to the package root or the pkg itself.
 *      NOTE: never edits a passed in package object.
 *      Edits applied to a copy passed back via callback
 *
 * @param {string} options.release_type
 *      semver release type, e.g. major, minor, patch. Default is patch
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const unityPackage_incrementVersion = (pkg, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    const promise = new Promise((resolve, reject) => {
        const isPath = typeof(pkg) === 'string' || pkg instanceof String;

        if (isPath) {
            const pkgPath = path.join(pkg, 'package.json');
            const asPkg = JSON.parse(fs.readFileSync(pkgPath));

            return unityPackage_incrementVersion(asPkg, options, (incErr, pkgAfter) => {
                if (incErr) {
                    return reject(incErr);
                }

                const pkgJson = JSON.stringify(pkgAfter, null, 2);

                fs.writeFile(pkgPath, pkgJson, (writeErr) => {
                    if (writeErr) {
                        return reject(writeErr);
                    }

                    return resolve(pkgAfter);
                });
            });
        }

        pkg = JSON.parse(JSON.stringify(pkg));

        const versionBase = semver.valid(pkg.version) || semver.valid('0.0.1');
        const releaseType = options.release_type ? options.release_type : 'patch';
        const versionAfter = semver.inc(versionBase, releaseType);

        if (!versionAfter) {
            return reject(new Error(`semver.inc failed for version ${versionBase} and release type ${releaseType}`));
        }

        pkg.version = versionAfter;

        return resolve(pkg);
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 *  functions for setting up Unity-code packages
 */
const unityPackage = {

    installTemplate: unityPackage_installTemplate,
    incrementVersion: unityPackage_incrementVersion,
    setPackageName: unityPackage_setPackageName,
    addSrcFiles: unityPackage_addSrcFiles
}

const _resolveCloneDir = (options) => {
    return (options && options.clone_dir) ?
        options.clone_dir : path.join(homeOrTmp, 'unity-npm-utils-packages');
}

/**
 * Install a unity package from node_modules/${package_name}
 * to Assets/Plugins/[packages/][${scope}/]${package_name}.
 *
 * Typically, this is called from a postinstall script specified in the package
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 */
const installPlugin = (pkgRoot) => {

    console.error('unity-npm-utils::installPlugin is deprecated. Use pkg2UnityInstall instead');

    pkg2UnityInstall(pkgRoot, (err, info) => {
        if (err) {
            console.error('error installing package: %j', err);
            return;
        }

        console.log(`installed package to ${info.unity_install_path}`);

    });
}

/**
 * Set the version for the package json in info.package.
 *
 */
const _setInfoPackageVersion = (info, options) => {
    const pkg = info.package;

    const pkgIncrementLevel = info.package_increment_level =
        options.package_increment_level ?
        options.package_increment_level : 'patch';

    const toVersion = info.package.set_version =
        options.package_set_version ? options.package_set_version :
        info.package.version ? semver.inc(info.package.version, pkgIncrementLevel) : '0.0.1';

    pkg.version = toVersion;
}

/**
 * @param {function(err)} callback
 */
const _writeInfoPackageJson = (info, callback) => {
    const promise = new Promise((resolve, reject) => {
        const pkgPath = info.package_path;
        const pkgJson = JSON.stringify(info.package);

        fs.writeFile(pkgPath, pkgJson, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve(info);
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

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
const _infoForPkg = (pkgRoot, options, callback) => {
    options = options ? options : {};

    const info = {};

    const promise = new Promise((resolve, reject) => {
        info.is_module = pkgRoot.split(path.sep).filter((i) => {
            return i == 'node_modules';
        }).length > 0;

        const pkgPath = info.package_path = path.join(pkgRoot, 'package.json');
        const pkg = info.package = JSON.parse(fs.readFileSync(pkgPath));
        info.package_original = Object.assign({}, pkg);

        if (!(pkg && pkg.name)) {
            return reject("Not a valid package.json at " + pkgPath);
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
    });


    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
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

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            // if we're not under node_modules, don't install
            if (!info.is_module) {
                return resolve(info);
            }

            mkdirp(info.unity_install_path, (mkdirErr) => {
                if (mkdirErr) {
                    console.error(mkdirErr)
                    return reject(mkdirErr);
                }

                // Copy files
                ncp(info.package_unity_src, info.unity_install_path, (cpErr) => {
                    if (cpErr) {
                        console.error(cpErr);
                        return reject(cpErr);
                    }

                    return resolve(info);
                });
            });
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * Sync package from its installed (Unity) directory back to the package src folder.
 *
 * This is to support a workflow where a plugin can install to a unity 'test' directory,
 * the plugin source can be editted there using Unity,
 * and then the source changes can be synced back to the plugin source to commit.
 *
 * It would be easier to define this in package.json as a 'script' that uses rsync,
 * but that would only on *nix systems and not work on Windows.
 *
 * @param {string} unityProjectRoot - abs path of the unity project we are syncing *from*
 *
 * @param {string} pkgTgtRoot - abs path of the root (where package.json lives)
 *      of the module we are syncing *to*
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
 * @param {string} options.filter - passed to ncp
 *      a RegExp instance, against which each file name is tested
 *      to determine whether to copy it or not,
 *      or a function taking single parameter:
 *      copied file name, returning true or false,
 *      determining whether to copy file or not.
 *
 *      If nothing is passed defaults to /^[^.]+$|\.(?!(meta)$)([^.]+$)/
 *
 * @param {bool} options.overwrite - if TRUE, deletes the existing contents
 *      of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 */
const syncPlugin2Src = (unityProjectRoot, pkgTgtRoot, options) => {
    console.error('unity-npm-utils::syncPlugin2Src is deprecated. Use copyFromUnity2PkgRoot instead');

    copyFromUnity2PkgRoot(unityProjectRoot, pkgTgtRoot, options, (err, info) => {
        if (err) {
            console.error("syncPlugin2Src error %j", err);
            return;
        }

        console.log('syncPlugin2Src succeedded');
    });
}

/**
 * Copy the (editted) source of a module from a unity project
 * to a package source folder.
 *
 * This enables editting packages in a unity project context and then
 * syncing the source from unity back to the package to commit changes.
 *
 * @param {string} unityProjectRoot
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
 * @param {bool} options.overwrite -
 *      if TRUE, deletes the existing contents
 *      of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 *
 * @param {function(err, info)} callback
 */
const copyFromUnity2PkgRoot = (unityProjectRoot, pkgRoot, options, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        options.package_root = pkgRoot;

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            copyFromUnity2Pkg(unityProjectRoot, info.package.name, options, (copyErr, copyInfo) => {
                if (copyErr) {
                    return reject(copyErr);
                }
                return resolve(copyInfo);
            });
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}


/**
 * Copy the (editted) source of a module from a unity project
 * to a package source folder.
 *
 * This enables editting packages in a unity project context and then
 * syncing the source from unity back to the package to commit changes.
 *
 * @param {string} unityProjectRoot
 *      The absolute path to the root of the unity project
 *      (the directory that contains 'Assets' and the package.json)
 *
 * @param {string} pkgName
 *      The name of the package
 *      which by convention should be both the package.json name and
 *      directory name where the package is installed under unity Assets.
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
 * @param {string} options.package_root
 *      If set, then the target/copy-to package is at this absolute path.
 *
 *      By default will assume the path is
 *      ${unityProjectRoot}/node_modules/${pkgName}
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
 * @param {bool} options.overwrite - if TRUE, deletes the existing contents
 *      of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 *
 * @param {function(err, info)} callback
 */
const copyFromUnity2Pkg = (unityProjectRoot, pkgName, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        const pkgRoot = options.package_root ?
            options.package_root : path.join(unityProjectRoot, 'node_modules', pkgName);

        options.unity_project_root = unityProjectRoot;

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            const unitySrc = info.unity_install_path;
            const pkgTgtSrc = info.package_unity_src;

            const ncpOpts = {
                filter: options.filter ? options.filter : /^[^.]+$|\.(?!(meta)$)([^.]+$)/,
                clobber: options.no_clobber ? false : true
            }

            const copy = () => {

                if (options.verbose) {
                    console.log(`will copy from ${unitySrc} to ${pkgTgtSrc} with options ${JSON.stringify(options)}`)
                }

                ncp(unitySrc, pkgTgtSrc, ncpOpts, (cpErr) => {
                    if (cpErr) {
                        console.error(cpErr);
                        return reject(`Copy failed with error: ${cpErr}`);
                    }

                    resolve(info);
                });
            }

            if (options.overwrite) {

                const pkgTgtDel = info.package_del_tgt = path.join(pkgTgtSrc, '*');

                if (options.verbose) {
                    console.log(`option 'overwrite' is set. deleting  ${pkgTgtDel}...`)
                }

                rimraf(pkgTgtDel, (delErr) => {

                    if (delErr) {
                        console.error(delErr);
                        return reject(`Delete for overwrite failed with error: ${delErr}`);
                    }

                    copy();
                });
            } else {
                copy();
            }
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * Create or update a clone of a module
 * for the purpose of applying changes made within a unity-project context
 * back to the module[s] used by that unity project.
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 */
const modCloneOrPull = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    if (options.verbose) {
        console.log('modCloneOrPull pkgRoot=%j, options=%j', pkgRoot, options);
    }

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            const pkg = info.package;

            if (!(pkg && pkg.repository && pkg.repository.url)) {
                if (options.verbose) {
                    console.log(`Not a valid package.json at ${pkgRoot}`);
                }

                return reject(`Not a valid package.json at ${pkgRoot}`);
            }

            const pkgUrl = pkg.repository.url.replace(/^git\+https/, 'https');

            if (options.verbose) {
                console.log('repository.url=%j', pkgUrl);
            }

            const cloneDir = _resolveCloneDir(options);

            if (options.verbose) {
                console.log(`clone dir=${cloneDir}`);
            }

            mkdirp(cloneDir, (mkdirErr) => {
                if (mkdirErr) {
                    console.log('failed to create clone dir %j', cloneDir);
                    return reject(mkdirErr);
                }

                const pkgDir = path.join(cloneDir, pkg.name);

                if (options.verbose) {
                    console.log(`pkg dir=${pkgDir}`);
                }

                const gitOpts = {
                    path: pkgDir,
                    implementation: 'nodegit' //'subprocess'
                }

                cloneOrPull(pkgUrl, gitOpts, (gitErr) => {

                    if (gitErr) {
                        if (options.verbose) {
                            console.log(`failed to clone or pull url ${pkgUrl} git-opts ${gitOpts}: ${gitErr}`);
                        }
                        return reject(gitErr);
                    }

                    if (options.verbose) {
                        console.log(`clone or pull succeeded: url ${pkgUrl} git-opts ${gitOpts}`);
                    }

                    return resolve();
                });

            });

        });

    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * Connect node_modules copy of a package (within unity project)
 * to module clone created by unity-npm-utils::modCloneOrPull
 * using npm link.
 *
 * Once this connection is established, changes made to the (module's) source
 * in unity can be synced to the clone using unity-npm-utils::syncPlugin2Src
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 *
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp.
 *
 * @param {string} options.project_root - the abs path for the root of the (Unity) project, where package.json lives.
 *      Defaults to 2 directories above pkgRoot param
 */
const modCloneLink = (pkgRoot, options, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            const pkg = info.package;

            if (!(pkg && pkg.repository && pkg.repository.url)) {
                return reject("Not a valid package.json at " + pkgRoot);
            }

            const cloneDir = info.clone_root_path = _resolveCloneDir(options);
            const clonePkg = info.clone_pkg_path = path.join(cloneDir, pkg.name);

            if (options.verbose) {
                console.log('cd %j && npm link', clonePkg);
            }

            const linkClone = spawn('npm link', {
                stdio: 'inherit',
                shell: true,
                cwd: clonePkg
            });

            linkClone.on('exit', (code, signal) => {

                if (code !== 0 || signal) {
                    return reject(`npm link clone failed with code ${code} and signal ${signal}`)
                }

                const projectRoot = options.project_root ?
                    options.project_root : path.join(pkgRoot, '..', '..');

                if (options.verbose) {
                    console.log('cd %j && npm link %j', projectRoot, pkg.name);
                }

                const linkNodeModule = spawn(`npm link ${pkg.name}`, {
                    stdio: 'inherit',
                    shell: true,
                    cwd: projectRoot
                });


                linkNodeModule.on('exit', (code, signal) => {

                    if (code !== 0 || signal) {
                        return reject(`npm link node module failed with code ${code} and signal ${signal}`)
                    }

                    resolve();
                });

            });
        });

    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

const copyUnity2LinkedClone = (unityRoot, pkgName, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        const pkgRoot = path.join(unityRoot, 'node_modules', pkgName);

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            if (options.verbose) {
                console.log(`copy unity to linked clone: unityroot=${unityRoot}, pkgPath=${pkgRoot}, options=${JSON.stringify(options)}`);
            }

            const pkg = info.package;

            modCloneOrPull(pkgRoot, options, (cloneErr) => {
                if (cloneErr) {
                    return reject(cloneErr);
                }

                if (options.verbose) {
                    console.log('clone succeeded...');
                    console.log('link clone to node_module %j with options', pkgRoot, options);
                }

                modCloneLink(pkgRoot, options, (linkErr) => {
                    if (linkErr) {
                        return reject(linkErr);
                    }

                    if (options.verbose) {
                        console.log('link succeeded...');
                        console.log('copy unity source to linked node_module with options %j', options);
                    }

                    copyFromUnity2Pkg(unityRoot, pkgName, options, (copyErr, copyInfo) => {
                        if (copyErr) {
                            return reject(copyErr);
                        }

                        console.log(`
===================================================================================================================
copy to linked clone succeeded
-----------------------------------------------------------------------------------------------------------------

commit changes at ${copyInfo.package_unity_src}

cd ${copyInfo.package_unity_src} && git add -A && git commit -m
===================================================================================================================
                            `);
                        return resolve();
                    });
                });
            });
        });
    });

    if(!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

exports.installPlugin = installPlugin;
exports.pkg2UnityInstall = pkg2UnityInstall;
exports.syncPlugin2Src = syncPlugin2Src;
exports.modCloneOrPull = modCloneOrPull;
exports.modCloneLink = modCloneLink;
exports.copyFromUnity2Pkg = copyFromUnity2Pkg;
exports.copyFromUnity2PkgRoot = copyFromUnity2PkgRoot;
exports.copyUnity2LinkedClone = copyUnity2LinkedClone;
exports.unityPackage = unityPackage;
