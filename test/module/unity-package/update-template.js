
const unpm = require('../../../lib/unity-npm-utils');
const updateTemplateBehaviour = require('../../shared/unpm-init-package-then-update-template-behaviour.js')

describe("'unityPackage.updateTemplate - updates scripts and template files for an existing unity package", () => {
    updateTemplateBehaviour((opts) => {
        if(!opts.package_path) {
            throw new Error('missing required option package_path')
        }
        return unpm.unityPackage.updateTemplate(opts.package_path)
    }, {
        install_required: false
    });
});
