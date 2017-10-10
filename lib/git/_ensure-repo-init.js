const Repo = require('git-tools');

/**
 * @private
 *
 * Ensure there is a git repo at the given path
 *
 * @param {string|Repo} pathOrRepo - path to the clone (may not yet be a clone) or Repo object
 * @returns {Repo} if no callback passed
 */
const _ensureRepoInit = async (pathOrRepo, opts) => {
    opts = opts || {};

    const repo = pathOrRepo instanceof Repo ? pathOrRepo : new Repo(pathOrRepo);

    const isRepo = await repo.isRepo()
    if (isRepo) {
        return repo;
    }

    await repo.exec('init', '--quiet');

    return repo;
}


module.exports = _ensureRepoInit;
