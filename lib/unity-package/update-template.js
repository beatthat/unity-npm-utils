const fs = require('fs-extra')
const path = require('path')

const _installTemplateToTmp = require('./_install-template-to-tmp.js')
const srcPathForPkg = require('./src-path-for-pkg')

const addSrcFiles = require('./add-src-files.js')
const readPackage = require('../core/read-package.js')
const setPackageName = require('./set-package-name')
const transformPackage = require('../core/transform-package.js')

/**
 * Updates package.json scripts and template files for a Unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 * @returns if no callback function passed, returns a Promise
 */
const updateTemplate = async (pkgRoot, opts) => {

    opts = opts || {};

    const tmpInstallPath = await _installTemplateToTmp()
    const pkgBefore = await readPackage(pkgRoot)

    await transformPackage({
        package_path: tmpInstallPath,
        transform: (pkgTemplate, cb) => {
            const pkgAfter = { ...pkgBefore };

            pkgAfter.files = [
                ...(pkgBefore.files||[]),
                ...(pkgTemplate.files||[])
            ].filter((item, i, ar) => { return ar.indexOf(item) === i })

            pkgAfter.scripts = { ...pkgBefore.scripts, ...pkgTemplate.scripts }
            pkgAfter.dependencies = { ...pkgBefore.dependencies, ...pkgTemplate.dependencies }
            pkgAfter.devDependencies = { ...pkgBefore.devDependencies, ...pkgTemplate.devDependencies }
            cb(null, pkgAfter)
        }
    })

    await setPackageName(tmpInstallPath, opts) // call setPackageName to make sure ./test/package.json dependency on main module is set correctly

    const srcPath = await srcPathForPkg(pkgRoot)

    if(opts.verbose) {
        console.log(`source path ${srcPath}...`)
    }

    const srcDirExists = await fs.exists(srcPath)

    if(opts.verbose) {
        console.log(`source path ${srcPath} exists? ${srcDirExists}`)
    }

    const srcFilesBefore = srcDirExists ?
        await fs.readdir(srcPath): []

    if(opts.verbose) {
        console.log(`source files BEFORE update template ${srcFilesBefore.join()}...`)
    }

    if(srcFilesBefore.length == 0) {
        await addSrcFiles(tmpInstallPath,
            [{name: 'INSTALL.txt', content: 'Placeholder file copies to unity-project'}],
            { ...opts }
        )
    }

    await fs.copy(tmpInstallPath, pkgRoot, {
        filter: async (src, dest) => {
            const destName = path.basename(dest)
            if((destName === 'README.md' || destName === 'LICENSE') && await fs.exists(dest)) {
                return false
            }
            return true
        }
    })
}

module.exports = updateTemplate;
