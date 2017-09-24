const fs = require('fs-extra-promise');
const path = require('path');

/**
 * Read the package.json for a package
 *
 * @param {string} pkgRoot abs path to the package root.
 *
 * @param {function(err, package)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const readPackage = (pkgRoot, callback) => {
    const promise = new Promise((resolve, reject) => {
        const jsonPath = path.join(pkgRoot, 'package.json');
        fs.readFile(jsonPath, (err, content) => {
            if (err) {
                return reject(err);
            }
            try {
                return resolve(JSON.parse(content));
            } catch (pErr) {
                return reject(pErr);
            }
        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = readPackage;
