const expect = require('chai').expect
const fs = require('fs-extra')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

const VERBOSE = false

describe("unityProject.findUnitySamplesPathForPackage", () => {


    it("- can guess unity path when a package's scope is defined in unpm-package.json", async function() {
      this.timeout(300000)


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
                beatthat: {
                    name: 'beatthat',
                    repository: {
                        type: 'git',
                        url: 'git+https://github.com/beatthat/{package_name}.git'
                    },
                    install: {
                        path: path.join('Assets', 'Plugins', 'packages', 'beatthat', '{package_name}')
                    }
                }
              }
          },
          transformAsync: async (p) => {
              return p; // will just write json_default
          }
      })

      const testPkgName = "property-interfaces"
      const testPkgScope = "beatthat"
      const testFullPkgFullName = `${testPkgScope}/${testPkgName}`

      await h.runPkgCmdAsync('npm install --save ' + testFullPkgFullName, testProjPath)

      const expectedSamplesPath = path.join(testProjPath, 'Assets', 'Samples', 'packages', 'beatthat', testPkgName)

      await fs.ensureDir(expectedSamplesPath)

      const foundPath = await unpm.unityProject.findUnitySamplesPathForPackage(testPkgName, {
        project_root: testProjPath,
        verbose: VERBOSE
      })

      expect(foundPath).to.equal(
          expectedSamplesPath
      )
    })

})
