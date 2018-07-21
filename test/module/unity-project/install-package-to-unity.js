const expect = require('chai').expect
const fs = require('fs-extra')
const path = require('path')
const YAML = require('yamljs');

const h = require('../../test-helpers')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = false

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

    it.only(`preserves the guid of existing meta files under the target path,
      otherwise replacing the target with the source`, async function() {
      this.timeout(300000)

      const pkgInfo = await h.npmInstallPackageWithIgnoreScripts("placements", "beatthat")

      console.log(`pkgInfo=${JSON.stringify(pkgInfo, null, 2)}`)

      await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
        project_root: pkgInfo.test_project_path,
        verbose: VERBOSE
      })

      const moduleSrcRoot = path.join(
        pkgInfo.test_project_path,
        'node_modules',
        pkgInfo.test_package_name,
        'Runtime',
        pkgInfo.test_package_name
      )

      console.log(`module src=${moduleSrcRoot}`)

      expect(
        await fs.exists(moduleSrcRoot),
        `module src exist be under node_modules at ${moduleSrcRoot}`
      ).to.be.true

      const testModuleFiles = await fs.readdir(moduleSrcRoot)

      expect(
        Array.isArray(testModuleFiles),
        `should be source files under ${moduleSrcRoot}`
      ).to.be.true

      console.log(`files=${JSON.stringify(testModuleFiles, null, 2)}`)

      let testMetaFile = null
      let testMetaFilePath = null

      for(let i = 0; i < testModuleFiles.length; i++) {
        if(!testModuleFiles[i].match(/.*\.cs\.meta$/)) {
          continue
        }
        if((await fs.lstat(path.join(moduleSrcRoot, testModuleFiles[i]))).isDirectory()) {
          continue
        }

        testMetaFile = testModuleFiles[i]
        testMetaFilePath = path.join(moduleSrcRoot, testModuleFiles[i])

      }

      console.log(`module testMetaFilePath: ${testMetaFilePath}`)

      expect(testMetaFilePath,
        `should be at least one meta file in package src at ${testMetaFilePath}`
      ).to.exist

      const metaOrig = YAML.parse(await fs.readFile(testMetaFilePath, 'utf8'))

      console.log(`module testMetaFile: ${YAML.stringify(metaOrig, null, 2)}`)

      const origGUID = metaOrig.guid

      expect(
        origGUID,
        `metafile should have a guid (${testMetaFilePath})`
      ).to.exist

      const changedGUID = `changed${origGUID}`

      await fs.writeFile(testMetaFilePath, YAML.stringify({...metaOrig, guid: changedGUID }, null, 2))

      const metaChanged = YAML.parse(await fs.readFile(testMetaFilePath, 'utf8'))

      expect(
        metaChanged.guid,
        `metafile in node_modules should have changed guid`
      ).to.equal(changedGUID)

      await unpm.unityProject.installPackageToUnity(pkgInfo.test_package_name, {
        project_root: pkgInfo.test_project_path,
        verbose: VERBOSE
      })

      const installedMetaPath = path.join(
        pkgInfo.test_package_expected_unity_install_path,
        testMetaFile
      )

      expect(installedMetaPath,
        `${installedMetaPath} should be installed`
      ).to.exist


      const metaInstalled = YAML.parse(await fs.readFile(installedMetaPath, 'utf8'))

      expect(
        metaInstalled.guid,
        `metafile guid should NOT have been overwritten on second install`
      ).to.equal(origGUID)

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
