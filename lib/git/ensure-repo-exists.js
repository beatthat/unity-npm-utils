
const GitHub = require('github-api');
const promisify = require('es6-promisify');
const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);

const _findCred = (opts) => {
    return new Promise((resolve, reject) => {

        if(opts.username && opts.password) {
            return resolve(opts);
        }

        const url = `https://${opts.repo_host}`;

        gchAvailable()
        .then(a => {
            if(!a) {
                throw new Error('username and password not passed as options and git credential helper is not available (required)');
            }
            return gchFill(url);
        })
        .then(creds => {
            if(!creds && creds.username && creds.password) {
                throw new Error('username and password not passed as options and credentials not set in helper')
            }
            resolve(creds)
        })
        .catch(e => reject(e))
    })
}

/**
 * @private
 *
 * Ensure a repo exists, try to create it if it does not
 *
 * @param {string} opts.repo_host_name
 * @param {string} opts.repo_name - the name of the repo that must exist. defaults to 'origin'
 * @param {string} opts.username - the username to use to create the repo. if not passed will try to use helper cred
 * @param {string} opts.password - the username to use to create the repo. if not passed will try to use helper cred
 * @param {function(err)} callback
 * @returns {Promise} if no callback passed
 */
const ensureRepoExists = (opts, callback) => {
    if (typeof(opts) === 'function') {
        callback = opts;
        opts = {};
    }

    opts = opts || {};
    opts.repo_host = opts.repo_host || 'github.com'

    const promise = new Promise((resolve, reject) => {

        if(!opts.repo_name) {
            throw new Error('required option repo_name is not set');
        }

        if(!opts.repo_host.match(/github/g)) {
            throw new Error('ensureRepoExists only implemented for github')
        }

        var gitHub = null;
        var userName = null;

        _findCred(opts)
        .then(creds => {
            console.log('creds=%j', creds)
            userName = creds.username;

            gitHub = new GitHub({
                username: creds.username,
                password: creds.password,
                // auth: 'basic',
            });

            return gitHub.getUser().createRepo({
                name: opts.repo_name,
                auto_init: true,
                private: false,
                gitignore_template: 'nanoc'
            })
        })
        .then(ok => resolve())
        .catch(e => reject(e))
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


module.exports = ensureRepoExists;
