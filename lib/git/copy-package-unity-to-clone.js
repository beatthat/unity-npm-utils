const path = require('path')
const appRoot = require('app-root-path').path

const _infoForPkg = require('../core/_info-for-pkg')
const cloneOrPullInstalledPackage = require('./clone-or-pull-installed-package')
const copyFromUnity2Pkg = require('../core/copy-from-unity-2-pkg')

/**
 *
 * @param {string} pkgName the (installed) package to copy back to a git clone
 * @param {string} opts.project_root (optional) path to the root of
 *      the unity project where the package is installed.
 *      If not passed, uses @see app-root-path
 */
const copyPackageUnityToClone = async (pkgName, opts) => {

    opts = opts || {};

    const projRoot = opts.project_root = opts.project_root || appRoot

    if (opts.verbose) {
        console.log(`copy unity to linked clone: unityroot=${projRoot}, opts=${JSON.stringify(opts)}`);
    }

    const result = await cloneOrPullInstalledPackage(pkgName, {...opts, project_root: projRoot });

    if (opts.verbose) {
        console.log(`cloneOrPullInstalledPackage(${pkgName}) result:\n ${JSON.stringify(result, null, 2)}`);
    }

    const pkgEntry = result.unpmLocal.packages[pkgName]

    if (opts.verbose) {
        console.log(`cloned pkg ${pkgName} to ${pkgEntry.clone.src}`);
    }

    const copyInfo = await copyFromUnity2Pkg(pkgName, {
        ...opts,
        package_target_path: path.join(pkgEntry.clone.src, pkgName)
    })

    console.log(`
===================================================================================================================
copy to linked clone succeeded
-----------------------------------------------------------------------------------------------------------------

commit changes at ${pkgEntry.clone.path}

cd ${pkgEntry.clone.path} && git add -A && git commit -m
===================================================================================================================
    `)

    return result

}

module.exports = copyPackageUnityToClone
