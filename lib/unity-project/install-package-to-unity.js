const fs = require('fs-extra')
const path = require('path')
const appRoot = require('app-root-path').path
const _infoForPkg = require('../core/_info-for-pkg')
const writePackageInfoToUnpmPackages = require('./write-package-info-to-unpm-packages')
const {mergeMetaFiles} = require('node-unity-guid-utils')

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
  *      If nothing passed, defaults to 'Runtime'
  *
  * @returns {object} @see _infoForPkg
  */
const installPackageToUnity = async (pkgName, opts) => {

  opts = opts || {}

  pkgName = path.basename(pkgName)

  const projRoot = opts.project_root || appRoot

  const pkgRoot = path.join(projRoot, 'node_modules', pkgName)

  if(await fs.exists(path.join(pkgRoot, 'package.json')) === false) {
    if(opts.verbose) {
      console.log(`installPackageToUnity skipping because package not installed in node_modules
        pkg=${pkgName} proj=${projRoot}`)
    }

    return {
      skippedInstallReason: 'package not installed in root of unity project'
    }
  }

  info = await _infoForPkg(pkgRoot, opts)

  if(opts.verbose) {
      console.log(`info for package at root ${pkgRoot}=\n${JSON.stringify(info, null, 2)}`)
  }

  if (!info.is_module) {
      return {
          skipped_install_reason: 'package not installed in root of unity project',
          package_info: info
      }
  }

  const result = await writePackageInfoToUnpmPackages(pkgName, {
    ...opts,
    project_root: projRoot,
    transform_package: async (p) => {
        return {
            ...p,
            package_unity_src: info.package_unity_src,
            package_unity_samples: info.package_unity_samples,
            unity_install_path: info.unity_install_path,
            unity_install_samples_path: info.unity_install_samples_path,
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

  const pkgEntry = result.unpmPackages.packages[pkgName]

  await fs.ensureDir(pkgEntry.unity_install.path)
  await fs.copy(pkgEntry.unity_install.src, pkgEntry.unity_install.path, {
    filter: f => f.match(/.*\.meta$/) === false
  })
  await mergeMetaFiles({
    path_source: pkgEntry.unity_install.src,
    path_target: pkgEntry.unity_install.path
  })

  if(await fs.exists(pkgEntry.package_unity_samples)) {
      await fs.ensureDir(pkgEntry.unity_install_samples_path)
      await fs.copy(pkgEntry.package_unity_samples, pkgEntry.unity_install_samples_path, {
        filter: f => f.match(/.*\.meta$/) === false
      })
      await mergeMetaFiles({
        path_source: pkgEntry.package_unity_samples,
        path_target: pkgEntry.unity_install_samples_path
      })
  }

  return result
}

module.exports = installPackageToUnity
