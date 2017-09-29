
const dateFormat = require('dateFormat')
const expect = require('chai').expect;
const mlog = require('mocha-logger');
const nodegit = require('nodegit');
const path = require('path');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');


describe("pubRelease - publishes a new tagged release of a package", () => {
    var pkgPath = null;
    var pkgBefore = null;

    beforeEach(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp({
            package_name: `${dateFormat(new Date(), 'yyyymmdd-hhMMss')}-test-pub-release`
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
        this.timeout(10000);

        console.log('package path=%j', pkgPath)

        unpm.git.pubRelease(pkgPath, { verbose : true })
        .then(didPub => unpm.readPackage(pkgPath))
        .then(pkgAfter => nodegit.Repository.open(pkgPath))
        .then(r => r.getStatus())
        .then(statuses => {
            expect(statuses.length, 'should be no local changes').to.equal(0);
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
