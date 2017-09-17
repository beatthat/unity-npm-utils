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

    const promise = new Promise((resolve, reject) => {
        const pkgPath = path.join(moduleRoot, 'package.json');
        const pkg = require(pkgPath);

        if (!(pkg && pkg.repository && pkg.repository.url)) {
            return reject("Not a valid package.json at " + pkgPath);
        }

        // nodegit doesn't work with git+https protocol
        // should research what's correct here, but works if we just switch to plain https
        const pkgUrl = pkg.repository.url.replace(/^git\+https/, 'https');

        console.log('url=%j', pkgUrl);

        const cloneDir = _resolveCloneDir(options);

        console.log('cloneDir=%j', cloneDir);

        mkdirp(cloneDir, (mkdirErr) => {
            if (mkdirErr) {
                console.log('failed to create clone dir %j', cloneDir);
                return reject(mkdirErr);
            }

            const pkgDir = path.join(cloneDir, pkg.name);
            console.log('pkgDir=%j', pkgDir);

            const gitOpts = {
                path: pkgDir,
                implementation: 'nodegit' //'subprocess'
            }

            cloneOrPull(pkgUrl, gitOpts, (gitErr) => {

                console.log('failed to update clone for %j with opts %j', pkgUrl, gitOpts);

                if (gitErr) {
                    return reject(gitErr);
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

        console.log('cd %j && npm link', clonePkg);

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

            console.log('cd %j && npm link %j', projectRoot, pkg.name);

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


exports.installPlugin = installPlugin;
exports.syncPlugin2Src = syncPlugin2Src;
exports.modCloneOrPull = modCloneOrPull;
exports.modCloneLink = modCloneLink;
