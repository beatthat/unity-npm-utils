const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');
const tmp = require('tmp');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

describe("'npm run install:test' - installs a package to its own 'test' Unity project for editting", () => {
    var pkgPath = null;

    const pkgNameFoo = "my-pkg-foo";
    const srcFiles = [{
            name: 'Foo.cs',
            content: 'public class Foo {}'
        },
        {
            name: 'Bar.cs',
            content: 'public class Bar {} '
        }
    ];

    before(async function() {
        this.timeout(300000);

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        })

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFiles)

        await h.installLocalUnpmToPackage(pkgPath)

        // change unity-unpm-utils to a bundled dependency in the fake/test package so we it will use the local version we're testing
        await unpm.transformPackage({
            package_path: pkgPath,
            transformAsync: async (p) => {
                return { ...p, bundledDependencies: ['unity-npm-utils'] }
            }
        })

        await h.runPkgCmd('npm run install:test', pkgPath)
    });

    it("installs under Plugins by default", async function() {

        const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgNameFoo);

        expect(await fs.existsAsync(unityPkgPath), `src for plugin copied to unity at path ${unityPkgPath}`).to.equal(true);
    });

});
