const fs = require('fs-extra-promise');
const path = require('path');
const readPackage = require('../core/read-package.js');

/**
 * Add files under the src directory for a unity package.
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {[Object]} files array of file-info objects, e.g.
 * <code>{ name: 'Foo.cs', content: 'public class Foo {}' }
 *
 * @param {function(err)} callback
 *      Packages here is an array with an object for each package affected,
 *      <code>[{path: '/some/package.json', package: { name: 'package_name', ... } }]</code>
 *
 * @returns if no callback function passed, returns a Promise
 */
const addSrcFiles = (pkgRoot, files, callback) => {
    const promise = new Promise((resolve, reject) => {
        var srcPath = null;

        readPackage(pkgRoot)
        .then(pkg => {
            srcPath = path.join(pkgRoot, 'src', pkg.name);
            return fs.ensureDirAsync(srcPath);
        })
        .then(() => Promise.all(files.map(f => fs.writeFileAsync(path.join(srcPath, f.name), f.content))))
        .then(files => resolve(files))
        .catch(e => reject(e));
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = addSrcFiles;
