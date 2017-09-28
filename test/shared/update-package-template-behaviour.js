const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');
const tmp = require('tmp');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

/**
 * @private
 *
 * Remove existing scripts from installed package
 * so we can see that template-update will add them back
 *
 * we need to leave the 'template:update' script though,
 * because we may be running that for the test
 */
const removeNonTemplateScripts = (pkgPath) => {

    return unpm.transformPackage({
        package_read_path: pkgPath,
        package_write_path: pkgPath,
        transform: (p, cb) => {
            p.scripts = Object.getOwnPropertyNames(p.scripts).reduce((acc, cur) => {
                // would remove all scripts for the test but need the template-update

                return cur.match(/template/)? { ...acc, [cur]: p.scripts[cur] } : acc;
            }, {});
            cb(null, p);
        }
    })
}

/**
 * See updateTemplateBehaviour below
 *
 * @callback updateTemplate
 * @param {string} options.package_path
 *      abs path to the (tmp dir) where package should install for the test
 */

/**
 * Core setup and expected behaviours for updating the package template.
 *
 * This operation can be performed multiple ways, e.g. from cli or from a module call,
 * so better to have the expected behaviour defined in a sharable test function.
 *
 * @param {updateTemplate} updateTemplate
 *      callback to execute the update-template op however the tester defines it.
 *
 * @param {Boolean} bOpts.install_required
 *      If true, will install the template package as part of beforeEach
 *
 */
