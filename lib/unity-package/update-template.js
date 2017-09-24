const ncp = require('ncp');

const _installTemplateToTmp = require('./_install-template-to-tmp.js');

const readPackage = require('../core/read-package.js');
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
const updateTemplate = (pkgRoot, callback) => {
    const promise = new Promise((resolve, reject) => {
        _installTemplateToTmp((installErr, tmpInstallPath) => {
            if(installErr) {
                return reject(installErr);
            }

            readPackage(pkgRoot, (readErr, pkgBefore) => {
                if(readErr) {
                    return reject(readErr);
                }

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
                }, (e, p) => {
                    ncp(tmpInstallPath, pkgRoot, (cpErr) => {
                        if (cpErr) {
                            console.error('failed to copy archive %j', cpErr);
                            return reject(cpErr);
                        }

                        return resolve();
                    });
                });
            });

        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = updateTemplate;
