const fs = require('fs-extra-promise');
const giturl = require('giturl');
const path = require('path');
// const promisify = require('es6-promisify');
const Repo = require('git-tools');
const semver = require('semver');

// const gitCredentialHelper = require('git-credential-helper');
// const gchAvailable = promisify(gitCredentialHelper.available);
// const gchFill = promisify(gitCredentialHelper.fill);

const deepCopy = require('../core/deep-copy.js');
const readPackage = require('../core/read-package.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');
const _transformPkg = require('../core/_transform-pkg.js');

const _ensureRepoInit = require('./_ensure-repo-init.js');
const _ensureRemoteSet = require('./_ensure-remote-set.js');

const _findRepoUrlForPackage = (pkg) => {
    return (pkg.repository && pkg.repository.url)? giturl.parse(pkg.repository.url): null;
}
/**
 * Increments (or sets) the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkgPath abs path to the package root
 *
 * @param {string} opts.release_type
 *      semver release type, e.g. major, minor, patch. Default is patch
 *
 * @param {string} opts.commit_message
 *      message for commit default is 'tagging release $newverion'
 *
 * @param {string} opts.tag_message
 *      message for tag. will use opts.commit_message or 'tagging release $newverion' if none specified
 *
 * @param {string} opts.remote - name of remote to push to (origin by default)
 * @param {string} opts.remote_url -
 *  url for the remote.
 *  REQUIRED if not set in package.repository and the remote does not yet exist
 *
 * @param {string} opts.branch - the branch to push to 'master' by default
 *
 * @param {function(err, pkg)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const pubRelease = (pkgPath, opts, callback) => {

    if (typeof(opts) === 'function') {
        callback = opts;
        opts = {};
    }

    opts = opts || {};

    var info = {
        branch: opts.branch || 'master',
    };

    const promise = new Promise((resolve, reject) => {

        readPackage(pkgPath)
            .then(pkg => {
                info.package = pkg;
                info.package_before = deepCopy(pkg);
                console.log('info.package.name=%j', info.package.name)
                return _ensureRepoInit(pkgPath, opts);
            })
            .then(repo => {
                info.repo = repo;

                return _transformPkg(pkgPath, (p, cb) => {
                    const versionBase = semver.valid(p.version) || semver.valid('0.0.1');
                    const releaseType = opts.release_type ? opts.release_type : 'patch';
                    const versionAfter = semver.inc(versionBase, releaseType);

                    if (!versionAfter) {
                        return tcallback(new Error(`semver.inc failed for version ${versionBase} and release type ${releaseType}`));
                    }

                    return cb(null, { ...p,
                        version: versionAfter
                    });
                })
            })
            .then(pkg => {
                info.package = pkg;
                return info.repo.exec('add', '-A')
            })
            .then(added => {
                info.commit_message = opts.commit_message || `'release version ${info.package.version}'`;
                return info.repo.exec('commit', `--message=${info.commit_message}`)
            })
            .then(committed => {
                opts.remote_url = opts.remote_url ||
                    _findRepoUrlForPackage(info.package);

                return _ensureRemoteSet(info.repo, opts)
            })
            .then(remoteInfo => {
                info = { ...info,
                    ...remoteInfo
                };
                return info.repo.exec('push', info.remote, info.branch);
                // still need to tag
            })
            .then(done => resolve())
            .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = pubRelease;
