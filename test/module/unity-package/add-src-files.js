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

describe("unityPackage.addSrcFiles", () => {
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

        const srcFiles = [{
                name: 'Foo.cs',
                content: 'public class Foo {}'
            },
            {
                name: 'Bar.cs',
                content: 'public class Bar {} '
            }
        ]

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFiles)

        const srcPath = path.join(pkgPath, 'Runtime', pkgName)

        for(var i in srcFiles) {
          const testFilePath = path.join(srcPath, srcFiles[i].name)

          expect(await fs.exists(testFilePath),
            `should gave created file at path '${testFilePath}'`
          ).to.equal(true)

          expect((await fs.readFile(testFilePath, 'utf8')).trim(),
            `${testFilePath} should have content matching what was passed to addSrcFiles`
          ).to.equal(srcFiles[i].content.trim())
        }

    })

})
