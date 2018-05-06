const path = require('path')
const readPackage = require('../core/read-package.js')
const fs = require('fs-extra-promise')

/**
 * Get the distributable source path for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @returns {string} the path to the root of distributable source for the package
 */
const srcPathForPkg = async (pkgRoot) => {
      const pkg = await readPackage(pkgRoot)

      const srcPath = path.join(pkgRoot, 'Runtime', pkg.name)
      const srcPathLegacy = path.join(pkgRoot, 'src', pkg.name)

      if(await fs.existsAsync(srcPath)) {
          return srcPath
      }

      if(await fs.existsAsync(srcPathLegacy)) {
          return srcPathLegacy
      }

      return srcPath

}

module.exports = srcPathForPkg;
