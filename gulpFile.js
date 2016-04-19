var versionNumber = '1.15';

var gulp = require('gulp'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    gutil = require("gulp-util"),
    license = require('gulp-header-license'),
    replace = require('gulp-replace'),
    gulpDoxx = require('gulp-doxx'),
    clean = require('gulp-clean'),
    documentation = require('gulp-documentation'),
    fs = require("fs"),
    request = require("request");

/***** Build  *****/

gulp.task('cleanDist', function () {
    return gulp.src('dist', {read: false}).pipe(clean());
});

gulp.task('copy-files', ['cleanDist'], function() {
  return gulp.src(['src/tradable-embed.js'])
    .pipe(gulp.dest('dist'));
});

gulp.task('license-embed', ['copy-files'], function () {
    var year = (new Date()).getFullYear();
    return gulp.src('dist/tradable-embed.js')
            .pipe(license("/******  Copyright " + year + " Tradable ApS; @license MIT; v" + versionNumber + "  ******/"))
            .pipe(gulp.dest('./dist/'));
});

gulp.task('minify-js', ['license-embed'], function() {
  return gulp.src('dist/tradable-embed.js')
    .pipe(uglify({preserveComments: 'some'})) // keeps comments with @license
	  .pipe(rename(function (path) {
            if(path.extname === '.js') {
                path.basename += '.min';
            }
        }))
    .pipe(gulp.dest('dist'));
});

gulp.task('compress-copy', ['cleanDist', 'license-embed', 'minify-js', 'copy-files']);

/***** Docs generation  *****/

gulp.task('documentation', ['compress-copy'], function () {
  return gulp.src('src/tradable-embed.js')
    .pipe(documentation({ format: 'html' }))
    .pipe(gulp.dest('docs/html-documentation'));
});

var apiJsonArray;
gulp.task('loadJSONTemplates', ['documentation'], function() {
    var url = 'https://docs.tradable.com/json';
    return request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            apiJsonArray = body.objects[""];
            console.log("Objects template loaded..");
        } else {
            throw new gutil.PluginError({
              plugin: 'Error trying to load object template from endpoint',
              message: "Can't reach " +  url
            });
        }
    });
});

function getJSONTemplateForObject(objName) {
    for(i = 0 ; i < apiJsonArray.length ; i++) {
        if(apiJsonArray[i].name === objName) {
            return apiJsonArray[i].jsondocTemplate; // Print the json response
        }
    }
    throw new gutil.PluginError({
      plugin: 'Error trying to load object template',
      message: "CAUTION!!!! '" + objName + "' not in JSON template!"
    });
    return null;
}

gulp.task('buildDocs', ['loadJSONTemplates'], function(){
   var introContent = fs.readFileSync("docs/template/intro-embed.html", "utf8");
   return gulp.src(['docs/html-documentation/**'])
     .pipe(replace("<div class='px2'>", introContent + "<div class='px2'>"))
     .pipe(replace("trEmbDevVersionX", versionNumber))
     .pipe(replace("<h3 class='mb0 no-anchor'></h3>", "<h3 class='mb0 no-anchor'>tradable-embed-core</h3>")) // set title
     .pipe(replace("<div class='mb1'><code></code></div>", "<div class='mb1'><code>" + versionNumber + "</code></div>")) // set version
     .pipe(replace('[exampleiframe-begin]', '<iframe width="100%" height="300" allowfullscreen="allowfullscreen" frameborder="0" src="')) // prepare example iframes
     .pipe(replace('[exampleiframe-end]', '"></iframe>')) // prepare example iframes
     .pipe(replace(new RegExp(/(_object-begin_)(\w+)(_object-end_)/g), replacer))
     .pipe(gulp.dest('docs/html-documentation'));
});

function replacer(match, p1, p2, p3, offset, string) {
  return JSON.stringify(getJSONTemplateForObject(p2));
}

gulp.task('replace-version', ['documentation'], function(){//copy-docs
  return gulp.src(['dist/**'])
    .pipe(replace('trEmbDevVersionX', versionNumber))
    .pipe(gulp.dest('dist'));
});

gulp.task('generateDocs', ['documentation', 'loadJSONTemplates', 'buildDocs']);

gulp.task('buildSDK', ['compress-copy', 'replace-version', 'generateDocs']);

