const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path
const readPackage = require('../core/read-package.js')
const readUnpmLocal = require('./read-unpm-local')

/**
 * an async function you can pass to writePackageInfoToUnpmLocal
 * that transforms the contents of the package to be written before write
 *
 * @typedef TransformPackageFunction
 * @param p the (unity-npm-local.json) package to transform
 * /


/**
 * Called on a unity project with a package name
 * (for a package that will ultimately be deployed into unity Assets).
 * This will write details of the package (name, version, repo url, etc)
 * to a unpm-local.json file at the root of the unity project.
 * Having those details written there makes it easier and cleaner
 * to install the actual source files to unity Assets in a subsequent step.
 *
 * @param {object} pkgName the pkg to copy

 * @param {object} opts.project_root
 *   optional unity project root (directy that contains unity's 'Assets' folder)
 *   When not passed, this defaults to the app-root-path
 *   as determined by eponymous npm package:
 *   https://www.npmjs.com/package/app-root-path
 *
 * @param {TransformPackageFunction} transform_package optional transform
 *
 *
 * @returns { unpmLocal: {object} }
 */
const writePackageInfoToUnpmLocal = async (pkgName, opts) => {
    opts = opts || {}

  const projRoot = opts.project_root = opts.project_root || appRoot

  const unpmLocalPath = path.join(projRoot, 'unpm-local.json')

  const unpmLocalExists = await fs.existsAsync(unpmLocalPath)

  if(opts.verbose) {
      console.log(`writePackageInfoToUnpmLocal(${pkgName}) - unpm-local
          ${unpmLocalExists? 'EXISTS': 'does NOT EXIST'} at ${unpmLocalPath}`)
  }

  const unpmLocal = unpmLocalExists? await readUnpmLocal(projRoot) : {}

  const pkgs = unpmLocal.packages = unpmLocal.packages || {}

  if(opts.verbose) {
      if(pkgs[pkgName]) {
          console.log(`writePackageInfoToUnpmLocal(${pkgName})   - pkg BEFORE write:\n ${JSON.stringify(pkgs[pkgName], null, 2)}`)
      }
      else {
          console.log(`writePackageInfoToUnpmLocal(${pkgName})  - pkg BEFORE write: DID NOT EXIST`)
      }
  }

  const pkgEntryBefore = pkgs[pkgName] || {}

  if(opts.verbose) {
      console.log(`TODO: before we check node_modules as a source to copy the package,
          would be possible to guess repository info etc
          based on some basic config in unpm-local (or unpm-packages if we break that out?)
          `)
  }
  /**
   * TODO: before we check node_modules to try to copy the package,
   * would be possible to guess repository info etc
   * based on some basic config in unpm-local (or unpm-packages if we break that out?)
   * Example, what if unpm-packages.json supported entries like this:
   *
{
  "scope_package_templates": {
    "ape" : {
      "name": "{package_name}",
      "repository" : {
        "type": "git",
        "url": "git+https://github.com/beatthat/{package_name}.git"
      },
      "unity_install_path": "/Users/kirschner/projects/pal-ios/Assets/Plugins/packages/ape/{package_name}",
    }
  }
}
  */

  pkgEntryBefore.name = pkgName

  const pkgNodeModulesPath = path.join(projRoot, 'node_modules', pkgName)

  if(await fs.existsAsync(pkgNodeModulesPath)) {
      if(opts.verbose) {
          console.log(`will try to read package from node_modules at path ${pkgNodeModulesPath}`)
      }

      const installedPkg = await readPackage(pkgNodeModulesPath)

      pkgEntryBefore.version = installedPkg.version
      pkgEntryBefore.config = installedPkg.config || {}
      pkgEntryBefore.repository = installedPkg.repository
      pkgEntryBefore._requested = installedPkg._requested
  }
  else {
      if(opts.verbose) {
          console.log(`No package to read under node_modules at path ${pkgNodeModulesPath}`)
      }
  }

  pkgs[pkgName] = opts.transform_package? await opts.transform_package(pkgEntryBefore): pkgEntryBefore;

  if(opts.verbose) {
      console.log(`writePackageInfoToUnpmLocal - pkg BEFORE write:\n ${JSON.stringify(pkgs[pkgName], null, 2)}`)
  }

  await fs.writeFileAsync(unpmLocalPath, JSON.stringify(unpmLocal, null, 2))

  if(opts.verbose) {
      console.log(`writePackageInfoToUnpmLocal - pkg AFTER write to path ${unpmLocalPath}`)
  }

  return {
    unpmLocal: unpmLocal
  }

}

module.exports = writePackageInfoToUnpmLocal;
