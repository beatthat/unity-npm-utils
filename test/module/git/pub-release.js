
const dateFormat = require('dateFormat')
const expect = require('chai').expect;
const GitHub = require('github-api');
const mlog = require('mocha-logger');
const Repo = require('git-tools');
const path = require('path');
const promisify = require('es6-promisify');
const tmp = require('tmp-promise');

const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);


const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');

const VERBOSE = false

const findGitAccount = async () => {

    const a = await gchAvailable();

    if (!a) {
        throw new Error('git credential helper is not available (required for this test)');
    }
    const creds = await gchFill('https://github.com');

    if (!creds || !creds.username || !creds.password) {
        throw new Error('github account credentials required for this test');
    }

    return creds;
}

describe("pubRelease", () => {
    var pkgPath = null;
    var pkgBefore = null;
    var pkgAndRepoName = null;
    var userName = null;
    var github = null;

    beforeEach(async function() {
        this.timeout(300000);

        this.timeout(30000);
        pkgAndRepoName = `${dateFormat(new Date(), 'yyyymmdd-hhMMss')}-test-pub-release`;

        const creds = await findGitAccount();
        userName = creds.username;

        github = new GitHub({
            username: creds.username,
            password: creds.password
        });

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgAndRepoName,
            package_scope: userName
        })

        pkgBefore = await unpm.readPackage(pkgPath)
    })

    afterEach(async function() {
        this.timeout(30000);
        if(github && pkgAndRepoName) {

            mlog.log(`attempting to delete test repo: ${userName}/${pkgAndRepoName}...`)
            const repo = github.getRepo(userName, pkgAndRepoName)

            await repo.deleteRepo()
        }
    })

    // TODO: this seems wrong. Is the package itself REALLY supposed to become a git clone (or should only external copy?)
    it("converts a non-git package into a git clone", async function() {
        this.timeout(300000);

        await unpm.git.pubRelease(pkgPath, {
            verbose : VERBOSE
        })

        const pkg = await unpm.readPackage(pkgPath);

        const repo = new Repo(pkgPath);

        const isRepo = await repo.isRepo();

        expect(isRepo, `should be a repo at path ${repo.path}`).to.equal(true);

        const repoStatus = await repo.exec('status', '--short');
        expect(repoStatus.trim().length, 'git status should show no local changes').to.equal(0);

        const tmpDir = await tmp.dir();

        const clonePath = path.join(tmpDir.path, pkg.name)

        const cloneOrInstallInfo = await unpm.git.cloneOrPullInstalledPackage(pkgPath, {
            clone_dir: tmpDir.path,
            verbose: VERBOSE
        });

        const clonePkg = h.readPackageSync(clonePath)
        expect(clonePkg.name, 'clone package has name set').to.equal(pkg.name)
    });

    it.skip("creates a new patch release if no release type specified", function(done) {
        this.timeout(10000);

        unpm.pubRelease(pkgPath)
        .then(didPub => {
            unpm.readPackage(pkgPath)
            .then(pkgAfter => {
                expect(pkgAfter.version).to.equal('0.0.2');
                done();
            });
        })
        .catch(e => done(e))
    });
});
