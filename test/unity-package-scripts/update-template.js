const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

const updateTemplateBehaviour = require('../shared/unpm-init-package-then-update-template-behaviour.js')

describe("'npm run template:update' - updates scripts and template files for an existing unity package", () => {
    updateTemplateBehaviour((opts) => {
        return h.runPkgCmd('npm run template:update', opts.package_path);
    }, {
        install_required: true
    });
});
