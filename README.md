@iebh/i3 - NodeJS adapter
=========================
I3 - IEBH Integration Engine (NodeJS).

The I3 represents an attempt to define the integration between different Systematic Review apps with an aim to entirely automating the communication between these individual stages.

* [OSF Technical Standards Documentation](https://osf.io/3kd58)
* [I3 specification](https://github.com/icasr/I3)


For internal use see the [API reference](API.md).


Installation
============
1. Ensure you have an existing [NodeJS setup](https://nodejs.org/en/download) along with [Git](https://git-scm.com/downloads).


2. Install the command line interface via NPM:

```
npm install --global @iebh/i3
```

(You may need a `sudo` prefix depending on your Node setup)


3. You should now be able to us I3 with the command line interface `i3`. For example to check the version:

```
i3 --version
```


Usage
=====

```
Usage: i3 <--app URL | --task ID> [options]

Options:
  -V, --version           output the version number
  --app <url>             Specify an I3 App URL
  --input <file>          Specify an input data file - can be specified
                          multiple times (default: [])
  --output <file>         Specify an output data file - can be specified
                          multiple times (default: [])
  -t, --task <task>       Specify the SRA3 taskID to process
  --task-local <path>     Use a local SRA3 setup rather than trying to connect
                          to the SRA3 API remotely, path should point to the
                          root directory of the server
  -o, --opt <key=val...>  CSV of dotted notation config options to populate
                          (default: [])
  --debug                 Enable debug mode. Shows more complex traces on
                          errors
  --api-endpoint <URL>    Override the default API endpoint (default:
                          "https://beta.sr-accelerator.com")
  -v, --verbose           Be verbose, specify multiple times for more verbosity
  -h, --help              output usage information

Notes:
  * Multiple config options can be provided via `-o opt1=val1,opt2=val2`
  * Options without values are assumed to be `=true` e.g. `-o o1=1,o2,o3`

Examples:

  # Filter only for RCTs
  i3 --app https://github.com/ESHackathon/RCT_Predictor.git --input test/data/endnote-sm.xml --output refs.csv
```


API Usage
=========
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

This example will scan an input reference library (`endnote-sm.xml`) and output a CSV (`refs.csv`) with one additional field (`is_rct`).


Also available in the [testkit via API calls](./test/rct_predictor.js).


SRA3 task
---------
Run a task from the [http://sr-accelerator.com](SR-Accelerator) website.

```
> i3 --task 1234567890
```


Debugging
=========
This module uses the [debug NPM module](https://github.com/visionmedia/debug) for debugging. To enable set the environment variable to `DEBUG=i3` (or `DEBUG=i3*` for everything).

For example:

The following debug flags are supported:


| Debugging flag         | Definition                                   |
|------------------------|----------------------------------------------|
| `i3`                   | General I3 debugging information             |
| `i3:noClean`           | Do not clean up when completing an operation |


**NOTES:**

* Enabling `i3:noClean` forces I3 _not_ to remove the temporary directory used when running an App. This is useful to see the state of the app's data directory on failure
