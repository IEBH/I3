var i3 = require('..');
var del = require('del');
var expect = require('chai').expect;
var fs = require('fs');
var temp = require('temp');

describe('@iebh/i3-data-shuffler', ()=> {

	var app;
	before('app init', function() {
		return i3
		.createApp('https://github.com/IEBH/I3-data-shuffler.git')
		.init({
			validate: false, build: false, // We conduct these phases manually below so we can track for debugging
		})
		.then(res => app = res)
	});

	before('app validateManifest', ()=>
		app.validateManifest(app.manifest)
			.catch(e => expect.fail(e))
	);

	before('app build', function() {
		this.timeout(60 * 1000);
		return app.build();
	});

	it('should have processed the manifest', ()=> {
		expect(app).to.be.an('object');
		expect(app).to.have.property('path');

		expect(app.manifest).to.be.an('object');
		expect(app.manifest).to.have.property('name');
		expect(app.manifest).to.have.property('worker');
		expect(app.manifest).to.have.nested.property('worker.type');
	});

	it('should validate config', ()=>
		app.resolveConfig().then(config => {
			expect(config).to.be.deep.equal({ // App defaults should have been populated
				shuffleOrder: true,
				deletePercent: 20,
			});
		})
	);

	it('should be able to run a basic operation', function() {
		var config = {
			inputs: [`${__dirname}/data/references.csv`],
			outputs: [temp.path({prefix: 'i3-test-'})],
		};

		this.timeout(20 * 1000);

		return app.run(config)
			.then(res => {
				expect(res).to.be.an('object');
				expect(res).to.have.property('app');
				expect(res.app).to.be.equal(app.manifest);
				expect(res.config).to.be.a('object');
				expect(res.config).to.be.deep.equal({shuffleOrder: true, deletePercent: 20}); // App defaults even though we fed in `{}`
				expect(res.inputs).to.be.deep.equal(config.inputs);
				expect(res.outputs).to.be.deep.equal(config.outputs);
			})
			.then(()=> fs.promises.readFile(config.outputs[0], 'utf-8') // Check output file looks valid
				.then(res => res.split('\n'))
				.then(lines => {
					expect(lines).to.have.length.above(1000);
					expect(lines).to.have.length.below(1989); // Input file has 1989, at least some lines should have been removed
				})
			)
			.finally(()=> del(config.outputs, {force: true}))
	});

});
