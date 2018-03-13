const expect = require('chai').expect
const path = require('path')
const fs = require('fs-extra-promise')
const tmp = require('tmp-promise')
const spawn = require('child_process').spawn
const mlog = require('mocha-logger')
const mcoloring = require('mocha').reporters.Base.color
const dateFormat = require('dateformat')

const appRoot = require('app-root-path').path

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
 */
const runPkgCmdAsync = async (cmd, pkgPath) => {

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

    return promise;
}

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
 * Create a temp directory to install a package (presumably for testing)
 *
 * @param opts.verbose - log stuff to console
 * @returns {string} path of newly created temp directory
 */
const createTmpPackageDir = async (opts) => {
  opts = opts || {};

  const d = await tmp.dir()
  const p = path.join(d.path, opts.package_name || 'unpm-testpackage')

  await fs.ensureDirAsync(p)

  if(opts.verbose) {
    console.log('created tmp package dir at %j', p)
  }

  return p;
}

const ensureTestPackage = async (pkgPath) => {
  if(!pkgPath || typeof(pkgPath) !== 'string') {
    pkgPath = await createTmpPackageDir()
  }

  if(!await fs.existsAsync(path.join(pkgPath, 'package.json'))) {
    await runPkgCmdAsync('npm init --force', pkgPath)
  }

  return pkgPath
}
/**
 * Install this (presumably unreleased) version of unity-npm-utils
 * to some package path
 *
 * @param {string} pkgPath - will install unity-npm-utils here.
 */
const installLocalUnpmToPackage = async (pkgPath, opts) => {
  pkgPath = await ensureTestPackage(pkgPath)
  const unpmRoot = appRoot;

  const unpmPkg = await readPackageAsync(unpmRoot)

  await runPkgCmdAsync('npm pack', unpmRoot)

  const unpmTarName = `${unpmPkg.name}-${unpmPkg.version}.tgz`;
  const unpmSourcePath = path.join(unpmRoot, unpmTarName)
  const unpmTargetDir = path.join(pkgPath, 'localpackage')

  await fs.ensureDirAsync(unpmTargetDir)

  const unpmTargetPath = path.join(unpmTargetDir, unpmTarName)

  await fs.renameAsync(unpmSourcePath, unpmTargetPath)

  // TODO: this is still not right with respect to install:test script in package. Need to change that script to bundle unity-unpm-utils instead of pack?
  await runPkgCmdAsync(`npm install file:${path.join('localpackage', unpmTarName)}`, pkgPath)

  await unpm.transformPackage({
      package_path: pkgPath,
      transformAsync: async (p) => {
          return { ...p, bundledDependencies: ['unity-npm-utils'] }
      }
  })

  return pkgPath
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

    if(opts.verbose) {
      mlog.pending(`will call unpm.unityPackage.installTemplate on install path '${installPath}' with opts ${JSON.stringify(opts)}...`);
    }

    await unpm.unityPackage.installTemplate(installPath, {...opts })

    if(opts.verbose) {
      mlog.pending(`unpm.unityPackage.installTemplate completed on install path '${installPath}'...`);
    }

    const installCmd =
        opts.run_npm_install_no_scripts? 'npm install --no-scripts':
        opts.run_npm_install? 'npm install' : undefined;

    if(!installCmd) { return installPath }

    await runPkgCmd(installCmd, installPath)

    return installPath

}

/**
 * Many tests require a (tmp/test) unity project
 * that has unity-npm-utils installed (the local version we're testing)
 * as well as maybe some other package[s]
 *
 * @param {array} opts.install_packages array of packages to install
 */
// const createTmpUnityProjectWithPackagesInstalled = async(opts) => {
//
// }

const readPackageSync = (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json')));
}

const readPackageAsync = async (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(await fs.readFileAsync(path.join(pkgPath, 'package.json')));
}

exports.createTmpPackageDir = createTmpPackageDir
exports.runPkgCmd = runPkgCmd
exports.runPkgCmdAsync = runPkgCmdAsync
exports.runBinCmd = runBinCmd
exports.ensureTestPackage = ensureTestPackage
exports.installUnityPackageTemplateToTemp = installUnityPackageTemplateToTemp
exports.installLocalUnpmToPackage = installLocalUnpmToPackage
exports.readPackageSync = readPackageSync
exports.readPackageAsync = readPackageAsync
