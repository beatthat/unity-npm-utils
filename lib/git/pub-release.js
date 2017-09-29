const semver = require('semver');
const _transformPkg = require('../core/_transform-pkg.js');
const nodegit = require('nodegit')

/**
 * @private
 *
 * open the git Repository for a pkgPath
 * and if that fails, try init instead
 */
const openOrInitRepo = (pkgPath, options, callback) => {
    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    const promise = new Promise((resolve, reject) => {
        nodegit.Repository.open(pkgPath)
        .then(r => resolve(r))
        .catch(e => {
            if(options.verbose) {
                console.log(`Failed to open git repo at ${pkgPath}. Will attempt init...`)
            }

            nodegit.Repository.init(pkgPath, 0)
            .then(r => resolve(r))
            .catch(e => reject(e))
        })
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

/**
 * Lookup the HEAD for a repo but if it doesn't exist yet (first commit)
 * then return null instead of throwing an error
 */
const headForRepo = (repo) => {
    return new Promise((resolve, reject) => {
        nodegit.Reference.nameToId(repo, "HEAD")
        .then(head => resolve(head))
        .catch(e => resolve(null))
    });
}

/**
 * Increments (or sets) the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkgPath abs path to the package root
 *
 * @param {string} options.release_type
 *      semver release type, e.g. major, minor, patch. Default is patch
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const pubRelease = (pkgPath, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    const req = {};

    const promise = new Promise((resolve, reject) => {
        openOrInitRepo(pkgPath, options)
        .then(repo => {
            console.log('got repo!')
            req.repo = repo;

            return _transformPkg(pkgPath, (p, cb) => {
                const versionBase = semver.valid(p.version) || semver.valid('0.0.1');
                const releaseType = options.release_type ? options.release_type : 'patch';
                const versionAfter = semver.inc(versionBase, releaseType);

                if (!versionAfter) {
                    return tcallback(new Error(`semver.inc failed for version ${versionBase} and release type ${releaseType}`));
                }

                return cb(null, {...p, version: versionAfter });
            })
        })
        .then(didSetVersion => req.repo.refreshIndex())
        .then(index => {
            req.index = index;
            return req.index.addAll()
        })
        .then(() => req.index.write())
        .then(() => req.index.writeTree())
        .then(oid => {
            req.oid = oid;
            return headForRepo(req.repo);
        })
        .then(parent => {
            const author = nodegit.Signature.create(
                'Larry Kirschner', 'larrykirschner@gmail.com',
                Math.round(Date.now() / 1000), 60
            );

            const commiter = nodegit.Signature.create(
                'Larry Kirschner', 'larrykirschner@gmail.com',
                Math.round(Date.now() / 1000), 60
            );

            return req.repo.createCommit('HEAD', author, commiter, 'commit message', req.oid, parent? [parent]: []);
        })
        .then(commitId => {
            resolve(commitId);
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = pubRelease;
