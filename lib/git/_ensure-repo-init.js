const Repo = require('git-tools');

/**
 * @private
 *
 * Ensure there is a git repo at the given path
 *
 * @param {string|Repo} pathOrRepo - path to the clone (may not yet be a clone) or Repo object
 * @param {function(err, Repo)} callback
 * @returns {Promise(Repo)} if no callback passed
 */
const _ensureRepoInit = (pathOrRepo, opts, callback) => {
    if (typeof(opts) === 'function') {
        callback = opts;
        opts = {};
    }

    opts = opts || {};

    const promise = new Promise((resolve, reject) => {
        const repo = pathOrRepo instanceof Repo ? pathOrRepo : new Repo(pathOrRepo);

        repo.isRepo()
            .then(isRepo => {
                if (isRepo) {
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


module.exports = _ensureRepoInit;
