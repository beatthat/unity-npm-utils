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
 * @param {string} opts.branch - the name of the branch. defaults to 'master'
 * @param {string} opts.remote_url - the url to create the remote if it doesn't already exist
 */
const _ensureRemoteSet = async (pathOrRepo, opts) => {

    opts = opts || {};

    const info = {
        remote: opts.remote || 'origin',
        branch: opts.branch || 'master'
    };

    const repo = await _ensureRepoInit(pathOrRepo)
    info.repo = repo;

    const allRemotes = await repo.remotes();

    const foundRemote = allRemotes.find(r => r.name === info.remote);
    if (foundRemote) {
        return { ...info,
            remote: foundRemote.name,
            remote_url: foundRemote.url
        };
    }

    info.remoteUrl = opts.remote_url;
    if (!info.remoteUrl) {
        throw new Error(`remote ${info.remote} does not exist, so must pass 'remote_url' param (missing)`);
    }

    const addOutput = await repo.exec('remote', 'add', info.remote, info.remoteUrl)

    info.add_output = addOutput;

    const allRemotesAfter = await repo.remotes();

    if (allRemotesAfter.findIndex(r => r.name === info.remote) === -1) {
        throw new Error(`failed to add remote ${info.remote} with url ${info.remoteUrl}
            remotes: [${allRemotesAfter.map(r => r.name).join(' ')}]
            output: ${info.add_output}`)
    }

    // await info.repo.exec('ls-remote', '--exit-code', info.remote)
    return info;
}


module.exports = _ensureRemoteSet;
