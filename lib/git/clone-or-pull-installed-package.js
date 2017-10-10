const cloneOrPull = require('./_clone-or-pull.js');
const fs = require('fs-extra-promise');
const path = require('path');

const _infoForPkg = require('../core/_info-for-pkg.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');

/**
 * Create or update a clone of an installed package
 * for the purpose of applying changes made within a unity-project context
 * back to the module[s] used by that unity project.
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 * @param {string} opts.clone_dir - the abs path for where to put the package clone, defaults to user home or tmp
 */
const cloneOrPullInstalledPackage = async (pkgRoot, opts) => {

    opts = opts || {}

    if (opts.verbose) {
        console.log('cloneOrPullPackage pkgRoot=%j, opts=%j', pkgRoot, opts)
    }

    const info = await _infoForPkg(pkgRoot, opts)
    const pkg = info.package;

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
        path.join(info.clone_dir, info.package.name);

    if (opts.verbose) {
        console.log(`pkg dir=${pkgDir}`);
    }

    await cloneOrPull(info.clone_package_url, {
        path: pkgDir
    })

    return info;
}

module.exports = cloneOrPullInstalledPackage;
