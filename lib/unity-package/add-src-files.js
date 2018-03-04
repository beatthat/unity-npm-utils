const fs = require('fs-extra-promise')
const path = require('path')
const readPackage = require('../core/read-package.js')
const srcPathForPkg = require('./src-path-for-pkg')

/**
 * Add files under the src directory for a unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {[Object]} files array of file-info objects, e.g.
 * <code>{ name: 'Foo.cs', content: 'public class Foo {}' }
 *
 * @returns {Array} of paths of source files added
 */
const addSrcFiles = async (pkgRoot, files, opts) => {

      opts = opts || {}

      const srcPath = await srcPathForPkg(pkgRoot)

      await fs.ensureDirAsync(srcPath);

      if(opts.verbose) {
          console.log(`add source files to path ${srcPath}...`)
      }

      if(opts.verbose) {
          console.log(`will add the following files to ${srcPath}:
              ${files.map(f => f.name).join()}...`)
      }

      return await Promise.all(
        files.map(async (f) => await fs.writeFileAsync(path.join(srcPath, f.name), f.content))
      )
}

module.exports = addSrcFiles;
