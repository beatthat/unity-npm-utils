const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');
const h = require('./test-helpers.js');

tmp.setGracefulCleanup();

describe("unity-npm-utils.unityPackage", () => {

    describe("installTemplate - installs a the unity-package template to an empty directory", () => {
        var pkgPath = null;

        before(function(done) {
            this.timeout(10000);

            h.installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
                if (installErr) {
                    return done(installErr);
                }

                pkgPath = tmpInstallPath;
                done();
            });
        });

        it("installs template files", () => {
            const packageJsonPath = path.join(pkgPath, 'package.json');

            expect(fs.existsSync(packageJsonPath),
                `package.json should exist in install path ${pkgPath}`).to.equal(true);
        });

        it("sets initial version to 0.0.1", () => {
            const pkg = h.readPackage(pkgPath);
            expect(pkg.version).to.equal('0.0.1');
        });

    });


    describe("setPackageName - sets package.name and updates all name-dependent aspects of a unity package", () => {
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

        it("writes new name to package.json", function(done) {
            this.timeout(10000);

            const newPkgName = 'my_new_name_for_this_pkg';

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName
            }, (err, pkgAfter) => {
                if (err) {
                    return done(err);
                }
                const pkgWritten = h.readPackage(pkgPath);
                expect(pkgWritten.name).to.equal(newPkgName);
                done();
            });
        });

        it("adds a folder under src with the new package name if none exists", function(done) {
            this.timeout(10000);

            const newPkgName = 'my_new_name_for_this_pkg';

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName,
                verbose: false
            }, (err, pkgAfter) => {
                if (err) {
                    return done(err);
                }

                const pkgSrcPath = path.join(pkgPath, 'src', newPkgName);
                fs.stat(pkgSrcPath, (statErr, stats) => {
                    if (statErr) {
                        return done(statErr);
                    }
                    expect(stats.isDirectory()).to.equal(true);
                    return done();
                });
            });
        });

        it("renames the existing (single) folder under (package_root)/src with the new package name", function(done) {
            this.timeout(10000);

            const newPkgName_1 = 'my_new_name_for_this_pkg_1';
            const newPkgName_2 = 'my_new_name_for_this_pkg_2';

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName_1,
                verbose: false
            }, (err) => {
                if (err) {
                    return done(err);
                }

                fs.stat(path.join(pkgPath, 'src', newPkgName_1), (statErr, stats) => {
                    if (statErr) {
                        return done(statErr);
                    }

                    expect(stats.isDirectory()).to.equal(true);

                    unpm.unityPackage.setPackageName(pkgPath, {
                        package_name: newPkgName_2,
                        verbose: false
                    }, (err2) => {
                        if (err2) {
                            return done(err2);
                        }

                        fs.stat(path.join(pkgPath, 'src', newPkgName_2), (statErr_2, stats_2) => {
                            if (statErr_2) {
                                return done(statErr_2);
                            }
                            expect(stats_2.isDirectory()).to.equal(true);
                            return done();
                        });
                    });
                });
            });
        });

    });


    describe.skip("updateTemplate - updates scripts and template files for an existing unity package", () => {
        var pkgPath = null;

        const pkgNameFoo = "my-pkg-foo";
        var pkgBefore = null;



        it("appends all template scripts to main package scripts", function(done) {
            done(new Error('not implemented'))
        });


    });


});
