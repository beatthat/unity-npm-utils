const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path
const readPackage = require('../core/read-package.js')

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
 *
 * @returns { unpmLocal: {object} }
 */
const writePackageInfoToUnpmLocal = async (pkgName, opts) => {
  const projRoot = opts.project_root || appRoot

  const unpmLocalPath = path.join(projRoot, 'unpm-local.json')

  const unpmLocal = await fs.existsAsync(unpmLocalPath)?
    await readPackage(unpmLocalPath) : {}

  const pkgs = unpmLocal.packages = unpmLocal.packages || {}

  const thisPkg = pkgs[pkgName] = pkgs[pkgName] || {}

  const installedPkg = await readPackage(path.join(projRoot, 'node_modules', pkgName))

  thisPkg.name = pkgName
  thisPkg.version = installedPkg.version
  thisPkg.repository = installedPkg.repository
  thisPkg._requested = installedPkg._requested

  await fs.writeFileAsync(unpmLocalPath, JSON.stringify(unpmLocal, null, 2))

  return {
    unpmLocal: unpmLocal
  }

}

module.exports = writePackageInfoToUnpmLocal;
