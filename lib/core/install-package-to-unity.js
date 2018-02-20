const fs = require('fs-extra-promise')
const path = require('path')
const appRoot = require('app-root-path').path
const _infoForPkg = require('./_info-for-pkg')
const writePackageInfoToUnpmLocal = require('./write-package-info-to-unpm-local')

 /**
  * For a package that's already (npm) installed to node_modules,
  * unpm.installPackageToUnity installs that package to unity
  * (typically just the source) at
  * Assets/Plugins/[packages/][${scope}/]${package_name}
  *
  * Typically, this is called from a postinstall script specified in the package
  *
  * @param {string} pkgName package we will install to unity Assets
  *     (note this must already be installed to node_modules)
  *
  * @param {object} opts.project_root
  *   optional unity project root (directy that contains unity's 'Assets' folder)
  *   When not passed, this defaults to the app-root-path
  *   as determined by eponymous npm package:
  *   https://www.npmjs.com/package/app-root-path
  *
  * @param {string} options.package_scope - the scope the package
  *      that will be copied back from under Assets/Plugins,
  *      so the actual package path is (unity)/Assets/Plugins/$scope/$package_name.
  *      If nothing passed, takes the value from package.json 'scope' property.
  *
  * @param {string} options.src_path - name (or rel path)
  *      of the folder within the package that contains the pkg source for unity.
  *      If nothing passed, defaults to 'src'
  *
  * @returns {object} @see _infoForPkg
  */
const installPackageToUnity = async (pkgName, opts) => {

  opts = opts || {};

  const projRoot = opts.project_root || appRoot

  const pkgRoot = path.join(projRoot, 'node_modules', pkgName)

  if(await fs.existsAsync(path.join(pkgRoot, 'package.json')) === false) {
    if(opts.verbose) {
      console.log(`installPackageToUnity skipping because package not installed in node_modules
        pkg=${pkgName} proj=${projRoot}`)
    }

    return {
      skippedInstallReason: 'package not installed in root of unity project'
    }
  }

  info = await _infoForPkg(pkgRoot, opts)

  if (!info.is_module) {
      return {
          skipped_install_reason: 'package not installed in root of unity project',
          package_info: info
      }
  }

  const result = await writePackageInfoToUnpmLocal(pkgName, {
    ...opts,
    project_root: projRoot,
    transform_package: async (p) => {
        return {
            ...p,
            package_unity_src: info.package_unity_src,
            unity_install_path: info.unity_install_path,
            unity_install: {
                path: info.unity_install_path,
                src: info.package_unity_src
            }
        }
    }
  })

  if(opts.verbose) {
      console.log(`installPackageToUnity(${pkgName}) result:\n ${JSON.stringify(result, null, 2)}`)
  }

  const pkgEntry = result.unpmLocal.packages[pkgName]

  dirExists = await fs.ensureDirAsync(pkgEntry.unity_install.path)
  await fs.copyAsync(pkgEntry.unity_install.src, pkgEntry.unity_install.path)

  return result
}

module.exports = installPackageToUnity
