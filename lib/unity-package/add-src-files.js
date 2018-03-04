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

      if(opts.skip_if_source_directory_non_empty
        && await fs.readdirAsync(srcPath).length > 0) {

        return []
      }

      return await Promise.all(
        files.map(async (f) => await fs.writeFileAsync(path.join(srcPath, f.name), f.content))
      )
}

module.exports = addSrcFiles;
