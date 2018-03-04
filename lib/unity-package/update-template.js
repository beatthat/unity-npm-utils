const fs = require('fs-extra-promise');

const _installTemplateToTmp = require('./_install-template-to-tmp.js');

const addSrcFiles = require('./add-src-files.js');
const readPackage = require('../core/read-package.js');
const setPackageName = require('./set-package-name');
const transformPackage = require('../core/transform-package.js');

/**
 * Updates package.json scripts and template files for a Unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @returns if no callback function passed, returns a Promise
 */
const updateTemplate = async (pkgRoot, options) => {

    options = options || {};

    const tmpInstallPath = await _installTemplateToTmp()
    const pkgBefore = await readPackage(pkgRoot)

    await transformPackage({
        package_path: tmpInstallPath,
        transform: (pkgTemplate, cb) => {
            const pkgAfter = { ...pkgBefore };

            pkgAfter.files = [
                ...(pkgBefore.files||[]),
                ...(pkgTemplate.files||[])
            ].filter((item, i, ar) => { return ar.indexOf(item) === i; })

            pkgAfter.scripts = { ...pkgBefore.scripts, ...pkgTemplate.scripts };
            pkgAfter.dependencies = { ...pkgBefore.dependencies, ...pkgTemplate.dependencies };
            pkgAfter.devDependencies = { ...pkgBefore.devDependencies, ...pkgTemplate.devDependencies };
            cb(null, pkgAfter);
        }
    })

    await setPackageName(tmpInstallPath) // call setPackageName to make sure ./test/package.json dependency on main module is set correctly
    await addSrcFiles(tmpInstallPath,
        [{name: 'INSTALL.txt', content: 'Placeholder file copies to unity-project'}],
        { skip_if_source_directory_non_empty: true }
    )

    await fs.copyAsync(tmpInstallPath, pkgRoot)
}

module.exports = updateTemplate;
