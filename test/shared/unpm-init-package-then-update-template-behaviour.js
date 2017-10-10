const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');
const tmp = require('tmp-promise');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

/**
 * Core setup and expected behaviours for updating the package template.
 *
 * This operation can be performed multiple ways, e.g. from cli or from a module call,
 * so better to have the expected behaviour defined in a sharable test function.
 *
 * @param {updateTemplate} updateTemplate
 *      callback to execute the update-template op however the tester defines it.
 *
 * @param {Boolean} options.install_required
 *      If true, will install the template package as part of beforeEach
 *
 */
const updateTemplateBehaviour = (updateTemplate, options) => {
    const pkgName = "my-pkg-foo";
    var pkgPath = null;
    var pkgDistNameSet = null;
    var distDepNames = null;
    var distScriptNames = null;
    var distFiles = null;

    var tmpPath = null;
    var pkgPath = null;

    options = options || {};

    const srcFiles = [{
            name: 'Foo.cs',
            content: 'public class Foo {}'
        },
        {
            name: 'Bar.cs',
            content: 'public class Bar {} '
        }
    ];

    beforeEach(async function() {
        this.timeout(300000);

        const test = this;

        const d = await tmp.dir()

        tmpPath = d.path;
        pkgPath = path.join(tmpPath, 'package-install');

        await fs.ensureDirAsync(pkgPath)

        await h.runBinCmd(`unpm init-package --package-name ${pkgName} -p ${pkgPath}`)

        test.test_config = {
            package_path: pkgPath
        };

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFiles)

        if(!options.install_required) {
            return;
        }

        await h.runPkgCmd('npm install', pkgPath)
    });

    require('./package-template-behaviour.js')({
        ...options,
        update_template_function: updateTemplate,
        package_src_files: srcFiles
    });

}


module.exports = updateTemplateBehaviour;
