
const expect = require('chai').expect
const Repo = require('git-tools')
const path = require('path')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')


describe("git.cloneOrPullInstallPackage - clones or updates an external git clone for an installed package", () => {
    var templatePkgPath = null;

    beforeEach(async function() {
        this.timeout(300000);

        templatePkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: 'my-package-foo',
            run_npm_install: true
        })
    });

    it("creates a new clone under the user's home directory by default", async function() {
        this.timeout(30000);

        const pkgToClone = 'unity-npm-utils'; // cause we know it's already installed in templatePkgPath
        const pkgToClonePath = path.join(templatePkgPath, 'node_modules', pkgToClone);

        const info = await unpm.git.cloneOrPullInstalledPackage(pkgToClonePath)

        const clonePkg = h.readPackageSync(info.clone_package_path);
        expect(clonePkg.name, 'clone package has name set').to.equal(pkgToClone);

        const repo = new Repo(info.clone_package_path)

        expect(await repo.isRepo(), `should be a repo at path ${repo.path}`).to.equal(true)

        const status = await repo.exec('status', '--short');

        expect(status.trim().length, 'git status should show no local changes').to.equal(0)
    });

});
