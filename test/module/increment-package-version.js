const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

tmp.setGracefulCleanup();


describe("incrementPackageVersion - increments the version for package", () => {
    var pkgPath = null;

    beforeEach(async function() {
        this.timeout(10000);
        pkgPath = await h.installUnityPackageTemplateToTemp();
    });

    it("accepts package OBJECT as arg", async function() {
        this.timeout(10000);

        const pkg = h.readPackageSync(pkgPath);
        const pkgAfter = await unpm.incrementPackageVersion(pkg);

        expect(pkg.version, 'should modify only copy of package passed to callback').to.equal('0.0.1');
        expect(pkgAfter.version).to.equal('0.0.2');
    });

    it("accepts package PATH as arg", async function() {
        this.timeout(10000);

        const pkgAfter = await unpm.incrementPackageVersion(pkgPath);
        expect(pkgAfter.version).to.equal('0.0.2');
    });

    it("writes changes to package.json when PATH as arg", async function() {
        this.timeout(10000);

        await unpm.incrementPackageVersion(pkgPath);
        const pkgWritten = h.readPackageSync(pkgPath);
        expect(pkgWritten.version).to.equal('0.0.2');
    });

    it("increments patch version by default", async function() {
        this.timeout(10000);

        const pkgAfter = await unpm.incrementPackageVersion(pkgPath);
        expect(pkgAfter.version, 'written package.json version should increment').to.equal('0.0.2');
    });

    it("increments semver release type passed via opts.release_type", async function() {
        this.timeout(10000);

        const pkg = h.readPackageSync(pkgPath);

        const p1 = await unpm.incrementPackageVersion(pkg, {
            release_type: 'minor'
        });

        expect(p1.version, "accepts release_type 'minor'").to.equal('0.1.0');

        const p2 = await unpm.incrementPackageVersion(pkg, {
            release_type: 'major'
        })

        expect(p2.version, "accepts release_type 'minor'").to.equal('1.0.0');
    });
});
