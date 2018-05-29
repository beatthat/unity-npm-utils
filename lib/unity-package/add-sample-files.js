const fs = require('fs-extra')
const path = require('path')
const readPackage = require('../core/read-package.js')
const samplesPathForPkg = require('./samples-path-for-pkg')

/**
 * Add files under the Samples directory for a unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {[Object]} files array of file-info objects, e.g.
 * <code>{ name: 'Foo.cs', content: 'public class Foo {}' }
 *
 * @returns {Array} of paths of source files added
 */
const addSampleFiles = async (pkgRoot, files, opts) => {

      opts = opts || {}

      const samplesPath = await samplesPathForPkg(pkgRoot)

      await fs.ensureDir(samplesPath);

      if(opts.verbose) {
          console.log(`add source files to path ${samplesPath}...`)
      }

      if(opts.verbose) {
          console.log(`will add the following files to ${samplesPath}:
              ${files.map(f => f.name).join()}...`)
      }

      return await Promise.all(
        files.map(async (f) => await fs.writeFile(path.join(samplesPath, f.name), f.content))
      )
}

module.exports = addSampleFiles;
