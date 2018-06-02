const mkdirp = require('mkdirp')
const path = require('path')
const fs = require('fs-extra')
const request = require('request')
const tmp = require('tmp');
const decompress = require('decompress')
const download = require('download-git-repo')


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

        tmp.dir((tmpDirErr, tmpDirPath, tmpDirCleanup) => {
            if (tmpDirErr) {
                console.error('failed to create tmp dir: %j', tmpDirErr);
                return reject(tmpDirErr);
            }

            const installPath = path.join(tmpDirPath, 'unity-npm-package-template-master')

            download('beatthat/unity-npm-package-template', installPath, (err) => {

              return resolve(installPath)
            })

        })

    })

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise
}


module.exports = _installTemplateToTmp
