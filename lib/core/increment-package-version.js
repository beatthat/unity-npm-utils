const semver = require('semver');
const _transformPkg = require('./_transform-pkg.js');

/**
 * Increments (or sets) the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkg abs path to the package root or the pkg itself.
 *      NOTE: never edits a passed in package object.
 *      Edits applied to a copy passed back via callback
 *
 * @param {string} options.release_type
 *      semver release type, e.g. major, minor, patch. Default is patch
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const incrementPackageVersion = (pkg, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    return _transformPkg(pkg, (p, cb) => {
        const versionBase = semver.valid(p.version) || semver.valid('0.0.1');
        const releaseType = options.release_type ? options.release_type : 'patch';
        const versionAfter = semver.inc(versionBase, releaseType);

        if (!versionAfter) {
            return tcallback(new Error(`semver.inc failed for version ${versionBase} and release type ${releaseType}`));
        }

        return cb(null, {...p, version: versionAfter });
    },
    callback);
}

module.exports = incrementPackageVersion;
