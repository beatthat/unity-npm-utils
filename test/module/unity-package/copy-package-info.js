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
      this.timeout(30000);

      const unpmPkg = h.readPackageSync(appRoot)
      expect(unpmPkg.name).to.equal('unity-npm-utils')

      //////////////////////////////////////////////////////////////////////
      // first let's create a test package with unity-npm-utils installed...
      //////////////////////////////////////////////////////////////////////

      const testProjPath = await h.installLocalUnpmToPackage()

      expect(
        fs.existsSync(path.join(testProjPath, 'package.json')),
        'test project should be installed at root ' + testProjPath
      ).to.equal(true)

      var testProj = h.readPackageSync(testProjPath)

      expect(
        testProj.dependencies['unity-npm-utils']
      ).to.exist

      ////////////////////////////////////////////////////////////////////
      // Now let's install a random package ('fs-extra' for this example)
      // This is the package we will test against further down
      ////////////////////////////////////////////////////////////////////

      const testInstallPkg = "fs-extra"

      await h.runPkgCmdAsync('npm install --save ' + testInstallPkg, testProjPath)

      testProj = h.readPackageSync(testProjPath)

      expect(
        testProj.dependencies[testInstallPkg],
        testInstallPkg + ' should have been installed to the test project at ' + testProjPath
      ).to.exist



      // const testPkgRoot = await h.createTmpPackageDir()
      //
      // expect(
      //   fs.existsSync(testPkgRoot),
      //   'temp directory should exist at ' + testPkgRoot
      // ).to.equal(true)
      //
      // await h.runPkgCmdAsync('npm init --force && npm install --save debug', testPkgRoot);
      //
      // expect(
      //   fs.existsSync(path.join(testPkgRoot, 'package.json')),
      //   'test project should be installed at root ' + testPkgRoot
      // ).to.equal(true)

    })

    // var pkgPath = null;
    //
    // before(async function() {
    //     this.timeout(10000);
    //     pkgPath = await h.installUnityPackageTemplateToTemp();
    // });
    //
    // it("installs template files", async () => {
    //     const packageJsonPath = path.join(pkgPath, 'package.json');
    //
    //     expect(await fs.existsAsync(packageJsonPath),
    //         `package.json should exist in install path ${pkgPath}`).to.equal(true);
    // });
    //
    // it("sets initial version to 0.0.1", () => {
    //     const pkg = h.readPackageSync(pkgPath);
    //     expect(pkg.version).to.equal('0.0.1');
    // });

});
