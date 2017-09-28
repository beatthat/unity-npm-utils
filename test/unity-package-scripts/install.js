const fs = require('fs-extra-promise');
const path = require('path');
const tmp = require('tmp');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');
const updateTemplateBehaviour = require('../shared/package-template-behaviour.js')

const pkgName = "my-pkg-foo";


describe.skip("'npm init && npm install --save-dev beatthat/unity-npm-package-template' - updates scripts and template files for an existing unity package", () => {


    beforeEach(function(done) {

        this.timeout(30000);

        const test = this;

        tmp.dir((err, tmpPath) => {
            if(err) { return done(err); }

            const pkgPath = path.join(tmpPath, 'package-install');

            fs.ensureDirAsync(pkgPath)
            .then(pkgPathExists => {
                test.test_config = {
                    package_path: pkgPath
                };

                h.runPkgCmd('npm init --force', pkgPath)
                .then(pkgDidInit => {

                    unpm.transformPackage({
                        package_path: pkgPath,
                        transform: (p, cb) => {
                            p.name = pkgName;
                            cb(null, p);
                        }
                    })
                    .then(pkgNameSet => done())
                    .catch(e => {
                        done(e)
                    })
                })
                .catch(e => done(e))


            })
            .catch(e => done(e))
        });
    });

    updateTemplateBehaviour({
        update_template_function: (opts) => {
            return h.runPkgCmd('npm install --save-dev beatthat/unity-npm-package-template', opts.package_path);
        }
    })

});
