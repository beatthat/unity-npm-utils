const expect = require('chai').expect;
const path = require('path');
const fs = require('fs-extra-promise');
const tmp = require('tmp-promise');

const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

const VERBOSE = false

/**
 * Core setup and expected behaviours for updating the package template.
 *
 * This operation can be performed multiple ways, e.g. from cli or from a module call,
 * so better to have the expected behaviour defined in a sharable test function.
 *
 * @param {updateTemplate} updateTemplate
 *      callback to execute the update-template op however the tester defines it.
 *
 * @param {Boolean} opts.install_required
 *      If true, will install the template package as part of beforeEach
 *
 */
const updateTemplateBehaviour = (updateTemplate, opts) => {
    const pkgName = "my-test-pkg";
    var pkgPath = null;
    var pkgDistNameSet = null;
    var distDepNames = null;
    var distScriptNames = null;
    var distFiles = null;

    var tmpPath = null;
    var pkgPath = null;

    opts = opts || {};

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
        this.timeout(30000);

        const test = this;

        // const d = await tmp.dir()
        //
        // tmpPath = d.path;
        // pkgPath = path.join(tmpPath, 'package-install');
        //
        // await fs.ensureDirAsync(pkgPath)
        //
        // await h.runBinCmd(`unpm init-package --package-name ${pkgName} -p ${pkgPath}`)
        //
        // if(VERBOSE) { console.log('init package completed...') }

        pkgPath = await h.installUnityPackageTemplateToTemp({
            package_name: pkgName,
            verbose: VERBOSE
        })

        await h.installLocalUnpmToPackage(pkgPath)

        test.test_config = {
            package_path: pkgPath,
            verbose: VERBOSE
        };

        if(VERBOSE) { console.log('will add source files...') }

        await unpm.unityPackage.addSrcFiles(pkgPath, srcFiles, { verbose: VERBOSE, ...opts })

        if(VERBOSE) { console.log('add source files completed...') }

        if(!opts.install_required) {
            return;
        }

        await h.runPkgCmd('npm install', pkgPath)
    });

    require('./package-template-behaviour.js')({
        ...opts,
        update_template_function: updateTemplate,
        package_src_files: srcFiles
    });

}


module.exports = updateTemplateBehaviour;
