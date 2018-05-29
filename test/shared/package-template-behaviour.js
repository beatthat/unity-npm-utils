const expect = require('chai').expect
const path = require('path')
const fs = require('fs')
const tmp = require('tmp')

const h = require('../test-helpers.js')
const unpm = require('../../lib/unity-npm-utils')

/**
 * @private
 *
 * Remove existing scripts from installed package
 * so we can see that template-update will add them back
 *
 * we need to leave the 'template:update' script though,
 * because we may be running that for the test
 */
const removeNonTemplateScripts = (pkgPath) => {

    return unpm.transformPackage({
        package_path: pkgPath,
        transform: (p, cb) => {
            p.scripts = Object.getOwnPropertyNames(p.scripts).reduce((acc, cur) => {
                // would remove all scripts for the test but need the template-update

                return cur.match(/template/) ? { ...acc,
                    [cur]: p.scripts[cur]
                } : acc
            }, {})
            cb(null, p)
        }
    })
}

/**
 * See updateTemplateBehaviour below
 *
 * @callback updateTemplate
 * @param {string} opts.package_path
 *      abs path to the (tmp dir) where package should install for the test
 */

const requireConfig = (test, opt) => {
    const val = test.test_config ? test.test_config[opt] : null
    if (!val) {
        throw new Error(`missing required test config property: test_config.${opt}`)
    }
    return val
}

const optionalConfig = (test, opt) => {
    return test.test_config ? test.test_config[opt] : undefined
}

/**
 * Expected behaviours for updating the package template *after* package exists
 *
 * This operation can be performed multiple ways, e.g. from cli or from a module call,
 * so better to have the expected behaviour defined in a sharable test function.
 *
 * NOTE: requires that calling test set
 *
 * @param {updateTemplate} opts.update_template_function
 *      callback to execute the update-template op however the tester defines it.
 *
 * @param {string} this.test_config.package_path
 *      NOT A PARAM, but required that calling test set <code>this.test_config.package_path</code>
 *      to the root of the test package.
 *
 */
