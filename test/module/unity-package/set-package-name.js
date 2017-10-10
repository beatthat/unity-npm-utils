const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');

describe("unityPackage.setPackageName - sets package.name and updates all name-dependent aspects of a unity package", () => {
    var pkgPath = null;

    beforeEach(async function() {
        this.timeout(10000);

        pkgPath = await h.installUnityPackageTemplateToTemp();
    });

    it("writes new name [and option scope] to package.json", async function() {
        this.timeout(10000);

        const newPkgName = 'my-new-pkg-name';
        const newPkgScope = 'my-pkg-scope'

        await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName,
            package_scope: newPkgScope
        });

        const pkgWritten = h.readPackageSync(pkgPath);

        expect(pkgWritten.name, 'should have written name').to.equal(newPkgName);
        expect(pkgWritten.config.scope, 'should have written scope as a config property').to.equal(newPkgScope);
    });

    it("forces package name and scope to cannonical lowercase and dash-delimited", async function() {
        this.timeout(10000);

        const newPkgName = 'My New Pkg Name';
        const newPkgScope = 'My_Pkg Scope ';

        const cannonicalPkgName = 'my-new-pkg-name';
        const cannonicalPkgScope = 'my-pkg-scope'

        await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName,
            package_scope: newPkgScope
        });

        const pkgWritten = h.readPackageSync(pkgPath);
        expect(pkgWritten.name,
            'should have translated name to cannonical lowercase and dash-delimited form'
        ).to.equal(cannonicalPkgName);

        expect(pkgWritten.config.scope,
            'should have translated scope to cannonical lowercase and dash-delimited form'
        ).to.equal(cannonicalPkgScope);
    });

    it("sets a github urls for repo, issues, and homepage by default when package scope is set", async function() {
        this.timeout(10000);

        const newPkgName = 'My New Pkg Name';
        const newPkgScope = 'My_Pkg Scope ';

        const cannonicalPkgName = 'my-new-pkg-name';
        const cannonicalPkgScope = 'my-pkg-scope'

        await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName,
            package_scope: newPkgScope
        })

        const pkgWritten = h.readPackageSync(pkgPath);
        expect(pkgWritten.repository.type, 'should have written repository type as git').to.equal('git');
        expect(pkgWritten.repository.url, 'should have written repository type as github url').to.equal(
            `git+https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}.git`
        );

        expect(pkgWritten.bugs.url, 'should have written issues github bugs url').to.equal(
            `https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}/issues`
        );

        expect(pkgWritten.homepage, 'should have written homepage github homepage url').to.equal(
            `https://github.com/${cannonicalPkgScope}/${cannonicalPkgName}`
        );
    });

    it("adds a folder under src with the new package name if none exists", async function() {
        this.timeout(10000);

        const newPkgName = 'my-new-name-for-this-pkg';

        const pkgAfter = await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName,
            verbose: false
        });

        const pkgSrcPath = path.join(pkgPath, 'src', newPkgName);
        const stats = await fs.statAsync(pkgSrcPath);
        expect(stats.isDirectory()).to.equal(true);
    });

    it("renames the existing (single) folder under (package_root)/src with the new package name", async function() {
        this.timeout(10000);

        const newPkgName_1 = 'my-new-name-for-this-pkg-1';
        const newPkgName_2 = 'my-new-name-for-this-pkg-2';

        await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName_1,
            verbose: false
        });

        const stats = await fs.statAsync(path.join(pkgPath, 'src', newPkgName_1));

        expect(stats.isDirectory()).to.equal(true);

        await unpm.unityPackage.setPackageName(pkgPath, {
            package_name: newPkgName_2,
            verbose: false
        });

        const stats_2 = await fs.statAsync(path.join(pkgPath, 'src', newPkgName_2));
        expect(stats_2.isDirectory()).to.equal(true);
    });
});
