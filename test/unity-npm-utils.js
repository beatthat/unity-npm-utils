const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');

tmp.setGracefulCleanup();

/**
 * @param {function(err, installPath)} callback
 * @private
 */
const installUnityPackageTemplateToTemp = (callback) => {
    const promise = new Promise((resolve, reject) => {
        tmp.dir((tmpDirErr, tmpDir) => {
            const installPath = path.join(tmpDir, 'unpm-testpackage');

            unpm.unityPackage.installTemplate(installPath, {}, (err) => {

                if (err) {
                    return reject(new Error(err));
                }

                return resolve(installPath);
            });
        });
    });

    if (!callback) {
        return promise;
    }

    promise.then((pRes) => {
            return callback(null, pRes);
        })
        .catch((pErr) => {
            return callback(pErr);
        })

}

const readPackage = (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json')));
}

describe("Unity NPM Utils", () => {

    describe("Unity Package", () => {

        describe("Installs Template", () => {
            var pkgPath = null;

            before(function(done) {
                this.timeout(10000);

                installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
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
                const pkg = readPackage(pkgPath);
                expect(pkg.version).to.equal('0.0.1');
            });

        });

        describe("Increments Version", () => {
            var pkgPath = null;

            beforeEach(function(done) {
                this.timeout(10000);

                installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
                    if (installErr) {
                        return done(installErr);
                    }

                    pkgPath = tmpInstallPath;
                    done();
                });
            });

            it("accepts package OBJECT as arg", function(done) {
                this.timeout(10000);

                const pkg = readPackage(pkgPath);

                unpm.unityPackage.incrementVersion(pkg, (err, pkgAfter) => {
                    if(err) { return done(err); }
                    expect(pkg.version, 'should modify only copy of package passed to callback').to.equal('0.0.1');
                    expect(pkgAfter.version).to.equal('0.0.2');
                    done();
                });
            });

            it("accepts package PATH as arg", function(done) {
                this.timeout(10000);

                unpm.unityPackage.incrementVersion(pkgPath, (err, pkgAfter) => {
                    if(err) { return done(err); }
                    expect(pkgAfter.version).to.equal('0.0.2');
                    done();
                });
            });

            it("writes changes to package.json when PATH as arg", function(done) {
                this.timeout(10000);

                unpm.unityPackage.incrementVersion(pkgPath, (err, pkgAfter) => {
                    if(err) { return done(err); }
                    const pkgWritten = readPackage(pkgPath);
                    expect(pkgWritten.version).to.equal('0.0.2');
                    done();
                });
            });

            it("increments patch version by default", function(done) {
                this.timeout(10000);

                unpm.unityPackage.incrementVersion(pkgPath, (err, pkgAfter) => {
                    if(err) { return done(err); }
                    expect(pkgAfter.version, 'written package.json version should increment').to.equal('0.0.2');
                    done();
                });
            });

            it("increments semver release type passed via options.release_type", function(done) {
                this.timeout(10000);

                const pkg = readPackage(pkgPath);

                unpm.unityPackage.incrementVersion(pkg, { release_type: 'minor'}, (err, pkgAfter) => {
                    expect(pkgAfter.version, "accepts release_type 'minor'").to.equal('0.1.0');

                    unpm.unityPackage.incrementVersion(pkg, { release_type: 'major'}, (err, pkgAfter) => {
                        expect(pkgAfter.version, "accepts release_type 'minor'").to.equal('1.0.0');
                        done();
                    });
                });

            });
        });


        describe("Sets Package Name", () => {
            var pkgPath = null;

            beforeEach(function(done) {
                this.timeout(10000);

                installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
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

                unpm.unityPackage.setPackageName(pkgPath, { package_name: newPkgName }, (err, pkgAfter) => {
                    if(err) { return done(err); }
                    const pkgWritten = readPackage(pkgPath);
                    expect(pkgWritten.name).to.equal(newPkgName);
                    done();
                });
            });

            it("adds a folder under src with the new package name if none exists", function(done) {
                this.timeout(10000);

                const newPkgName = 'my_new_name_for_this_pkg';

                unpm.unityPackage.setPackageName(pkgPath, { package_name: newPkgName, verbose: false }, (err, pkgAfter) => {
                    if(err) { return done(err); }

                    const pkgSrcPath = path.join(pkgPath, 'src', newPkgName);
                    fs.stat(pkgSrcPath, (statErr, stats) => {
                        if(statErr) { return done(statErr); }
                        expect(stats.isDirectory()).to.equal(true);
                        return done();
                    });
                });
            });

            it("renames the existing (single) folder under (package_root)/src with the new package name", function(done) {
                this.timeout(10000);

                const newPkgName_1 = 'my_new_name_for_this_pkg_1';
                const newPkgName_2 = 'my_new_name_for_this_pkg_2';

                unpm.unityPackage.setPackageName(pkgPath, { package_name: newPkgName_1, verbose: false }, (err) => {
                    if(err) { return done(err); }

                    fs.stat(path.join(pkgPath, 'src', newPkgName_1), (statErr, stats) => {
                        if(statErr) { return done(statErr); }

                        expect(stats.isDirectory()).to.equal(true);

                        unpm.unityPackage.setPackageName(pkgPath, { package_name: newPkgName_2, verbose: false }, (err2) => {
                            if(err2) { return done(err2); }

                            fs.stat(path.join(pkgPath, 'src', newPkgName_2), (statErr_2, stats_2) => {
                                if(statErr_2) { return done(statErr_2); }
                                expect(stats_2.isDirectory()).to.equal(true);
                                return done();
                            });
                        });
                    });
                });
            });

        });




        // describe("Installs to Unity Project", () => {
        //     var pkgPath = null;
        //
        //     before(function(done) {
        //         this.timeout(10000);
        //
        //         installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
        //             if (installErr) {
        //                 return done(installErr);
        //             }
        //
        //             pkgPath = tmpInstallPath;
        //
        //             mkdirp(path.join(pkgPath, 'src', readPackage(pkgPath).name), (mkdirErr) => {
        //                 if (mkdirErr) {
        //                     return done(mkdirErr);
        //                 }
        //
        //                 done();
        //             });
        //         });
        //     });
        //
        //     it("installs under Plugins by default", function(done) {
        //
        //
        // })






    });

});
