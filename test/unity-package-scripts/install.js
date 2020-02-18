const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp-promise');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');
const updateTemplateBehaviour = require('../shared/package-template-behaviour.js')

const pkgName = "my-pkg-foo";

const VERBOSE = false


describe(`'npm init && npm install --save beatthat/unity-npm-utils && node ./node_modules/unity-npm-utils/bin/unpm upt -v'
        : updates scripts and template files for an existing unity package`, () => {


    beforeEach(async function() {

        this.timeout(30000);

        const d = await tmp.dir()
        const pkgPath = path.join(d.path, 'package-install');

        await fs.ensureDir(pkgPath)

        this.test_config = {
            package_path: pkgPath,
            verbose: VERBOSE
        }

        await h.runPkgCmd('npm init --force && echo "@beatthat:registry=https://npm.pkg.github.com" > .npmrc', pkgPath)

        await unpm.transformPackage({
            package_path: pkgPath,
            transform: (p, cb) => {
                p.name = pkgName;
                cb(null, p);
            }
        })
    });

    updateTemplateBehaviour({
        update_template_function: (opts) => {
            return h.runPkgCmd('npm install --save @beatthat/unity-npm-utils && npx unpm upt -v', opts.package_path);
        }
    })

});
