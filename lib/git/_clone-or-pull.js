'use strict';

const fs = require('fs-extra-promise'),
    path = require('path'),
    childProcess = require('child_process'),
    spawnWithSanityChecks = require('smart-spawn');

const gitBinary = childProcess.spawnSync('git', ['--version']).status === 0;

/**
 * Clone a git repo to a path or if clone already present, pull
 *
 * @param {string} url the git url
 * @param {string} opts.path path to the clone
 * @param {string} opts.branch optional branch to clone/pull. Default is master
 * @param {function(err)} callback
 * @returns Promise if callback not passed
 */
function gitCloneOrPull(url, opts, callback) {
    if(typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

	if (typeof opts === 'string') {
        opts = { path: opts };
    }

    opts = opts || {};
    opts.branch = opts.branch || 'master';

    const promise = new Promise((resolve, reject) => {
        if(!gitBinary) {
            throw new Error('Running `git --version` failed. git is not installed or missing from PATH?')
        }

        fs.access(opts.path, (err) => {
    		// Chop off the last path element to get the proper cwd for git subprocesses
    		var targetDir = opts.path.split(path.sep).slice(0, -1).join(path.sep);

    		if (err) {
    			// Not yet cloned
    			spawnWithSanityChecks('git', ['clone', '--quiet', '--branch', opts.branch, url, opts.path], targetDir, function(err, stdout) {
    				return (err)? reject(err): resolve();
    			});
    		} else {
    			// Cloned already; we need to pull

    			// Fetch
    			spawnWithSanityChecks('git', ['fetch', '--quiet', '--all'], opts.path, function(err, stdout) {
    				if (err) {
    					return reject(err);
    				}

    				// Checkout
    				spawnWithSanityChecks('git', ['checkout','--quiet', opts.branch], opts.path, function(err, stdout) {
                        if (err) {
        					return reject(err);
        				}

    					// Merge
    					spawnWithSanityChecks('git', ['merge','--quiet', '--ff-only', 'origin/' + opts.branch], opts.path, function(err, stdout) {
                            if (err) {
            					return reject(err);
            				}

    						resolve();
    					});
    				});
    			});
    		}
    	});

    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = gitCloneOrPull;
