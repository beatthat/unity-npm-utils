const transformPackage = require('./transform-package');

/**
 * Convenience wrapper for transformPackage that can handle
 * an object package or a package path.
 *
 * @param {string} pkg abs path to the package root or the pkg itself.
 *      NOTE: never edits a passed in package object.
 *      Edits applied to a copy passed back via callback
 *
 * @param {function(package, callback)} transform
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const _transformPkg = (pkg, transform, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    const isPath = typeof(pkg) === 'string' || pkg instanceof String;

    return transformPackage({
            package_read_path: isPath? pkg: undefined,
            package_write_path: isPath? pkg: undefined,
            package: isPath? undefined: pkg,
            transform: transform
        }, callback);
}

module.exports = _transformPkg;
