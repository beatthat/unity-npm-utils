const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

describe.only("unityPackage.copyPackageInfo", () => {

    /**
     * test that copyPackageInfo can take an arbitrary installed package
     * and write the details of that package to the file unpm-local.json
     */
    it("- copies info required to install a package to unity from node_modules to unpm-packages.json", async function() {
      this.timeout(30000)

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
      // Now let's install a random package ('fs-extra' for this example)
      // This is the package we will test against further down
      ////////////////////////////////////////////////////////////////////

      const testInstallPkg = "fs-extra"

      await h.runPkgCmdAsync('npm install --save ' + testInstallPkg, testProjPath)

      testProj = await unpm.readPackage(testProjPath)

      expect(
        testProj.dependencies[testInstallPkg],
        testInstallPkg + ' should have been installed to the test project at ' + testProjPath
      ).to.exist

      ////////////////////////////////////////////////////////////
      // now finally make the call to copy package info
      // and follow up with some tests/expectations
      ///////////////////////////////////////////////////////////

      await unpm.copyPackageInfo(testProjPath, testInstallPkg)

      const unpmLocalPath = path.join(testProjPath, "unpm-local.json")

      expect(
        await fs.existsAsync(unpmLocalPath),
        'unpm-local.json should have been written at ' + unpmLocalPath
      ).to.equal(true)

      const unpmLocal = await await unpm.readUnpmLocal(testProjPath)

      expect(
        unpmLocal.packages[testInstallPkg].name,
        'unpm-local.json should contain an entry for the test package ('
        + testInstallPkg + ')'
      ).to.equal(testInstallPkg)

    })

});
