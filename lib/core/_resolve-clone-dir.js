const homeOrTmp = require('home-or-tmp');
const path = require('path');

const _resolveCloneDir = (opts) => {
    return (opts && opts.clone_dir) ?
        opts.clone_dir : path.join(homeOrTmp, 'unity-npm-utils-packages');
}

module.exports = _resolveCloneDir;
