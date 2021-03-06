# <a name="readme"></a>Unity NPM Utils

[![Build Status](https://travis-ci.com/beatthat/unity-npm-utils.svg?branch=master)](https://travis-ci.com/beatthat/unity-npm-utils)

## Create, install, and share interdependent Unity packages

The Unity Asset Store is a great resource but as a package manager, it has limitations. Notably, it provides no mechanism for one package to declare dependencies on another.

A practical effect of this is that the Unity ecosystem doesn't create and share small, single-task focused, interdependent code modules the way other language/platform communities do, and so the Unity community misses out on that engine of innovation and progress.

`unity-npm-utils` leverages the mature and powerful Node JS package manager, npm, as a basis to provide Unity-friendly tools for creating, integrating, editing and sharing Unity packages.

#### Why do I need this when Unity has released their own package manager?

Unity doesn't yet support user-generated packages. When they do, I'll probably switch to their tool, but in the meantime, I need a usable package manager for my own code (and hopefully yours).

#### Should I be worried about depending on this package manager or lock in?

Really no, because unity-npm-utils doesn't change anything about your code or project. By default, package code is installed to the Assets folder of your unity project and (unless you choice to mark it as ignored in version control) stored like any other Unity scripts, asset files etc.

If anything, breaking out your code into packages now should make it much easier to migrate to Unity Package Manager down the road.

## Dependencies

* Requires ```npm```
* Some advanced features require ```git``` cli
* Tested extensively on Mac OSX, but generally should work on in any shell and on Windows as well.

## Usage

### Installing packages to a unity project

#### Your unity project needs a package.json

The next few sections below will take you through the process of installing an package to a Unity project via npm. If you prefer video tutorials, this [video](https://youtu.be/Uss_yOiLNw8) goes through more or less the same process.

First things first: we're using npm here, so your unity project needs a package.json. If you don't yet have a package.json in your unity project, you can use npm init

`cd [your unity project root] && npm init`

#### Use `npm install` to install existing (unpm-enabled) packages along with their Samples

...so now that your unity project has a package.json file at its root, if you want to install a unity package that's been set up for with unity-npm-utils, you can just use the normal npm install command. For example, to install [beatthat/properties](https://github.com/beatthat/properties):

```
npm install --save beatthat/properties
```

Once that completes, notice that an Assets folder has been created. Open the project in Unity (or review it in a Finder/Explorer) and there should now be a `Plugins/packages/beatthat` directory. Under that directory, you will see not only the [properties](https://github.com/beatthat/properties) package that you just installed but also various other packages which are the (recursive) dependencies of the properties package.

#### Check out the Samples that installed with your packages

Packages frequently include Samples, which also get copied to your unity project when you install the package. Look for package samples under ```Samples/packages```

#### If you're curious about what's happening under the hood...

What makes each package install to a folder under Assets/Plugins is a `postinstall` script. Unlike an npm javascript package installed to node_modules, the code package installed to your unity project is a copy intended for you to commit. If you only want to install packages that already exist using unity-npm-utils, then this is all you need to know!

### Create your own unity package

If you want to create your unity package that can install via npm (and leverage dependency support), then `unpm` can help.

#### Set up a unpm-enabled package from clean slate

Create a new directory with the same you want to give your package and then execute the following shell command:

```
npm init --force && \
npm install --save beatthat/unity-npm-utils && \
node ./node_modules/unity-npm-utils/bin/unpm upt -v
```

When the commands above complete, your package.json should have some scripts and directories should be set up for source and tests.

#### Edit your package code and Samples in a Unity test project

Unity NPM Utils provides tools to let you work on your package code and Samples in a Unity 'test' project and then sync the changes back to their respective folders for commit.

Run the command below to install your project to a test unity project:

```
npm run test-install
```

Now launch Unity and open the generated project in your package folder under `./test`. The contents from your package `Runtime/${your_package_name}` should be copied to `Plugins/packages` and the contents from your package `Samples` should be copied to `Samples/packages`.

#### Sync changes made in the Unity test project back to your package

When you're done editing Samples etc. in the Unity test project, you must sync those changes back to their folders in the package root or they will be lost.

To sync run one of the commands below from the package root (not the test folder)

```npm run overwrite2src```

...to OVERWRITE (will delete`Runtime` and `Samples` before copy)

...or...

```npm run copy2src```

...to copy WITHOUT deleting files on the package side

#### Create a package out of code already living in your Unity project

TODO: document this

#### Sync changes made to a package in your Unity project back to the package, e.g. a git clone

TODO: document this

## How to test the software

If you're making changes to unity-npm-utils, use the extensive suite of BDD tests ```npm run test```. These tests take some time to run because many of them are doing npm installs and other downloads to mimic real-world scenarios.

## Known issues

Document any known significant shortcomings with the software.

## Getting help

Instruct users how to get help with this software; this might include links to an issue tracker, wiki, mailing list, etc.

**Example**

If you have questions, concerns, bug reports, etc, please file an issue in this repository's Issue Tracker.

## Getting involved

Feel free to email me if you have any questions about the package etc. If you have a pull request, make sure all tests are passing.

## Credits and references

Based on https://github.com/shadowmint/unity-package-template
