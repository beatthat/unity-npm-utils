const path = require('path')
const readPackage = require('../core/read-package.js')
const fs = require('fs-extra')

/**
 * Get the distributable Samples path for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @returns {string} the path to the root of distributable source for the package
 */
const srcPathForPkg = async (pkgRoot) => {
      const pkg = await readPackage(pkgRoot)

      return path.join(pkgRoot, 'Samples', pkg.name)
}

module.exports = srcPathForPkg;
