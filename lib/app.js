var _ = require('lodash');
var axios = require('axios');
var exec = require('@momsfriendlydevco/exec');
var debugNoClean = require('debug')('i3:noClean');
var del = require('del');
var fs = require('fs');
var fspath = require('path');
var macgyver = require('@momsfriendlydevco/macgyver');
var temp = require('temp');
var template = require('@momsfriendlydevco/template');
var reflib = require('reflib');

var macgyverAppCount = 0;


/**
* An I3 App
* @param {I3} i3 The I3 parent instance
* @param {string} path The base path of the app (usually a file path on disk)
*/
class I3App {
	constructor(i3, path) {
		this.i3 = i3;
		this.path = path;
		this.log.warn = (...msg) => this.i3.log(this.i3.log.colors.blue(`[App / ${this.name || this.path || 'Unknown app'}]`), this.i3.log.colors.yellow('WARN'), ...msg);
		this.log.colors = this.i3.log.colors;
	};


	/**
	* Parent I3 instance
	* Defined on construction
	* @type {I3}
	*/
	i3;


	/**
	* Unique ID for this app instance
	* @type {string}
	*/
	id = `mgApp${macgyverAppCount++}`;


	/**
	* @type {string} During the build phrase this is the originally provided path to the source app, after build this should be the path on disk
	*/
	path;


	/**
	* @type {Object} The loaded app manifest
	*/
	manifest;


	/**
	* @type {string} Friendly name for this app
	*/
	name = `app-${Date.now()}-${_.random(100,999)}`; // Temporary name, hopefully replaced later with something logical


	/**
	* Debug output hook
	* This really just wraps the main I3 debug function with a prefix
	* This object also contains {warn, colors} convenience functions (see controller)
	* @param {*} [msg...] Output message components
	*/
	log = (...msg) => this.i3.log(this.i3.log.colors.blue(`[App / ${this.name || this.path || 'Unknown app'}]`), ...msg);


	/**
	* Initialize the app environment by fetching the manifest and parsing it
	* @param {object} [options] Options to use when building
	* @param {boolean} [options.validate=true] Validate the manifest, only disable this if you absolutely trust the app source
	* @param {boolean} [options.build=true] Automatically build the app, if falsy call I3App.build() manually
	* @returns {Promise<I3App>} A promise which will return the full app object when complete
	*/
	init = options => {
		var settings = {
			validate: true,
			build: true,
			...options,
		};

		return Promise.resolve()
			.then(()=> this.path || Promise.reject('No I3App.path specified'))
			.then(()=> {
				if ( // Load from Git
					/^git\+https?:\/\//.test(this.path) // git+http://*
					|| /^https:\/\/github.com\/.*\.git$/.test(this.path) // GitHubs weird thing
				) {
					var gitUrl = this.path;
					this.path = this.i3.settings.apps.cachePath
						+ '/'
						+ this.i3.settings.apps.appHasher(gitUrl);

					return Promise.resolve()
						.then(()=> fs.promises.mkdir(fspath.dirname(this.path), {recursive: true}))
						.then(()=> fs.promises.readdir(this.path)
							.then(()=> true)
							.catch(e => false)
						)
						.then(exists => {
							if (exists) {
								this.log('Using locally cached Git repo', this.log.colors.cyan(gitUrl), this.log.colors.gray(`(${this.path})`));
							} else {
								// App doesn't exist - go fetch it
								this.log('Fetching Git repo', this.log.colors.cyan(gitUrl));
								var tempDir = temp.path({prefix: 'i3-git-pull-', dir: this.i3.settings.apps.cachePath})

								return exec([
									'git',
									'clone',
									'--depth=1', // Only fetch most recent version
									gitUrl,
									tempDir,
								], {
									log: this.log.bind(this.log.colors.blue('[Docker/GitFetch]')),
								})
									.then(()=> fs.promises.readFile(`${tempDir}/i3.json`).catch(e => Promise.reject('No i3.json manifest found from pulled Git directory')))
									.then(()=> fs.promises.rename(tempDir, this.path)) // Passed basic test - splat to real location
									.catch(e => {
										del.sync(tempDir);
										throw e;
									})

							}
						})
						.then(()=> this.log('Fetching manifest path', this.log.colors.cyan(`${this.path}/i3.json`)))
						.then(()=> fs.promises.readFile(`${this.path}/i3.json`))
						.then(content => JSON.parse(content))
				} else if (/^https?:\/\//.test(this.path)) { // Load I3 manifest direct from URL
					this.log('Fetching manifest URL', this.log.colors.cyan(this.path));
					return axios.get(this.path)
						.then(res => res.data)
				} else {
					this.log('Fetching manifest path', this.log.colors.cyan(this.path));
					return fs.promises.readFile(this.path)
						.then(content => JSON.parse(content))
						.finally(()=> this.path = fspath.dirname(this.path))
				}
			})
			.then(manifest => {
				this.manifest = Object.freeze(manifest);
				if (settings.validate) {
					this.log('Validating manifest');
					return this.validateManifest();
				} else {
					this.log.warn('Skipping validation of manifest');
				}
			})
			.then(()=> this.name || Promise.reject('Cannot find minimum of `name` field in manifest, enable validation or validate the manifest manually'))
			.then(()=> this.name = this.manifest.name.replace(/[^a-z0-9_\-]+/ig, '_').replace(/^[\._\-]/, ''))
			.then(()=> settings.build && this.build())
			.then(()=> this)
	};


