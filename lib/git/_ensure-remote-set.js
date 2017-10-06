const Repo = require('git-tools');

const _ensureRepoInit = require('./_ensure-repo-init.js');

/**
 * @callback ensureRemoteSetCallback
 * @param err - err if any
 * @param info.remote - the remote name
 * @param info.remote_url - the remote url
 */

/**
 * @private
 *
 * Ensure there is a git repo at the given path
 *
 * @param {string|Repo} pathOrRepo - path to the clone (may not yet be a clone) or Repo object
 * @param {string} opts.remote - the name of the remote that must exist. defaults to 'origin'
 * @param {string} opts.remote_url - the url to create the remote if it doesn't already exist
 * @param {ensureRemoteSetCallback} callback
 * @returns {Promise({remote: name, remote_url: url})} if no callback passed
 */
const _ensureRemoteSet = (pathOrRepo, opts, callback) => {
    if (typeof(opts) === 'function') {
        callback = opts;
        opts = {};
    }

    opts = opts || {};

    const info = {
        remote: opts.remote || 'origin'
    };

    const promise = new Promise((resolve, reject) => {

        _ensureRepoInit(pathOrRepo)
            .then(r => {
                info.repo = r;
                return info.repo.remotes();
            })
            .then(allRemotes => {
                const foundRemote = allRemotes.find(r => r.name === info.remote);
                if (foundRemote) {
                    return resolve({ ...info,
                        remote: foundRemote.name,
                        remote_url: foundRemote.url
                    })
                }

                info.remoteUrl = opts.remote_url;
                if (!info.remoteUrl) {
                    throw new Error(`remote ${info.remote} does not exists, so must pass 'remote_url' param (missing)`);
                }

                info.repo.exec('remote', 'add', info.remote, info.remoteUrl)
                    .then(addOutput => {
                        info.add_output = addOutput;
                        return info.repo.remotes();
                    })
                    .then(allRemotesAfter => {
                        if (allRemotesAfter.findIndex(r => r.name === info.remote) === -1) {
                            throw new Error(`failed to add remote ${info.remote} with url ${info.remoteUrl}
                                remotes: [${allRemotesAfter.map(r => r.name).join(' ')}]
                                output: ${info.add_output}`)
                        }

                        info.repo.exec('ls-remote', '--exit-code', info.remote)
                        .then(remoteExists => resolve(info))
                        .catch(e => {
                            reject(new Error(`remote ${info.remote} does not exist with url ${info.remoteUrl}`));
                        });
                    })
                    .catch(e => reject(e));
            })
            .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


module.exports = _ensureRemoteSet;
