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
	createApp = path => new this.classes.app(this, path);

};

module.exports = new I3();
