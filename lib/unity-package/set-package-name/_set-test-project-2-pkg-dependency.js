const path = require('path');
const readPackage = require('../../core/read-package.js');
const transformPackage = require('../../core/transform-package.js');

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
const _setTestProject2PkgDependency = async (pkgRoot, opts) => {

    opts = opts || {};


    const mainPkg = await readPackage(pkgRoot);
    const testPkgRoot = path.join(pkgRoot, 'test');
    const testPkg = await transformPackage({
        package_path: testPkgRoot,
        transform: (testPkg, transformCB) => {
            // filter out existing _latest.tgz dependencies (presumably old names for package)
            testPkg.dependencies = Object.getOwnPropertyNames(testPkg.dependencies || {}).reduce((cur, acc) => {
                const v = testPkg.dependencies[cur];
                if (!v || typeof v.match === 'function' && v.match(/^.*_latest.tgz$/)) {
                    return acc;
                }
                acc[cur] = v;
                return acc;
            }, {});

            testPkg.dependencies[mainPkg.name] = `../${mainPkg.name}-latest.tgz`;

            transformCB(null, testPkg);
        }
    });

    return testPkg;
}

module.exports = _setTestProject2PkgDependency
