const semver = require('semver');
const _transformPkg = require('../core/_transform-pkg.js');
const nodegit = require('nodegit');

const promisify = require('es6-promisify');

const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);


const _requireHelperCred = (url) => {
    return new Promise((resolve, reject) => {
        gchAvailable()
        .then(a => {
            if(!a) {
                throw new Error('git credential helper is not available (required)');
            }
            return gchFill(url);
        })
        .then(creds => {
            if(!creds && creds.username && creds.password) {
                throw new Error('requires credentials stored in helper (missing)')
            }
            resolve(creds)
        })
        .catch(e => reject(e))
    })
}
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
                if (options.verbose) {
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
 * @private
 * Lookup the HEAD for a repo but if it doesn't exist yet (first commit)
 * then return null instead of throwing an error
 */
const _headForRepo = (repo) => {
    return new Promise((resolve, reject) => {
        nodegit.Reference.nameToId(repo, "HEAD")
            .then(head => resolve(head))
            .catch(e => resolve(null))
    });
}


/**
 * @private
 * Find or create the remote branch for a repo.
 * @param {string} options.remote_name
 *      The remote to find or create (default is 'origin')
 *
 * @param {string} options.remote_url

 * @returns Promise
 */
const _findOrCreateRemote = (repo, options) => {
    options = options || {};
    const remoteName = options.remote_name || 'origin';

    return new Promise((resolve, reject) => {
        nodegit.Remote.list(repo)
            .then(allNames => {
                if (allNames.includes(remoteName)) {
                    nodegit.Remote.lookup(repo, remoteName)
                    .then(remote => resolve(remove))
                    .catch(e => reject(e))
                } else {
                    if (!options.remote_url) {
                        throw new Error('missing required option remote_url')
                    }
                    nodegit.Remote.create(repo, remoteName, options.remote_url)
                        .then(remote => resolve(remote))
                        .catch(e => reject(e));
                }
            })
            .catch(e => reject(e))
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

    const info = {};

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

                    return cb(null, { ...p,
                        version: versionAfter
                    });
                })
            })
            .then(pkg => {
                info.pkg = pkg;
                return req.repo.refreshIndex()
            })
            .then(index => {
                req.index = index;
                return req.index.addAll()
            })
            .then(() => req.index.write())
            .then(() => req.index.writeTree())
            .then(oid => {
                req.oid = oid;
                return _headForRepo(req.repo);
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

                return req.repo.createCommit('HEAD', author, commiter, 'commit message', req.oid, parent ? [parent] : []);
            })
            .then(commitId => {
                const remoteUrl = `git@github.com:${info.pkg.config.scope}/${info.pkg.name}.git`
                console.log('remoteUrl=%j', remoteUrl);
                return _findOrCreateRemote(req.repo, { remote_url: remoteUrl })
            })
            .then(remote => {
                req.remote = remote;
                return _requireHelperCred('https://github.com');
            })
            .then(helperCred => {
                return req.remote.push(["refs/heads/master:refs/heads/master"], {
                    callbacks: {
                        certificateCheck: () => { return 1; },
                        credentials: (url, userName) => {

                            console.log('credentials callback for url %j and username %j and helperCred=%j', url, userName, helperCred);
                            // const credType = nodegit.Cred.sshKeyFromAgent(userName);
                            // const cred = nodegit.Cred.userpassPlaintextNew('beatthat', 'sharethebestofy0u!'); //helperCred.username, helperCred.password);
                            return nodegit.Cred.sshKeyNew(
                                      userName, //'beatthat', //helperCred.username,
                                      '/Users/larryk/.ssh/id_rsa.pub',
                                      '/Users/larryk/.ssh/id_rsa',
                                      helperCred.password);

                            // console.log('cred=%j', cred);
                            // return cred;
                        }
                    }
                });
            })
            .then(done => resolve())
            .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = pubRelease;
