const dateFormat = require('dateFormat')
const expect = require('chai').expect
const GitHub = require('github-api')

const mlog = require('mocha-logger')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

const promisify = require('es6-promisify')
const gitCredentialHelper = require('git-credential-helper')
const gchAvailable = promisify(gitCredentialHelper.available)
const gchFill = promisify(gitCredentialHelper.fill)

const VERBOSE = false

const findGitAccount = async () => {

    const a = await gchAvailable();

    if (!a) {
        throw new Error('git credential helper is not available (required for this test)');
    }
    const creds = await gchFill('https://github.com');

    if (!creds || !creds.username || !creds.password) {
        throw new Error(`github account credentials required for this test: ${JSON.stringify(creds)}`);
    }

    return creds;
}

describe("ensureRepoExists", () => {
    var repoName = null;
    var userName = null;
    var github = null;

    beforeEach(async function() {
        this.timeout(30000);
        repoName = `${dateFormat(new Date(), 'yyyymmdd-hhMMss')}-test-ensure-remote-exists`;

        const creds = await findGitAccount();
        userName = creds.username;

        github = new GitHub({
            username: creds.username,
            password: creds.password
        });
    });

    afterEach(async function() {
        this.timeout(30000);
        if(github && repoName) {

            mlog.log(`attempting to delete test repo: ${repoName}...`)
            const repo = github.getRepo(userName, repoName);

            await repo.deleteRepo();
        }
    })

    it.only("creates a github repo if it does not exist", async function() {
        this.timeout(30000);

        mlog.log(`attempting to create test repo: ${repoName} which should then be auto deleted by test cleanup.`)

        await unpm.git.ensureRepoExists({
            repo_name: repoName,
            verbose: VERBOSE
        })

        const repo = github.getRepo(userName, repoName);

        await repo.getDetails();

    });

    it("DOES NOT try to create a github repo if it already exists", async function() {
        this.timeout(30000);

        mlog.log(`attempting to create test repo: ${repoName} which should then be auto deleted by test cleanup.`)

        await unpm.git.ensureRepoExists({
            repo_name: repoName,
            verbose: VERBOSE
        })

        await unpm.git.ensureRepoExists({
            repo_name: repoName,
            verbose: VERBOSE
        })

        const repo = github.getRepo(userName, repoName);

        await repo.getDetails();

    });


});
