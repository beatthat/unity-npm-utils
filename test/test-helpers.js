const expect = require('chai').expect
const path = require('path')
const fs = require('fs-extra')
const tmp = require('tmp-promise')
const spawn = require('child_process').spawn
const mlog = require('mocha-logger')
const mcoloring = require('mocha').reporters.Base.color
const dateFormat = require('dateformat')

const appRoot = require('app-root-path').path

const unpm = require('../lib/unity-npm-utils')

tmp.setGracefulCleanup()

/**
 * @private
 */
const _cmdToLogFileName = (cmd) => {
    return dateFormat(new Date(), 'yyyymmdd-hhMMss') + '-'
    + cmd.split(' ').reduce((acc, cur, i) => {
        return i < 3 && String(cur).match(/^[a-zA-Z0-9]+.*/)?
            (acc? acc+'_': '') + cur.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20): acc
    }) + '.log'
}

mlog.styles.pending.prefix = mcoloring('pending', '        ...')
mlog.styles.log.prefix = mcoloring('light', '        -')

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
        })

        const log = path.join(pkgPath, _cmdToLogFileName(cmd))

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        })

        mlog.pending(`running '${cmd}'...`)
        mlog.pending(`view logs at ${log}`)
        mlog.pending('this may take a while...')

        cmdProc.stdout.pipe(logStream)
        cmdProc.stderr.pipe(logStream)

        cmdProc.on('exit', (code, signal) => {
            if (code !== 0 || signal) {
                return reject(new Error(`${cmd} failed with code ${code} and signal ${signal}`))
            }
            return resolve(null)
        })
    })

    return promise
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
    console.log(`runPkgCmd cmd=${cmd} pkgPath=${pkgPath}...`)
    const promise = new Promise((resolve, reject) => {
        const cmdProc = spawn(cmd, {
            shell: true,
            cwd: pkgPath
        })

        const log = path.join(pkgPath, _cmdToLogFileName(cmd))

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        })

        mlog.pending(`running '${cmd}'...`)
        mlog.pending(`view logs at ${log}`)
        mlog.pending('this may take a while...')

        cmdProc.stdout.pipe(logStream)
        cmdProc.stderr.pipe(logStream)

        cmdProc.on('exit', (code, signal) => {
            if (code !== 0 || signal) {
                return reject(new Error(`${cmd} failed with code ${code} and signal ${signal}`))
            }
            return resolve()
        })
    })

    if (!callback) { return promise }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe))
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

        const pkgPath = path.join(__dirname, '..')

        const cmdParts = cmd.split(' ')

        const cmdFull = `node ${path.join(pkgPath, 'bin', cmdParts[0])} ${[...cmdParts.slice(1)].join(' ')}`

        const cmdProc = spawn(`${cmdFull}`, {
            shell: true
        })

        const log = path.join(pkgPath, _cmdToLogFileName(cmd))

        logStream = fs.createWriteStream(log, {
            flags: 'a'
        })

        mlog.pending(`running 'node ${cmd}'...`)
        mlog.pending(`logging to ${log}`)

        cmdProc.stdout.pipe(logStream)
        cmdProc.stderr.pipe(logStream)

        cmdProc.on('exit', (code, signal) => {
            if (code !== 0 || signal) {
                return reject(new Error(`${cmd} failed with code ${code} and signal ${signal}`))
            }

            return resolve()
        })
    })

    if (!callback) { return promise }
    promise.then(pr => callback(null, pr)).catch(pe => callback(pe))
}

/**
 * Create a temp directory to install a package (presumably for testing)
 *
 * @param opts.verbose - log stuff to console
 * @returns {string} path of newly created temp directory
 */
const createTmpPackageDir = async (opts) => {
  opts = opts || {}

  const d = await tmp.dir()
  const p = path.join(d.path, opts.package_name || 'unpm-testpackage')

  await fs.ensureDir(p)

  if(opts.verbose) {
    console.log('created tmp package dir at %j', p)
  }

  return p
}

