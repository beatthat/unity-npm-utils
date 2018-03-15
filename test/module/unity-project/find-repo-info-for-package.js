const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')
const appRoot = require('app-root-path').path

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
              scopes: [
                  {
                      scope: 'ape',
                      repo: {
                          type: 'git',
                          url_template: 'git+https://github.com/beatthat/{package_name}.git'
                      },
                      unity_install: {
                          path_template: path.join('Assets', 'Plugins', 'packages', 'ape', '{package_name}')
                      }
                  }
              ]
          },
          transformAsync: async (p) => {
              return p; // will just write json_default
          }
      })

      const unpmPackages = await unpm.readJson(testProjPath, { file_name: 'unpm-packages.json' })

      console.log(`at path ${testProjPath} wrote ${JSON.stringify(unpmPackages, null, 2)}`)
    })

})
