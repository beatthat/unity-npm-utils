const cloneOrPull = require('./_clone-or-pull.js');
const fs = require('fs-extra-promise');
const path = require('path');

const _infoForPkg = require('../core/_info-for-pkg.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');
const readUnpmLocal = require('../core/read-unpm-local')
const appRoot = require('app-root-path').path
const writePackageInfoToUnpmLocal = require('../core/write-package-info-to-unpm-local.js')

/**
 * @typedef {Object} CloneOrPullInstalledPackageReturn
 * @property {string} clone_package_path Full path to the cloned package
 * @property {string} clone_dir Full path to parent directory where (by default) packages are cloned
 * @property {object} pkg The entry from unpm-local.json that contains info about the package as installed to unity
 */

/**
 * Create or update a clone of an installed package
 * for the purpose of applying changes made within a unity-project context
 * back to the module[s] used by that unity project.
 *
 * @param {string} pkgName - package name to clonse
 * @param {string} opts.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 * @param {string} opts.project_root - [optiona] the root of the unity package. Defaults to @see app-root-path
 *
 * @returns {CloneOrPullInstalledPackageReturn}
 *
 */
const cloneOrPullInstalledPackage = async (pkgName, opts) => {

    opts = opts || {}

    const info = {}

    const projRoot = opts.project_root || appRoot

    if (opts.verbose) {
        console.log('cloneOrPullPackage projRoot=%j, opts=%j', projRoot, opts)
    }

    var unpmLocal = await readUnpmLocal(projRoot)
    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        await writePackageInfoToUnpmLocal(pkgName, {...opts, project_root: projRoot })
        unpmLocal = await readUnpmLocal(projRoot)
    }

    if(!(unpmLocal && unpmLocal.packages && unpmLocal.packages[pkgName])) {
        console.log(`package ${pkgName} is not installed in project ${projRoot}`)
        return info
    }

    const pkg = info.pkg = unpmLocal.packages[pkgName]

    if(!pkg) {
        console.log(`no package '${pkgName}' installed in ${path.join(projRoot, 'unpm-local.json')}`)
        return {}
    }

    if (!(pkg && pkg.repository && pkg.repository.url)) {
        throw new Error(`package.json must provide repository.url ${pkgRoot}`);
    }

    info.clone_package_url = pkg.repository.url.replace(/^git\+https/, 'https');

    if (opts.verbose) {
        console.log('repository.url=%j', info.clone_package_url);
    }

    info.clone_dir = _resolveCloneDir(opts);

    if (opts.verbose) {
        console.log(`clone dir=${info.clone_dir}`);
    }

    await fs.ensureDirAsync(info.clone_dir)

    const pkgDir = info.clone_package_path =
        path.join(info.clone_dir, pkgName);

    if (opts.verbose) {
        console.log(`pkg dir=${pkgDir}`);
    }

    await cloneOrPull(info.clone_package_url, {
        path: pkgDir
    })

    return info;
}

module.exports = cloneOrPullInstalledPackage;
