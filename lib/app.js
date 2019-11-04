var _ = require('lodash');
var axios = require('axios');
var exec = require('@momsfriendlydevco/exec');
var del = require('del');
var fs = require('fs');
var fspath = require('path');
var macgyver = require('/home/mc/Dropbox/Projects/Node/@momsfriendlydevco/macgyver');
var temp = require('temp');
var template = require('@momsfriendlydevco/template');
var reflib = require('reflib');

var macgyverAppCount = 0;

var I3App = function I3App(i3) {
	var app = this;

	/**
	* Unique ID for this app instance
	* @var {string}
	*/
	app.id = `mgApp${macgyverAppCount++}`;


	/**
	* @var {string} Originally provided path to the source app
	*/
	app.path;


	/**
	* @var {Object} The loaded app manifest
	*/
	app.manifest;


	/**
	* @var {string} Friendly name for this app
	*/
	app.name = `app-${Date.now()}-${_.random(100,999)}`; // Temporary name, hopefully replaced later with something logical


	/**
	* Debug output hook
	* This really just wraps the main I3 debug function with a prefix
	* @param {*} [msg...] Output message components
	*/
	app.log = (...msg) => i3.log(i3.log.colors.blue(`[App / ${app.name || app.path || 'Unknown app'}]`), ...msg);
	app.log.warn = (...msg) => i3.log(i3.log.colors.blue(`[App / ${app.name || app.path || 'Unknown app'}]`), i3.log.colors.yellow('WARN'), ...msg);
	app.log.colors = i3.log.colors;


	/**
	* Initialize the app environment by fetching the manifest and parsing it
	* @param {object} [options] Options to use when building
	* @param {boolean} [options.validate=true] Validate the manifest, only disable this if you absolutely trust the app source
	* @param {boolean} [options.build=true] Automatically build the app, if falsy call app.build() manually
	* @returns {Promise} A promise which will return the full app object when complete
	*/
	app.init = options => {
		var settings = {
			validate: true,
			build: true,
			...options,
		};

		return Promise.resolve()
			.then(()=> app.path || Promise.reject('No app.path specified'))
			.then(()=> {
				if (/^https?:\/\//.test(app.path)) { // Load from URL
					app.log('Fetching manifest URL', app.log.colors.cyan(app.path));
					return axios.get(app.path)
						.then(res => res.data)
				} else {
					app.log('Fetching manifest path', app.log.colors.cyan(app.path));
					return fs.promises.readFile(app.path)
						.then(content => JSON.parse(content))
				}
			})
			.then(manifest => {
				if (settings.validate) {
					app.log('Validating manifest');
					return i3.validateManifest(manifest);
				} else {
					app.log.warn('Skipping validation of manifest');
					return manifest;
				}
			})
			.then(manifest => app.manifest = Object.freeze(manifest))
			.then(()=> app.name = app.manifest.name.replace(/[^a-z0-9_\-]+/ig, '_').replace(/^[\._\-]/, ''))
			.then(()=> settings.build && app.build())
			.then(()=> app)
	};


	/**
	* Convenience function to validate this apps manifest against the main I3 object
	* @see i3.validateManifest()
	*/
	app.validateManifest = ()=> i3.validateManifest(app.manifest);


	/**
	* Build the app (using whatever means is specified)
	* @returns {Promise} A promise which will return when built or throw if an error occurs during the build process
	*/
	app.build = ()=> Promise.resolve()
		.then(()=> app.manifest || Promise.reject('Manifest not yet loaded, call I3App.init(path) first'))
		.then(()=> {
			if (app.manifest.worker.type == 'url') {
				// type=='url' {{{
				return; // Nothing to do, its a remote URL anyway
				// }}}
			} else if (app.manifest.worker.type == 'docker') {
				// type=='docker' {{{
				var dockerFile = ''
					+ `FROM ${app.manifest.worker.base}\n`
					+ 'WORKDIR /app\n\n'
					+ (app.manifest.worker.build ? '\n# Build steps\n' : '')
					+ _.castArray(app.manifest.worker.build)
						.map(cmd => `RUN ${cmd}`)
						.join('\n') + '\n'

				app.log('Build docker image', app.log.colors.cyan(app.name));

				return exec([
					'docker',
					'build',
					...i3.settings.docker.runArgs,
					`--tag=${app.name}`,
					'-',
				], {
					log: app.log.bind(app.log.colors.blue('[Docker/Build]')),
					stdin: dockerFile,
				})
				// }}}
			} else {
				// type else {{{
				return Promise.reject('Unknown worker type');
				// }}}
			}
		})


	/**
	* Validate the manifest config, apply defaults and return the final config we would use when running the app
	* Automatically conduceted by app.run()
	* @param {Object} config The input config
	* @returns {Promise} A promise which will either resolve with the computed full config object or throw with a validation message
	*/
	app.resolveConfig = config => Promise.resolve()
		.then(()=> macgyver.forms.setConfig(app.id, app.manifest.config))
		.then(()=> macgyver.forms.setData(app.id, config))
		.then(()=> macgyver.forms.validate(app.id, app.manifest.config))
		.then(()=> _.merge(macgyver.forms.getPrototype(app.id), config))


	/**
	* AppResponse object
	* Returned by app.run()
	* @typedef {Object} AppResponse
	* @property {Object} app The app manifest used, since app.manifest is frozen this cannot be mutated
	* @property {Object} config The input config
	* @param {Array <string|null>} inputs Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional)
	* @param {Array <string|null>} outputs Array of generated output files, either the path to the file on disk or `null` if the output was not requested
	* @see app.run()
	*/


	/**
	* Execute this app instance within a Docker container using predefined config
	* @param {Object} [options] Setttings to pass when running
	* @param {Object} [options.resolveConfig] Run config via app.resolveConfig()
	* @param {Object} [options.config] Settings config object, defaults will be auto-computed and inserted
	* @param {Array <string|null>} [inputs] Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional)
	* @param {Array <string|null>} [outputs] Array of output file destinations, either the path to the file on disk or `null` if not specified (i.e. file is optional and not required)
	* @returns {Promise <AppResponse>} A Promise which resolves to an AppResponse object
	*/
	app.run = options => {
		var settings = {
			resolveConfig: true,
			config: {},
			inputs: [],
			outputs: [],
			...options,
		};

		var session = { // Session specific storage, perishes after function completes
			tempDir: null, // Temp directory
			outputs: [],
		};

		return Promise.resolve()
			// App run validation {{{
			.then(()=> app.manifest || Promise.reject('Manifest not yet loaded, call I3App.init(path) first'))
			.then(()=> {
				['inputs', 'outputs'].forEach(branch => {
					app.manifest[branch].forEach((file, fileOffset) => {
						if (
							(file.required === undefined || file.required)
							&& _.isString(settings[branch][fileOffset])
						) { // file is required & file is specified
							// Pass
						} else if (!file.required && settings[branch][fileOffset] === null) { // Valid omitted optional file
							// Pass
						} else if (!file.required && settings[branch][fileOffset] !== null) {
							throw new Error(`Invalid optional ${branch} file file at offset #${fileOffset} - specify string paths or "null" for optional file slots`);
						} else {
							throw new Error(`Invalid ${branch} file at offset #${fileOffset} - specify string paths or "null" for optional file slots`);
						}
					})
				});
			})
			// }}}
			// Parse config or apply defaults {{{
			.then(()=> settings.resolveConfig && app.resolveConfig(settings.config).then(res => settings.config = res))
			// }}}
			// Pre-flight logging {{{
			.then(()=> {
				app.log('Run app');
				app.log('* Config =', settings.config);
				app.log('* Inputs =', settings.inputs.length);
				settings.inputs.forEach((input, inputOffset) => app.log(`* Input #${inputOffset} =`, input));
			})
			// }}}
			// Create workspace with input files {{{
			.then(()=> temp.mkdir({prefix: 'i3-'}).then(res => session.tempDir = res))
			.then(()=> Promise.all(app.manifest.inputs.map((input, inputOffset) => {
				switch (input.type) {
					case 'references':
						// Use RefLib to slurp files from source and spew into destination format {{{
						var reflibFormat = reflib.supported.find(rl => rl.id == input.format); // Find first supported Reflib format
						if (!reflibFormat) throw new Error(`Unsupported RefLib reference input format "${input.format}"`);
						app.log(`Converting input file #${inputOffset} from ${reflibFormat} -> ${input.format}`);
						return Promise.resolve()
							.then(()=> new Promise((resolve, reject) => {
								var refs = [];
								reflib.parseFile(settings.inputs[inputOffset])
									.on('ref', ref => refs.push(ref))
									.on('end', ()=> resolve(refs))
									.on('error', reject)
							}))
							.then(refs => new Promise((resolve, reject) => {
								reflib.outputFile(fspath.join(session.tempDir, input.filename), refs, input.reflib || {}, (err) => {
									if (err) return reject(err);
									app.log(`Converting input file #${inputOffset} ready`);
									resolve();
								});
							}))
						// }}}
						break;
					case 'spreadsheet':
						// FIXME: Provide support for XLSX input format etc. -> XLSX output
					case 'text':
					case 'other':
						// Other - Copy file from source -> dest {{{
						return new Promise((resolve, reject) => {
							fs.createReadStream(settings.inputs[inputOffset])
								.pipe(fs.createWriteStream(fspath.join(session.tempDir, input.filename)))
								.on('close', resolve)
								.on('error', reject)
						});
						// }}}
						break;
					default:
						throw new Error(`Unknown input type "${input.type}"`);
				}
			})))
			// }}}
			// Run Docker process {{{
			.then(()=> {
				// Compute the Docker arguments / environment objects {{{
				var templateArgs = {
					manifest: app.manifest,
					settings: settings.config,
					config: settings.config,
					inputs: app.manifest.inputs.map(input => ({
						...input,
						path: `${app.manifest.worker.mount || '/data'}/${input.filename}`,
					})),
					outputs: app.manifest.outputs.map(output => ({
						...output,
						path: `${app.manifest.worker.mount || '/data'}/${output.filename}`,
					})),
				};

				var entryArgs =
					_.isArray(app.manifest.worker.command) ? app.manifest.worker.command
						.map(arg => template(arg, templateArgs))
						.filter(i => i) // Remove empty
					: _.isString(app.manifest.worker.command) ? exec.split(template(app.manifest.worker.command, templateArgs))
					: false;
				if (!entryArgs) throw new Error('unknown command type for all');

				var entryEnv = _(app.manifest.worker.environment || {})
					.mapValues(v => template(v, templateArgs))
					.pickBy(v => v) // Remove empty
					.map((v, k) => `--env=${k}=${v}`)
					.value();
				// }}}

				return exec(_([
					'docker',
					'run',
					...i3.settings.docker.runArgs,

					// Environment variables
					entryEnv.length ? entryEnv : false,

					// Docker options including mounts
					['--volume', `${session.tempDir}:${app.manifest.worker.mount || '/data'}`],

					// Container name
					app.name,

					// Command line arguments for an optional entry point
					entryArgs.length ? entryArgs : false,
				])
					.flattenDeep()
					.filter() // Remove blanks
					.value()
				, {
					log: app.log.bind(app.log.colors.blue('[Docker/Run]')),
				})
			})
			// }}}
			// Process outputs {{{
			.then(()=> Promise.all(app.manifest.outputs.map((output, outputOffset) => {
				if (output === null) return; // File not required
				return new Promise((resolve, reject) => {
					fs.createReadStream(fspath.join(session.tempDir, output.filename))
						.pipe(fs.createWriteStream(settings.outputs[outputOffset]))
						.on('close', resolve)
						.on('error', reject)
				});
			})))
			// }}}
			// Generate output AppResponse object {{{
			.then(()=> ({
				app: app.manifest,
				config: settings.config,
				inputs: settings.inputs,
				outputs: settings.outputs,
			}))
			// }}}
			// Clean up {{{
			.finally(()=> session.tempDir && del(session.tempDir, {force: true}))
			// }}}
	};

	return app;
};

module.exports = I3App;