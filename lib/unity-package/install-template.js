const fs = require('fs-extra')
const path = require('path')

const _installTemplateToTmp = require('./_install-template-to-tmp.js')
const setPackageName = require('./set-package-name')
const transformPackage = require('../core/transform-package')

/**
 * Install template files for a Unity package
 *
 * @param {string} installPath abs path where the package will install
 * @param {Object} opts.package_name
 */
const installTemplate = async (installPath, opts) => {

  opts = opts || {}

  await fs.ensureDir(installPath)


  if(opts.verbose) {
    console.log(`install-template directory ensured at install path ${installPath}`)
  }

  const files = await fs.readdir(installPath)


  if(files.filter(f => f && f[0] !== '.').length > 0) {
      if(opts.verbose) {
        console.log(`install-template directory NOT EMPTY at install path ${installPath}`)
      }
      throw new Error(`cannot install into non-empty path: ${installPath}`)
  }

  if(opts.verbose) {
    console.log(`install-template directory NOT EMPTY at install path ${installPath}`)
  }

  const tmpInstallPath = await _installTemplateToTmp(opts)
  await fs.copy(tmpInstallPath, installPath)

  const pkgName = opts.package_name || path.basename(installPath)

  await setPackageName(installPath, { ...opts, package_name: pkgName })
  await transformPackage({
    package_path: installPath,
    transform: (p, callback) => {
      callback(null, {...p, version: "1.0.0"} )
    }
  })
}

module.exports = installTemplate
