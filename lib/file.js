var _ = require('lodash');
var axios = require('axios');
var fs = require('fs');
var fspath = require('path');

module.exports = class I3File {
	constructor(path) {
		if (path) this.setPath(path);
	};


	/**
	* Set paths locally depending on resource type
	* If the incomming path looks like a URL then pathUrl is set, otherwise pathLocal
	* @param {string} path The path, either local or URL to set
	* @returns {I3File} This chainable file instance
	*/
	setPath(path) {
		if (/^https?:\/\//.test(path)) {
			this.pathUrl = path;
		} else {
			this.pathLocal = path;
		}
		return this;
	};


	/**
	* Get whichever file protocol is available
	* Typically this is used for logging and not much use as a worker without calling `ensureLocal()` / `ensureUrl()`
	* @returns {string} The file path to use for this file
	*/
	getPath() {
		return this.pathLocal || this.pathUrl;
	};


	/**
	* Local path of the file (if any)
	* @see ensurePath()
	* @type {string}
	*/
	pathLocal;


	/**
	* Publically exposed file via Url (if any)
	* @see ensureUrl()
	* @type {string}
	*/
	pathUrl;


	/**
	* Request that the file is available locally
	* @param {string} root Root directory to save paths in if they are not already local
	* @param {string} filename Filename to use if local, otherwise a random name is generated
	* @returns {Promise<string>} A promise which will resolve with the local file path (also available as `pathLocal`)
	*/
	ensureLocal(root, filename) {
		if (this.pathLocal) {
			return Promise.resolve(this.pathLocal); // Already available locally
		} else if (this.pathUrl) { // Available as URL - go fetch it
			if (!root || !filename) throw new Error('ensureLocal(root, filename) root+filename must both be specified when asking for local file');
			this.pathLocal = fspath.join(root, filename);

			return Promise.resolve()
				.then(()=> this.log('Downloading input file', this.log.colors.cyan(this.pathUrl), '->', this.log.colors.cyan(this.pathLocal)))
				.then(()=> axios({
					method: 'get',
					url: input,
					responseType: 'stream',
				}))
				.then(res => new Promise((resolve, reject) => res.data.pipe(
					fs.createWriteStream(this.pathLocal)
						.on('close', ()=> {
							this.log('Finished downloading input file', this.log.colors.cyan(this.pathUrl));
							resolve();
						})
						.on('error', e => reject(`Error downloading input file - ${this.pathUrl} - ${e.toString()}`))
				)))
				.then(()=> this.pathLocal)
		} else {
			throw new Error('FIXME: ensureLocal() cannot resolve unknown file protocols must be already local or a URL');
		}
	};


	/**
	* Request that the file is available remotely as a URL
	* @returns {Promise<string>} A promise which will resolve with the file URL (also available as `pathUrl`)
	*/
	ensureUrl() {
		if (this.pathUrl) return Promise.resolve(this.pathUrl); // Already available remotely
		throw new Error('FIXME: ensureUrl() is not yet supported to convert local -> remote paths');
	};


	/**
	* Check if the output URL endpoint has been populated
	* This is just the full file path with the suffix `/stats` and is expected to return an object containing `{exists: Boolean}`
	* @returns {Promise<boolean>} A promise which will resolve if the endpoint exists
	*/
	poll() {
		if (!this.pathUrl) throw new Error('Cannot poll output path on-non URLs');
		return axios.get(`${this.pathUrl}/stats`)
			.then(res => res.data ? res : Promise.reject('Non-JSON response from file.poll()'))
			.then(res => _.isBoolean(res.data.exists) ? res.data.exists : Promise.reject('Expected object from file.poll() that contains {exists: Boolean}'))
	};
};
