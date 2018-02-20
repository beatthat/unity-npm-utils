
const expect = require('chai').expect
const Repo = require('git-tools')
const path = require('path')
const fs = require('fs-extra-promise')
const tmp = require('tmp-promise')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

const VERBOSE = false

describe("git.cloneOrPullInstallPackage - clones or updates an external git clone for an installed package", () => {

    it("creates a new clone under the user's home directory by default", async function() {
        this.timeout(30000);

        const testProjPath = await h.installLocalUnpmToPackage()

        expect(
          fs.existsSync(path.join(testProjPath, 'package.json')),
          'test project should be installed at root ' + testProjPath
        ).to.equal(true)

        var testProj = await unpm.readPackage(testProjPath)

        expect(
          testProj.dependencies['unity-npm-utils']
        ).to.exist

        const pkgToCloneFullName = "beatthat/properties"
        const pkgToClone = "properties"

        await h.runPkgCmdAsync('npm install --save ' + pkgToCloneFullName, testProjPath)

        const tmpd = await tmp.dir()
        const result = await unpm.git.cloneOrPullInstalledPackage(pkgToClone, {
            project_root: testProjPath,
            clone_dir: path.join(tmpd.path, 'clones'),
            verbose: VERBOSE
        })

        if(VERBOSE) {
            console.log(`result of cloneOrPullInstalledPackage(${pkgToClone}):\n ${JSON.stringify(result, null, 2)}`)
        }

        expect(typeof(result.unpmLocal),
            "result should include the (updated) unpm-local file for the project, read to a json object"
        ).to.equal('object')

        expect(typeof(result.unpmLocal.packages),
            "result unpmLocal should contain a 'packages' object"
        ).to.equal('object')

        const pkgEntry = result.unpmLocal.packages[pkgToClone]

        expect(typeof(pkgEntry),
            `result unpmLocal should contain a an entry for the cloned package (${pkgToClone})`
        ).to.equal('object')

        expect(typeof(pkgEntry.clone),
            `result unpmLocal should contain a an entry for the cloned package (${pkgToClone}) with a 'clone' info object`
        ).to.equal('object')


        const clonePkg = h.readPackageSync(pkgEntry.clone.path)
        expect(clonePkg.name, 'clone package has name set').to.equal(pkgToClone)

        const repo = new Repo(pkgEntry.clone.path)

        expect(await repo.isRepo(), `should be a repo at path ${repo.path}`).to.equal(true)

        const status = await repo.exec('status', '--short')

        expect(status.trim().length, 'git status should show no local changes').to.equal(0)
    });


});
