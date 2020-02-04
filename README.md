@iebh/i3 - NodeJS adapter
=========================
I3 - IEBH Integration Engine (NodeJS).

For internal use see the [API reference](API.md).


Examples
========

rct_predictor
-------------
Use [Iain Marshall's](https://github.com/ijmarshall) [RobotSearch](https://github.com/ijmarshall/robotsearch) project to detect RCT's within a research library:
This was a project at the [Evidence Synthesis Hackathon (Canberra 2019)](https://github.com/ESHackathon/RCT_Predictor).

```
./i3 \
--app https://github.com/ESHackathon/RCT_Predictor.git \
--input test/data/endnote-sm.xml \
--output refs.csv
```

Also available in the [testkit via API calls](./test/rct_predictor.js).


SRA3 task
---------
Run a task from the [http://sr-accelerator.com](SR-Accelerator) website.

```
> i3 \
--task 1234567890
```


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
