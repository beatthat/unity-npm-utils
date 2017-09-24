const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const mlog = require('mocha-logger');

const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');


tmp.setGracefulCleanup();

describe("unityPackage.installTemplate - installs a the unity-package template to an empty directory", () => {
    var pkgPath = null;

    before(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp((installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;
            done();
        });
    });

    it("installs template files", () => {
        const packageJsonPath = path.join(pkgPath, 'package.json');

        expect(fs.existsSync(packageJsonPath),
            `package.json should exist in install path ${pkgPath}`).to.equal(true);
    });

    it("sets initial version to 0.0.1", () => {
        const pkg = h.readPackageSync(pkgPath);
        expect(pkg.version).to.equal('0.0.1');
    });

});
