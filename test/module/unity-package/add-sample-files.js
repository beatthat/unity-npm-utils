const path = require('path')
const fs = require('fs-extra')

const chai = require('chai')
const chaiFiles = require('chai-files')

chai.use(chaiFiles)

const expect = chai.expect
const file = chaiFiles.file
const dir = chaiFiles.dir

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

const VERBOSE = false

const pkgName = 'my-test-pkg'
const pkgScope = 'my-scope'

describe("unityPackage.addSampleFiles", () => {
    var pkgPath = null

    beforeEach(async function() {
        this.timeout(30000)

        pkgPath = await h.installUnityPackageTemplateToTemp({
          verbose: VERBOSE,
          package_name: pkgName,
          package_scope: pkgScope
        })

    })

    it("adds a set of src files to a project where the content for each file is passed as a string", async function() {
        this.timeout(30000)

        const sampleFiles = [{
                name: 'ExampleClass.cs',
                content: 'public class ExampleClass {}'
            },
            {
                name: 'ExampleScene.unity',
                content: 'guid: example_scene_guid'
            }
        ]

        await unpm.unityPackage.addSampleFiles(pkgPath, sampleFiles)

        const samplesPath = path.join(pkgPath, 'Samples')

        for(var i in sampleFiles) {
          const testFilePath = path.join(samplesPath, sampleFiles[i].name)

          expect(await fs.exists(testFilePath),
            `should gave created file at path '${testFilePath}'`
          ).to.equal(true)

          expect((await fs.readFile(testFilePath, 'utf8')).trim(),
            `${testFilePath} should have content matching what was passed to addSampleFiles`
          ).to.equal(sampleFiles[i].content.trim())
        }

    })

})
