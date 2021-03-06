/*
 * Copyright 2014-2015 Workiva Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function(gulp, userConfig){
    var _ = require('lodash');
    var cwd = process.cwd();
    var glob = require('glob');
    var path = require('path');
    var getDeps = require('./src/depTreeParser');

    // Load default options from gulpconfig.json
    var defaultOptions = require('./src/gulpconfig.json');
    // Use user defined languages if provided, otherwise use defaults
    var languages = 'languages' in userConfig ? userConfig.languages : defaultOptions.languages;
    // Apply changes to options based on languages selected
    defaultOptions = require('./src/applyLanguageOptions')(defaultOptions, languages);
    // Merge user defined config with wGulp's default options
    var options = require('./src/mergeOptions')(userConfig, defaultOptions);

    // Is this a `dist` run? Check the sequence for 'dist'
    gulp.on('start', function(e){
        options.isDist = _.contains(e.message.split(','), 'dist');
    });

    // Echo a system bell on all errors to alert the user
    gulp.on('err', function(e){
        console.log("\u0007");
    });

    // Check for circular dependencies (cycles) in resulting taskTree
    function detectCycle(task, key, val){
        if(_.contains(val, task)){
            if(_.contains(getDeps(options, task), key)){
                console.log("Circular task dependency detected! \t" + task + " --> " + key);
            }
        }
    }
    _.forOwn(options.taskTree, function(val, key){
        val = getDeps(options, key);
        _.forOwn(options.taskTree, function(innerVal, innerKey){
            if(innerKey != key){
                detectCycle(innerKey, key, val);
            }
        });
    });

    // Put our custom describe method onto gulp
    gulp.desc = require('./src/desc');

    // Register task functions for exporting
    var sPath = './src/subtasks/';
    var subtasks = {
        analyze: require(sPath + 'analyze')(gulp, options),
        applyLicense: require(sPath + 'applyLicense')(gulp, options),
        clean: require(sPath + 'clean')(gulp, options),
        coffee: require(sPath + 'coffee')(gulp, options),
        compass: require(sPath + 'compass')(gulp, options),
        concat: require(sPath + 'concat')(gulp, options),
        connect: require(sPath + 'connect')(gulp, options),
        copy: require(sPath + 'copy')(gulp, options),
        jasmine: require(sPath + 'jasmine')(gulp, options),
        jsdoc: require(sPath + 'jsdoc')(gulp, options),
        jshint: require(sPath + 'jshint')(gulp, options),
        jsx: require(sPath + 'jsx')(gulp, options),
        livescript: require(sPath + 'livescript')(gulp, options),
        minify_css: require(sPath + 'minifyCss')(gulp, options),
        minify_js: require(sPath + 'minifyJs')(gulp, options),
        sass: require(sPath + 'sass')(gulp, options),
        tsc: require(sPath + 'tsc')(gulp, options),
        tslint: require(sPath + 'tslint')(gulp, options)
    };

    // Create tasks for each task function with default options
    _.forOwn(subtasks, function(val, key){
        key = key.replace('_', ':');

        var taskDeps = getDeps(options, key);
        gulp.task(key, taskDeps, val());
    });

    // Add runSequence function (not really a task/subtask)
    subtasks.runSequence = require(sPath + 'runSequence')(gulp, options);

    // Generate bundle tasks
    require('./src/bundling/buildBundleTasks')(gulp, options);

    // Create tasks in task folders
    function addTasks(folder) {
        var files = glob('*.js', {
            cwd: folder,
            sync: true
        });
        _.forEach(files, function(file){
            var taskName = file.replace(/\.js$/i, '');
            var taskPath = path.resolve(folder, taskName);
            require(taskPath)(gulp, options, subtasks);
        });
    };
    var globalTaskFolder = path.resolve(__dirname, 'src/tasks/');
    var projectTaskFolder = path.resolve(cwd, 'tasks/');
    addTasks(globalTaskFolder);
    addTasks(projectTaskFolder);

    // Add config to exports
    subtasks.config = options;

    // Expose getDeps in case consumers want to use it
    subtasks.getDeps = _.curry(getDeps)(options);

    return subtasks;
};
