const path = require('path');
const readPackage = require('../core/read-package.js');

/**
 * Get the distributable source path for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @returns {string} the path to the root of distributable source for the package
 */
const srcPathForPkg = async (pkgRoot) => {
      const pkg = await readPackage(pkgRoot)
      return path.join(pkgRoot, 'src', pkg.name)
}

module.exports = srcPathForPkg;
