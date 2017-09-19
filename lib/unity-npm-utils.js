const mkdirp = require('mkdirp');
const path = require('path');
const ncp = require('ncp');
const rimraf = require('rimraf');
const homeOrTmp = require('home-or-tmp');
const cloneOrPull = require('git-clone-or-pull');
const spawn = require('child_process').spawn;


const _resolveCloneDir = (moduleRoot, options) => {
    return (options && options.clone_dir) ?
        options.clone_dir : path.join(homeOrTmp, 'unity-npm-utils-packages');
}

/**
 * Install a unity package from node_modules/$package_name
 * to Assets/Plugins/$scope/$package_name.
 *
 * Typically, this is called from a postinstall script specified in the package
 *
 * @param {string} moduleRoot - the absolute path of the module root (where package.json lives)
 *
 * @param {string} pkgScope - a scope to install the package into under Assets/Plugins.
 *      If nothing passed, takes the value from package.json 'scope' property.
 *
 * @param {string} srcPkg - name of the folder within the package that will be copied
 *      to (unity)/Assets/Plugins/$scope/$package_name. If nothing passed, defaults to 'src'.
 */
const installPlugin = function(moduleRoot, pkgScope, srcPkg) {

    // by default expects a 'src' folder at the root of the package
    // whose contents will be copied to the target dir in Assets/Plugins
    srcPkg = srcPkg ? srcPkg : "src";

    // by default expects the package.json to have a 'scope' property
    // and that will be the target folder, e.g. Assets/Plugins/$scope
    pkgScope = pkgScope ? pkgScope : process.env.npm_package_scope;

    const src = path.join(moduleRoot, srcPkg);

    // expecting the module root will be as $unityProject/node_modules/$thisModule...
    const tgt = path.join(moduleRoot, '..', '..', 'Assets', 'Plugins', pkgScope);

    const ismodule = moduleRoot.split(path.sep).filter(function(i) {
        return i == 'node_modules';
    }).length > 0;

    // if we're not under node_modules, don't install
    if (!ismodule) {
        return false;
    }

    mkdirp(tgt, function(err) {
        if (err) {
            console.error(err)
            process.exit(1);
        }

        // Copy files
        ncp(src, tgt, function(err) {
            if (err) {
                console.error(err);
                process.exit(1);
            }
        });
    });
    return true;
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
 * @param {string} unitySrcRoot - abs path of the unity project we are syncing *from*
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
const syncPlugin2Src = function(unitySrcRoot, pkgTgtRoot, options) {
    options = options ? options : {};

    // expecting the module root will be as $unityProject/node_modules/$thisModule...

    const pkgScope = options.package_scope ?
        options.package_scope : process.env.npm_package_scope;

    const pkgName = options.package_name ?
        options.package_name : process.env.npm_package_name

    const unitySrc = path.join(
        unitySrcRoot,
        'Assets',
        'Plugins',
        pkgScope,
        pkgName);

    const pkgTgtSrc = path.join(
        pkgTgtRoot,
        options.src_path ? options.src_path : "src",
        pkgName);

    const ncpOpts = {
        filter: options.filter ? options.filter : /^[^.]+$|\.(?!(meta)$)([^.]+$)/,
        clobber: options.no_clobber ? false : true
    }

    const copy = function() {
        ncp(unitySrc, pkgTgtSrc, ncpOpts, function(cpErr) {
            if (cpErr) {
                console.error(cpErr);
                process.exit(1);
            }
        });
    }

    if (options.overwrite) {
        const delTgt = path.join(pkgTgtSrc, '*');

        rimraf(delTgt, (delErr) => {
            if (delErr) {
                console.error(delErr);
                process.exit(1);
            }

            copy();
        });
    } else {
        copy();
    }
}

/**
 * Copy the (editted) source of a module from a unity project
 * to a package source folder.
 *
 * This enables editting packages in a unity project context and then
 * syncing the source from unity back to the package to commit changes.
 *
 * @param {string} unitySrcRoot
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
 *      ${unitySrcRoot}/node_modules/${pkgName}
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
 * @param {Object} callback - function(err, info)
 */
const modCopyFromUnity2Pkg = (unitySrcRoot, pkgName, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const info = {};
    const promise = new Promise((resolve, reject) => {

        const modRoot = path.join(unitySrcRoot, 'node_modules', pkgName);
        const pkgPath = path.join(modRoot, 'package.json');
        const pkg = require(pkgPath);

        if (!(pkg && pkg.name)) {
            return reject("Not a valid package.json at " + pkgPath);
        }

        var unitySrc = path.join(unitySrcRoot, 'Assets');

        // by default packages install to Unity/Assets/Plugins.
        // but sometimes you can't install there
        // (because, say, pkg depends on another package that installs to the Assets root)
        info.install_outside_plugins = options.install_outside_plugins ?
            options.install_outside_plugins : pkg.config ?
            pkg.config.install_outside_plugins : false;

        if (!info.install_outside_plugins) {
            unitySrc = path.join(unitySrc, 'Plugins');
        }

        // the package may be installed within a scope directory,
        // usually pulled from a {pkg_root}.scope or {pkg_root}.config.scope.
        info.scope = options.package_scope ?
            options.package_scope : pkg.scope ?
            pkg.scope : pkg.config ?
            pkg.config.scope : undefined;

        if (info.scope) {
            unitySrc = path.join(unitySrc, info.scope);
        }

        unitySrc = path.join(unitySrc, pkgName);

        // By default assume we're using the package in a unity project
        // and that we've npm-link'ed the package
        // and we'll just copy the source from Unity/Assets/... to node_modules.
        // If we're working on the package directly in a git clone
        // (and our changes are in some 'test' Unity project contained by the clone)
        // then we will copy to {package_root}/src
        info.package_tgt_root = options.package_root ?
            options.package_root : modRoot;

        info.package_tgt_src_rel = (pkg.config && pkg.config.src_path) ?
            pkg.config.src_path : "src";

        info.package_tgt_src = path.join(info.package_tgt_root, info.package_tgt_src_rel, pkgName);

        const ncpOpts = {
            filter: options.filter ? options.filter : /^[^.]+$|\.(?!(meta)$)([^.]+$)/,
            clobber: options.no_clobber ? false : true
        }

        const copy = () => {

            if (options.verbose) {
                console.log(`will copy from ${unitySrc} to ${info.package_tgt_src} with options ${JSON.stringify(options)}`)
            }

            ncp(unitySrc, info.package_tgt_src, ncpOpts, function(cpErr) {
                if (cpErr) {
                    console.error(cpErr);
                    return reject(`Copy failed with error: ${cpErr}`);
                }

                resolve(info);
            });
        }

        if (options.overwrite) {

            info.package_del_tgt = path.join(info.package_tgt_src, '*');

            if (options.verbose) {
                console.log(`option 'overwrite' is set. deleting  ${info.package_del_tgt}...`)
            }

            rimraf(info.package_del_tgt, (delErr) => {

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
 * @param {string} moduleRoot - the absolute path of the module root (where package.json lives)
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 */
const modCloneOrPull = (moduleRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    if (options.verbose) {
        console.log('modCloneOrPull modRoot=%j, options=%j', moduleRoot, options);
    }

    const promise = new Promise((resolve, reject) => {

        const pkgPath = path.join(moduleRoot, 'package.json');

        if (options.verbose) {
            console.log(`modCloneOrPull reading package at path ${pkgPath}`);
        }

        const pkg = require(pkgPath);

        if (!(pkg && pkg.repository && pkg.repository.url)) {
            if (options.verbose) {
                console.log(`Not a valid package.json at ${pkgPath}`);
            }

            return reject(`Not a valid package.json at ${pkgPath}`);
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
 * @param {string} moduleRoot - the absolute path of the module root (where package.json lives)
 *
 * @param {string} options.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp.
 *
 * @param {string} options.project_root - the abs path for the root of the (Unity) project, where package.json lives.
 *      Defaults to 2 directories above moduleRoot param
 */
const modCloneLink = (moduleRoot, options, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {
        const pkgPath = path.join(moduleRoot, 'package.json');
        const pkg = require(pkgPath);

        if (!(pkg && pkg.repository && pkg.repository.url)) {
            return reject("Not a valid package.json at " + pkgPath);
        }

        const cloneDir = _resolveCloneDir(options);
        const clonePkg = path.join(cloneDir, pkg.name);

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
                options.project_root : path.join(moduleRoot, '..', '..');

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
        const pkgPath = path.join(modRoot, 'package.json');

        if (options.verbose) {
            console.log(`copy unity to linked clone: unityroot=${unityRoot}, pkgPath=${pkgPath}, options=${JSON.stringify(options)}`);
        }

        const pkg = require(pkgPath);

        if (!(pkg && pkg.name)) {
            return reject("Not a valid package.json at " + pkgPath);
        }

        if (options.verbose) {
            console.log(`read pkg with name ${pkg.name} modCloneOrPull=${typeof(modCloneOrPull)}`);
        }

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

                modCopyFromUnity2Pkg(unityRoot, pkgName, options, (copyErr, copyInfo) => {
                    if (copyErr) {
                        return reject(copyErr);
                    }

                    console.log(`
===================================================================================================================
 copy to linked clone succeeded
 -----------------------------------------------------------------------------------------------------------------

 commit changes at ${copyInfo.package_tgt_src}

 cd ${copyInfo.package_tgt_src} && git add -A && git commit -m
===================================================================================================================
                        `);
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
        })
}

exports.installPlugin = installPlugin;
exports.syncPlugin2Src = syncPlugin2Src;
exports.modCloneOrPull = modCloneOrPull;
exports.modCloneLink = modCloneLink;
exports.modCopyFromUnity2Pkg = modCopyFromUnity2Pkg;
exports.copyUnity2LinkedClone = copyUnity2LinkedClone;
