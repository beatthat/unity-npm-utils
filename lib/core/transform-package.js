const fs = require('fs-extra-promise');
const path = require('path');
const deepCopy = require('./deep-copy.js');
const readPackage = require('./read-package.js');

const transformPackage = (options, callback) => {

    const promise = new Promise((resolve, reject) => {
        if (typeof options.transform !== 'function') {
            return reject(new Error('requires options.transform of type function(pkg,callback)'));
        }

        if (!options.package && options.package_read_path) {
            return readPackage(options.package_read_path)
                .then(p => {
                    transformPackage({ ...options,
                        package: p
                    }, (e, r) => {
                        return (e) ? reject(e) : resolve(r);
                    });
                })
                .catch(e => reject(e));
        }

        options.transform(deepCopy(options.package), (transErr, pkgAfter) => {

            if (transErr) {
                return reject(transErr);
            }

            if (!options.package_write_path) {
                return resolve(pkgAfter);
            }

            fs.writeFileAsync(path.join(options.package_write_path, 'package.json'), JSON.stringify(pkgAfter, null, 2))
                .then(wr => {
                    resolve(pkgAfter)
                })
                .catch(we => reject(we));
        })
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
};

module.exports = transformPackage;
