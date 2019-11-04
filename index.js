var _ = require('lodash');
var colors = require('chalk');
var debug = require('debug')('i3');
var eventer = require('@momsfriendlydevco/eventer');

/**
* I3 main instance
* @emits log Emitted on any log event of this or any child class
*/
var I3Instance = function I3() {
	var i3 = this;

	i3.classes = {
		app: require('./lib/app'),
	};

	i3.settings = {
		docker: {
			runArgs: [], // Additional args to feed when running `docker build`
		},
	};


	/**
	* Debugger and general output function
	* With apps this is prefixed with the app name
	*/
	i3.log = (...msg) => {
		debug(...msg);
		return i3.emit('log', ...msg);
	};
	i3.log.colors = colors; // Convenience function to access coloring


	/**
	* Build an app from the path to a i3.json file, this can be a URL or local path
	* @param {string} path Path to the i3.json file (can also be a URL)
	* @returns {I3App} An I3 app instance
	*/
	i3.createApp = path => {
		var app = new i3.classes.app(i3);
		app.path = path;
		return app;
	};


	/**
	* Validate a manifest schema
	* @param {Object} manifest The input manifest object
	* @returns {Promise} A promise which will either return with the manifest object or throw with a CSV of errors
	*/
	i3.validateManifest = manifest => Promise.resolve()
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
						if (!_.has(i, f)) err.push(`Input #${index} should have a '${f}' field`);
					})

					if (i.type == 'references') {
						if (!_.has(i, 'filename')) err.push(`Input #${index} should specify a filename if the type is "references"`);
						if (!_.has(i, 'format')) err.push(`Input #${index} should specify a reference library format`);
					} else if (i.type == 'other') {
						if (!_.has(i, 'accepts')) err.push(`Input #${index} should specify a glob or array of globs if the type is "other"`);
					}
				});
			}
			// }}}

			// Check worker {{{
			if (manifest.worker.type == 'docker') {
				if (!_.has(manifest, 'worker.base')) err.push('If worker.container == "docker", worker.base must be specified');
				if (manifest.worker.build) {
					if (!_.isString(manifest.worker.build) && !_.isArray(manifest.worker.build)) err.push('worker.build must be a string or array of strings');
					if (_.isArray(manifest.worker.build) && !manifest.worker.build.every(i => _.isString(i))) err.push('All worker.build array items must be strings');
				}
				if (manifest.worker.command) {
					if (!_.isString(manifest.worker.command) && !_.isArray(manifest.worker.command)) err.push('worker.command must be a string or array of strings');
					if (_.isArray(manifest.worker.command) && !manifest.worker.command.every(i => _.isString(i))) err.push('All worker.command array items must be strings');
				}
			} else if (manifest.worker.type == 'url') {
				if (!_.has(manifest, 'worker.url')) err.push('If worker.container == "url", worker.url must be specified');
			} else {
				err.push('worker.type has an invalid worker type');
			}

			if (manifest.worker.environment) {
				if (!_.isPlainObject(manifest.worker.environment)) err.push('worker.envionment must be an object');
				if (_.every(manifest.worker.environment, (v, k) => _.isString(v) && _.isString(k))) err.push('worker.envionment must be an object of string key / values only');
			}
			// }}}

			// Check outputs {{{
			(manifest.outputs ? _.castArray(manifest.outputs) : []).forEach((i, index) => {
				['type'].forEach(f => {
					if (!_.has(i, f)) err.push({type: 'critical', text: `Output #${index} should have a '${f}' field`});
				})
			});
			// }}}

			if (errs.length) Promise.reject(errs.join(', '));
		}).then(()=> manifest);


	eventer.extend(i3);

	return i3;
};

module.exports = I3Instance();
