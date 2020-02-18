const path = require('path')
const fs = require('fs-extra')
const readPackage = require('../../core/read-package.js')
const transformPackage = require('../../core/transform-package.js')

/**
 * @private
 *
 * The test Unity project contained in every Unity package
 * Needs its package.json to depend on (an npm-packed tgz version of)
 * the main package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @returns {Promise}
 */
const _setSubProject2PkgDependency = async (pkgRoot, subPkgName, opts) => {
    opts = opts || {}
    const mainPkg = await readPackage(pkgRoot)
    const subPkgRoot = path.join(pkgRoot, subPkgName)
    if(!await fs.exists(subPkgRoot)) {
        return
    }
    const subPkg = await transformPackage({
        package_path: subPkgRoot,
        transform: (subPkg, transformCB) => {
            // filter out existing _latest.tgz dependencies (presumably old names for package)
            subPkg.dependencies = Object.getOwnPropertyNames(subPkg.dependencies || {}).reduce((acc, cur) => {
                const v = subPkg.dependencies[cur]
                if (typeof cur !== 'string' || !v || (typeof v.match === 'function' && v.match(/^.*-latest.tgz$/))) {
                    return acc
                }
                acc[cur] = v
                return acc
            }, {})
            subPkg.dependencies[mainPkg.name] = `../${mainPkg.name}-latest.tgz`
            subPkg.dependencies['@beatthat/unity-npm-utils'] = '../beatthat-unity-npm-utils.tgz'
            transformCB(null, subPkg)
        }
    })
    return subPkg
}

module.exports = _setSubProject2PkgDependency
