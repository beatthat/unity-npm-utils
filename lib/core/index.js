const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');
const spawn = require('child_process').spawn;
const fs = require('fs-extra-promise');
const request = require('request');
const tmp = require('tmp');
const unzip = require('unzip');
const semver = require('semver');

const _resolveCloneDir = require('./_resolve-clone-dir.js');
const _infoForPkg = require('./_info-for-pkg.js');
const _transformPkg = require('./_transform-pkg.js');

const deepCopy = require('./deep-copy.js');
const incrementPackageVersion = require('./increment-package-version.js');
const readPackage = require('./read-package.js');
const setPackageVersion = require('./set-package-version.js');
const transformPackage = require('./transform-package.js');

tmp.setGracefulCleanup();



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

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
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
 * @param {function(src,dest)} options.filter - filter function used in the copy.
 *      Default filters .meta files
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
 * @param {Boolean} options.overwrite -
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

    options = options || {};

    const promise = new Promise((resolve, reject) => {

        options.package_root = pkgRoot;

        _infoForPkg(pkgRoot, options)
        .then(info => copyFromUnity2Pkg(unityProjectRoot, info.package.name, options))
        .then(info => resolve(info))
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
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
 * @param {bool} options.overwrite -
 *      if TRUE, deletes the existing contents of target src before syncing.
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

    options = options || {};

    const promise = new Promise((resolve, reject) => {

        const pkgRoot = options.package_root ?
            options.package_root : path.join(unityProjectRoot, 'node_modules', pkgName);

        options.unity_project_root = unityProjectRoot;

        _infoForPkg(pkgRoot, options)
        .then(info => {

            const unitySrc = info.unity_install_path;
            const pkgTgtSrc = info.package_unity_src;

            const copy = () => {

                if (options.verbose) {
                    console.log(`will copy from ${unitySrc} to ${pkgTgtSrc} with options ${JSON.stringify(options)}`)
                }

                fs.copyAsync(unitySrc, pkgTgtSrc, {
                    filter: options.filter ? options.filter : (src, dst) => {
                        return String(src).match(/^[^.]+$|\.(?!(meta)$)([^.]+$)/)
                    },
                    overwrite: options.no_clobber ? false : true
                })
                .then(afterCopy => resolve(info))
                .catch(e => reject(e))
            }

            if (options.overwrite) {

                const pkgTgtDel = info.package_del_tgt = path.join(pkgTgtSrc, '*');

                if (options.verbose) {
                    console.log(`option 'overwrite' is set. deleting  ${pkgTgtDel}...`)
                }

                rimraf(pkgTgtDel, (delErr) => {

                    if (delErr) {
                        return reject(`Delete for overwrite failed with error: ${delErr}`);
                    }

                    copy();
                });
            } else {
                copy();
            }
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

// /**
//  * Connect node_modules copy of a package (within unity project)
//  * to module clone created by unity-npm-utils::modCloneOrPull
//  * using npm link.
//  *
//  * Once this connection is established, changes made to the (module's) source
//  * in unity can be synced to the clone using unity-npm-utils::syncPlugin2Src
//  *
//  * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
//  *
//  * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp.
//  *
//  * @param {string} options.project_root - the abs path for the root of the (Unity) project, where package.json lives.
//  *      Defaults to 2 directories above pkgRoot param
//  */
// const modCloneLink = (pkgRoot, options, callback) => {
//     if (typeof(options) === 'function') {
//         callback = options;
//         options = {};
//     }
//
//     options = options ? options : {};
//
//     const promise = new Promise((resolve, reject) => {
//
//         _infoForPkg(pkgRoot, options, (infoErr, info) => {
//             if (infoErr) {
//                 return reject(infoErr);
//             }
//
//             const pkg = info.package;
//
//             if (!(pkg && pkg.repository && pkg.repository.url)) {
//                 return reject("Not a valid package.json at " + pkgRoot);
//             }
//
//             const cloneDir = info.clone_root_path = _resolveCloneDir(options);
//             const clonePkg = info.clone_pkg_path = path.join(cloneDir, pkg.name);
//
//             if (options.verbose) {
//                 console.log('cd %j && npm link', clonePkg);
//             }
//
//             const linkClone = spawn('npm link', {
//                 stdio: 'inherit',
//                 shell: true,
//                 cwd: clonePkg
//             });
//
//             linkClone.on('exit', (code, signal) => {
//
//                 if (code !== 0 || signal) {
//                     return reject(`npm link clone failed with code ${code} and signal ${signal}`)
//                 }
//
//                 const projectRoot = options.project_root ?
//                     options.project_root : path.join(pkgRoot, '..', '..');
//
//                 if (options.verbose) {
//                     console.log('cd %j && npm link %j', projectRoot, pkg.name);
//                 }
//
//                 const linkNodeModule = spawn(`npm link ${pkg.name}`, {
//                     stdio: 'inherit',
//                     shell: true,
//                     cwd: projectRoot
//                 });
//
//
//                 linkNodeModule.on('exit', (code, signal) => {
//
//                     if (code !== 0 || signal) {
//                         return reject(`npm link node module failed with code ${code} and signal ${signal}`)
//                     }
//
//                     resolve();
//                 });
//
//             });
//         });
//
//     });
//
//     return (callback) ?
//         promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
// }

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

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = {
    installPlugin: installPlugin,
    pkg2UnityInstall: pkg2UnityInstall,
    syncPlugin2Src: syncPlugin2Src,
    modCloneOrPull: require('../git/clone-or-pull-installed-package.js'),
    modCloneLink: require('../git/link-package-2-clone.js'),
    copyFromUnity2Pkg: copyFromUnity2Pkg,
    copyFromUnity2PkgRoot: copyFromUnity2PkgRoot,
    copyUnity2LinkedClone: copyUnity2LinkedClone,

    deepCopy: deepCopy,
    readPackage: readPackage,
    transformPackage: transformPackage,
    incrementPackageVersion: incrementPackageVersion,
    setPackageVersion: setPackageVersion
}
