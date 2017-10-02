
const expect = require('chai').expect;
const mlog = require('mocha-logger');
const nodegit = require('nodegit');
const path = require('path');
const tmp = require('tmp-promise');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');


describe("git.cloneOrPullInstallPackage - clones or updates an external git clone for an installed package", () => {
    var templatePkgPath = null;

    beforeEach(function(done) {
        this.timeout(300000);

        h.installUnityPackageTemplateToTemp({
            package_name: 'my-package-foo',
            run_npm_install: true
        })
        .then(tmpInstallPath => {
            templatePkgPath = tmpInstallPath;
            done();
        })
        .catch(e => done(e))
    });

    it("creates a new clone under the user's home directory by default", function(done) {
        this.timeout(300000);

        const pkgToClone = 'unity-npm-utils'; // cause we know it's already installed in templatePkgPath
        const pkgToClonePath = path.join(templatePkgPath, 'node_modules', pkgToClone);

        unpm.git.cloneOrPullInstalledPackage(pkgToClonePath) //, { verbose: true })
        .then(info => {
            const clonePkg = h.readPackageSync(info.clone_package_path);
            expect(clonePkg.name, 'clone package has name set').to.equal(pkgToClone);
            return nodegit.Repository.open(info.clone_package_path);
        })
        .then(r => r.getStatus())
        .then(statuses => {
            expect(statuses.length, 'git status should show no local changes').to.equal(0);
            done();
        })
        .catch(e => done(e))
    });

});