const updateTemplateBehaviour = (opts) => {

    opts = opts || {}

    const updateTemplate = opts.update_template_function
    var pkgPath = null
    var pkgBefore = null
    var pkgName = null

    var templatePath = null
    var templateDist = null
    var templateScriptNames = null
    var templateDependencyNames = null

    const srcFiles = opts.package_src_files || []

    before(async function() {
        this.timeout(30000)

        templatePath = await h.installUnityPackageTemplateToTemp()

        const p = await unpm.readPackage(templatePath)
        templateDist = p
        templateScriptNames = Object.getOwnPropertyNames(p.scripts || {})
        templateDependencyNames = Object.getOwnPropertyNames(p.dependencies || {})
    })

    beforeEach(async function() {
        this.timeout(30000)

        const verbose = optionalConfig(this, 'verbose')

        if(verbose) { console.log(`will check required config 'package_path'...`) }

        if (!(pkgPath = requireConfig(this, 'package_path'))) {
            return
        }


        if(verbose) { console.log(`will retrieve package json from path ${pkgPath}...`) }

        const p = await unpm.readPackage(pkgPath)
        pkgBefore = p
        pkgName = pkgBefore.name
    })

    it.only("adds all template scripts to main package scripts", async function() {
        this.timeout(30000)

        const verbose = optionalConfig(this, 'verbose')

        // wipe out existing scripts in installed package
        // so we can see that template-update will add them back
        await removeNonTemplateScripts(pkgPath)

        const pkgScriptsRemoved = h.readPackageSync(pkgPath)

        expect(Object.getOwnPropertyNames(pkgScriptsRemoved.scripts).length,
            'given some scripts have been removed from the package'
        ).to.not.equal(pkgBefore.scripts.length)

                // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
        await updateTemplate({
            package_path: pkgPath,
            verbose: verbose
        })

        const testPkgJsonPath = path.join(pkgPath, 'test', 'package.json')
        expect(fs.existsSync(testPkgJsonPath),
            `after update, test package.json file exists at ${testPkgJsonPath}`
        ).to.equal(true)

        const pkgAfter = h.readPackageSync(pkgPath)
        templateScriptNames.forEach(n => {
            expect(pkgAfter.scripts[n],
                `target package should have script from template '${n}' : '${templateDist.scripts[n]}'`
            ).to.equal(templateDist.scripts[n])
        })
    })

    it('preserves the name and scope of the pre-update package', async function() {
        this.timeout(30000)

        const nameToKeep = "some-weird-name"

        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.name = nameToKeep
                cb(null, p)
            }
        })

        await updateTemplate({
            package_path: pkgPath
        })

        const pkgAfter = h.readPackageSync(pkgPath)

        expect(pkgAfter.name,
            'should preserve name of the pre-update package'
        ).to.equal(nameToKeep)
    })

    it("combines scripts from template and pre-update package, preferring the template version", async function() {
        this.timeout(30000)

        const pkgNoScripts = h.readPackageSync(pkgPath)
        var oldScripts = {
            old_1: 'val 1',
            old_2: 'val 2'
        }

        await removeNonTemplateScripts(pkgPath)
        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.scripts = {
                    ...p.scripts,
                    ...oldScripts,
                    [templateScriptNames[0]]: 'this val should be overwritten with template val for script'
                }
                cb(null, p)
            }
        })

        await updateTemplate({
            package_path: pkgPath
        })

        const pkgAfter = h.readPackageSync(pkgPath)
        templateScriptNames.forEach(n => {
            expect(pkgAfter.scripts[n],
                `scripts.${n} should have template value`
            ).to.equal(templateDist.scripts[n])
        })

        Object.getOwnPropertyNames(oldScripts).forEach(n => {
            expect(pkgAfter.scripts[n],
                `scripts.${n} should have pre-update value`
            ).to.equal(oldScripts[n])
        })
    })

    it("combines dependencies from template and pre-update package, preferring the template version", async function() {
        this.timeout(30000)

        const pkgNoDeps = h.readPackageSync(pkgPath)
        var oldDeps = {
            dep_1: 'val 1',
            dep_2: 'val 2'
        }

        // rename all scripts
        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.dependencies = {
                    ...oldDeps,
                    ...(templateDependencyNames && templateDependencyNames.length > 0) ? {
                        [templateDependencyNames[0]]: 'this dependency should be overwritten with template version'
                    } : {}

                }
                cb(null, p)
            }
        })

        await updateTemplate({
            package_path: pkgPath
        })

        const pkgAfter = h.readPackageSync(pkgPath)
        templateDependencyNames.forEach(n => {
            expect(pkgAfter.dependencies[n],
                `dependencies.${n} should have template value`
            ).to.equal(templateDist.dependencies[n])
        })

        Object.getOwnPropertyNames(oldDeps).forEach(n => {
            expect(pkgAfter.dependencies[n],
                `dependencies.${n} should have pre-update value`
            ).to.equal(oldDeps[n])
        })
    })

    it("preserves source files from pre-update package", async function() {
        this.timeout(30000)

        const pkgNoDeps = h.readPackageSync(pkgPath)

        // h.runBinCmd(`unpm update-package-template -p ${pkgPath}`)
        await updateTemplate({
            package_path: pkgPath
        })

        const pkgAfter = h.readPackageSync(pkgPath)

        const srcRoot = path.join(pkgPath, 'Runtime', pkgBefore.name)
        expect(fs.existsSync(srcRoot)).to.equal(true)

        srcFiles.forEach(f => {
            const fpath = path.join(srcRoot, f.name)
            expect(fs.existsSync(fpath)).to.equal(true)
            expect(fs.readFileSync(fpath, 'utf8')).to.equal(f.content)
        })
    })

    it("ensures 'npm run install:test' creates an example Unity project with the package installed", async function() {
        this.timeout(300000)

        const testPkgJsonPath = path.join(pkgPath, 'test', 'package.json')

        await updateTemplate({
            package_path: pkgPath
        })

        expect(fs.existsSync(testPkgJsonPath),
            `after update, test package.json file exists at ${testPkgJsonPath}`
        ).to.equal(true)

        await h.runPkgCmd('npm run install:test', pkgPath)

        const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName)

        srcFiles.forEach(f => {
            const fpath = path.join(unityPkgPath, f.name)
            expect(fs.existsSync(fpath), `src file installed at ${fpath}`).to.equal(true)
            expect(fs.readFileSync(fpath, 'utf8'), `src file contents at ${fpath}=${f.content}`).to.equal(f.content)
        })
    })

}

module.exports = updateTemplateBehaviour
