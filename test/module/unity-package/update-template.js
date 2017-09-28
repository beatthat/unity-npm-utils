
const unpm = require('../../../lib/unity-npm-utils');
const updateTemplateBehaviour = require('../../shared/unpm-init-package-then-update-template-behaviour.js')

describe("'unityPackage.updateTemplate - updates scripts and template files for an existing unity package", () => {
    updateTemplateBehaviour((opts) => {
        return opts.package_path?
            unpm.unityPackage.updateTemplate(opts.package_path):
            new Promise((resolve, reject) => { reject(new Error('missing required option package_path')) });
    }, {
        install_required: false
    });
});
