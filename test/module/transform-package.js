const expect = require('chai').expect;
const mlog = require('mocha-logger');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

describe('transformPackage - transforms a package json with options to read before and/or write after transform', () => {
    var pkgPath = null;

    const pkgNameFoo = "my-pkg-foo";

    beforeEach(async function() {
        this.timeout(10000);

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        });
    });

    it('can read -> transform -> write a package', async function() {

        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (pkg, callback) => {
                pkg.scripts = { foo: 'bar' };
                callback(null, pkg);
            }
        })

        const pkgAfter = h.readPackageSync(pkgPath);
        expect(pkgAfter.scripts.foo).to.equal('bar');
    });

    it('returns a promise when no callback passed', async function() {

        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (pkg, callback) => {
                pkg.scripts = { foo: 'bar' };
                callback(null, pkg);
            }
        })
        const pkgAfter = h.readPackageSync(pkgPath);

        expect(pkgAfter.scripts.foo).to.equal('bar');
    });
});
