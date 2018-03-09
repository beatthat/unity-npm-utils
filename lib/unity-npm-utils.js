const unpm = require('./core');
const unityPackage = require('./unity-package');
const unityProject = require('./unity-project');
const git = require('./git')

module.exports = {
    ...unpm,
    unityPackage: unityPackage,
    unityProject: unityProject,
    git: git,

// backwards compatibility with packages before code moved to unpm.unityProject
    copyFromUnity2Pkg: unityProject.copyFromUnity2Pkg,
    copyFromUnity2PkgRoot: unityProject.copyFromUnity2PkgRoot,
    installPackageToUnity: unityProject.installPackageToUnity,

}
