const expect = require('chai').expect
const path = require('path')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const tmp = require('tmp')

const h = require('../test-helpers.js')
const unpm = require('../../lib/unity-npm-utils')

const VERBOSE = false

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

    const pkgName = "my-pkg-foo"
    var pkgPath = null

    const srcFilesBefore = [{
            name: 'Foo.cs',
            content: 'public class Foo {}'
        },
        {
            name: 'Bar.cs',
            content: 'public class Bar {} '
        }
    ]

    const sampleFilesBefore = [{
            name: 'ExampleClass.cs',
            content: 'public class ExampleClass {}'
        },
        {
            name: 'ExampleScene.unity',
            content: 'ExampleScene content in unity'
        }
    ]

    beforeEach(async function() {
        this.timeout(180000)

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgName,
            run_npm_install: true
        })

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFilesBefore)
        await unpm.unityPackage.addSampleFiles(pkgPath, sampleFilesBefore)

        await h.installLocalUnpmToPackage(pkgPath)

        await h.runPkgCmd('npm run test-install', pkgPath)
    })

    it('adds new files created in the Unity project to pkg src and overwrites existing pkg-src files with changes made in the Unity project', async function() {

        this.timeout(10000)

        const unityFiles = [
            ...srcFilesBefore,
            { name: 'NewClass1.cs', content: 'public class NewClass1 {}' },
            { name: 'NewClass2.cs', content: 'public class NewClass2 {}' }
        ]
        unityFiles[0].content = 'public class Foo { // added code }'
        unityFiles[1].content = 'public class Bar { // added code here too }'

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, {
          unity_package_files: unityFiles
        })

        const srcPath = path.join(pkgPath, 'Runtime', pkgName)

        for(var i in unityFiles) {
          const testFilePath = path.join(srcPath, unityFiles[i].name)

          expect(await fs.exists(testFilePath),
            `should gave created file at path '${testFilePath}'`
          ).to.equal(true)

          expect((await fs.readFile(testFilePath, 'utf8')).trim(),
            `${testFilePath} should have content matching what was passed to addSrcFiles`
          ).to.equal(unityFiles[i].content.trim())
        }
    })

    const expectDeletes = options.expect_deletes_from_package
    it(expectDeletes?
        'deletes package src files not present in the Unity test source':
        'does NOT delete package src files not present in the Unity test source', async function() {

        this.timeout(10000)

        const unityFiles = srcFilesBefore.slice(0, 1)
        const deleteUnityFiles = srcFilesBefore.slice(1)

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, {
          unity_package_files: unityFiles,
          unity_package_delete_files: deleteUnityFiles,
          expect_deletes: expectDeletes
        })
    })


    it('adds new Samples files created in the Unity project to pkg Samples and overwrites existing pkg-Samples files with changes made in the Unity project', async function() {

        this.timeout(10000)

        const sampleFiles = [
            ...sampleFilesBefore,
            { name: 'NewExampleClass.cs', content: 'public class NewExampleClass {}' },
            { name: 'NewExampleScene.unity', content: 'unity scene file content' },
            { name: 'NewExampleScene.unity.meta', content: 'guid: unity_scene_file_guid' },
        ]
        sampleFiles[0].content = 'public class ExampleClass { // added code }'
        sampleFiles[1].content = 'Example scene changed content'

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, {
          unity_sample_files: sampleFiles
        })

        const srcPath = path.join(pkgPath, 'Samples')

        for(var i in sampleFiles) {
          const testFilePath = path.join(srcPath, sampleFiles[i].name)

          expect(await fs.exists(testFilePath),
            `should gave created file at path '${testFilePath}'`
          ).to.equal(true)

          expect((await fs.readFile(testFilePath, 'utf8')).trim(),
            `${testFilePath} should have content matching what's in unity Assets after copy`
          ).to.equal(sampleFiles[i].content.trim())
        }
    })

    it('copies README and associated files from unity install back to root of package', async function() {

        this.timeout(10000)

        const readmeFiles = [
            { name: 'README.md', content: 'overwritten README content' }
        ]

        await writeFilesToUnityThenCopy2Pkg(pkgPath, pkgName, copy2Src, {
          unity_package_files: readmeFiles
        })

        await expectAllFiles(pkgPath, readmeFiles)
    })
}

const expectAllFiles = async (rootPath, data4Files) => {
  for(var i in data4Files) {
    const filePath = path.join(rootPath, data4Files[i].name)

    expect(await fs.exists(filePath),
      `should gave created file at path '${filePath}'`
    ).to.be.true

    expect((await fs.readFile(filePath, 'utf8')).trim(),
      `${filePath} should have content matching what's in unity Assets after copy`
    ).to.equal(data4Files[i].content.trim())
  }
}

const writeFilesToUnityThenCopy2Pkg = async (pkgPath, pkgName, copy2Src, opts) => { //unityFiles, deleteUnityFiles, expectDeletes) => {

    const unityFiles = opts.unity_package_files || []
    const deleteUnityFiles = opts.unity_package_delete_files || []
    const expectDeletes = opts.expect_deletes

    const unitySrcRoot = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName)

    const unityChanges = unityFiles.map(async f =>
        await fs.writeFile(path.join(unitySrcRoot, f.name), f.content)
    )

    if(deleteUnityFiles) {
        deleteUnityFiles.forEach(async f =>
            unityChanges.push(await fs.unlink(path.join(unitySrcRoot, f.name)))
        )
    }

    const unitySampleFiles = opts.unity_sample_files || []
    const unitySamplesRoot = path.join(pkgPath, 'test', 'Assets', 'Samples', 'packages', pkgName)

    const unitySamplesChanges = unitySampleFiles.map(async f =>
        await fs.writeFile(path.join(unitySamplesRoot, f.name), f.content)
    )

    await Promise.all([...unityChanges, ...unitySamplesChanges])

    await copy2Src({ package_path: pkgPath, verbose: VERBOSE })

    const pkgSrcRoot = path.join(pkgPath, 'Runtime', pkgName)

    const pkgChanges = unityFiles.map(async f =>
        await fs.readFile(path.join(pkgSrcRoot, f.name), 'utf8')
    )

    if(deleteUnityFiles) {
        deleteUnityFiles.forEach(f => {
            pkgChanges.push(new Promise((resolve, reject) => {
                const fpath = path.join(pkgSrcRoot, f.name)
                fs.exists(path.join(pkgSrcRoot, f.name))
                .then(deletedFileStillExistsInPkg => {
                    expect(deletedFileStillExistsInPkg, expectDeletes?
                        `${fpath} should be deleted from package source because it is not present in unity test source`:
                        `${fpath} should NOT be deleted because overwrite option isn't set for this copy`
                    ).to.not.equal(expectDeletes)
                    resolve()
                })
                .catch(e => reject(e))
            }))
        })
    }

    await Promise.all(pkgChanges)
}


module.exports = copy2SrcBehaviour
