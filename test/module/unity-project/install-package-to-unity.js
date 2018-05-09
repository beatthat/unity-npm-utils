const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = true

describe.only("unityProject.installPackageToUnity", () => {

    /**
     * For a package that's already (npm) installed to node_modules,
     * unpm.installPackageToUnity installs that package to unity
     * (typically just the source).
     */
    it("installs a package (already installed to node_modules) to unity Assets", async function() {
      this.timeout(300000)

      const unpmPkg = await unpm.readPackage(appRoot)

      expect(unpmPkg.name).to.equal('unity-npm-utils')

      //////////////////////////////////////////////////////////////////////
      // first let's create a test package with unity-npm-utils installed...
      //////////////////////////////////////////////////////////////////////

      const testProjPath = await h.installLocalUnpmToPackage()

      expect(
        fs.existsSync(path.join(testProjPath, 'package.json')),
        'test project should be installed at root ' + testProjPath
      ).to.equal(true)

      var testProj = await unpm.readPackage(testProjPath)

      expect(
        testProj.dependencies['unity-npm-utils']
      ).to.exist

      ////////////////////////////////////////////////////////////////////
      // Now let's install a random unity package ('beatthat/properties' for this example)
      // This is the package we will test against further down
      ////////////////////////////////////////////////////////////////////

      const testPkgName = "placements"
      const testPkgScope = "beatthat"
      const testPkgFullName = `${testPkgScope}/${testPkgName}`

      await h.runPkgCmdAsync('npm install --save --ignore-scripts ' + testPkgFullName, testProjPath)

      testProj = await unpm.readPackage(testProjPath)

      const testPkgInstallPath = path.join(testProjPath, 'Assets', 'Plugins', 'packages', testPkgScope, testPkgName)

      expect(
        await fs.existsAsync(testPkgInstallPath),
        "(having installed package with ignore-scripts) the package should NOT yet be installed to unity"
      ).to.equal(false)

      const testPkgSamplesPath = path.join(testProjPath, 'Assets', 'Samples', 'packages', testPkgScope, testPkgName)

      expect(
        await fs.existsAsync(testPkgSamplesPath),
        "(having installed package with ignore-scripts) the package's Samples should NOT yet be installed to unity"
      ).to.equal(false)

      await unpm.unityProject.installPackageToUnity(testPkgName, {
        project_root: testProjPath,
        verbose: VERBOSE
      })

      expect(
        await fs.existsAsync(testPkgInstallPath),
        `the package folder should be installed to unity at ${testPkgInstallPath}`
      ).to.equal(true)

      expect(
        await fs.existsAsync(testPkgSamplesPath),
        `the package Samples folder should be installed to unity ar ${testPkgSamplesPath}`
      ).to.equal(true)
    })

});
