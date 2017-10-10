
const GitHub = require('github-api');
const promisify = require('es6-promisify');
const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);

const _findCred = async (opts) => {

    if(opts.username && opts.password) {
        return opts;
    }

    const url = `https://${opts.repo_host}`;

    const a = await gchAvailable();
    if(!a) {
        throw new Error('must have credentials helper configured or otherwise pass username and password in options');
    }
    const creds = gchFill(url);

    if(!creds && creds.username && creds.password) {
        throw new Error('must have valid credentials in helper or otherwise pass username and password in options')
    }
    return creds;
}

/**
 * @private
 *
 * Ensure a repo exists, try to create it if it does not.

 * NOTE: in current form, when this call creates a repo it is
 * empty with no master branch. This is of limited utility
 * but need to some research to see how to fix
 *
 * @param {string} opts.repo_host_name
 * @param {string} opts.repo_name - the name of the repo that must exist. defaults to 'origin'
 * @param {string} opts.username - the username to use to create the repo. if not passed will try to use helper cred
 * @param {string} opts.password - the password to use to create the repo. if not passed will try to use helper cred
 * @param {string} opts.verbose - if TRUE logs debug info to console
 */
const ensureRepoExists = async (opts) => {

    opts = opts || {};
    opts.repo_host = opts.repo_host || 'github.com'


    if(!opts.repo_name) {
        throw new Error('required option repo_name is not set');
    }

    if(!opts.repo_host.match(/github/g)) {
        throw new Error('ensureRepoExists only implemented for github')
    }

    const creds = await _findCred(opts);

    const userName = creds.username;
    const repoName = opts.repo_name;

    const gitHub = new GitHub({
        username: userName,
        password: creds.password
    });

    try {
        const repo = gitHub.getRepo(userName, repoName);

        await repo.getDetails();

        if(opts.verbose) {
            console.log(`repo ${userName}/${repoName} already exists; will NOT attempt to create...`)
        }

        return null;
    }
    catch(e) {
        if(opts.verbose) {
            console.log(`repo ${userName}/${repoName} does not exists; will attempt to create...`)
        }
    }

    await gitHub.getUser().createRepo({
        name: repoName,
        private: false
    });
}


module.exports = ensureRepoExists;
