const fs = require('fs-extra');
const giturl = require('giturl');
const path = require('path');
const Repo = require('git-tools');
const semver = require('semver');


const deepCopy = require('../core/deep-copy.js');
const readPackage = require('../core/read-package.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');
const _transformPkg = require('../core/_transform-pkg.js');

const ensureRepoExists = require('./ensure-repo-exists.js');
const _ensureRepoInit = require('./_ensure-repo-init.js');
const _ensureRemoteSet = require('./_ensure-remote-set.js');

const _findRepoUrlForPackage = (pkg) => {
    return (pkg.repository && pkg.repository.url) ? giturl.parse(pkg.repository.url) : null;
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
 */
const pubRelease = async(pkgPath, opts) => {

    opts = opts || {};

    var info = {
        branch: opts.branch || 'master',
    };

    const p0 = await readPackage(pkgPath)

    info.package = p0;
    info.package_before = deepCopy(p0)

    if(opts.verbose) {
        console.log(`read package with name ${info.package.name} from path ${pkgPath}`)
    }

    const repo = await _ensureRepoInit(pkgPath, opts)

    const pkg = await _transformPkg(pkgPath, (p, cb) => {
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

    info.package = pkg;

    await ensureRepoExists({ ...opts, repo_name: opts.repo_name || info.package.name })

    opts.remote_url = opts.remote_url ||
        _findRepoUrlForPackage(info.package);

    const remoteInfo = await _ensureRemoteSet(repo, opts)

    info = {
        ...info,
        ...remoteInfo
    }

    await repo.exec('add', '-A')

    info.commit_message = opts.commit_message || `'release version ${info.package.version}'`;

    await repo.exec('commit', `--message=${info.commit_message}`)

    await repo.exec('push', '-u', info.remote, info.branch)

    return info;
}

module.exports = pubRelease;
