var i3 = require('..');
var del = require('del');
var expect = require('chai').expect;
var fs = require('fs');
var temp = require('temp');

// FIXME: Not yet working - requires full RCT_Predictor app presence to work as the Dockerfile assumes all resources are present
describe('RCT Predictor', ()=> {

	var app;
	before('app init', function() {
		this.timeout(60 * 1000);

		return i3
		.createApp('https://github.com/ESHackathon/RCT_Predictor.git')
		.init()
		.then(res => app = res)
	});

	it('should be able to identify RCTs from a reference library', function() {
		var config = {
			inputs: [`${__dirname}/data/endnote-sm.xml`],
			outputs: [temp.path({prefix: 'i3-test-'})],
		};

		this.timeout(60 * 1000);

		return app.run(config)
			.then(res => {
				expect(res).to.be.an('object');
				expect(res).to.have.property('app');
				expect(res.app).to.be.equal(app.manifest);
				expect(res.config).to.be.a('object');
				expect(res.config).to.be.deep.equal({});
				expect(res.inputs).to.be.deep.equal(config.inputs);
				expect(res.outputs).to.be.deep.equal(config.outputs);
			})
			.then(()=> fs.promises.readFile(config.outputs[0]) // Check output file looks valid
				.then(res => JSON.parse(res))
				.then(refs => {
					expect(refs).to.have.length(5);
					refs.forEach(ref => {
						expect(ref).to.have.property('is_rct');
						expect(ref.is_rct).to.be.oneOf(['True', 'False', 'missing title and/or abstract']);
					});
				})
			)
			.finally(()=> del(config.outputs, {force: true}))
	});

});
