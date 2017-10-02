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
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const _setSrcPackageName = (pkgRoot, pkgName, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    const promise = new Promise((resolve, reject) => {
        const pkgSrcRoot = path.join(pkgRoot, 'src');
        const pkgSrcDir = path.join(pkgSrcRoot, pkgName);

        const results = {
            package_src_name: pkgSrcDir
        };

        fs.ensureDirAsync(pkgSrcRoot)
            .then(dirExists => fs.readdirAsync(pkgSrcRoot))
            .then(dirFiles => {

                const curName = results.package_src_name_before = dirFiles.find((f) => {
                    return f && f.length > 0 && f[0] !== '.'
                });

                if (curName === pkgName) {
                    return resolve(results);
                }

                if (!curName) {
                    return fs.ensureDirAsync(pkgSrcDir)
                        .then(srcDirExists => resolve(results))
                        .catch(e => reject(e));
                }

                fs.renameAsync(path.join(pkgSrcRoot, curName), pkgSrcDir)
                    .then(didRename => resolve(results))
                    .catch(e => reject(e))
            })
            .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = _setSrcPackageName;
