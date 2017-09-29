const fs = require('fs-extra-promise');

const _installTemplateToTmp = require('./_install-template-to-tmp.js');
const setPackageName = require('./set-package-name.js');

/**
 * Install template files for a Unity package
 *
 * @param {string} installPath abs path where the package will install
 * @param {Object} options.package_name
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const installTemplate = (installPath, options, callback) => {

    const promise = new Promise((resolve, reject) => {
        fs.ensureDirAsync(installPath)
        .then(() => fs.readdirAsync(installPath))
        .then(files => {
            if(files.filter(f => f && f[0] !== '.').length > 0) {
                throw new Error(`cannot install into non-empty path: ${installPath}`);
            }

            return _installTemplateToTmp();
        })
        .then(tmpInstallPath => fs.copyAsync(tmpInstallPath, installPath))
        .then(afterCopy => {
            if(!options.package_name) {
                return resolve();
            }

            setPackageName(installPath, { package_name: options.package_name }, (nameErr) => {
                return nameErr? reject(nameErr): resolve();
            });
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = installTemplate;
