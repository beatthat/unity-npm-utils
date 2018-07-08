const expect = require('chai').expect
const fs = require('fs-extra')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

const VERBOSE = true

describe.only("unityPackage.installTemplate - installs a the unity-package template to an empty directory", () => {
    var pkgPath = null

    before(async function() {
        this.timeout(10000)

        pkgPath = await h.installUnityPackageTemplateToTemp()

        if(VERBOSE) {
            console.log(`installing at ${pkgPath}`)
        }
    })

    it("installs template files", async () => {
        const packageJsonPath = path.join(pkgPath, 'package.json')

        expect(await fs.exists(packageJsonPath),
            `package.json should exist in install path ${pkgPath}`).to.equal(true)
    })

    it("sets initial version to 1.0.0", () => {
        const pkg = h.readPackageSync(pkgPath)
        expect(pkg.version).to.equal('1.0.0')
    })

    it("sets package name to install dir name by default", () => {
        const pkg = h.readPackageSync(pkgPath)
        expect(pkg.name).to.equal(path.basename(pkgPath))

    })

    it("updates test package.json to depend on freshly built copy of the package", async () => {

        const pkg = h.readPackageSync(pkgPath)

        const pkgTarFileName = `${pkg.name}-latest.tgz`

        const testPkgPath = path.join(pkgPath, 'test', 'package.json')

        expect(await fs.exists(testPkgPath),
            `test package should exists at ${testPkgPath}`
        ).to.equal(true)

        const testPkg = h.readPackageSync(path.join(pkgPath, 'test'))


        expect((testPkg.dependencies !== null && testPkg.dependencies[pkg.name] === `../${pkgTarFileName}`),
            `test package should have dependency for ${pkg.name}`
        ).to.equal(true)

    })

    it("updates sampledev package.json to depend on freshly built copy of the package", async () => {

        const pkg = h.readPackageSync(pkgPath)

        const pkgTarFileName = `${pkg.name}-latest.tgz`

        const sampledevPkgPath = path.join(pkgPath, 'sampledev', 'package.json')

        expect(await fs.exists(sampledevPkgPath),
            `sampledev package should exists at ${sampledevPkgPath}`
        ).to.equal(true)

        const sampledevPkg = h.readPackageSync(path.join(pkgPath, 'sampledev'))

        expect((sampledevPkg.dependencies !== null && sampledevPkg.dependencies[pkg.name] === `../${pkgTarFileName}`),
            `sampledev package should have dependency for ${pkg.name} pointed to newly build tar`
        ).to.equal(true)

    })

})
