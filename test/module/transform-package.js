const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

tmp.setGracefulCleanup();

describe.only('transformPackage - transforms a package json with options to read before and/or write after transform', () => {
    var pkgPath = null;

    const pkgNameFoo = "my-pkg-foo";

    beforeEach(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        }, (installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;

            done();
        });
    });

    it('can read -> transform -> write a package', function(done) {

        unpm.transformPackage({
            package_path: pkgPath,
            transform: (pkg, callback) => {
                pkg.scripts = { foo: 'bar' };
                callback(null, pkg);
            }
        },
        (err) => {
            if(err) {
                return done(err);
            }

            const pkgAfter = h.readPackageSync(pkgPath);

            expect(pkgAfter.scripts.foo).to.equal('bar');

            return done();
        });
    });

    it('returns a promise when no callback passed', function(done) {

        unpm.transformPackage({
            package_path: pkgPath,
            transform: (pkg, callback) => {
                pkg.scripts = { foo: 'bar' };
                callback(null, pkg);
            }
        })
        .then(p => {
            const pkgAfter = h.readPackageSync(pkgPath);

            expect(pkgAfter.scripts.foo).to.equal('bar');

            return done();
        })
        .catch(err => done(err))
    });
});
