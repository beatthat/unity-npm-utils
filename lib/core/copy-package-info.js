const fs = require('fs-extra-promise')
const path = require('path')
const readPackage = require('../core/read-package.js')

/**
 * Called on a unity project with a package name
 * (for a package that will ultimately be deployed into unity Assets).
 * This will write details of the package (name, version, repo url, etc)
 * to a unpm-local.json file at the root of the unity project.
 * Having those details written there makes it easier and cleaner
 * to install the actual source files to unity Assets in a subsequent step.
 *
 * @param {string} projRoot abs path to the (unity) project root.
 * This is where unpm-local.json will be written
 *
 * @param {object} pkgName the pkg to copy
 *
 * @returns { unpmLocal: {object} }
 */
const copyPackageInfo = async (projRoot, pkgName, opts) => {
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

module.exports = copyPackageInfo;
