const fs = require('fs-extra-promise');
const path = require('path');
const readPackage = require('../core/read-package.js');

/**
 * Add files under the src directory for a unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {[Object]} files array of file-info objects, e.g.
 * <code>{ name: 'Foo.cs', content: 'public class Foo {}' }
 *
 * @param {bool} opts.skip_if_source_directory_non_empty - when set TRUE will only add the files if the source directory is empty
 *
 * @returns {Array} of paths of source files added
 */
const addSrcFiles = async (pkgRoot, files, opts) => {

      opts = opts || {}

      const pkg = await readPackage(pkgRoot)
      const srcPath = path.join(pkgRoot, 'src', pkg.name)

      await fs.ensureDirAsync(srcPath);

      if(opts.verbose) {
          console.log(`add source files to path ${srcPath}...`)
      }

      if(opts.skip_if_source_directory_non_empty) {
          const srcFilesBefore = await fs.readdirAsync(srcPath)

          if(opts.verbose) {
              console.log(`skip_if_source_directory_non_empty option is set.
                  source files BEFORE add ${srcFilesBefore.join()}...`)
          }

          if(srcFilesBefore.length > 0) {
              return []
          }
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
