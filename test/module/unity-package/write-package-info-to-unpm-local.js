const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

describe("unityPackage.writePackageInfoToUnpmLocal", () => {

    /**
     * test that writePackageInfoToUnpmLocal can take an arbitrary installed package
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

      const testInstallPkgName = "fs-extra"

      await h.runPkgCmdAsync('npm install --save ' + testInstallPkgName, testProjPath)

      testProj = await unpm.readPackage(testProjPath)

      expect(
        testProj.dependencies[testInstallPkgName],
        testInstallPkgName + ' should have been installed to the test project at ' + testProjPath
      ).to.exist

      ////////////////////////////////////////////////////////////
      // now finally make the call to copy package info
      // and follow up with some tests/expectations
      ///////////////////////////////////////////////////////////

      await unpm.writePackageInfoToUnpmLocal(testProjPath, testInstallPkgName)

      const unpmLocalPath = path.join(testProjPath, "unpm-local.json")

      expect(
        await fs.existsAsync(unpmLocalPath),
        'unpm-local.json should have been written at ' + unpmLocalPath
      ).to.equal(true)

      const unpmLocal = await await unpm.readUnpmLocal(testProjPath)

      const testInstallPkg = await unpm.readPackage(
        path.join(testProjPath, 'node_modules', testInstallPkgName))

      expect(
        unpmLocal.packages[testInstallPkgName].name,
        'unpm-local.json should contain an entry for the test package ('
        + testInstallPkgName + ')'
      ).to.equal(testInstallPkgName)

      expect(
        unpmLocal.packages[testInstallPkgName].version,
        'unpm-local.json should contain an entry for the test package ('
        + testInstallPkgName
        + ') with version matching the installed (node_modules) package version'
      ).to.equal(testInstallPkg.version)

      expect(
        unpmLocal.packages[testInstallPkgName].repository.url,
        'unpm-local.json should contain an entry for the test package ('
        + testInstallPkgName
        + ') with repository url matching the installed (node_modules) package repository url'
      ).to.equal(testInstallPkg.repository.url)

    })

});
