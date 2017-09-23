const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');
const h = require('./test-helpers.js');

tmp.setGracefulCleanup();

describe("unity-npm-utils - unity-package npm scripts", () => {

    describe("'npm run install:test' - installs a package to its own 'test' Unity project for editting", () => {
        var pkgPath = null;

        const pkgNameFoo = "my-pkg-foo";
        const srcFiles = [{
                name: 'Foo.cs',
                content: 'public class Foo {}'
            },
            {
                name: 'Bar.cs',
                content: 'public class Bar {} '
            }
        ];

        before(function(done) {
            this.timeout(90000);

            h.installUnityPackageTemplateToTemp({
                package_name: pkgNameFoo
            }, (installErr, tmpInstallPath) => {
                if (installErr) {
                    return done(installErr);
                }

                pkgPath = tmpInstallPath;

                unpm.unityPackage.addSrcFiles(pkgPath, srcFiles, (addErr) => {
                    if (addErr) {
                        return done(addErr);
                    }

                    h.runPkgCmd('npm run install:test', pkgPath, (cmdErr) => {
                        return done(cmdErr);
                    })
                });


            });
        });

        it("installs under Plugins by default", function(done) {

            const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgNameFoo);

            expect(fs.existsSync(unityPkgPath), `Plugin folder name matches package name ${unityPkgPath}`).to.equal(true);

            return done();
        });

    })


    describe.skip("'npm run template:update' - updates scripts and template files for an existing unity package", () => {
        var pkgPath = null;

        const pkgNameFoo = "my-pkg-foo";
        var pkgBefore = null;

        beforeEach(function(done) {
            this.timeout(10000);

            h.installUnityPackageTemplateToTemp({
                package_name: pkgNameFoo
            }, (installErr, tmpInstallPath) => {
                if (installErr) {
                    return done(installErr);
                }

                pkgPath = tmpInstallPath;

                pkgBefore = h.readPackageSync(pkgPath);

                h.runPkgCmd('npm run template:update', pkgPath, (cmdErr) => {
                    return done(cmdErr);
                });
            });
        });

        it("appends all template scripts to main package scripts", function(done) {
            done(new Error('not implemented'))
        });

    })


});
