const fs = require('fs-extra-promise');

const _installTemplateToTmp = require('./_install-template-to-tmp.js');

const readPackage = require('../core/read-package.js');
const setPackageName = require('./set-package-name.js');
const transformPackage = require('../core/transform-package.js');

/**
 * Updates package.json scripts and template files for a Unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const updateTemplate = (pkgRoot, options, callback) => {
    if(typeof options === 'function') {
        callback = options;
        options = {}
    }

    options = options || {};

    const promise = new Promise((resolve, reject) => {
        _installTemplateToTmp((installErr, tmpInstallPath) => {
            if(installErr) {
                return reject(installErr);
            }

            readPackage(pkgRoot)
            .then(pkgBefore => {
                transformPackage({
                    package_read_path: tmpInstallPath,
                    package_write_path: tmpInstallPath,
                    transform: (pkgTemplate, cb) => {
                        const pkgAfter = { ...pkgBefore };
                        pkgAfter.scripts = { ...pkgBefore.scripts, ...pkgTemplate.scripts };
                        pkgAfter.dependencies = { ...pkgBefore.dependencies, ...pkgTemplate.dependencies };
                        pkgAfter.devDependencies = { ...pkgBefore.devDependencies, ...pkgTemplate.devDependencies };
                        cb(null, pkgAfter);
                    }
                })
                .then(p => {

                    // TODO: we're gonna just wipe out any existing ./test/package.json. Merge would be better

                    setPackageName(tmpInstallPath) // call setPackageName to make sure ./test/package.json dependency on main module is set correctly
                    .then(pkgNameSet => {

                        fs.copyAsync(tmpInstallPath, pkgRoot)
                        .then(copyDone => {
                            return resolve();
                        })
                        .catch(e => reject(e));

                    })
                    .catch(e => reject(e));

                })
                .catch(e => reject(e));
            })
            .catch(e => reject(e));
        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = updateTemplate;
