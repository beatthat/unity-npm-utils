const fs = require('fs-extra');
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
const transformPackage = async (opts) => {

    opts = opts || {};

    if (typeof opts.transform !== 'function' && typeof opts.transformAsync !== 'function') {
        throw new Error('requires opts.transform of type function(pkg,callback) or opts.transformAsync of type async function(pkg)');
    }

    if (!opts.package) {
        const readPath = opts.package_read_path || opts.package_path;
        if(readPath) {
            opts.package = await readPackage(readPath);
        }
    }

    if(!opts.package) {
        throw new Error(`no package to transform in ${JSON.stringify(opts)}`);
    }

    const pkgAfter = opts.transformAsync?
        await opts.transformAsync(deepCopy(opts.package)):
        await new Promise((resolve, reject) => {
            opts.transform(deepCopy(opts.package), (e, p) => {
                return (e)? reject(e): resolve(p)
            })
        })

    const writePath = opts.package_write_path || opts.package_path;

    if (!writePath) {
        return pkgAfter;
    }

    await fs.writeFile(path.join(writePath, 'package.json'), JSON.stringify(pkgAfter, null, 2))

    return pkgAfter;
};

module.exports = transformPackage;
