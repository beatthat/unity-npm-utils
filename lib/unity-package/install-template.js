const fs = require('fs-extra-promise')
const path = require('path')

const _installTemplateToTmp = require('./_install-template-to-tmp.js')
const setPackageName = require('./set-package-name')

/**
 * Install template files for a Unity package
 *
 * @param {string} installPath abs path where the package will install
 * @param {Object} opts.package_name
 */
const installTemplate = async (installPath, opts) => {

  opts = opts || {}

  await fs.ensureDirAsync(installPath)
  const files = await fs.readdirAsync(installPath)

  if(files.filter(f => f && f[0] !== '.').length > 0) {
      throw new Error(`cannot install into non-empty path: ${installPath}`)
  }

  const tmpInstallPath = await _installTemplateToTmp()
  await fs.copyAsync(tmpInstallPath, installPath)

  const pkgName = opts.package_name || path.basename(installPath)

  await setPackageName(installPath, { package_name: pkgName })
}

module.exports = installTemplate
