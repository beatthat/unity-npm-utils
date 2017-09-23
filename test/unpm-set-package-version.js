const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');
const h = require('./test-helpers.js');

tmp.setGracefulCleanup();

describe("unpm.setPackageVersion - sets the version for a unity package", () => {
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
        const oldVersion = pkg.version;
        const newVersion = '1.2.3';

        unpm.setPackageVersion(pkg, newVersion, (err, pkgAfter) => {
            if (err) {
                return done(err);
            }
            expect(pkg.version, 'should modify only copy of package passed to callback').to.equal(oldVersion);
            expect(pkgAfter.version).to.equal(newVersion);
            done();
        });
    });

    // it("accepts package PATH as arg", function(done) {
    //     this.timeout(10000);
    //
    //     unpm.incrementPackageVersion(pkgPath, (err, pkgAfter) => {
    //         if (err) {
    //             return done(err);
    //         }
    //         expect(pkgAfter.version).to.equal('0.0.2');
    //         done();
    //     });
    // });
    //
    // it("writes changes to package.json when PATH as arg", function(done) {
    //     this.timeout(10000);
    //
    //     unpm.incrementPackageVersion(pkgPath, (err, pkgAfter) => {
    //         if (err) {
    //             return done(err);
    //         }
    //         const pkgWritten = h.readPackageSync(pkgPath);
    //         expect(pkgWritten.version).to.equal('0.0.2');
    //         done();
    //     });
    // });

});
