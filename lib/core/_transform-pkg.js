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

 * @returns (a deep copy of) the transformed package
 */
const _transformPkg = async (pkg, transform) => {

    const isPath = typeof(pkg) === 'string' || pkg instanceof String;

    return transformPackage({
            package_path: isPath? pkg: undefined,
            package: isPath? undefined: pkg,
            transform: transform
        });
}

module.exports = _transformPkg;
