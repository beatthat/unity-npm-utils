const fs = require('fs-extra-promise');
const path = require('path');
const deepCopy = require('./deep-copy.js');
const readPackage = require('./read-package.js');

/**
 * Transform function passed to transformPackage
 * takes a package, transforms the package, and then makes a callback.
 *
 * @callback transformFunction
 * @param {Object} package the package.json as an object
 * @param {function(err, pkgTransformed)} callback
 */

/**
 * Transforms a package with a caller-provided transform function\
 * and various options for how the package is read and/or written
 *
 * @param {string} options.package_path
 *      For a read=>transform=>write operation, this is the read and write path
 *
 * @param {string} options.package_read_path
 *      For a read=>transform... operation, this is the read path
 *
 * @param {string} options.package_write_path
 *      For a ...=>transform=>write operation, this is the write path
 *
 * @param {string} options.package
 *      For an operation where the package has already been read in
 *      and is ready to transform. The transform will NOT change this package Object
 *      but instead first make a copy.
 *
 * @param {transformFunction} options.tranform
 *      For an operation where the package has already been read in and is ready to transform
 *
 *
 */
const transformPackage = (options, callback) => {

    options = options || {};

    const promise = new Promise((resolve, reject) => {
        if (typeof options.transform !== 'function') {
            return reject(new Error('requires options.transform of type function(pkg,callback)'));
        }

        if (!options.package) {
            const readPath = options.package_read_path || options.package_path;
            if(readPath) {
                return readPackage(readPath)
                    .then(p => {
                        transformPackage({ ...options,
                            package: p
                        }, (e, r) => {
                            return (e) ? reject(e) : resolve(r);
                        });
                    })
                    .catch(e => reject(e));
            }
        }

        if(!options.package) {
            return reject(new Error(`no package to transform in ${JSON.stringify(options)}`));
        }

        options.transform(deepCopy(options.package), (transErr, pkgAfter) => {

            if (transErr) {
                return reject(transErr);
            }

            const writePath = options.package_write_path || options.package_path;

            if (!writePath) {
                return resolve(pkgAfter);
            }

            fs.writeFileAsync(path.join(writePath, 'package.json'), JSON.stringify(pkgAfter, null, 2))
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
