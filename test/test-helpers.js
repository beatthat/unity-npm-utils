const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');

const unpm = require('../lib/unity-npm-utils');

tmp.setGracefulCleanup();

const runPkgCmd = (cmd, pkgPath, callback) => {

    const promise = new Promise((resolve, reject) => {
        const cmdProc = spawn(cmd, {
            shell: true,
            cwd: pkgPath
        });

        const log = path.join(pkgPath, 'npm-cmd.log');

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        });

        mlog.log(`running '${cmd}'...`);
        mlog.log(`view logs at ${log}`);
        mlog.pending('this may take a while...');

        cmdProc.stdout.pipe(logStream);
        cmdProc.stderr.pipe(logStream);

        cmdProc.on('exit', (code, signal) => {
            if (code !== 0 || signal) {
                return reject(new Error(`${cmd} failed with code ${code} and signal ${signal}`));
            }
            return resolve();
        });
    });

    if (!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));
}

/**
 * @param options.package_name - if passed will set the package name
 * @param {function(err, installPath)} callback
 * @private
 */
const installUnityPackageTemplateToTemp = (options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    const promise = new Promise((resolve, reject) => {
        tmp.dir((tmpDirErr, tmpDir) => {
            const installPath = path.join(tmpDir, 'unpm-testpackage');

            unpm.unityPackage.installTemplate(installPath, {}, (err) => {

                if (err) {
                    return reject(new Error(err));
                }

                if (!options.package_name) {
                    return resolve(installPath);
                }

                unpm.unityPackage.setPackageName(installPath, {
                        package_name: options.package_name,
                        verbose: false
                    },
                    (setNameErr) => {
                        if (setNameErr) {
                            return reject(setNameErr);
                        }
                        return resolve(installPath);
                    });
            });
        });
    });

    if (!callback) { return promise; }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe));

}

const readPackageSync = (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json')));
}

exports.runPkgCmd = runPkgCmd;
exports.installUnityPackageTemplateToTemp = installUnityPackageTemplateToTemp;
exports.readPackageSync = readPackageSync;
