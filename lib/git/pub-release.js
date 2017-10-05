const fs = require('fs-extra-promise');
const path = require('path');
const promisify = require('es6-promisify');
const Repo = require('git-tools');
const semver = require('semver');
const shellEscape = require('shell-escape')
// const nodegit = require('nodegit');


const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);

const deepCopy = require('../core/deep-copy.js');
const readPackage = require('../core/read-package.js');
const _resolveCloneDir = require('../core/_resolve-clone-dir.js');
const _transformPkg = require('../core/_transform-pkg.js');

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

// /**
//  * @private
//  *
//  * open the git Repository for a pkgPath
//  * and if that fails, try init instead
//  */
// const _openOrInitRepo = (pkgPath, opts, callback) => {
//     if (typeof(opts) === 'function') {
//         callback = opts;
//         opts = {};
//     }
//
//     opts = opts || {};
//
//     const promise = new Promise((resolve, reject) => {
//         nodegit.Repository.open(pkgPath)
//             .then(r => resolve(r))
//             .catch(e => {
//                 if (opts.verbose) {
//                     console.log(`Failed to open git repo at ${pkgPath}. Will attempt init...`)
//                 }
//
//                 nodegit.Repository.init(pkgPath, 0)
//                     .then(r => resolve(r))
//                     .catch(e => reject(e))
//             })
//     });
//
//     return (callback) ?
//         promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
// }

/**
 * @private
 *
 * Ensure there is a git repo at the given path
 *
 * @param {string} path - path to the clone (may not yet be a clone)
 * @param {function(err, Repo)} callback
 * @returns {Promise(Repo)} if no callback passed
 */
