const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
// const tmp = require('tmp');
const mlog = require('mocha-logger');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');

// tmp.setGracefulCleanup();

describe("unityPackage.updateTemplate - updates scripts and template files for an existing unity package", () => {

    const pkgNameFoo = "my-pkg-foo";
    var pkgPath = null;
    var pkgDist = null;
    var distDepNames = null;
    var distScriptNames = null;

    beforeEach(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        }, (installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;

            pkgDist = h.readPackageSync(pkgPath);
            distScriptNames = Object.getOwnPropertyNames(pkgDist.scripts);
            distDepNames = Object.getOwnPropertyNames(pkgDist.dependencies);

            // rename all scripts
            unpm.transformPackage({
                package_read_path: pkgPath,
                package_write_path: pkgPath,
                transform: (p, cb) => {
                    p.scripts = {};
                    p.dependencies = {};
                    cb(null, p);
                }
            }, (e, p) => {
                return done(e);
            })
        });
    });

    it("uses a package template that includes scripts", function(done) {
        expect(distScriptNames.length, 'dist template package includes scripts').to.be.gt(0);
        done();
    })

    it("uses a package template that includes dependencies", function(done) {
        expect(distDepNames.length, 'dist template package includes dependencies').to.be.gt(0);
        done();
    })

    it("adds all template scripts to main package scripts", function(done) {
        this.timeout(10000);

        const pkgNoScripts = h.readPackageSync(pkgPath);

        expect(Object.getOwnPropertyNames(pkgNoScripts.scripts).length, 'given scripts have been cleared to an empty object').to.equal(0);

        unpm.unityPackage.updateTemplate(pkgPath)
            .then(p => {
                const pkgAfter = h.readPackageSync(pkgPath);
                distScriptNames.forEach(n => {
                    expect(pkgAfter.scripts[n]).to.equal(pkgDist.scripts[n]);
                });

                done();
            })
            .catch(e => done(e));
    });

    it('preserves the name and scope of the pre-update package', function(done) {
        this.timeout(10000);

        const nameToKeep = "some-weird-name";

        unpm.unityPackage.setPackageName(pkgPath, {
            package_name: nameToKeep
        }, (ne) => {
            if (ne) {
                return done(ne);
            }

            unpm.unityPackage.updateTemplate(pkgPath)
                .then(p => {
                    const pkgAfter = h.readPackageSync(pkgPath);

                    expect(pkgAfter.name,
                        'should preserve name of the pre-update package'
                    ).to.equal(nameToKeep)

                    done();
                })
                .catch(e => done(e));
        });

    })

    it("combines scripts from template and pre-update package, preferring the template version", function(done) {
        this.timeout(10000);

        const pkgNoScripts = h.readPackageSync(pkgPath);
        var oldScripts = {
            old_1: 'val 1',
            old_2: 'val 2'
        };

        // rename all scripts
        unpm.transformPackage({
            package_read_path: pkgPath,
            package_write_path: pkgPath,
            transform: (p, cb) => {
                p.scripts = {
                    ...oldScripts,
                    [distScriptNames[0]]: 'this val should be overwritten with template val for script'
                };
                cb(null, p);
            }
        }, (e, p) => {
            if (e) {
                return done(e);
            }

            unpm.unityPackage.updateTemplate(pkgPath)
                .then(p => {
                    const pkgAfter = h.readPackageSync(pkgPath);
                    distScriptNames.forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `scripts.${n} should have template value`
                        ).to.equal(pkgDist.scripts[n]);
                    });

                    Object.getOwnPropertyNames(oldScripts).forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `scripts.${n} should have pre-update value`
                        ).to.equal(oldScripts[n]);
                    });

                    return done();
                })
                .catch(e => done(e));

        });
    });

    it("combines dependencies from template and pre-update package, preferring the template version", function(done) {
        this.timeout(10000);

        const pkgNoDeps = h.readPackageSync(pkgPath);
        var oldDeps = {
            dep_1: 'val 1',
            dep_2: 'val 2'
        };

        // rename all scripts
        unpm.transformPackage({
            package_read_path: pkgPath,
            package_write_path: pkgPath,
            transform: (p, cb) => {
                p.dependencies = {
                    ...oldDeps,
                    [distDepNames[0]]: 'this version should be overwritten with template version'
                };
                cb(null, p);
            }
        }, (e, p) => {
            if (e) {
                return done(e);
            }

            unpm.unityPackage.updateTemplate(pkgPath)
                .then(p => {
                    const pkgAfter = h.readPackageSync(pkgPath);
                    distDepNames.forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `dependencies.${n} should have template value`
                        ).to.equal(pkgDist.scripts[n]);
                    });

                    Object.getOwnPropertyNames(oldDeps).forEach(n => {
                        expect(pkgAfter.dependencies[n],
                            `dependencies.${n} should have pre-update value`
                        ).to.equal(oldDeps[n]);
                    });

                    return done();
                })
                .catch(e => done(e));

        });
    });

    it("preserves source files from pre-update package", function(done) {
        this.timeout(10000);

        const pkgNoDeps = h.readPackageSync(pkgPath);

        const srcFiles = [{
                name: 'Foo.cs',
                content: 'public class Foo {}'
            },
            {
                name: 'Bar.cs',
                content: 'public class Bar {} '
            }
        ];

        unpm.unityPackage.addSrcFiles(pkgPath, srcFiles)
        .then(asr => {
            unpm.unityPackage.updateTemplate(pkgPath)
                .then(p => {
                    const pkgAfter = h.readPackageSync(pkgPath);

                    const srcRoot = path.join(pkgPath, 'src', pkgDist.name);
                    expect(fs.existsSync(srcRoot)).to.equal(true);

                    srcFiles.forEach(f => {
                        const fpath = path.join(srcRoot, f.name);
                        expect(fs.existsSync(fpath)).to.equal(true);
                        expect(fs.readFileSync(fpath, 'utf8')).to.equal(f.content);
                    });

                    return done();
                })
                .catch(e => done(e));
        })
        .catch(e => done(e));



    });

});
