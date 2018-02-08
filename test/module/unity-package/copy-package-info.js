const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

describe("unityPackage.copyPackageInfo", () => {


    it("- copies info required to install a package to unity from node_modules to unpm-packages.json", async function() {
      this.timeout(30000);

      const unpmPkg = h.readPackageSync(appRoot)

      expect(unpmPkg.name).to.equal('unity-npm-utils')

      const testPkgPath = await h.installLocalUnpmToPackage()

      expect(
        fs.existsSync(path.join(testPkgPath, 'package.json')),
        'test project should be installed at root ' + testPkgPath
      ).to.equal(true)

      const testPkg = h.readPackageSync(appRoot)

      expect(
        testPkg.dependencies['unity-npm-utils']
      ).to.not.be.null

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