	/**
	* Validate a manifest schema
	* @returns {Promise} A promise which will return if the manifest validates or throws with a string of errors if not
	*/
	validateManifest = ()=> Promise.resolve()
		.then(()=> {
			var errs = [];

			if (!this.manifest) return Promise.reject('No manifest present');

			// Check for missing fields (dotted notation) {{{
			['name', 'version', 'description', 'license', 'inputs', 'outputs', 'worker']
				.filter(field => !_.has(this.manifest, field))
				.map(field => `Field "${field}" is missing from manifest`)
				.forEach(text => errs.push(text))
			// }}}

			// Check inputs {{{
			if (_.isUndefined(this.manifest.inputs)) {
				errs.push('The input array must be specified, even if it is an empty array');
			} else {
				(_.castArray(this.manifest.inputs)).forEach((i, index) => {
					['type'].forEach(f => {
						if (!_.has(i, f)) errs.push(`Input #${index} should have a '${f}' field`);
					})

					if (i.type == 'references') {
						if (!_.has(i, 'filename')) errs.push(`Input #${index} should specify a filename if the type is "references"`);
						if (!_.has(i, 'format')) errs.push(`Input #${index} should specify a reference library format`);
					} else if (i.type == 'other') {
						if (!_.has(i, 'accepts')) errs.push(`Input #${index} should specify a glob or array of globs if the type is "other"`);
					}
				});
			}
			// }}}

			// Check worker {{{
			if (this.manifest.worker.type == 'docker') {
				if (this.manifest.worker.build) {
					if (!_.isString(this.manifest.worker.build) && !_.isArray(this.manifest.worker.build)) errs.push('worker.build must be a string or array of strings');
					if (_.isArray(this.manifest.worker.build) && !this.manifest.worker.build.every(i => _.isString(i))) errs.push('All worker.build array items must be strings');
				}
				if (this.manifest.worker.command) {
					if (!_.isString(this.manifest.worker.command) && !_.isArray(this.manifest.worker.command)) errs.push('worker.command must be a string or array of strings');
					if (_.isArray(this.manifest.worker.command) && !this.manifest.worker.command.every(i => _.isString(i))) errs.push('All worker.command array items must be strings');
				}
			} else if (this.manifest.worker.type == 'url') {
				if (!_.has(this.manifest, 'worker.url')) errs.push('If worker.container == "url", worker.url must be specified');
			} else {
				errs.push('worker.type has an invalid worker type');
			}

			if (this.manifest.worker.environment) {
				if (!_.isPlainObject(this.manifest.worker.environment)) errs.push('worker.envionment must be an object');
				if (!_.every(this.manifest.worker.environment, (v, k) => _.isString(v) && _.isString(k))) errs.push('worker.envionment must be an object of string key / values only');
			}
			// }}}

			// Check outputs {{{
			(this.manifest.outputs ? _.castArray(this.manifest.outputs) : []).forEach((i, index) => {
				['type'].forEach(f => {
					if (!_.has(i, f)) errs.push({type: 'critical', text: `Output #${index} should have a '${f}' field`});
				})
			});
			// }}}

			if (errs.length) return Promise.reject(errs.join(', '));
		});


