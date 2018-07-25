const fs = require('fs-extra')
const path = require('path')
const appRoot = require('app-root-path').path
const readPackage = require('../core/read-package.js')
const readUnpmPackages = require('./read-unpm-packages')

/**
 * an async function you can pass to writePackageInfoToUnpmPackages
 * that transforms the contents of the package to be written before write
 *
 * @typedef TransformPackageFunction
 * @param p the (unpm-packages.json) package to transform
 * /


/**
 * Called on a unity project with a package name
 * (for a package that will ultimately be deployed into unity Assets).
 * This will write details of the package (name, version, repo url, etc)
 * to a unpm-packages.json file at the root of the unity project.
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
 * @returns { unpmPackages: {object} }
 */
const writePackageInfoToUnpmPackages = async (pkgName, opts) => {
  const projRoot = opts.project_root = opts.project_root || appRoot

  const unpmPackagesPath = path.join(projRoot, 'unpm-packages.json')

  const unpmPackagesExists = await fs.exists(unpmPackagesPath)

  if(opts.verbose) {
      console.log(`writePackageInfoToUnpmPackages(${pkgName}) - unpm-packages
          ${unpmPackagesExists? 'EXISTS': 'does NOT EXIST'} at ${unpmPackagesPath}`)
  }

  const unpmPackages = unpmPackagesExists? await readUnpmPackages(projRoot) : {}

  const pkgs = unpmPackages.packages = unpmPackages.packages || {}

  if(opts.verbose) {
      if(pkgs[pkgName]) {
          console.log(`writePackageInfoToUnpmPackages(${pkgName})   - pkg BEFORE write:\n ${JSON.stringify(pkgs[pkgName], null, 2)}`)
      }
      else {
          console.log(`writePackageInfoToUnpmPackages(${pkgName})  - pkg BEFORE write: DID NOT EXIST`)
      }
  }

  const pkgEntryBefore = pkgs[pkgName] || {}

  pkgEntryBefore.name = pkgName

  const pkgNodeModulesPath = path.join(projRoot, 'node_modules', pkgName)

  if(await fs.exists(pkgNodeModulesPath)) {
      const installedPkg = await readPackage(pkgNodeModulesPath)

      pkgEntryBefore.version = installedPkg.version
      pkgEntryBefore.config = installedPkg.config || {}
      pkgEntryBefore.repository = installedPkg.repository
      // pkgEntryBefore._requested = installedPkg._requested
  }
  else {
      if(opts.verbose) {
          console.log(`No package to read under node_modules at path ${pkgNodeModulesPath}`)
      }
  }

  pkgs[pkgName] = opts.transform_package?
    await opts.transform_package(pkgEntryBefore): pkgEntryBefore;

  await fs.writeFile(unpmPackagesPath, JSON.stringify(unpmPackages, null, 2))

  if(opts.verbose) {
      console.log(`writePackageInfoToUnpmPackages - pkg AFTER write:\n ${JSON.stringify(pkgs[pkgName], null, 2)}`)
  }

  return {
    unpmPackages: unpmPackages
  }

}

module.exports = writePackageInfoToUnpmPackages;
