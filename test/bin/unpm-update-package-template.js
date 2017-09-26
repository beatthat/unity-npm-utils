const h = require('../test-helpers.js');
const unpm = require('../../lib/unity-npm-utils');

const updateTemplateBehaviour = require('../shared/update-package-template-behaviour.js')

describe("'[npm i -g unity-npm-utils &&] unpm update-template [path] : updates a unity package with latest template scripts and files", () => {
    updateTemplateBehaviour((opts) => {
        return opts.package_path?
            h.runBinCmd(`unpm update-package-template -p ${opts.package_path}`):
            new Promise((resolve, reject) => { reject(new Error('missing required option package_path')) });
    }, {
        install_required: false
    });
});
