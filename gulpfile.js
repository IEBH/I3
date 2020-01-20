var fs = require('fs');
var gulp = require('@momsfriendlydevco/gulpy');
var jsDoc2MD = require('jsdoc-to-markdown')

gulp.task('default', ['build']);
gulp.task('build', ['build:docs']);

gulp.task('build:docs', ()=>
	jsDoc2MD.render({
		files: ['index.js', 'lib/*.js'],
	})
		.then(content => fs.promises.writeFile('API.md', content))
);
