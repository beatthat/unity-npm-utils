
const expect = require('chai').expect
const fs = require('fs-extra-promise');
const mlog = require('mocha-logger');
const path = require('path')
const Repo = require('git-tools');
const tmp = require('tmp-promise')

const h = require('../../test-helpers.js')
const unpm = require('../../../lib/unity-npm-utils')

const VERBOSE = false;

describe.only("git.linkPackage2Clone", () => {
    var templatePkgPath = null;

    beforeEach(async function() {
        this.timeout(300000);

        templatePkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: 'my-package-foo',
            run_npm_install: true
        });

    });

    it.only("ensures clone exists", async function() {
        this.timeout(30000);

        const pkgToClone = 'unity-npm-utils'; // cause we know it's already installed in templatePkgPath
        const pkgToClonePath = path.join(templatePkgPath, 'node_modules', pkgToClone);


        const tmpD = await tmp.dir();
        const logPath = path.join(tmpD.path, 'link-pkg-2-clone.log');

        mlog.pending(`logs for link op at ${logPath}`)

        const info = await unpm.git.linkPackage2Clone(pkgToClonePath, {
            stdio_log_path: logPath
        });

        const clonePkg = h.readPackageSync(info.clone_package_path);
        expect(clonePkg.name, 'clone package has name set').to.equal(pkgToClone);

        const repo = new Repo(info.clone_package_path)

        expect(await repo.isRepo(), `should be a repo at path ${repo.path}`).to.equal(true)

        const status = await repo.exec('status', '--short');

        expect(status.trim().length, 'git status should show no local changes').to.equal(0)
    });

});
