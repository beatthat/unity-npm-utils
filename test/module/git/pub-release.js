
const dateFormat = require('dateFormat')
const expect = require('chai').expect;
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

const findGitAccount = () => {
    return new Promise((resolve, reject) => {
        gchAvailable()
        .then(a => {
            if(!a) {
                throw new Error('git credential helper is not available (required for this test)');
            }
            return gchFill('https://github.com');
        })
        .then(creds => {
            if(!creds || !creds.username) {
                throw new Error('github account credentials required for this test');
            }
            resolve(creds.username)
        })
        .catch(e => reject(e))
    })
}

describe("pubRelease - publishes a new tagged release of a package", () => {
    var pkgPath = null;
    var pkgBefore = null;

    beforeEach(function(done) {
        this.timeout(300000);

        findGitAccount()
        .then(username => {
            return h.installUnityPackageTemplateToTemp({
                package_name: `${dateFormat(new Date(), 'yyyymmdd-hhMMss')}-test-pub-release`,
                package_scope: username
            })
        })
        .then(tmpInstallPath => {
            pkgPath = tmpInstallPath;
            return unpm.readPackage(pkgPath);
        })
        .then(p => {
            pkgBefore = p;
            done();
        })
        .catch(e => done(e))
    });

    it("ensures package is init for git", function(done) {
        this.timeout(300000);

        console.log('package path=%j', pkgPath);

        var pkg = null;
        var clonePath = null;

        const req = {};

        unpm.git.pubRelease(pkgPath, { verbose : true })
        .then(didPub => {
            console.log('after pubRelease')
            return unpm.readPackage(pkgPath);
        })
        .then(p => {
            pkg = p;
            req.repo = new Repo(pkgPath);
            return req.repo.isRepo();
        })
        .then(isRepo => {
            expect(isRepo, `should be a repo at path ${req.repo.path}`).to.equal(true);
            return req.repo.exec('status', '--short');
        })
        .then(stdout => {
            expect(stdout.trim().length, 'git status should show no local changes').to.equal(0);
            return tmp.dir();
        })
        .then(tmpDir => {
            clonePath = path.join(tmpDir.path, pkg.name)
            console.log('before clone clonePath=%j', clonePath)
            return unpm.git.cloneOrPullInstalledPackage(pkgPath, { clone_dir: tmpDir.path, verbose: true });
        })
        .then(info => {
            clonePath = info.clone_package_path;
            console.log('clonePath=%j', clonePath)
            const clonePkg = h.readPackageSync(clonePath);
            expect(clonePkg.name, 'clone package has name set').to.equal(pkg.name);
            done();
        })
        .catch(e => done(e))
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
