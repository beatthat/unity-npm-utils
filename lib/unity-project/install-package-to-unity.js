const fs = require('fs-extra')
const path = require('path')
const appRoot = require('app-root-path').path
const _infoForPkg = require('../core/_info-for-pkg')
const writePackageInfoToUnpmPackages = require('./write-package-info-to-unpm-packages')
const {syncMissingMetaFiles} = require('node-unity-guid-utils')
const transformPackage = require('../core/transform-package')

const copySrc2Unity = async (srcPath, tgtPath) => {
  await fs.ensureDir(tgtPath)
  await fs.copy(srcPath, tgtPath, {
    filter: f => f.match(/.*\.meta$/) === null
  })
  await syncMissingMetaFiles({
    path_source: srcPath,
    path_target: tgtPath
  })
}
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

  const projPath = p => path.resolve(projRoot, p) // gonna resolve a lot of paths below

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
            package_root: path.relative(projRoot, info.package_root),
            package_unity_src: path.relative(projRoot, info.package_unity_src),
            package_unity_samples: path.relative(projRoot, info.package_unity_samples),
            unity_install_path: path.relative(projRoot, info.unity_install_path),
            unity_install_samples_path: path.relative(projRoot, info.unity_install_samples_path),
            unity_install: {
                path: path.relative(projRoot, info.unity_install_path),
                src: path.relative(projRoot, info.package_unity_src)
            }
        }
    }
  })

  if(opts.verbose) {
      console.log(`installPackageToUnity(${pkgName}) result:\n ${JSON.stringify(result, null, 2)}`)
  }

  const pkgEntry = result.unpmPackages.packages[pkgName]

  await copySrc2Unity(projPath(pkgEntry.unity_install.src), projPath(pkgEntry.unity_install.path))

  const readMeName = 'README.md'
  const readMeSrc = projPath(path.join(pkgEntry.package_root, readMeName))

  if(await fs.exists(readMeSrc)) {
    await fs.copy(readMeSrc, projPath(path.join(pkgEntry.unity_install.path, readMeName)))

    const readMeFilesName = 'readmefiles'
    const readMeFilesSrc = projPath(path.join(pkgEntry.package_root, readMeFilesName))
    if(await fs.exists(readMeFilesSrc) && (await fs.lstat(readMeFilesSrc)).isDirectory()) {
      await copySrc2Unity(
        readMeFilesSrc,
        projPath(path.join(pkgEntry.unity_install.path, readMeFilesName))
      )
    }
  }

  if(await fs.exists(projPath(pkgEntry.package_unity_samples))) {
      await copySrc2Unity(
        projPath(pkgEntry.package_unity_samples),
        projPath(pkgEntry.unity_install_samples_path)
      )
  }

  // when unity-npm-utils is installed to a unity project
  // that project should have npm scripts that
  // copy changes made to any package in the unity project
  // back to a vs clone of the package
  await transformPackage({
    package_path: projRoot,
    transform: (pkg, cb) => {
      const scripts = pkg.scripts? {...pkg.scripts }: {}
      scripts.overwrite2clone = scripts.overwrite2clone || './node_modules/.bin/overwrite2clone'
      cb(null, {
        ...pkg,
        scripts: scripts
      })
    }
  })

  return result
}


module.exports = installPackageToUnity
