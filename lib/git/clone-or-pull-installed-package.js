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
        throw new Error(`package ${pkgName} is not installed in project ${projRoot}`)
    }

    var pkg = unpmLocal.packages[pkgName]

    if(!pkg) {
        throw new Error(`no package '${pkgName}' installed in ${path.join(projRoot, 'unpm-local.json')}`)
    }

    if (!(pkg && pkg.repository && pkg.repository.url)) {
        throw new Error(`package.json must provide repository.url ${pkgRoot}`);
    }

    pkg.clone = pkg.clone || {}

    pkg.clone.package_url = pkg.repository.url.replace(/^git\+https/, 'https');

    if (opts.verbose) {
        console.log('repository.url=%j', pkg.clone.package_url);
    }

    pkg.clone.dir = _resolveCloneDir(opts);

    if (opts.verbose) {
        console.log(`clone dir=${pkg.clone.dir}`);
    }

    await fs.ensureDirAsync(pkg.clone.dir)

    pkg.clone.path = path.join(pkg.clone.dir, pkgName);

    if (opts.verbose) {
        console.log(`pkg dir=${pkg.clone.path}`);
    }

    pkg.clone.src_rel = (pkg.config && pkg.config.src_path)? pkg.config.src_path: 'src'

    pkg.clone.src = path.join(pkg.clone.path, pkg.clone.src_rel)

    await cloneOrPull(pkg.clone.package_url, {
        path: pkg.clone.path
    })

    const result = await writePackageInfoToUnpmLocal(pkgName, {
        ...opts,
        project_root: projRoot,
        transform_package: async (p) => { return { ...p, ...pkg } }
    })

    if (opts.verbose) {
        console.log(`cloneOrPullInstalledPackage(${pkgName}) unpm-local.json AFTER install:\n ${JSON.stringify(result.unpmLocal, null, 2)}`);
    }

    return result
}

module.exports = cloneOrPullInstalledPackage;
