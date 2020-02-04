@iebh/i3 - NodeJS adapter
=========================
I3 - IEBH Integration Engine (NodeJS).

For internal use see the [API reference](API.md).


Debugging
=========
This module uses the [debug NPM module](https://github.com/visionmedia/debug) for debugging. To enable set the environment variable to `DEBUG=i3` (or `DEBUG=i3*` for everything).

For example:

The following debug flags are supported:


| Debugging flag         | Definition                         |
|------------------------|------------------------------------|
| `i3`         | General I3 debugging information             |
| `i3:noClean` | Do not clean up when completing an operation |


**NOTES:**

* Enabling `i3:noClean` forces I3 _not_ to remove the temporary directory used when running an App. This is useful to see the state of the app's data directory on failure
