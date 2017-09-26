const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');
const mcoloring = require('mocha').reporters.Base.color;
const dateFormat = require('dateformat');

const unpm = require('../lib/unity-npm-utils');

tmp.setGracefulCleanup();

/**
 * @private
 */
const _cmdToLogFileName = (cmd) => {
    return dateFormat(new Date(), 'yyyymmdd-hhMMss') + '-'
    + cmd.split(' ').reduce((acc, cur, i) => {
        return i < 3 && String(cur).match(/^[a-zA-Z0-9]+.*/)?
            (acc? acc+'_': '') + cur.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20): acc;
    }) + '.log';
}

mlog.styles.pending.prefix = mcoloring('pending', '        ...');
mlog.styles.log.prefix = mcoloring('light', '        -');

/**
 * Run a package shell command (with cwd set to the package room),
 * e.g, <code>cd $pkgPath && npm run foo</code>
 *
 * @param {string} cmd the shell command to run
 * @param {string} pkgPath the cwd path the command will be run from
 * @param {function(err)} callback
 */
const runPkgCmd = (cmd, pkgPath, callback) => {

    const promise = new Promise((resolve, reject) => {
        const cmdProc = spawn(cmd, {
            shell: true,
            cwd: pkgPath
        });

        const log = path.join(pkgPath, _cmdToLogFileName(cmd));

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        });

        mlog.pending(`running '${cmd}'...`);
        mlog.pending(`view logs at ${log}`);
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
 * Run a unity-npm-utils/bin shell command
 * with cwd set to ${unity-npm-utils_CLONE}/bin
 * to emulate as if we had done a global install, <code>npm i -g unity-npm-utils</code>
 * e.g, <code>unpm</code>
 *
 * @param {string} cmd the shell command to run
 * @param {function(err)} callback
 */
const runBinCmd = (cmd, callback) => {

    const promise = new Promise((resolve, reject) => {

        const pkgPath = path.join(__dirname, '..');

        const cmdParts = cmd.split(' ');

        const cmdFull = `node ${path.join(pkgPath, 'bin', cmdParts[0])} ${[...cmdParts.slice(1)].join(' ')}`;

        const cmdProc = spawn(`${cmdFull}`, {
            shell: true
        });

        const log = path.join(pkgPath, _cmdToLogFileName(cmd));

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        });

        mlog.pending(`running '${cmdFull}'...`);
        mlog.pending(`logging to ${log}`);

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
exports.runBinCmd = runBinCmd;
exports.installUnityPackageTemplateToTemp = installUnityPackageTemplateToTemp;
exports.readPackageSync = readPackageSync;
