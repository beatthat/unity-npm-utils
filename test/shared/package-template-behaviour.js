const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
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
        package_path: pkgPath,
        transform: (p, cb) => {
            p.scripts = Object.getOwnPropertyNames(p.scripts).reduce((acc, cur) => {
                // would remove all scripts for the test but need the template-update

                return cur.match(/template/) ? { ...acc,
                    [cur]: p.scripts[cur]
                } : acc;
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

const requireConfig = (test, opt, done) => {
    const val = test.test_config? test.test_config[opt]: null;
    if(!val) {
        done(new Error(`missing required test config property: test_config.${opt}`));
        return false;
    }
    return val;
}

/**
 * Expected behaviours for updating the package template *after* package exists
 *
 * This operation can be performed multiple ways, e.g. from cli or from a module call,
 * so better to have the expected behaviour defined in a sharable test function.
 *
 * NOTE: requires that calling test set
 *
 * @param {updateTemplate} options.update_template_function
 *      callback to execute the update-template op however the tester defines it.
 *
 * @param {string} this.test_config.package_path
 *      NOT A PARAM, but required that calling test set <code>this.test_config.package_path</code>
 *      to the root of the test package.
 *
 */
const updateTemplateBehaviour = (options) => {

    options = options || {};

    const updateTemplate = options.update_template_function;
    var pkgPath = null;
    var pkgBefore = pkgPath ? h.readPackageSync(pkgPath) : null;
    var pkgName = pkgBefore? pkgBefore.name: null;
    var pkgBeforeDependencyNames = pkgBefore ?
        Object.getOwnPropertyNames(pkgBefore.dependencies) : null;

    var pkgBeforeScriptNames = pkgBefore ?
        Object.getOwnPropertyNames(pkgBefore.scripts) : null;;


    const srcFiles = options.package_src_files || [];

    beforeEach(function(done) {
        if(!(pkgPath = requireConfig(this, 'package_path', done))) {
            return;
        }

        pkgBefore = h.readPackageSync(pkgPath);
        pkgName = pkgBefore.name;
        pkgBeforeDependencyNames =Object.getOwnPropertyNames(pkgBefore.dependencies || {});
        pkgBeforeScriptNames = Object.getOwnPropertyNames(pkgBefore.scripts || {});

        done();
    });

    it("adds all template scripts to main package scripts", function(done) {
        this.timeout(10000);

        // wipe out existing scripts in installed package
        // so we can see that template-update will add them back
        removeNonTemplateScripts(pkgPath)
            .then(p => {
                const pkgScriptsRemoved = h.readPackageSync(pkgPath);

                expect(Object.getOwnPropertyNames(pkgScriptsRemoved.scripts).length,
                    'given some scripts have been removed from the package'
                ).to.not.equal(pkgBefore.scripts.length);

                // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
                updateTemplate({
                        package_path: pkgPath
                    })
                    .then(installed => {

                        const testPkgJsonPath = path.join(pkgPath, 'test', 'package.json');
                        expect(fs.existsSync(testPkgJsonPath),
                            `after update, test package.json file exists at ${testPkgJsonPath}`
                        ).to.equal(true);


                        const pkgAfter = h.readPackageSync(pkgPath);
                        pkgBeforeScriptNames.forEach(n => {
                            expect(pkgAfter.scripts[n]).to.equal(pkgBefore.scripts[n]);
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
            updateTemplate({
                    package_path: pkgPath
                })
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
                        package_read_path: pkgPath,
                        package_write_path: pkgPath,
                        transform: (p, cb) => {
                            p.scripts = {
                                ...p.scripts,
                                ...oldScripts,
                                [pkgBeforeScriptNames[0]]: 'this val should be overwritten with template val for script'
                            };
                            cb(null, p);
                        }
                    })
                    .then(addedSomeNewScripts => {
                        // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
                        updateTemplate({
                                package_path: pkgPath
                            })
                            .then(installed => {
                                const pkgAfter = h.readPackageSync(pkgPath);
                                pkgBeforeScriptNames.forEach(n => {
                                    expect(pkgAfter.scripts[n],
                                        `scripts.${n} should have template value`
                                    ).to.equal(pkgBefore.scripts[n]);
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
                    [pkgBeforeDependencyNames[0]]: 'this version should be overwritten with template version'
                };
                cb(null, p);
            }
        }, (e, p) => {
            if (e) {
                return done(e);
            }


            // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
            updateTemplate({
                    package_path: pkgPath
                })
                .then(installed => {
                    const pkgAfter = h.readPackageSync(pkgPath);
                    pkgBeforeDependencyNames.forEach(n => {
                        expect(pkgAfter.scripts[n],
                            `dependencies.${n} should have template value`
                        ).to.equal(pkgBefore.scripts[n]);
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

        // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
        updateTemplate({
                package_path: pkgPath
            })
            .then(installed => {
                const pkgAfter = h.readPackageSync(pkgPath);

                const srcRoot = path.join(pkgPath, 'src', pkgBefore.name);
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
        updateTemplate({
                package_path: pkgPath
            })
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
