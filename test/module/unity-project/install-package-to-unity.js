const expect = require('chai').expect
const fs = require('fs-extra')
const path = require('path')

const h = require('../../test-helpers')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = true

describe("unityProject.installPackageToUnity", () => {

    /**
     * For a package that's already (npm) installed to node_modules,
     * unpm.installPackageToUnity installs that package to unity
     * (typically just the source).
     */
    it("installs code and samples from a package (already installed to node_modules) to unity Assets", async function() {
      this.timeout(300000)

      const pkgInfo = await h.npmInstallPackageWithIgnoreScripts("placements", "beatthat")

      await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
        project_root: pkgInfo.test_project_path,
        verbose: VERBOSE
      })

      expect(
        await fs.exists(pkgInfo.test_package_expected_unity_install_path),
        `the package folder should be installed to unity at ${pkgInfo.test_package_expected_unity_install_path}`
      ).to.equal(true)

      expect(
        await fs.exists(pkgInfo.test_package_expected_unity_samples_path),
        `the package Samples folder should be installed to unity ar ${pkgInfo.test_package_expected_unity_samples_path}`
      ).to.equal(true)
    })

    it("does NOT create a Samples directory for the package in Unity if there are no samples in the package", async function() {
        this.timeout(300000)

        const pkgInfo = await h.npmInstallPackageWithIgnoreScripts("placements", "beatthat")

        // get rid of the Samples directory from the package,
        // and then confirm that samples directory
        // doesn't get created on unity-install side

        const pkgSamplesPath = path.join(pkgInfo.test_project_path, 'node_modules', pkgInfo.test_package_name, 'Samples')

        await fs.remove(pkgSamplesPath)

        await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
          project_root: pkgInfo.test_project_path,
          verbose: VERBOSE
        })

        expect(
          await fs.exists(pkgInfo.test_package_expected_unity_install_path),
          `the package folder should be installed to unity at ${pkgInfo.test_package_expected_unity_install_path}`
        ).to.equal(true)

        expect(
          await fs.exists(pkgInfo.test_package_expected_unity_samples_path),
          `no Samples should be installed at ${pkgInfo.test_package_expected_unity_samples_path} because the Samples were deleted from the package source`
      ).to.equal(false)
    })

});