const _ensureRepoInit = (path, opts, callback) => {
    if (typeof(opts) === 'function') {
        callback = opts;
        opts = {};
    }

    opts = opts || {};

    const promise = new Promise((resolve, reject) => {
        const repo = new Repo(path);
        repo.isRepo()
        .then(isRepo => {
            if(isRepo) {
                return resolve(repo);
            }

            repo.exec('init', '--quiet')
            .then(noErr => resolve(repo))
            .catch(e => reject(e));
        })
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

// /**
//  * @private
//  * Lookup the HEAD for a repo but if it doesn't exist yet (first commit)
//  * then return null instead of throwing an error
//  */
// const _headForRepo = (repo) => {
//     return new Promise((resolve, reject) => {
//         nodegit.Reference.nameToId(repo, "HEAD")
//             .then(head => resolve(head))
//             .catch(e => resolve(null))
//     });
// }


// /**
//  * @private
//  * Find or create the remote branch for a repo.
//  * @param {string} opts.remote_name
//  *      The remote to find or create (default is 'origin')
//  *
//  * @param {string} opts.remote_url
//
//  * @returns Promise
//  */
// const _findOrCreateRemote = (repo, opts) => {
//     opts = opts || {};
//     const remoteName = opts.remote_name || 'origin';
//
//     return new Promise((resolve, reject) => {
//         nodegit.Remote.list(repo)
//             .then(allNames => {
//                 if (allNames.includes(remoteName)) {
//                     nodegit.Remote.lookup(repo, remoteName)
//                     .then(remote => resolve(remove))
//                     .catch(e => reject(e))
//                 } else {
//                     if (!opts.remote_url) {
//                         throw new Error('missing required option remote_url')
//                     }
//                     nodegit.Remote.create(repo, remoteName, opts.remote_url)
//                         .then(remote => resolve(remote))
//                         .catch(e => reject(e));
//                 }
//             })
//             .catch(e => reject(e))
//     });
// }

/**
 * Increments (or sets) the version for a unity package.
 * By default increments the patch version.
 *
 * @param {string} pkgPath abs path to the package root
 *
 * @param {string} opts.release_type
 *      semver release type, e.g. major, minor, patch. Default is patch
 *
 *
 * @param {string} opts.commit_message
 *      message for commit default is 'tagging release $newverion'
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

    const info = {};

    const promise = new Promise((resolve, reject) => {
        // info.clone_dir = _resolveCloneDir(opts);
        //
        // if (opts.verbose) {
        //     console.log(`clone dir=${info.clone_dir}`);
        // }

        readPackage(pkgPath)
        .then(pkg => {
            info.package = pkg;
            info.package_before = deepCopy(pkg);
            console.log('info.clone_dir=%j, info.package.name=%j', info.clone_dir, info.package.name)
        //     info.clone_package_path = path.join(info.clone_dir, info.package.name);
        //     return fs.ensureDirAsync(info.clone_package_path);
        // })
        // .then(dirExists  => {
            return _ensureRepoInit(pkgPath, opts);
        })
        .then(repo => {
            console.log('got repo!')
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
            const commitMsg = opts.commit_message || `'release version ${info.package.version}'`;
            return info.repo.exec('commit', `--message=${commitMsg}`)
        })
            // .then(index => {
            //     req.index = index;
            //     return req.index.addAll()
            // })
            // .then(() => req.index.write())
            // .then(() => req.index.writeTree())
            // .then(oid => {
            //     req.oid = oid;
            //     return _headForRepo(req.repo);
            // })
            // .then(parent => {
            //     const author = nodegit.Signature.create(
            //         'Larry Kirschner', 'larrykirschner@gmail.com',
            //         Math.round(Date.now() / 1000), 60
            //     );
            //
            //     const commiter = nodegit.Signature.create(
            //         'Larry Kirschner', 'larrykirschner@gmail.com',
            //         Math.round(Date.now() / 1000), 60
            //     );
            //
            //     return req.repo.createCommit('HEAD', author, commiter, 'commit message', req.oid, parent ? [parent] : []);
            // })
            // .then(commitId => {
            //     const remoteUrl = `git@github.com:${info.pkg.config.scope}/${info.pkg.name}.git`
            //     console.log('remoteUrl=%j', remoteUrl);
            //     return _findOrCreateRemote(req.repo, { remote_url: remoteUrl })
            // })
            // .then(remote => {
            //     req.remote = remote;
            //     return _requireHelperCred('https://github.com');
            // })
            // .then(helperCred => {
            //     return req.remote.push(["refs/heads/master:refs/heads/master"], {
            //         callbacks: {
            //             certificateCheck: () => { return 1; },
            //             credentials: (url, userName) => {
            //
            //                 console.log('credentials callback for url %j and username %j and helperCred=%j', url, userName, helperCred);
            //                 // const credType = nodegit.Cred.sshKeyFromAgent(userName);
            //                 // const cred = nodegit.Cred.userpassPlaintextNew('beatthat', 'sharethebestofy0u!'); //helperCred.username, helperCred.password);
            //                 return nodegit.Cred.sshKeyNew(
            //                           userName, //'beatthat', //helperCred.username,
            //                           '/Users/larryk/.ssh/id_rsa.pub',
            //                           '/Users/larryk/.ssh/id_rsa',
            //                           helperCred.password);
            //
            //                 // console.log('cred=%j', cred);
            //                 // return cred;
            //             }
            //         }
            //     });
            // })
        .then(done => resolve())
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

// /**
//  * Increments (or sets) the version for a unity package.
//  * By default increments the patch version.
//  *
//  * @param {string} pkgPath abs path to the package root
//  *
//  * @param {string} opts.release_type
//  *      semver release type, e.g. major, minor, patch. Default is patch
//  *
//  * @param {function(err, pkg)} callback
//  *
//  * @returns if no callback function passed, returns a Promise
//  */
// const pubRelease = (pkgPath, opts, callback) => {
//
//     if (typeof(opts) === 'function') {
//         callback = opts;
//         opts = {};
//     }
//
//     opts = opts || {};
//
//     const req = {};
//
//     const info = {};
//
//     const promise = new Promise((resolve, reject) => {
//
//         _openOrInitRepo(pkgPath, opts)
//             .then(repo => {
//                 console.log('got repo!')
//                 req.repo = repo;
//
//                 return _transformPkg(pkgPath, (p, cb) => {
//                     const versionBase = semver.valid(p.version) || semver.valid('0.0.1');
//                     const releaseType = opts.release_type ? opts.release_type : 'patch';
//                     const versionAfter = semver.inc(versionBase, releaseType);
//
//                     if (!versionAfter) {
//                         return tcallback(new Error(`semver.inc failed for version ${versionBase} and release type ${releaseType}`));
//                     }
//
//                     return cb(null, { ...p,
//                         version: versionAfter
//                     });
//                 })
//             })
//             .then(pkg => {
//                 info.pkg = pkg;
//                 return req.repo.refreshIndex()
//             })
//             .then(index => {
//                 req.index = index;
//                 return req.index.addAll()
//             })
//             .then(() => req.index.write())
//             .then(() => req.index.writeTree())
//             .then(oid => {
//                 req.oid = oid;
//                 return _headForRepo(req.repo);
//             })
//             .then(parent => {
//                 const author = nodegit.Signature.create(
//                     'Larry Kirschner', 'larrykirschner@gmail.com',
//                     Math.round(Date.now() / 1000), 60
//                 );
//
//                 const commiter = nodegit.Signature.create(
//                     'Larry Kirschner', 'larrykirschner@gmail.com',
//                     Math.round(Date.now() / 1000), 60
//                 );
//
//                 return req.repo.createCommit('HEAD', author, commiter, 'commit message', req.oid, parent ? [parent] : []);
//             })
//             .then(commitId => {
//                 const remoteUrl = `git@github.com:${info.pkg.config.scope}/${info.pkg.name}.git`
//                 console.log('remoteUrl=%j', remoteUrl);
//                 return _findOrCreateRemote(req.repo, { remote_url: remoteUrl })
//             })
//             .then(remote => {
//                 req.remote = remote;
//                 return _requireHelperCred('https://github.com');
//             })
//             .then(helperCred => {
//                 return req.remote.push(["refs/heads/master:refs/heads/master"], {
//                     callbacks: {
//                         certificateCheck: () => { return 1; },
//                         credentials: (url, userName) => {
//
//                             console.log('credentials callback for url %j and username %j and helperCred=%j', url, userName, helperCred);
//                             // const credType = nodegit.Cred.sshKeyFromAgent(userName);
//                             // const cred = nodegit.Cred.userpassPlaintextNew('beatthat', 'sharethebestofy0u!'); //helperCred.username, helperCred.password);
//                             return nodegit.Cred.sshKeyNew(
//                                       userName, //'beatthat', //helperCred.username,
//                                       '/Users/larryk/.ssh/id_rsa.pub',
//                                       '/Users/larryk/.ssh/id_rsa',
//                                       helperCred.password);
//
//                             // console.log('cred=%j', cred);
//                             // return cred;
//                         }
//                     }
//                 });
//             })
//             .then(done => resolve())
//             .catch(e => reject(e))
//     });
//
//     return (callback) ?
//         promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
// }

module.exports = pubRelease;
