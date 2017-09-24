const mkdirp = require('mkdirp');
const path = require('path');
const ncp = require('ncp');
const fs = require('fs-extra-promise');
const request = require('request');
const tmp = require('tmp');
const unzip = require('unzip');

/**
 * @private
 *
 * Install template files for a Unity package to a tmp dir
 *
 * @param {Object} options
 * @param {function(err)} callback
 *
 * @returns if no callback function passed, returns a Promise
 */
const _installTemplateToTmp = (callback) => {

    const promise = new Promise((resolve, reject) => {


        tmp.dir((tmpDirErr, tmpDirPath, tmpDirCleanup) => {
            if (tmpDirErr) {
                console.error('failed to create tmp dir: %j', tmpDirErr);
                return reject(tmpDirErr);
            }

            const templateReq = request.get('https://github.com/beatthat/unity-npm-package-template/archive/master.zip');

            templateReq.on('error', (templateErr) => {
                console.log('ERROR: %j', templateErr);
                return reject(`Failed to load template: ${templateErr}`);
            });

            const tmpArchive = path.join(tmpDirPath, 'template_archive.zip');
            templateReq.pipe(fs.createWriteStream(tmpArchive));

            templateReq.on('response', (res) => {

                if (Number(res['statusCode']) != 200) {
                    return reject(`Error loading template archive: ${JSON.stringify(res)}`);
                }

                templateReq.on('end', () => {

                    fs.createReadStream(tmpArchive)
                        .pipe(unzip.Extract({
                            path: tmpDirPath
                        }))
                        .on('close', () => {
                            return resolve(path.join(tmpDirPath, 'unity-npm-package-template-master'));
                        });
                });
            });
        });

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


module.exports = _installTemplateToTmp;
