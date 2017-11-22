const cloneOrPull = require('./_clone-or-pull.js');
const fs = require('fs-extra-promise');
const path = require('path');
const spawn = require('child_process').spawn;

const cloneOrPullInstalledPackage = require('./clone-or-pull-installed-package.js');
const _infoForPkg = require('../core/_info-for-pkg.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');


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
 * @param {string} opts.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp.
 *
 * @param {string} opts.project_root - the abs path for the root of the (Unity) project, where package.json lives.
 *      Defaults to 2 directories above pkgRoot param
 *
 * @param {string} opts.stdio_log_path - pipe stdio to this path if set
 */
const linkPackage2Clone = async (pkgRoot, opts) => {
    opts = opts || {};

    // const promise = new Promise((resolve, reject) => {

    const info = await cloneOrPullInstalledPackage(pkgRoot, opts); //, (infoErr, info) => {
            // if (infoErr) {
            //     return reject(infoErr);
            // }

    const pkg = info.package;

    if (!(pkg && pkg.repository && pkg.repository.url)) {
        throw new Error("Not a valid package.json at " + pkgRoot);
    }

    const cloneDir = info.clone_root_path = _resolveCloneDir(opts);
    const clonePkg = info.clone_pkg_path = path.join(cloneDir, pkg.name);

    if (opts.verbose) {
        console.log('cd %j && npm link', clonePkg);
    }

    const linkCloneLog = opts.stdio_log_path?
        fs.createWriteStream(opts.stdio_log_path, {
            flags: 'a'
        })
        : undefined;

    const linkCloneProc = spawn('npm link', {
        stdio: linkCloneLog? undefined: 'inherit',
        shell: true,
        cwd: clonePkg
    });


    if(linkCloneLog) {
        linkCloneProc.stdout.pipe(linkCloneLog);
        linkCloneProc.stderr.pipe(linkCloneLog);
    }

    return new Promise((resolve, reject) => {
        linkCloneProc.on('exit', (code, signal) => {

            if (code !== 0 || signal) {
                return reject(new Error(`npm link clone failed with code ${code} and signal ${signal}`));
            }

            const projectRoot = opts.project_root ?
                opts.project_root : path.join(pkgRoot, '..', '..');

            if (opts.verbose) {
                console.log('cd %j && npm link %j', projectRoot, pkg.name);
            }

            const linkNodeModLog = opts.stdio_log_path?
                fs.createWriteStream(opts.stdio_log_path, {
                    flags: 'a'
                })
                : undefined;

            const linkNodeModProc = spawn(`npm link ${pkg.name}`, {
                stdio: linkNodeModLog? undefined: 'inherit',
                shell: true,
                cwd: projectRoot
            });

            if(linkNodeModLog) {
                linkNodeModProc.stdout.pipe(linkNodeModLog);
                linkNodeModProc.stderr.pipe(linkNodeModLog);
            }

            linkNodeModProc.on('exit', (code, signal) => {

                if (code !== 0 || signal) {
                    return reject(`npm link node module failed with code ${code} and signal ${signal}`)
                }

                resolve(info);
            });
        });
    });
}

module.exports = linkPackage2Clone;