const updateTemplateBehaviour = (updateTemplate, bOpts) => {
    const pkgName = "my-pkg-foo";
    var pkgPath = null;
    var pkgDistNameSet = null;
    var distDepNames = null;
    var distScriptNames = null;
    var distFiles = null;

    var tmpPath = null;
    var pkgPath = null;

    bOpts = bOpts || {};

    const srcFiles = [{
            name: 'Foo.cs',
            content: 'public class Foo {}'
        },
        {
            name: 'Bar.cs',
            content: 'public class Bar {} '
        }
    ];

    beforeEach(function(done) {
        this.timeout(90000);

        tmp.dir((err, d) => {
            if(err) { return done(err); }

            tmpPath = d;
            pkgPath = path.join(tmpPath, 'package-install');

            fs.ensureDirAsync(pkgPath)
            .then(pkgPathExists => {
                h.runBinCmd(`unpm init-package --package-name ${pkgName} -p ${pkgPath}`)
                .then(afterPkgInit => {
                    pkgDistNameSet = h.readPackageSync(pkgPath);
                    distScriptNames = Object.getOwnPropertyNames(pkgDistNameSet.scripts);
                    distDepNames = Object.getOwnPropertyNames(pkgDistNameSet.dependencies);
                    distFiles = pkgDistNameSet.files || [];

                    unpm.unityPackage.addSrcFiles(pkgPath, srcFiles)
                    .then(addedSrc => {
                        if(!bOpts.install_required) {
                            return done();
                        }

                        h.runPkgCmd('npm install --ignore-scripts', pkgPath) // ignore-scripts because nodegit post install is VERY long and not needed here
                        .then(installed => done())
                        .catch(e => done(e))

                    })
                    .catch(e => done(e));
                })
                .catch(e => done(e));
            })
            .catch(e => done(e))
        });
    });

    it("uses a package template that includes scripts and dependencies", function(done) {
        expect(distScriptNames.length, 'dist template package includes scripts').to.be.gt(0);
        expect(distDepNames.length, 'dist template package includes dependencies').to.be.gt(0);
        done();
    })

    it("adds all template scripts to main package scripts", function(done) {
        this.timeout(10000);

        // wipe out existing scripts in installed package
        // so we can see that template-update will add them back
        removeNonTemplateScripts(pkgPath)
        .then(p => {
            const pkgScriptsRemoved = h.readPackageSync(pkgPath);

            expect(Object.getOwnPropertyNames(pkgScriptsRemoved.scripts).length,
                'given some scripts have been removed from the package'
            ).to.not.equal(pkgDistNameSet.scripts.length);

            // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
            updateTemplate({ package_path: pkgPath })
            .then(installed => {

                const testPkgJsonPath = path.join(pkgPath, 'test', 'package.json');
                expect(fs.existsSync(testPkgJsonPath),
                    `after update, test package.json file exists at ${testPkgJsonPath}`
                ).to.equal(true);


                const pkgAfter = h.readPackageSync(pkgPath);
                distScriptNames.forEach(n => {
                    expect(pkgAfter.scripts[n]).to.equal(pkgDistNameSet.scripts[n]);
                });

                done();
            })
            .catch(e => done(e));
        })
        .catch(e => done(e))
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

            // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
            updateTemplate({ package_path: pkgPath })
            .then(installed => {
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

        removeNonTemplateScripts(pkgPath)
        .then(mostScriptsRemoved => {
            unpm.transformPackage({
                package_path: pkgPath,
                transform: (p, cb) => {
                    p.scripts = {
                        ...p.scripts,
                        ...oldScripts,
                        [distScriptNames[0]]: 'this val should be overwritten with template val for script'
                    };
                    cb(null, p);
                }
            })
            .then(addedSomeNewScripts => {
                // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
                updateTemplate({ package_path: pkgPath })
                .then(installed => {
                    const pkgAfter = h.readPackageSync(pkgPath);
                    distScriptNames.forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `scripts.${n} should have template value`
                        ).to.equal(pkgDistNameSet.scripts[n]);
                    });

                    Object.getOwnPropertyNames(oldScripts).forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `scripts.${n} should have pre-update value`
                        ).to.equal(oldScripts[n]);
                    });

                    return done();
                })
                .catch(e => done(e))
            })
            .catch(e => done(e))
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


            // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
            updateTemplate({ package_path: pkgPath })
            .then(installed => {
                const pkgAfter = h.readPackageSync(pkgPath);
                distDepNames.forEach(n => {
                    expect(pkgAfter.scripts[n],
                        `dependencies.${n} should have template value`
                    ).to.equal(pkgDistNameSet.scripts[n]);
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

    it.only("combines file's from template and pre-update package", function(done) {
        this.timeout(10000);

        const filesBefore = ['/somedir_1'];

        unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.files = filesBefore;
                cb(null, p);
            }
        })
        .then(changedFiles => {
            updateTemplate({ package_path: pkgPath })
            .then(installed => {
                const pkgAfter = h.readPackageSync(pkgPath);
                distFiles.forEach(n => {
                    expect(pkgAfter.files.includes(n),
                        `files should include (template) item ${n}`
                    ).to.equal(true);
                });

                filesBefore.forEach(n => {
                    expect(pkgAfter.files.includes(n),
                        `files should include (preserved) item ${n}`
                    ).to.equal(true);
                });

                return done();
            })
            .catch(e => done(e));
        })
        .catch(e => done(e))
    });

    it("preserves source files from pre-update package", function(done) {
        this.timeout(10000);

        const pkgNoDeps = h.readPackageSync(pkgPath);

        // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
        updateTemplate({ package_path: pkgPath })
        .then(installed => {
            const pkgAfter = h.readPackageSync(pkgPath);

            const srcRoot = path.join(pkgPath, 'src', pkgDistNameSet.name);
            expect(fs.existsSync(srcRoot)).to.equal(true);

            srcFiles.forEach(f => {
                const fpath = path.join(srcRoot, f.name);
                expect(fs.existsSync(fpath)).to.equal(true);
                expect(fs.readFileSync(fpath, 'utf8')).to.equal(f.content);
            });

            return done();
        })
        .catch(e => done(e));
    });

    it("ensures 'npm run install:test' creates an example Unity project with the package installed", function(done) {
        this.timeout(90000);

        const testPkgJsonPath = path.join(pkgPath, 'test', 'package.json');

        expect(fs.existsSync(testPkgJsonPath),
        `before update test package.json file exists at ${testPkgJsonPath}`
        ).to.equal(true);

        // h.runBinCmd(`unpm update-package-template -p ${pkgPath} -v`)
        updateTemplate({ package_path: pkgPath })
        .then(installed => {

            expect(fs.existsSync(testPkgJsonPath),
                `after update, test package.json file exists at ${testPkgJsonPath}`
            ).to.equal(true);


            h.runPkgCmd('npm run install:test', pkgPath).
            then(testInstalled => {
                const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName);

                srcFiles.forEach(f => {
                    const fpath = path.join(unityPkgPath, f.name);
                    expect(fs.existsSync(fpath), `src file installed at ${fpath}`).to.equal(true);
                    expect(fs.readFileSync(fpath, 'utf8'), `src file contents at ${fpath}=${f.content}`).to.equal(f.content);
                });

                done();
            })
            .catch(e => done(e));
        })
        .catch(e => done(e));
    });

}


module.exports = updateTemplateBehaviour;
