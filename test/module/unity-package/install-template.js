const expect = require('chai').expect
const fs = require('fs-extra-promise')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

describe("unityPackage.installTemplate - installs a the unity-package template to an empty directory", () => {
    var pkgPath = null

    before(async function() {
        this.timeout(10000)

        pkgPath = await h.installUnityPackageTemplateToTemp()
    })

    it("installs template files", async () => {
        const packageJsonPath = path.join(pkgPath, 'package.json')

        expect(await fs.existsAsync(packageJsonPath),
            `package.json should exist in install path ${pkgPath}`).to.equal(true)
    })

    it("sets initial version to 0.0.1", () => {
        const pkg = h.readPackageSync(pkgPath)
        expect(pkg.version).to.equal('0.0.1')
    })

    it("sets package name to install dir name by default", () => {
        const pkg = h.readPackageSync(pkgPath)
        expect(pkg.name).to.equal(path.basename(pkgPath))
    })

})
