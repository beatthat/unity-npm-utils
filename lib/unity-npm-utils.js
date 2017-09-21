const mkdirp = require('mkdirp');
const path = require('path');
const ncp = require('ncp');
const rimraf = require('rimraf');
const homeOrTmp = require('home-or-tmp');
const cloneOrPull = require('git-clone-or-pull');
const spawn = require('child_process').spawn;
const fs = require('fs');
const request = require('request');
const tmp = require('tmp');
const unzip = require('unzip');

const unityPackage_install = (installPath, options, callback) => {

    var cleanup = null;

    const promise = new Promise((resolve, reject) => {
        mkdirp(installPath, (mkdirErr) => {
            if (mkdirErr) {
                return reject(mkdirErr);
            }

            const templateReq = request.get('https://github.com/beatthat/unity-npm-package-template/archive/master.zip');

            templateReq.on('error', (templateErr) => {
                console.log('ERROR: %j', templateErr);
                return reject("Failed to load template: %j", templateErr);
            });

            templateReq.on('response', (res) => {

                if (Number(res['statusCode']) != 200) {
                    return reject(`Error loading template archive: ${JSON.stringify(res)}`);
                }

                tmp.dir((tmpDirErr, tmpDirPath, tmpDirCleanup) => {
                    if(tmpDirErr) {
                        console.error('failed to create tmp dir: %j', tmpDirErr);
                        return reject(tmpDirErr);
                    }

                    cleanup = tmpDirCleanup;

                    const tmpArchive = path.join(tmpDirPath, 'template_archive.zip');
                    const tmpArchiveExpanded = path.join(tmpDirPath, 'template_archive');

                    templateReq.pipe(fs.createWriteStream(tmpArchive));

                    templateReq.on('end', () => {
                        console.log('archive download completed to %j', tmpArchive);

                        fs.createReadStream(tmpArchive)
                        .pipe(unzip.Extract({ path: tmpArchiveExpanded }))
                        .on('close', () => {

                            console.log('unzipped to %j', tmpArchiveExpanded);

                            ncp(path.join(tmpArchiveExpanded, 'unity-npm-package-template'), installPath, (cpErr) => {
                                if (cpErr) {
                                    console.error('failed to copy archive %j', cpErr);
                                    return reject(cpErr);
                                }

                                console.log('copied to %j', installPath);

                                return resolve();
                            });
                        });
                    });
                });


            });
        });

    });

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
        if(cleanup) { cleanup(); }
        return callback(null, pRes);
    })
    .catch((pErr) => {
        if(cleanup) { cleanup(); }
        console.log('promise rejected w err %j', pErr)
        return callback(pErr);
    });
}

/**
 *  functions for setting up Unity-code packages
 */
const unityPackage = {

    install: unityPackage_install
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
 * @param {string} modRoot - the absolute path of the module root (where package.json lives)
 */
const installPlugin = (modRoot) => {

    console.error('unity-npm-utils::installPlugin is deprecated. Use pkg2UnityInstall instead');

    pkg2UnityInstall(modRoot, (err, info) => {
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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });
}

/**
 * Internal function used to resolve paths, e.g. Unity install path for a package
 * based on a module's root and options.
 *
 * @param {string} modRoot - the absolute path of the module root (where package.json lives)
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
const _infoForPkg = (modRoot, options, callback) => {
    options = options ? options : {};

    const info = {};

    const promise = new Promise((resolve, reject) => {
        info.is_module = modRoot.split(path.sep).filter((i) => {
            return i == 'node_modules';
        }).length > 0;

        const pkgPath = info.package_path = path.join(modRoot, 'package.json');
        const pkg = info.package = require(pkgPath);
        info.package_original = Object.assign({}, pkg);

        if (!(pkg && pkg.name)) {
            return reject("Not a valid package.json at " + pkgPath);
        }

        const unityProjectRoot = info.unity_project_root = options.unity_project_root ?
            options.unity_project_root : path.join(modRoot, '..', '..');

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

        info.package_unity_src = path.join(modRoot, info.package_unity_src_rel, pkg.name);

        return resolve(info);
    });

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });
}

/**
 * Install a unity package from node_modules/${package_name}
 * to Assets/Plugins/[packages/][${scope}/]${package_name}.
 *
 * Typically, this is called from a postinstall script specified in the package
 *
 * @param {string} modRoot - the absolute path of the module root (where package.json lives)
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
const pkg2UnityInstall = (modRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(modRoot, options, (infoErr, info) => {
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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });

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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
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

        const modRoot = options.package_root ?
            options.package_root : path.join(unityProjectRoot, 'node_modules', pkgName);

        options.unity_project_root = unityProjectRoot;

        _infoForPkg(modRoot, options, (infoErr, info) => {
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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });

}

/**
 * Create or update a clone of a module
 * for the purpose of applying changes made within a unity-project context
 * back to the module[s] used by that unity project.
 *
 * @param {string} modRoot - the absolute path of the module root (where package.json lives)
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 */
const modCloneOrPull = (modRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    if (options.verbose) {
        console.log('modCloneOrPull modRoot=%j, options=%j', modRoot, options);
    }

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(modRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            const pkg = info.package;

            if (!(pkg && pkg.repository && pkg.repository.url)) {
                if (options.verbose) {
                    console.log(`Not a valid package.json at ${modRoot}`);
                }

                return reject(`Not a valid package.json at ${modRoot}`);
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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });
}

/**
 * Connect node_modules copy of a package (within unity project)
 * to module clone created by unity-npm-utils::modCloneOrPull
 * using npm link.
 *
 * Once this connection is established, changes made to the (module's) source
 * in unity can be synced to the clone using unity-npm-utils::syncPlugin2Src
 *
 * @param {string} modRoot - the absolute path of the module root (where package.json lives)
 *
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp.
 *
 * @param {string} options.project_root - the abs path for the root of the (Unity) project, where package.json lives.
 *      Defaults to 2 directories above modRoot param
 */
const modCloneLink = (modRoot, options, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        _infoForPkg(modRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            const pkg = info.package;

            if (!(pkg && pkg.repository && pkg.repository.url)) {
                return reject("Not a valid package.json at " + modRoot);
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
                    options.project_root : path.join(modRoot, '..', '..');

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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        });
}

const copyUnity2LinkedClone = (unityRoot, pkgName, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        const modRoot = path.join(unityRoot, 'node_modules', pkgName);

        _infoForPkg(modRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            if (options.verbose) {
                console.log(`copy unity to linked clone: unityroot=${unityRoot}, pkgPath=${modRoot}, options=${JSON.stringify(options)}`);
            }

            const pkg = info.package;

            modCloneOrPull(modRoot, options, (cloneErr) => {
                if (cloneErr) {
                    return reject(cloneErr);
                }

                if (options.verbose) {
                    console.log('clone succeeded...');
                    console.log('link clone to node_module %j with options', modRoot, options);
                }

                modCloneLink(modRoot, options, (linkErr) => {
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

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        })
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
