const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const mlog = require('mocha-logger');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');

    describe("unityPackage.setPackageName - sets package.name and updates all name-dependent aspects of a unity package", () => {
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

        it("writes new name [and option scope] to package.json", function(done) {
            this.timeout(10000);

            const newPkgName = 'my-new-pkg-name';
            const newPkgScope = 'my-pkg-scope'

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName,
                package_scope: newPkgScope
            })
            .then(pkgPath => {

                const pkgWritten = h.readPackageSync(pkgPath);
                expect(pkgWritten.name, 'should have written name').to.equal(newPkgName);
                expect(pkgWritten.config.scope, 'should have written scope as a config property').to.equal(newPkgScope);
                done();
            })
            .catch(e => {
                console.log(new Error().stack);
                done(e);
            });
        });

        it("forces package name and scope to cannonical lowercase and dash-delimited", function(done) {
            this.timeout(10000);

            const newPkgName = 'My New Pkg Name';
            const newPkgScope = 'My_Pkg Scope ';

            const cannonicalPkgName = 'my-new-pkg-name';
            const cannonicalPkgScope = 'my-pkg-scope'

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName,
                package_scope: newPkgScope
            })
            .then(pkgPath => {

                const pkgWritten = h.readPackageSync(pkgPath);
                expect(pkgWritten.name,
                    'should have translated name to cannonical lowercase and dash-delimited form'
                ).to.equal(cannonicalPkgName);

                expect(pkgWritten.config.scope,
                    'should have translated scope to cannonical lowercase and dash-delimited form'
                ).to.equal(cannonicalPkgScope);

                done();
            })
            .catch(e => {
                console.log(new Error().stack);
                done(e);
            });
        });

        it("sets a github urls for repo, issues, and homepage by default when package scope is set", function(done) {
            this.timeout(10000);

            const newPkgName = 'My New Pkg Name';
            const newPkgScope = 'My_Pkg Scope ';

            const cannonicalPkgName = 'my-new-pkg-name';
            const cannonicalPkgScope = 'my-pkg-scope'

            unpm.unityPackage.setPackageName(pkgPath, {
                package_name: newPkgName,
                package_scope: newPkgScope
            })
            .then(pkgPath => {

                const pkgWritten = h.readPackageSync(pkgPath);
                expect(pkgWritten.repository.type, 'should have written repository type as git').to.equal('git');
                expect(pkgWritten.repository.url, 'should have written repository type as github url').to.equal(
                    `git+https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}.git`
                );

                expect(pkgWritten.bugs.url, 'should have written issues github bugs url').to.equal(
                    `https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}/issues`
                );

                expect(pkgWritten.homepage, 'should have written homepage github homepage url').to.equal(
                    `https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}`
                );

                done();
            })
            .catch(e => {
                console.log(new Error().stack);
                done(e);
            });
        });

        it("adds a folder under src with the new package name if none exists", function(done) {
            this.timeout(10000);

            const newPkgName = 'my-new-name-for-this-pkg';

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

            const newPkgName_1 = 'my-new-name-for-this-pkg-1';
            const newPkgName_2 = 'my-new-name-for-this-pkg-2';

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
