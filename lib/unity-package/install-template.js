const mkdirp = require('mkdirp');
const ncp = require('ncp');

const _installTemplateToTmp = require('./_install-template-to-tmp.js');

/**
 * Install template files for a Unity package
 *
 * @param {string} installPath abs path where the package will install
 * @param {Object} options
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const installTemplate = (installPath, options, callback) => {

    const promise = new Promise((resolve, reject) => {
        mkdirp(installPath, (mkdirErr) => {
            if (mkdirErr) {
                return reject(mkdirErr);
            }

            _installTemplateToTmp((installErr, tmpInstallPath) => {
                if(installErr) {
                    return reject(installErr);
                }

                ncp(tmpInstallPath, installPath, (cpErr) => {
                    if (cpErr) {
                        console.error('failed to copy archive %j', cpErr);
                        return reject(cpErr);
                    }

                    return resolve();
                });
            });
        });

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = installTemplate;
