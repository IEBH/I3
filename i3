#!/bin/sh
":" //# comment; exec /usr/bin/env node --no-warnings "$0" "$@"
// ^^^ Weird hack to disable warnings - https://gist.github.com/rachidbch/5985f5fc8230b45c4b516ce1c14f0832


var axios = require('axios');
var commander = require('commander'); require('commander-extras');
var fspath = require('path');
var i3 = require('./index');

var program = commander
	.version(require('./package.json').version)
	.name('i3')
	.usage('--task <ID>')
	.option('--local <path>', 'Use a local SRA3 setup rather than trying to connect to the SRA3 API remotely, path should point to the root directory of the server')
	.option('-o, --opt <key=val...>', 'CSV of dotted notation config options to populate')
	.option('-t, --task <task>', 'Specify the SRA3 taskID to process')
	.option('--debug', 'Enable debug mode. Shows more complex traces on errors')
	.option('--api-endpoint <URL>', 'Override the default API endpoint (default is \'https://beta.sr-accelerator.com\')', 'https://beta.sr-accelerator.com')
	.note('Multiple config options can be provided via `-o opt1=val1,opt2=val2`')
	.parse(process.argv)


var task, taskApp;
Promise.resolve()
	// Sanity checks {{{
	.then(()=> {
		if (!program.task) throw new Error('`--task <ID>` must be specified');
	})
	// }}}
	// IF --local mode {{{
	.then(()=> {
		if (!program.local) return;

		console.warn('WARNING:', 'Remote task support is experiemental');

		return Promise.resolve()
			.then(()=> process.argv = []) // Reset ARGV so the app loader doesnt mistake it for its own arguments
			.then(()=> process.chdir(program.local))
			.then(()=> require(fspath.join(program.local, 'app')).setup()) // Setup global app object
			.then(()=> app.emit('dbInit')) // Setup all DB functionality...
			.then(()=> app.emit('dbMiddleware'))
			.then(()=> app.emit('preSchemas'))
			.then(()=> app.emit('schemas'))
			.then(()=> app.emit('postSchemas'))
	})
	// }}}
	// I3 setup {{{
	.then(()=> i3.on('log', console.log))
	// }}}
	// Fetch data {{{
	.then(()=>
		program.local
			? db.tasks.findOne({_id: taskID, $errNotFound: false})
			: axios.get(`${program.apiEndpoint}/api/tasks/${taskID}`)
				.then(res => res.data)
	)
	.then(res => res || Promise.reject('Task not found'))
	.then(res => task = res)
	.then(()=> Promise.all(
		// Populate task.inputs[].file
		task.inputs.map((input, inputOffset) =>
			(program.local ?
				db.files.findOneByID(input.file)
				: axios.get(`${program.apiEndpoint}/api/files/${input.file}`)
			)
				.then(file => file || Promise.reject(`Invalid input file ID "${input.file}"`))
				.then(file => task.inputs[inputOffset].file = file)
		),

		// Populate task.outputs[].file
		task.outputs.map((output, outputOffset) => // Populate task.outputs[].file
			(program.local ?
				db.files.findOneByID(output.file)
				: axios.get(`${program.apiEndpoint}/api/files/${output.file}`)
			)
				.then(file => file || Promise.reject(`Invalid output file ID "${output.file}"`))
				.then(file => task.outputs[outputOffset].file = file)
		),
	))
	// }}}
	// Setup app {{{
	.then(()=> task.app = '/home/mc/Dropbox/Projects/IEBH-SRA3/data/apps/i3-data-shuffler/i3.json')// FIXME: DEBUGGING
	.then(()=> i3.createApp(task.app))
	.then(res => taskApp = res)
	.then(()=> taskApp.init())
	// }}}
	// Run app {{{
	.then(()=> taskApp.run({
		config: task.config,
		inputs: task.inputs.map(input => input.file.path),
		outputs: task.outputs.map(output => output.file.path),
	}))
	// }}}
	// End {{{
	.catch(e => {
		console.warn(program.debug ? e : e.toString());
		process.exit(1);
	})
	// }}}
