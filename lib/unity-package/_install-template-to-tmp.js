const mkdirp = require('mkdirp');
const path = require('path');
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
const _installTemplateToTmp = (opts, callback) => {

    if(typeof(opts) === 'function') {
      callback = opts
      opts = {}
    }

    const promise = new Promise((resolve, reject) => {

        if(opts.verbose) {
          console.log('install-template-to-tmp will create tmp dir')
        }

        tmp.dir((tmpDirErr, tmpDirPath, tmpDirCleanup) => {
            if (tmpDirErr) {
                console.error('failed to create tmp dir: %j', tmpDirErr);
                return reject(tmpDirErr);
            }

            if(opts.verbose) {
              console.log('install-template-to-tmp DID create tmp dir')
            }

            const templateReq = request.get('https://github.com/beatthat/unity-npm-package-template/archive/master.zip');

            templateReq.on('error', (templateErr) => {
                console.error('ERROR: %j', templateErr);
                return reject(`Failed to load template: ${templateErr}`);
            });

            const tmpArchive = path.join(tmpDirPath, 'template_archive.zip');
            templateReq.pipe(fs.createWriteStream(tmpArchive));

            templateReq.on('response', (res) => {

                if (Number(res['statusCode']) != 200) {

                    console.error(`install-template-to-tmp: RESPONSE NOT OK: ${JSON.stringify(res, null, 2)}`);
                    return reject(`Error loading template archive: ${JSON.stringify(res)}`);
                }

                if(opts.verbose) {
                  console.log('install-template-to-tmp recvd OK response')
                }

                templateReq.on('end', () => {

                  if(opts.verbose) {
                    console.log('install-template-to-tmp recvd END event')
                  }

                    fs.createReadStream(tmpArchive)
                        .pipe(unzip.Extract({
                            path: tmpDirPath
                        }))
                        .on('error', (unzip2TmpErr) => {
                          if(opts.verbose) {
                            console.error(`install-template-to-tmp recvd ERROR on pipe unzipped to tmp ${JSON.stringify(unzip2TmpErr)}`)
                          }
                        })
                        .on('close', () => {
                          if(opts.verbose) {
                            console.log('install-template-to-tmp recvd CLOSE event')
                          }

                            return resolve(path.join(tmpDirPath, 'unity-npm-package-template-master'));
                        })
                });
            });
        });

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}


module.exports = _installTemplateToTmp;
