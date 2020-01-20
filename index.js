var _ = require('lodash');
var colors = require('chalk');
var crypto = require('crypto');
var debug = require('debug')('i3');
var eventer = require('@momsfriendlydevco/eventer');

/**
* I3 main instance
* @emits log Emitted on any log event of this or any child class
*/
class I3 extends eventer {
	constructor() {
		super();
		this.log.colors = colors;
	};

	/**
	* Available I3 classes
	* @var {Object}
	*/
	classes = {
		app: require('./lib/app'),
	};


	/**
	* Settings object
	* @var {Object}
	*/
	settings = {
		docker: {
			runArgs: [], // Additional args to feed when running `docker build`
		},
		apps: {
			cachePath: `${__dirname}/data/appCache`,
			appHasher: url => crypto
				.createHmac('sha256', '')
				.update(url)
				.digest('hex')
		},
	};


	/**
	* Debugger and general output function
	* With apps this is prefixed with the app name
	* Also includes the `log.colors` convience object which provides a Chalk instance
	*/
	log = (...msg) => {
		debug(...msg);
		return this.emit('log', ...msg);
	};


	/**
	* Build an app from the path to a i3.json file, this can be a URL or local path
	* @param {string} path Path to the i3.json file (can also be a URL)
	* @returns {I3App} An I3 app instance
	*/
	createApp = path => {
		var app = new this.classes.app(this);
		app.path = path;
		return app;
	};


	/**
	* Validate a manifest schema
	* @param {Object} manifest The input manifest object
	* @returns {Promise <Object>} A promise which will either return with the manifest object or throw with a CSV of errors
	*/
	validateManifest = manifest => Promise.resolve()
		.then(()=> {
			var errs = [];

			if (!manifest) Promise.reject('Not a JSON file');

			// Check for missing fields (dotted notation) {{{
			['name', 'version', 'description', 'license', 'inputs', 'outputs', 'worker']
				.filter(field => !_.has(manifest, field))
				.map(field => `Field "${field}" is missing from manifest`)
				.forEach(text => errs.push(text))
			// }}}

			// Check inputs {{{
			if (_.isUndefined(manifest.inputs)) {
				errs.push('The input array must be specified, even if it is an empty array');
			} else {
				(_.castArray(manifest.inputs)).forEach((i, index) => {
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
			if (manifest.worker.type == 'docker') {
				if (manifest.worker.build) {
					if (!_.isString(manifest.worker.build) && !_.isArray(manifest.worker.build)) errs.push('worker.build must be a string or array of strings');
					if (_.isArray(manifest.worker.build) && !manifest.worker.build.every(i => _.isString(i))) errs.push('All worker.build array items must be strings');
				}
				if (manifest.worker.command) {
					if (!_.isString(manifest.worker.command) && !_.isArray(manifest.worker.command)) errs.push('worker.command must be a string or array of strings');
					if (_.isArray(manifest.worker.command) && !manifest.worker.command.every(i => _.isString(i))) errs.push('All worker.command array items must be strings');
				}
			} else if (manifest.worker.type == 'url') {
				if (!_.has(manifest, 'worker.url')) errs.push('If worker.container == "url", worker.url must be specified');
			} else {
				errs.push('worker.type has an invalid worker type');
			}

			if (manifest.worker.environment) {
				if (!_.isPlainObject(manifest.worker.environment)) errs.push('worker.envionment must be an object');
				if (!_.every(manifest.worker.environment, (v, k) => _.isString(v) && _.isString(k))) errs.push('worker.envionment must be an object of string key / values only');
			}
			// }}}

			// Check outputs {{{
			(manifest.outputs ? _.castArray(manifest.outputs) : []).forEach((i, index) => {
				['type'].forEach(f => {
					if (!_.has(i, f)) errs.push({type: 'critical', text: `Output #${index} should have a '${f}' field`});
				})
			});
			// }}}

			if (errs.length) return Promise.reject(errs.join(', '));
		}).then(()=> manifest);
};

module.exports = new I3();
