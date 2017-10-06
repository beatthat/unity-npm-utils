const dateFormat = require('dateFormat')
const expect = require('chai').expect;
const GitHub = require('github-api');

const mlog = require('mocha-logger');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');


const promisify = require('es6-promisify');
const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);

const findGitAccount = () => {
    return new Promise((resolve, reject) => {
        gchAvailable()
            .then(a => {
                if (!a) {
                    throw new Error('git credential helper is not available (required for this test)');
                }
                return gchFill('https://github.com');
            })
            .then(creds => {
                if (!creds || !creds.username || !creds.password) {
                    throw new Error('github account credentials required for this test');
                }
                resolve(creds)
            })
            .catch(e => reject(e))
    })
}

describe.only("ensureRemoteExists - checks that a remote exists and if not, tries to create it", () => {
    var repoName = null;
    var userName = null;
    var github = null;

    beforeEach(function(done) {
        repoName = `${dateFormat(new Date(), 'yyyymmdd-hhMMss')}-test-ensure-remote-exists`;

        findGitAccount()
            .then(creds => {
                userName = creds.username;

                console.log('will create test github w creds=%j', creds);

                github = new GitHub({
                    username: creds.username,
                    password: creds.password,
                    // auth: 'basic',
                });

                done();
            })
            .catch(e => done(e))
    });

    it("creates a github repo if it does not exist", function(done) {
        this.timeout(300000);


        unpm.git.ensureRepoExists({
            repo_name: repoName
        })
        .then(shouldExists => {
            const repo = github.getRepo(userName, repoName);
            return repo.getBranch('master')
        })
        .then(gotMaster => done())
        .catch(e => done(e))


    });


});
