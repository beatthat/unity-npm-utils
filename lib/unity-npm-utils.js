const unpm = require('./core');
const unityPackage = require('./unity-package');
const git = require('./git')

module.exports = {
    ...unpm,
    unityPackage: unityPackage,
    git: git
}
