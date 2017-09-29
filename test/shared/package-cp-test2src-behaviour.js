const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');
const mkdirp = require('mkdirp');
const tmp = require('tmp');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

/**
 * See updateTemplateBehaviour below
 *
 * @callback copy2Src
 * @param {string} options.package_path
 *      abs path to the (tmp dir) where package should install for the test
 */

/**
 * Core setup and expected behaviours for copying
 * from a package's unity 'test' project back to the package source..
 *
 * This operation has a few variations but mostly common behaviour,
 * which is why shared-behaviour tests are separated out.
 *
 * @param {copy2Src} copy2Src
 *      callback to execute the copy op however the tester defines it.
 *
 *
 *  @param {string} options.expect_deletes_from_package
 *      if TRUE then will expect that a deletion on the Unity test project srcFilesAdded
 *      followed by a copy will trigger a deletion in the package source.
 *
 */
const copy2SrcBehaviour = (copy2Src, options) => {

    const pkgName = "my-pkg-foo";
    var pkgPath = null;

    const srcFilesBefore = [{
            name: 'Foo.cs',
            content: 'public class Foo {}'
        },
        {
            name: 'Bar.cs',
            content: 'public class Bar {} '
        }
    ];

    beforeEach(function(done) {
        this.timeout(180000);

        h.installUnityPackageTemplateToTemp({
            package_name: pkgName,
            run_npm_install_no_scripts: true
        }, (installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;

            unpm.unityPackage.addSrcFiles(pkgPath, srcFilesBefore)
            .then(srcFilesAdded => {
                h.runPkgCmd('npm run install:test', pkgPath)
                .then(installTestDone => done())
                .catch(e => done(e));
            })
        });
    });

    it('adds new files created in the Unity project to pkg src and overwrites existing pkg-src files with changes made in the Unity project', function(done) {

        this.timeout(10000);

        const unityFiles = [
            ...srcFilesBefore,
            { name: 'NewClass1.cs', content: 'public class NewClass1 {}' },
            { name: 'NewClass2.cs', content: 'public class NewClass2 {}' }
        ];
        unityFiles[0].content = 'public class Foo { // added code }';
        unityFiles[1].content = 'public class Bar { // added code here too }';

        writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, unityFiles).
        then(success => done())
        .catch(e => done(e))
    })

    const expectDeletes = options.expect_deletes_from_package;
    it(expectDeletes?
        'deletes package src files not present in the Unity test source':
        'does NOT delete package src files not present in the Unity test source', function(done) {

        this.timeout(10000);

        const unityFiles = srcFilesBefore.slice(0, 1);
        const deleteUnityFiles = srcFilesBefore.slice(1);

        writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, unityFiles, deleteUnityFiles, expectDeletes).
        then(allSuccess => done())
        .catch(e => done(e))
    });
}

const writeFilesToUnityThenCopy2Pkg = (pkgPath, pkgName, copy2Src, unityFiles, deleteUnityFiles, expectDeletes) => {
    return new Promise((doneResolve, doneReject) => {
        const unitySrcRoot = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName);

        const unityChanges = unityFiles.map(f => {
            return new Promise((resolve, reject) => {
                fs.writeFileAsync(path.join(unitySrcRoot, f.name), f.content)
                .then(wroteOne => resolve())
                .catch(e => reject(e))
            })
        });

        if(deleteUnityFiles) {
            deleteUnityFiles.forEach(f => {
                unityChanges.push(new Promise((resolve, reject) => {
                    fs.unlinkAsync(path.join(unitySrcRoot, f.name))
                    .then(deletedOne => resolve())
                    .catch(e => reject(e))
                }));
            });
        }

        Promise.all(unityChanges)
        .then(unitySrcUpdated => copy2Src({ package_path: pkgPath }))
        .then(copied => {
            const pkgSrcRoot = path.join(pkgPath, 'src', pkgName);

            const pkgChanges = unityFiles.map(f => {
                return new Promise((resolve, reject) => {
                    fs.readFileAsync(path.join(pkgSrcRoot, f.name), 'utf8')
                    .then(content => {
                        expect(content).to.equal(f.content);
                        resolve();
                    })
                    .catch(e => reject(e))
                });
            });

            if(deleteUnityFiles) {
                deleteUnityFiles.forEach(f => {
                    pkgChanges.push(new Promise((resolve, reject) => {
                        const fpath = path.join(pkgSrcRoot, f.name);
                        fs.existsAsync(path.join(pkgSrcRoot, f.name))
                        .then(deletedFileStillExistsInPkg => {
                            expect(deletedFileStillExistsInPkg, expectDeletes?
                                `${fpath} should be deleted from package source because it is not present in unity test source`:
                                `${fpath} should NOT be deleted because overwrite option isn't set for this copy`
                            ).to.not.equal(expectDeletes);
                            resolve();
                        })
                        .catch(e => reject(e))
                    }));
                });
            }

            return Promise.all(pkgChanges)
        })
        .then(allSuccess => doneResolve())
        .catch(e => doneReject(e))
    });
}


module.exports = copy2SrcBehaviour;
