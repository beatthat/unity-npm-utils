const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
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

    before(function(done) {
        this.timeout(300000);

        h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        })
        .then(tmpInstallPath => {
            pkgPath = tmpInstallPath;
            return unpm.unityPackage.addSrcFiles(pkgPath, srcFiles);
        })
        .then(addedSrcFiles => h.runPkgCmd('npm run install:test', pkgPath))
        .then(success => done())
        .catch(e => done(e))
    });

    it("installs under Plugins by default", function(done) {

        const unityPkgPath = path.join(pkgPath, 'test', 'Assets', 'Plugins', 'packages', pkgNameFoo);

        expect(fs.existsSync(unityPkgPath), `Plugin folder name matches package name ${unityPkgPath}`).to.equal(true);

        return done();
    });

});
