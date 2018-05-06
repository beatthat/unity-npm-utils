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

    beforeEach(async function() {
        this.timeout(180000);

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgName,
            run_npm_install: true
        })

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFilesBefore)

        await h.installLocalUnpmToPackage(pkgPath)

        await h.runPkgCmd('npm run install:test', pkgPath)
    });

    it('adds new files created in the Unity project to pkg src and overwrites existing pkg-src files with changes made in the Unity project', async function() {

        this.timeout(10000);

        const unityFiles = [
            ...srcFilesBefore,
            { name: 'NewClass1.cs', content: 'public class NewClass1 {}' },
            { name: 'NewClass2.cs', content: 'public class NewClass2 {}' }
        ];
        unityFiles[0].content = 'public class Foo { // added code }';
        unityFiles[1].content = 'public class Bar { // added code here too }';

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, unityFiles)
    })

    const expectDeletes = options.expect_deletes_from_package;
    it(expectDeletes?
        'deletes package src files not present in the Unity test source':
        'does NOT delete package src files not present in the Unity test source', async function() {

        this.timeout(10000);

        const unityFiles = srcFilesBefore.slice(0, 1);
        const deleteUnityFiles = srcFilesBefore.slice(1);

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, unityFiles, deleteUnityFiles, expectDeletes)
    });
}

const writeFilesToUnityThenCopy2Pkg = async (pkgPath, pkgName, copy2Src, unityFiles, deleteUnityFiles, expectDeletes) => {

    const unitySrcRoot = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName);

    const unityChanges = unityFiles.map(async f =>
        await fs.writeFileAsync(path.join(unitySrcRoot, f.name), f.content)
    )

    if(deleteUnityFiles) {
        deleteUnityFiles.forEach(async f =>
            unityChanges.push(await fs.unlinkAsync(path.join(unitySrcRoot, f.name)))
        )
    }

    await Promise.all(unityChanges)

    await copy2Src({ package_path: pkgPath });

    const pkgSrcRoot = path.join(pkgPath, 'Runtime', pkgName);

    const pkgChanges = unityFiles.map(async f =>
        await fs.readFileAsync(path.join(pkgSrcRoot, f.name), 'utf8')
    );

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

    await Promise.all(pkgChanges)
}


module.exports = copy2SrcBehaviour;
