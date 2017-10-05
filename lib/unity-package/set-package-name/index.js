const fs = require('fs-extra-promise');
const mkdirp = require('mkdirp');
const path = require('path');

const transformPackage = require('../../core/transform-package.js');
const _setSrcPackageName = require('./_set-src-package-name.js');
const _setTestProject2PkgDependency = require('./_set-test-project-2-pkg-dependency.js');

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
        .replace(/^[^a-z1-9]+/, '')
        .replace(/[^a-z1-9]+$/, '')
        .replace(/[^a-z1-9]+/g, '-')
}

/**
 * Sets the name of the package and also updates that name in the
 * template/example Unity package under test.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {string} options.package_name
 *      new name for the package, if not set defaults to existing package name
 *
 * @param {string} options.package_scope
 *      new config.scope for package
 *
 * @param {function(err, packages)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const setPackageName = (pkgRoot, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    if (options.verbose) {
        console.log(`unity-npm-utils::unityPackage.setPackageName package_root=${pkgRoot}`)
    }

    const promise = new Promise((resolve, reject) => {

        const pkgJsonPath = path.join(pkgRoot, 'package.json');
        const testPkgJsonPath = path.join(pkgRoot, 'test', 'package.json');

        var newPkgName = null;

        transformPackage({
            package_path: pkgRoot,
            transform: (p, cb) => {

                p.name = newPkgName = _toCannonical(options.package_name) || p.name;

                if(options.package_scope) {
                    p.config = { ...(p.config || {}), scope: _toCannonical(options.package_scope) }
                }

                p = _updateUrls(p);

                return cb(null, p);
            }
        })
        .then(p => {
            return Promise.all([
                _setSrcPackageName(pkgRoot, newPkgName),
                _setTestProject2PkgDependency(pkgRoot)
            ])
        })
        .then(allDone => resolve(pkgRoot))
        .catch(e => reject(e));
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = setPackageName;
