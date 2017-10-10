const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp-promise');
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

        mlog.pending(`running 'node ${cmd}'...`);
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
 *
 * @param opts.package_name - if passed will set the package name
 * @param opts.package_scope - if passed will set the package config.scope
 * @param opts.run_npm_install - if TRUE, will run <code>npm install</code> on the package before callback
 * @param opts.run_npm_install_no_scripts - if TRUE, will run <code>npm install --no-scripts</code> on the package before callback
 *
 */
const installUnityPackageTemplateToTemp = async (opts) => {

    opts = opts || {};

    const d = await tmp.dir()
    const installPath = path.join(d.path, opts.package_name || 'unpm-testpackage')

    await unpm.unityPackage.installTemplate(installPath, {})

    if (!opts.package_name) {
        return installPath;
    }

    await unpm.unityPackage.setPackageName(installPath, {
        package_name: opts.package_name,
        package_scope: opts.package_scope,
        verbose: false
    })

    const installCmd =
        opts.run_npm_install_no_scripts? 'npm install --no-scripts':
        opts.run_npm_install? 'npm install' : undefined;

    if(!installCmd) { return installPath }

    await runPkgCmd(installCmd, installPath)

}

const readPackageSync = (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json')));
}

exports.runPkgCmd = runPkgCmd;
exports.runBinCmd = runBinCmd;
exports.installUnityPackageTemplateToTemp = installUnityPackageTemplateToTemp;
exports.readPackageSync = readPackageSync;
