#!/usr/bin/env node

var _ = require('lodash');
var axios = require('axios');
var colors = require('chalk');
var commander = require('commander'); require('commander-extras');
var debug = require('debug')('i3');
var fs = require('fs');
var fspath = require('path');
var i3 = require('./index');

var program = commander
	.version(require('./package.json').version)
	.name('i3')
	.usage('<--app URL | --task ID> [options]')
	.option('--app <url>', 'Specify an I3 App URL')
	.option('--input <file>', 'Specify an input data file - can be specified multiple times', (v, t) => t.concat([v]), [])
	.option('--output <file>', 'Specify an output data file - can be specified multiple times', (v, t) => t.concat([v]), [])
	.option('-t, --task <task>', 'Specify the SRA3 taskID to process')
	.option('-o, --opt <key=val...>', 'CSV of dotted notation config options to populate', (v, t) => t.concat(v.split(/\s*,\s*/)), [])
	.option('--debug', 'Enable debug mode. Shows more complex traces on errors')
	.option('--api-endpoint <URL>', 'Override the default API endpoint', 'https://beta.sr-accelerator.com')
	.option('-v, --verbose', 'Be verbose, specify multiple times for more verbosity', (t, v) => v + 1, 0)
	.option('-s, --shell', 'Instead of running the regular entry point commands, open a shell and prompt the user to do so manually - used for debugging')
	.option('--timeout <milliseconds>', 'Change default HTTP timeout', 5000)
	.note('Multiple config options can be provided via `-o opt1=val1,opt2=val2`')
	.note('Options without values are assumed to be `=true` e.g. `-o o1=1,o2,o3`')
	.example('i3 --app https://github.com/ESHackathon/RCT_Predictor.git --input test/data/endnote-sm.xml --output refs.csv', 'Filter only for RCTs')
	.example('i3 --app https://github.com/IEBH/sra-dedupe.git --input test/data/endnote-sm.xml --output deduped.xml', 'Deduplicate a list of references')
	.parse(process.argv)


/**
* Storage for this sessions data
* @type {Object}
*/
var session = {
	task: undefined, // Populated with server task if !!program.task
	app: undefined, // Populated with the I3 app object when its loaded
};


Promise.resolve()
	// Sanity checks {{{
	.then(()=> {
		if (program.app && program.task) {
			throw new Error('Cannot specify BOTH --app & --task');
		} else if (program.app) { // App mode
			// Pass
		} else if (program.task) { // SRA task mode
			if (program.input.length || program.output.length) throw new Error('Cannot specify input / output files when in Task mode');
		} else {
			program.outputHelp();
			console.log();
			throw new Error('Either `--task <ID>` OR `--app <URL>` must be specified');
		}
	})
	// }}}
	// Process config {{{
	.then(()=> {
		program.opt = program.opt.reduce((t, v) => {
			var optBits = /^(.+?)=(.*)$/.exec(v);
			if (optBits) { // key=val
				_.set(t, optBits[1], optBits[2]);
			} else { // key=true
				_.set(t, v, true);
			}
			return t;
		}, {})

		if (program.verbose > 1) console.log('Using config', program.opt);

		axios.defaults.timeout = program.timeout;
	})
	// }}}
	// I3 setup {{{
	.then(()=> i3.on('log', console.log))
	// }}}
	// If --task (use the SRA3 API endpoint) {{{
	.then(()=> {
		if (!program.task) return;

		if (program.verbose > 1) console.log('Using remote server for task data');
		console.warn('WARNING:', 'Remote task support is experimental');
	})
	// }}}
	// Setup app (pull data from server if !!program.task OR init app locally if not) {{{
	.then(()=> {
		if (program.app) { // Fetch specific app by name
			// Running locally, no need to fetch task data
			session.app = i3.createApp(program.app);
		} else { // Fetch task document from remote and use that to populate app info
			return Promise.resolve()
				// Fetch task from server {{{
				.then(()=> program.verbose && console.log('Fetching task data'))
				.then(()=> axios.get(`${program.apiEndpoint}/api/tasks/${program.task}`))
				.then(res => res.data)
				.then(res => res || Promise.reject('Task not found'))
				.then(res => session.task = res)
				// }}}
				// Setup app {{{
				.then(()=> session.app = i3.createApp(`${program.apiEndpoint}/api/apps/${session.task.app.id}`))
				// }}}
				// Add log entry to indicate we're working on this task {{{
				.then(()=> axios.post(`${program.apiEndpoint}/api/tasks/${program.task}/logs`, {contents: 'Preparing to run task', type: 'system'}))
				// }}}
		}
	})
	// }}}
	// Run app {{{
	.then(()=> program.verbose > 1 && console.log('Init app'))
	.then(()=> { if (program.shell) session.app.wantShell = true })
	.then(()=> session.app.init())
	.then(()=> {
		if (program.verbose) console.log('Run app', session.app.id);

		if (program.app) { // Use local CLI data only
			return session.app.run({
				config: program.opt,
				inputs: program.input,
				outputs: program.output,
			});
		} else { // Use task data to populate run
			if (!_.isEmpty(program.opt)) console.log(colors.yellow('WARN'), 'Overriding config with local CLI options');

			axios.post(`${program.apiEndpoint}/api/tasks/${program.task}/logs`, {contents: 'Execute task', type: 'system'})
			return session.app.run({
				config: !_.isEmpty(program.opt) ? program.opt : session.task.config,
				inputs: session.task.inputs.map(input => input.url ? {url: input.url, filename: input.filename} : null),
				outputs: session.task.outputs.map(output => output.url && output.url ? output.url : null),
			});
		}
	})
	// }}}
	// End {{{
	.catch(e => {
		console.warn(program.debug || debug.enabled ? e : e.toString());
		process.exit(1);
	})
	// }}}
