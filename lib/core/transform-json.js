const fs = require('fs-extra');
const path = require('path');
const deepCopy = require('./deep-copy.js');
const readJson = require('./read-json.js');

/**
 * Transform function passed to transformPackage
 * takes a package, transforms the package, and then makes a callback.
 *
 * @callback transformFunction
 * @param {Object} package the package.json as an object
 * @param {function(err, pkgTransformed)} callback
 */

/**
 * Transforms a json with a caller-provided transform function\
 * and various options for how the json is read and/or written
 *
 * @param {string} options.path
 *      For a read=>transform=>write operation, this is the read and write path
 *
 * @param {string} options.read_path
 *      For a read=>transform... operation, this is the read path
 *
 * @param {string} options.write_path
 *      For a ...=>transform=>write operation, this is the write path
 *
 * @param {string} options.file_name
 *   For a read=>transform=>write operation, this is the read and write file name
 *
 * @param {string} options.read_file_name
 *  For a read=>transform... operation, this is the read file name
 *
 * @param {string} options.write_file_name
 *  For a ...=>transform=>write operation, this is the write file name

 * @param {string} options.json
 *      For an operation where the json has already been read in
 *      and is ready to transform. The transform will NOT change this json Object
 *      but instead first make a copy.
 *
 * @param {string} options.json_default
 *      Json object to use as the read json for a read/write op in the event that there is no json to read
 *
 * @param {transformFunction} options.tranform
 *      For an operation where the json has already been read in and is ready to transform
 */
const transformJson = async (opts) => {

    opts = opts || {};

    if (typeof opts.transform !== 'function' && typeof opts.transformAsync !== 'function') {
        throw new Error('requires opts.transform of type function(pkg,callback) or opts.transformAsync of type async function(pkg)');
    }

    if (!opts.json) {
        const readPath = opts.read_path || opts.path;
        if(readPath) {
            opts.json = await readJson(readPath, { 'file_name': opts.file_read_name || opts.file_name });
        }
    }

    opts.json = opts.json || opts.json_default

    if(!opts.json) {
        throw new Error(`no json to transform in ${JSON.stringify(opts)}`);
    }

    const pkgAfter = opts.transformAsync?
        await opts.transformAsync(deepCopy(opts.json)):
        await new Promise((resolve, reject) => {
            opts.transform(deepCopy(opts.json), (e, p) => {
                return (e)? reject(e): resolve(p)
            })
        })

    const writePath = opts.write_path || opts.path;

    if (!writePath) {
        return pkgAfter;
    }

    const fileWriteName = opts.file_write_name || opts.file_name || 'package.json'

    await fs.writeFile(path.join(writePath, fileWriteName), JSON.stringify(pkgAfter, null, 2))

    return pkgAfter;
};

module.exports = transformJson;