const ensureTestPackage = async (pkgPath) => {
  if(!pkgPath || typeof(pkgPath) !== 'string') {
    pkgPath = await createTmpPackageDir()
  }

  if(!await fs.exists(path.join(pkgPath, 'package.json'))) {
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
  const unpmRoot = appRoot

  const unpmPkg = await readPackageAsync(unpmRoot)

  await runPkgCmdAsync('npm pack', unpmRoot)

  const unpmTarName = `${unpmPkg.name.replace('@', '').replace('/', '-')}-${unpmPkg.version}.tgz`
  const unpmSourcePath = path.join(unpmRoot, unpmTarName)
  const unpmTargetDir = path.join(pkgPath, 'localpackage')

  await fs.ensureDir(unpmTargetDir)

  const unpmTargetPath = path.join(unpmTargetDir, unpmTarName)

  await fs.rename(unpmSourcePath, unpmTargetPath)

  // TODO: this is still not right with respect to test-install script in package. Need to change that script to bundle unity-unpm-utils instead of pack?
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

    opts = opts || {}

    const d = await tmp.dir()
    const installPath = path.join(d.path, opts.package_name || 'unpm-testpackage')

    if(opts.verbose) {
      mlog.pending(`will call unpm.unityPackage.installTemplate on install path '${installPath}' with opts ${JSON.stringify(opts)}...`)
    }

    await unpm.unityPackage.installTemplate(installPath, {...opts })

    if(opts.verbose) {
      mlog.pending(`unpm.unityPackage.installTemplate completed on install path '${installPath}'...`)
    }

    const installCmd =
        opts.run_npm_install_no_scripts? 'npm install --no-scripts':
        opts.run_npm_install? 'npm install' : undefined

    if(!installCmd) { return installPath }

    await runPkgCmd(installCmd, installPath)

    return installPath

}


/**
 * @typedef {Object} NpmInstallPackageWithIgnoreScripts_Return
 * @property {string} test_project_path path to the root of (the unity project) where the package was installed
 * @property {string} test_package_name name of the package that was installed
 * @property {object} test_package_scope scope of the package installed (e.g. a github account name)
 * @property {object} test_package_full_name full string used to install the package, which is a combination of scope and package name, e.g. 'beatthat/placements'
 * @property {string} test_package_expected_unity_install_path absolute path to where the package was installed (in the target unity project)
 * @property {string} test_package_expected_unity_samples_path absolute path to where the package's 'Samples' were installed (in the target unity project)
 */

/**
 * Install a package (to a unity-project root) with the ignore-scripts flag, e.g.
 *
 * <code>npm install --ignore-scripts $pkgScope/$pkgName</code>
 *
 * ...and returns a all the relevant path info.
 *
 * This is useful to test any scripts that run post install.
 *
 * @param {string} pkgName - the name of the package to install
 * @param {string} pkgScope - the scope of the package to install (e.g. a github account name)
 *
 * @returns {NpmInstallPackageWithIgnoreScripts_Return} - an object containing path info about the install
 */
const npmInstallPackageWithIgnoreScripts = async function(pkgName, pkgScope)
{
    const unpmPkg = await unpm.readPackage(appRoot)

    expect(unpmPkg.name).to.equal('@beatthat/unity-npm-utils')

    //////////////////////////////////////////////////////////////////////
    // first let's create a test package with unity-npm-utils installed...
    //////////////////////////////////////////////////////////////////////

    const testProjPath = await installLocalUnpmToPackage()

    expect(
      fs.existsSync(path.join(testProjPath, 'package.json')),
      'test project should be installed at root ' + testProjPath
    ).to.equal(true)

    var testProj = await unpm.readPackage(testProjPath)

    expect(
      testProj.dependencies['@beatthat/unity-npm-utils']
    ).to.exist

    ////////////////////////////////////////////////////////////////////
    // Now let's install a random unity package ('beatthat/properties' for this example)
    // This is the package we will test against further down
    ////////////////////////////////////////////////////////////////////

    const testPkgFullName = `${pkgScope}/${pkgName}`

    await runPkgCmdAsync('npm install --save --ignore-scripts ' + testPkgFullName, testProjPath)

    testProj = await unpm.readPackage(testProjPath)

    const testPkgInstallPath = path.join(testProjPath, 'Assets', 'Plugins', 'packages', pkgScope, pkgName)

    expect(
      await fs.exists(testPkgInstallPath),
      "(having installed package with ignore-scripts) the package should NOT yet be installed to unity"
    ).to.equal(false)

    const testPkgSamplesPath = path.join(testProjPath, 'Assets', 'Samples', 'packages', pkgScope, pkgName)

    expect(
      await fs.exists(testPkgSamplesPath),
      "(having installed package with ignore-scripts) the package's Samples should NOT yet be installed to unity"
    ).to.equal(false)

    return {
        test_project_path: testProjPath,
        test_package_name: pkgName,
        test_package_scope: pkgScope,
        test_package_full_name: testPkgFullName,
        test_package_expected_unity_install_path: testPkgInstallPath,
        test_package_expected_unity_samples_path: testPkgSamplesPath
    }
}


const readPackageSync = (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json')))
}

const readPackageAsync = async (pkgPath) => {
    // don't use require because it will cache and we're here editting package.json
    return JSON.parse(await fs.readFile(path.join(pkgPath, 'package.json')))
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
exports.npmInstallPackageWithIgnoreScripts = npmInstallPackageWithIgnoreScripts
