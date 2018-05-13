const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = true


const npmInstallPackageWithIgnoreScripts = async function(pkgName, pkgScope)
{
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

    const testPkgFullName = `${pkgScope}/${pkgName}`

    await h.runPkgCmdAsync('npm install --save --ignore-scripts ' + testPkgFullName, testProjPath)

    testProj = await unpm.readPackage(testProjPath)

    const testPkgInstallPath = path.join(testProjPath, 'Assets', 'Plugins', 'packages', pkgScope, pkgName)

    expect(
      await fs.existsAsync(testPkgInstallPath),
      "(having installed package with ignore-scripts) the package should NOT yet be installed to unity"
    ).to.equal(false)

    const testPkgSamplesPath = path.join(testProjPath, 'Assets', 'Samples', 'packages', pkgScope, pkgName)

    expect(
      await fs.existsAsync(testPkgSamplesPath),
      "(having installed package with ignore-scripts) the package's Samples should NOT yet be installed to unity"
    ).to.equal(false)

    return {
        test_project_path: testProjPath,
        test_package_name: pkgName,
        test_package_scope: pkgScope,
        test_package_full_name: testPkgFullName,
        test_package_expected_unity_install_path: testPkgInstallPath,
        test_package_expected_unity_samples_path: testPkgSamplesPath
    }
}

describe("unityProject.installPackageToUnity", () => {

    /**
     * For a package that's already (npm) installed to node_modules,
     * unpm.installPackageToUnity installs that package to unity
     * (typically just the source).
     */
    it("installs code and samples from a package (already installed to node_modules) to unity Assets", async function() {
      this.timeout(300000)

      const pkgInfo = await npmInstallPackageWithIgnoreScripts("placements", "beatthat")

      await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
        project_root: pkgInfo.test_project_path,
        verbose: VERBOSE
      })

      expect(
        await fs.existsAsync(pkgInfo.test_package_expected_unity_install_path),
        `the package folder should be installed to unity at ${pkgInfo.test_package_expected_unity_install_path}`
      ).to.equal(true)

      expect(
        await fs.existsAsync(pkgInfo.test_package_expected_unity_samples_path),
        `the package Samples folder should be installed to unity ar ${pkgInfo.test_package_expected_unity_samples_path}`
      ).to.equal(true)
    })

    it("does NOT create a Samples directory for the package in Unity if there are no samples in the package", async function() {
        this.timeout(300000)

        const pkgInfo = await npmInstallPackageWithIgnoreScripts("placements", "beatthat")

        // get rid of the Samples directory from the package,
        // and then confirm that samples directory
        // doesn't get created on unity-install side

        const pkgSamplesPath = path.join(pkgInfo.test_project_path, 'node_modules', pkgInfo.test_package_name, 'Samples')

        await fs.removeAsync(pkgSamplesPath)

        await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
          project_root: pkgInfo.test_project_path,
          verbose: VERBOSE
        })

        expect(
          await fs.existsAsync(pkgInfo.test_package_expected_unity_install_path),
          `the package folder should be installed to unity at ${pkgInfo.test_package_expected_unity_install_path}`
        ).to.equal(true)

        expect(
          await fs.existsAsync(pkgInfo.test_package_expected_unity_samples_path),
          `no Samples should be installed at ${pkgInfo.test_package_expected_unity_samples_path} because the Samples were deleted from the package source`
      ).to.equal(false)
    })

});
