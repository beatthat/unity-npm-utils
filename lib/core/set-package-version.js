const _transformPkg = require('./_transform-pkg.js');

/**
 * Sets the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkg abs path to the package root or the pkg itself.
 *      NOTE: never edits a passed in package object.
 *      Edits applied to a copy passed back via callback
 *
 * @param {string} version - new version
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const setPackageVersion = (pkg, version, callback) => {
    return _transformPkg(pkg, (p, cb) => {
        const pkgAfter = {...p, version: version };
        return cb(null, pkgAfter);
    },
    callback);
}

module.exports = setPackageVersion;
