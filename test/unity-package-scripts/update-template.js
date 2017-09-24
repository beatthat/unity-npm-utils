const expect = require('chai').expect;

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');


describe.skip("'npm run template:update' - updates scripts and template files for an existing unity package", () => {
    var pkgPath = null;

    const pkgNameFoo = "my-pkg-foo";
    var pkgBefore = null;

    beforeEach(function(done) {
        this.timeout(10000);

        h.installUnityPackageTemplateToTemp({
            package_name: pkgNameFoo
        }, (installErr, tmpInstallPath) => {
            if (installErr) {
                return done(installErr);
            }

            pkgPath = tmpInstallPath;

            pkgBefore = h.readPackageSync(pkgPath);

            h.runPkgCmd('npm run template:update', pkgPath, (cmdErr) => {
                return done(cmdErr);
            });
        });
    });

    it("appends all template scripts to main package scripts", function(done) {
        done(new Error('not implemented'))
    });

});
