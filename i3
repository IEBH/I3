#!/usr/bin/env node

var _ = require('lodash');
var axios = require('axios');
var colors = require('chalk');
var commander = require('commander'); require('commander-extras');
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
	.option('--task-local <path>', 'Use a local SRA3 setup rather than trying to connect to the SRA3 API remotely, path should point to the root directory of the server')
	.option('-o, --opt <key=val...>', 'CSV of dotted notation config options to populate', (v, t) => t.concat(v.split(/\s*,\s*/)), [])
	.option('--debug', 'Enable debug mode. Shows more complex traces on errors')
	.option('--api-endpoint <URL>', 'Override the default API endpoint', 'https://beta.sr-accelerator.com')
	.option('-v, --verbose', 'Be verbose, specify multiple times for more verbosity', (t, v) => v++, 0)
	.note('Multiple config options can be provided via `-o opt1=val1,opt2=val2`')
	.note('Options without values are assumed to be `=true` e.g. `-o o1=1,o2,o3`')
	.example('i3 --app https://github.com/ESHackathon/RCT_Predictor.git --input test/data/endnote-sm.xml --output refs.csv', 'Filter only for RCTs')
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
			if (program.taskLocal) throw new Error('Cannot specify --task-local with --app');
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
	})
	// }}}
	// I3 setup {{{
	.then(()=> i3.on('log', console.log))
	// }}}
	// IF --task (use the SRA3 API endpoint) {{{
	.then(()=> {
		if (!program.task) return;

		if (!program.taskLocal) {
			if (program.verbose) console.log('Using local server for task data');
			return Promise.resolve()
				.then(()=> process.argv = []) // Reset ARGV so the app loader doesnt mistake it for its own arguments
				.then(()=> process.chdir(program.local))
				.then(()=> require(fspath.join(program.local, 'app')).setup()) // Setup global app object
				.then(()=> app.emit('dbInit')) // Setup all DB functionality...
				.then(()=> app.emit('dbMiddleware'))
				.then(()=> app.emit('preSchemas'))
				.then(()=> app.emit('schemas'))
				.then(()=> app.emit('postSchemas'))
		} else {
			if (program.verbose > 1) console.log('Using remote server for task data');
			console.warn('WARNING:', 'Remote task support is experiemental');
		}
	})
	// }}}
	// Setup app (pull data from server if !!program.task OR init app locally if not) {{{
	.then(()=> {
		if (program.app) {
			// Running locally, no need to fetch task data
			session.app = i3.createApp(program.app);
		} else {
			return Promise.all()
				// Fetch task from server {{{
				.then(()=> program.verbose && console.log('Fetching task data'))
				.then(()=>
					program.local
						? db.tasks.findOne({_id: program.taskID, $errNotFound: false})
						: axios.get(`${program.apiEndpoint}/api/tasks/${program.taskID}`)
							.then(res => res.data)
				)
				.then(res => res || Promise.reject('Task not found'))
				.then(res => session.task = res)
				// }}}
				// Tidy up input / output files {{{
				.then(()=> Promise.all(
					// Populate session.task.inputs[].file
					session.task.inputs.map((input, inputOffset) =>
						(program.local ?
							db.files.findOneByID(input.file)
							: axios.get(`${program.apiEndpoint}/api/files/${input.file}`)
						)
							.then(file => file || Promise.reject(`Invalid input file ID "${input.file}"`))
							.then(file => session.task.inputs[inputOffset].file = file)
					),

					// Populate session.task.outputs[].file
					session.task.outputs.map((output, outputOffset) => // Populate session.task.outputs[].file
						(program.local ?
							db.files.findOneByID(output.file)
							: axios.get(`${program.apiEndpoint}/api/files/${output.file}`)
						)
							.then(file => file || Promise.reject(`Invalid output file ID "${output.file}"`))
							.then(file => session.task.outputs[outputOffset].file = file)
					),
				))
				// }}}
				// Setup app {{{
				.then(()=> session.app = i3.createApp(session.task.app))
				// }}}
		}
	})
	// }}}
	// Run app {{{
	.then(()=> program.verbose > 1 && console.log('Init app'))
	.then(()=> session.app.init())
	.then(()=> {
		if (program.verbose) console.log('Run app', app.id);

		if (program.app) { // Use local CLI data only
			session.app.run({
				config: program.opt,
				inputs: program.input,
				outputs: program.output,
			});
		} else { // Use task data to populate run
			if (!_.isEmpty(program.opt)) console.log(colors.yellow('WARN'), 'Overriding config with local CLI options');

			session.app.run({
				config: !_.isEmpty(program.opt) ? program.opt : task.config,
				inputs: task.inputs.map(input => input.file.path),
				outputs: task.outputs.map(output => output.file.path),
			});
		}
	})
	// }}}
	// End {{{
	.catch(e => {
		console.warn(program.debug ? e : e.toString());
		process.exit(1);
	})
	// }}}
