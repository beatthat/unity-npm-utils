const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = true

describe.only("unityProject.findRepoInfoForPackage", () => {


    it("- can guess repo info when a package's scope is defined in unpm-package.json", async function() {
      this.timeout(30000)


      //////////////////////////////////////////////////////////////////////
      // first let's create a test package with unity-npm-utils installed...
      //////////////////////////////////////////////////////////////////////

      const testProjPath = await h.installLocalUnpmToPackage()

      // set up a unpm-packages.json with some scope definition
      await unpm.transformJson({
          path: testProjPath,
          file_name: 'unpm-packages.json',
          json_default: {
              scopes: {
                ape: {
                    name: 'ape',
                    repository: {
                        type: 'git',
                        url: 'git+https://github.com/beatthat/{package_name}.git'
                    },
                    install: {
                        path: path.join('Assets', 'Plugins', 'packages', 'ape', '{package_name}')
                    }
                }
              }
          },
          transformAsync: async (p) => {
              return p; // will just write json_default
          }
      })

      const unpmPackages = await unpm.readJson(testProjPath, { file_name: 'unpm-packages.json' })

      const testPkgName = 'my-pkg-foo'
      const repo = await unpm.unityProject.findRepoInfoForPackage(testPkgName, {
        project_root: testProjPath,
        package_install_path: path.join('Assets', 'Plugins', 'packages', 'ape', testPkgName),
        verbose: VERBOSE
      })

      expect(repo.url).to.equal(`git+https://github.com/beatthat/${testPkgName}.git`)
    })

})
