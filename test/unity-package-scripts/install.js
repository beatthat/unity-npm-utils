const fs = require('fs-extra-promise');
const path = require('path');
const tmp = require('tmp-promise');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');
const updateTemplateBehaviour = require('../shared/package-template-behaviour.js')

const pkgName = "my-pkg-foo";


describe(`'npm init && npm install --save beatthat/unity-npm-utils && node ./node_modules/unity-npm-utils/bin/unpm upt -v'
        : updates scripts and template files for an existing unity package`, () => {


    beforeEach(function(done) {

        this.timeout(30000);

        const test = this;
        var pkgPath = null;

        tmp.dir()
        .then(d => {
            pkgPath = path.join(d.path, 'package-install');
            return fs.ensureDirAsync(pkgPath);
        })
        .then(pkgPathExists => {
            test.test_config = {
                package_path: pkgPath
            };

            return h.runPkgCmd('npm init --force', pkgPath);
        })
        .then(pkgDidInit => unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.name = pkgName;
                cb(null, p);
            }
        }))
        .then(pkgNameSet => done())
        .catch(e => done(e))
    });

    updateTemplateBehaviour({
        update_template_function: (opts) => {
            return h.runPkgCmd('npm install --save beatthat/unity-npm-utils && node ./node_modules/unity-npm-utils/bin/unpm upt -v', opts.package_path);
        }
    })

});
