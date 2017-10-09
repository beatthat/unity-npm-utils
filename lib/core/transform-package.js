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
 */
const transformPackage = async (options) => {

    options = options || {};

    if (typeof options.transform !== 'function') {
        throw new Error('requires options.transform of type function(pkg,callback)');
    }

    if (!options.package) {
        const readPath = options.package_read_path || options.package_path;
        if(readPath) {
            options.package = await readPackage(readPath);
        }
    }

    if(!options.package) {
        throw new Error(`no package to transform in ${JSON.stringify(options)}`);
    }

    const pkgAfter = await new Promise((resolve, reject) => {
        options.transform(deepCopy(options.package), (e, p) => {

            if (e) {
                return reject(e);
            }

            resolve(p);
        });
    });

    const writePath = options.package_write_path || options.package_path;

    if (!writePath) {
        return resolve(pkgAfter);
    }

    await fs.writeFileAsync(path.join(writePath, 'package.json'), JSON.stringify(pkgAfter, null, 2))

    return pkgAfter;
};

module.exports = transformPackage;
