const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');
const h = require('./test-helpers.js');

tmp.setGracefulCleanup();


describe("unityPackage.incrementPackageVersion - increments the version for a unity package", () => {
    var pkgPath = null;

    beforeEach(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;
            done();
        });
    });

    it("accepts package OBJECT as arg", function(done) {
        this.timeout(10000);

        const pkg = h.readPackageSync(pkgPath);

        unpm.incrementPackageVersion(pkg, (err, pkgAfter) => {
            if (err) {
                return done(err);
            }
            expect(pkg.version, 'should modify only copy of package passed to callback').to.equal('0.0.1');
            expect(pkgAfter.version).to.equal('0.0.2');
            done();
        });
    });

    it("accepts package PATH as arg", function(done) {
        this.timeout(10000);

        unpm.incrementPackageVersion(pkgPath, (err, pkgAfter) => {
            if (err) {
                return done(err);
            }
            expect(pkgAfter.version).to.equal('0.0.2');
            done();
        });
    });

    it("writes changes to package.json when PATH as arg", function(done) {
        this.timeout(10000);

        unpm.incrementPackageVersion(pkgPath, (err, pkgAfter) => {
            if (err) {
                return done(err);
            }
            const pkgWritten = h.readPackageSync(pkgPath);
            expect(pkgWritten.version).to.equal('0.0.2');
            done();
        });
    });

    it("increments patch version by default", function(done) {
        this.timeout(10000);

        unpm.incrementPackageVersion(pkgPath, (err, pkgAfter) => {
            if (err) {
                return done(err);
            }
            expect(pkgAfter.version, 'written package.json version should increment').to.equal('0.0.2');
            done();
        });
    });

    it("increments semver release type passed via options.release_type", function(done) {
        this.timeout(10000);

        const pkg = h.readPackageSync(pkgPath);

        unpm.incrementPackageVersion(pkg, {
            release_type: 'minor'
        }, (err, pkgAfter) => {
            expect(pkgAfter.version, "accepts release_type 'minor'").to.equal('0.1.0');

            unpm.incrementPackageVersion(pkg, {
                release_type: 'major'
            }, (err, pkgAfter) => {
                expect(pkgAfter.version, "accepts release_type 'minor'").to.equal('1.0.0');
                done();
            });
        });

    });
});
