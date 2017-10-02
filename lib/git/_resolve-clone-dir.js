const homeOrTmp = require('home-or-tmp');
const path = require('path');

const _resolveCloneDir = (options) => {
    return (options && options.clone_dir) ?
        options.clone_dir : path.join(homeOrTmp, 'unity-npm-utils-packages');
}

module.exports = _resolveCloneDir;
