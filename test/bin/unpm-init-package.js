const expect = require('chai').expect
const path = require('path')
const fs = require('fs-extra-promise')
const mkdirp = require('mkdirp')
const tmp = require('tmp')

const h = require('../test-helpers.js')
const unpm = require('../../lib/unity-npm-utils')

describe("'[npm i -g unity-npm-utils &&] unpm init-package [-p install-path] : installs the template for a unity npm package", () => {
    var tmpPath = null
    var pkgPath = null

    beforeEach(function(done) {
        this.timeout(10000)

        tmp.dir((err, d) => {
            if(err) { return done(err) }

            tmpPath = d
            pkgPath = path.join(d, 'package-install')

            mkdirp(pkgPath, (mkdirErr) => done(mkdirErr))
        })
    })

    it("installed package.json has scripts and dependencies", function(done) {

        this.timeout(10000)

        h.runBinCmd(`unpm init-package -p ${pkgPath}`)
        .then(installed => {
            const pkg = h.readPackageSync(pkgPath)
            expect(Object.getOwnPropertyNames(pkg.scripts).length, 'template package includes scripts').to.be.gt(0)
            expect(Object.getOwnPropertyNames(pkg.scripts).length, 'template package includes dependencies').to.be.gt(0)
            done()
        })
        .catch(e => done(e))
    })

    it("sets package name when --package-name passed", function(done) {
        this.timeout(90000)

        const pkgName = 'my-pkg-foo'

        h.runBinCmd(`unpm init-package --package-name ${pkgName} -p ${pkgPath}`)
        .then(installed => {
            const pkg = h.readPackageSync(pkgPath)
            const srcPath = path.join(pkgPath, 'Runtime', pkgName)

            expect(pkg.name).to.equal(pkgName)
            expect(fs.existsSync(srcPath), `should create a directory for source at ${srcPath}`).to.equal(true)

            return h.runPkgCmd('npm run install:test', pkgPath)
        })
        .then(testInstalled => {
            const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgName)

            expect(fs.existsSync(unityPkgPath), `should install by default to Assets/Plugins/packages/${pkgName}`).to.equal(true)

            done()
        })
        .catch(e => done(e))
    })

    it("fails when run on a non-empty directory", async function() {
        this.timeout(10000)

        await fs.writeFileAsync(path.join(pkgPath, 'anyfile.txt'), 'any content')

        try {
            await h.runBinCmd(`unpm init-package -p ${pkgPath}`)
            throw new Error(`should throw Error on attempt to install in non-empty dir: ${pkgPath}`)
        }
        catch(e) {
            expect(fs.existsSync(path.join(pkgPath, 'package.json')),
                `should throw Error and NOT write files on install to non-empty directory: ${pkgPath}`
            ).to.equal(false)
        }

    })

})
