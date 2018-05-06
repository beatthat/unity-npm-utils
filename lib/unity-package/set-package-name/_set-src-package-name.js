const fs = require('fs-extra-promise')
const mkdirp = require('mkdirp')
const path = require('path')

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
 * @returns {Promise}
 */
const _setSrcPackageName = async (pkgRoot, pkgName) => {


    const pkgSrcRoot = path.join(pkgRoot, 'Runtime')

    // patch legacy packages by renaming src folder from 'src' to 'Runtime' (unity's preferred name)
    if(! await fs.existsAsync(pkgSrcRoot) && await fs.existsAsync(path.join(pkgRoot, 'src'))) {
        await fs.renameAsync(path.join(pkgRoot, 'src'), pkgSrcRoot)
    }

    const pkgSrcDir = path.join(pkgSrcRoot, pkgName)

    const results = {
        package_src_name: pkgSrcDir
    };

    await fs.ensureDirAsync(pkgSrcRoot);

    const dirFiles = await fs.readdirAsync(pkgSrcRoot);

    const curName = results.package_src_name_before = dirFiles.find((f) => {
        return f && f.length > 0 && f[0] !== '.'
    });

    if (curName === pkgName) {
        return results;
    }

    if (!curName) {
        await fs.ensureDirAsync(pkgSrcDir);
        return results;
    }

    await fs.renameAsync(path.join(pkgSrcRoot, curName), pkgSrcDir);
    return results;
}

module.exports = _setSrcPackageName;
