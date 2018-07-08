const fs = require('fs-extra');
const mkdirp = require('mkdirp');
const path = require('path');

const transformPackage = require('../../core/transform-package.js');
const _setSrcPackageName = require('./_set-src-package-name.js');
const _setSubProject2PkgDependency = require('./_set-sub-project-2-pkg-dependency.js');

/**
 * @private
 */
const _updateUrls = (pkg) => {
    if(!(pkg.name && pkg.config && pkg.config.scope)) {
        return pkg;
    }

    const repo = pkg.repository = {...pkg.repository } || {};

    repo.type = repo.type || 'git';
    repo.url = (repo.url && !repo.url.match(/^git\+https:\/\/github\.com\/[^/]+\/[^/]+\.git$/))?
        repo.url:
        `git+https://github.com/${_toCannonical(pkg.config.scope)}/${_toCannonical(pkg.name)}.git`;

    const bugs = pkg.bugs = {...pkg.bugs } || {};

    bugs.url = (bugs.url && !bugs.url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues$/))?
        bugs.url:
        `https://github.com/${_toCannonical(pkg.config.scope)}/${_toCannonical(pkg.name)}/issues`;


    const homepage = (pkg.homepage && !pkg.homepage.match(/^https:\/\/github\.com\/[^/]+\/[^/]+$/))?
        pkg.homepage:
        `https://github.com/${_toCannonical(pkg.config.scope)}/${_toCannonical(pkg.name)}`;

    return {
        ...pkg,
        repository: repo,
        homepage: homepage,
        bugs: bugs
    };
}

/**
 * @private
 */
const _toCannonical = (name) => {
    if(typeof(name) !== 'string') {
        return null;
    }

    return name.toLowerCase()
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .replace(/[^a-z0-9]+/g, '-')
}

/**
 * Sets the name of the package and also updates that name in the
 * template/example Unity package under test.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {string} opts.package_name
 *      new name for the package, if not set defaults to existing package name
 *
 * @param {string} opts.package_scope new config.scope for package
 *
 * @returns {string} the package root path
 */
const setPackageName = async (pkgRoot, opts) => {

    opts = opts || {};

    if (opts.verbose) {
        console.log(`unity-npm-utils::unityPackage.setPackageName package_root=${pkgRoot}`)
    }

    const pkgJsonPath = path.join(pkgRoot, 'package.json');
    const testPkgJsonPath = path.join(pkgRoot, 'test', 'package.json');

    var newPkgName = null;

    const p = await transformPackage({
        package_path: pkgRoot,
        transform: (p, cb) => {

            p.name = newPkgName = _toCannonical(opts.package_name) || p.name;

            if(opts.package_scope) {
                p.config = { ...(p.config || {}), scope: _toCannonical(opts.package_scope) }
            }

            p = _updateUrls(p);

            return cb(null, p);
        }
    });

    await Promise.all([
        _setSrcPackageName(pkgRoot, newPkgName),
        _setSubProject2PkgDependency(pkgRoot, 'test'),
        _setSubProject2PkgDependency(pkgRoot, 'sampledev')
    ]);

    return pkgRoot;
}

module.exports = setPackageName;