	/**
	* Build the app (using whatever means is specified)
	* @returns {Promise} A promise which will return when built or throw if an error occurs during the build process
	*/
	build = ()=> Promise.resolve()
		.then(()=> this.manifest || Promise.reject('Manifest not yet loaded, call I3App.init(path) first'))
		.then(()=> {
			if (this.manifest.worker.type == 'url') {
				// type=='url' {{{
				return; // Nothing to do, its a remote URL anyway
				// }}}
			} else if (this.manifest.worker.type == 'docker' && this.manifest.worker.base) {
				// type=='docker' (build using base from `this.manifest.{base,build}`) {{{
				var dockerFile = ''
					+ `FROM ${this.manifest.worker.base}\n`
					+ `WORKDIR ${this.manifest.worker.mountApp || '/app'}\n\n`
					+ (this.manifest.worker.build ? '\n# Build steps\n' : '')
					+ _.castArray(this.manifest.worker.build)
						.map(cmd => `RUN ${cmd}`)
						.join('\n') + '\n'

				this.log('Build docker image', this.log.colors.cyan(this.name), this.log.colors.gray(`(from base image "${this.manifest.worker.base}")`));

				return exec([
					'docker',
					'build',
					...this.i3.settings.docker.runArgs,
					`--tag=${this.name}`,
					'-',
				], {
					log: this.log.bind(this.log.colors.blue('[Docker/Build]')),
					stdin: dockerFile,
					cwd: this.path,
				})
				// }}}
			} else if (this.manifest.worker.type == 'docker') {
				// type=='docker' (using Dockerfile) {{{
				this.log('Build docker image', this.log.colors.cyan(this.name), this.log.colors.gray('(from Dockerfile)'));

				var dockerFilePath = fspath.join(this.path, 'Dockerfile');
				return fs.promises.readFile(dockerFilePath)
					.then(dockerFile => exec([
						'docker',
						'build',
						...this.i3.settings.docker.runArgs,
						`--tag=${this.name}`,
						'.',
					], {
						log: this.log.bind(this.log.colors.blue('[Docker/Build]')),
						stdin: dockerFile,
						cwd: this.path,
					}))
					.catch(e => {
						if (e.errno && e.errno == -2) {
							throw new Error(`Cannot find Dockerfile at "${dockerFilePath}"`);
						} else {
							throw e;
						}
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
	* Automatically conduceted by I3App.run()
	* @param {Object} config The input config
	* @returns {Promise} A promise which will either resolve with the computed full config object or throw with a validation message
	*/
	resolveConfig = config => Promise.resolve()
		.then(()=> macgyver.forms.setConfig(this.id, this.manifest.config))
		.then(()=> macgyver.forms.setData(this.id, config))
		.then(()=> macgyver.forms.validate(this.id, this.manifest.config))
		.then(()=> _.merge(macgyver.forms.getPrototype(this.id), config))


	/**
	* AppResponse object
	* Returned by I3App.run()
	* @typedef {Object} AppResponse
	* @property {Object} app The app manifest used, since I3App.manifest is frozen this cannot be mutated
	* @property {Object} config The input config
	* @param {array<string|null>} inputs Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional)
	* @param {array<string|null>} outputs Array of generated output files, either the path to the file on disk or `null` if the output was not requested
	* @see I3App.run()
	*/


	/**
	* Execute this app instance within a Docker container using predefined config
	* @param {Object} [options] Setttings to pass when running
	* @param {Object} [options.resolveConfig] Run config via I3App.resolveConfig()
	* @param {Object} [options.config] Settings config object, defaults will be auto-computed and inserted
	* @param {array<string|null>} [inputs] Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional)
	* @param {array<string|null>} [outputs] Array of output file destinations, either the path to the file on disk or `null` if not specified (i.e. file is optional and not required)
	* @returns {Promise<AppResponse>} A Promise which resolves to an AppResponse object
	*/
	run = options => {
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
			.then(()=> this.manifest || Promise.reject('Manifest not yet loaded, call I3App.init(path) first'))
			.then(()=> {
				['inputs', 'outputs'].forEach(branch => {
					this.manifest[branch].forEach((file, fileOffset) => {
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
			.then(()=> settings.resolveConfig && this.resolveConfig(settings.config).then(res => settings.config = res))
			// }}}
			// Pre-flight logging {{{
			.then(()=> {
				this.log('Run app');
				this.log('* Config =', settings.config);
				this.log('* Inputs =', settings.inputs.length);
				settings.inputs.forEach((input, inputOffset) => this.log(`* Input #${inputOffset} =`, input));
			})
			// }}}
			// Create workspace with input files {{{
			.then(()=> temp.mkdir({prefix: 'i3-'}).then(res => session.tempDir = res))
			.then(()=> Promise.all(this.manifest.inputs.map((input, inputOffset) => {
				switch (input.type) {
					case 'references':
						// Use RefLib to slurp files from source and spew into destination format {{{
						var reflibFormat = reflib.supported.find(rl => rl.id == input.format); // Find first supported Reflib format
						if (!reflibFormat) throw new Error(`Unsupported RefLib reference input format "${input.format}"`);
						var outPath = fspath.join(session.tempDir, input.filename);
						this.log('Converting input file', this.log.colors.cyan(`#${inputOffset}`), '"' + this.log.colors.cyan(settings.inputs[inputOffset]) + '"', '->', this.log.colors.cyan(outPath), this.log.colors.gray(`(as ${reflibFormat.name})`));
						return Promise.resolve()
							.then(()=> new Promise((resolve, reject) => {
								var refs = [];
								reflib.parseFile(settings.inputs[inputOffset])
									.on('ref', ref => refs.push(ref))
									.on('end', ()=> resolve(refs))
									.on('error', reject)
							}))
							.then(refs => new Promise((resolve, reject) => {
								reflib.outputFile(outPath, refs, input.reflib || {}, (err) => {
									if (err) return reject(err);
									this.log('Finished convert of input file', this.log.colors.cyan(`#${inputOffset}`));
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
					manifest: this.manifest,
					settings: settings.config,
					config: settings.config,
					inputs: this.manifest.inputs.map(input => ({
						...input,
						path: `${this.manifest.worker.mountData || '/data'}/${input.filename}`,
					})),
					outputs: this.manifest.outputs.map(output => ({
						...output,
						path: `${this.manifest.worker.mountData || '/data'}/${output.filename}`,
					})),
				};

				var entryArgs =
					_.isArray(this.manifest.worker.command) ? this.manifest.worker.command
						.map(arg => template(arg, templateArgs))
						.filter(i => i) // Remove empty
					: _.isString(this.manifest.worker.command) ? exec.split(template(this.manifest.worker.command, templateArgs))
					: false;
				if (!entryArgs) throw new Error('unknown command type for all');

				var entryEnv = _(this.manifest.worker.environment || {})
					.mapValues(v => template(v, templateArgs))
					.pickBy(v => v) // Remove empty
					.map((v, k) => `--env=${k}=${v}`)
					.value();
				// }}}

				return exec(_([
					'docker',
					'run',
					...this.i3.settings.docker.runArgs,

					// Environment variables
					entryEnv.length ? entryEnv : false,

					// Docker options including mounts
					['--volume', `${session.tempDir}:${this.manifest.worker.mountData || '/data'}`],

					// Container name
					this.name,

					// Command line arguments for an optional entry point
					entryArgs.length ? entryArgs : false,
				])
					.flattenDeep()
					.filter() // Remove blanks
					.value()
				, {
					log: this.log.bind(this.log.colors.blue('[Docker/Run]')),
				})
			})
			// }}}
			// Process outputs {{{
			.then(()=> Promise.all(this.manifest.outputs.map((output, outputOffset) => {
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
				app: this.manifest,
				config: settings.config,
				inputs: settings.inputs,
				outputs: settings.outputs,
			}))
			// }}}
			// Clean up {{{
			.finally(()=> {
				if (!session.tempDir) return; // Nothing to remove anyway
				if (debugNoClean.enabled) {
					this.log(this.log.colors.red.bold('WARN'), 'Not cleaning up temporary app space due to flag');
					this.log(' * App directory =', this.log.colors.cyan(session.tempDir));
				} else {
					return del(session.tempDir, {force: true})
				}
			})
			// }}}
	};
};

module.exports = I3App;
