//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2017 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: Templates_Html_Make.js - Make extension
// Project home: https://github.com/doodadjs/
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2015-2017 Claude Petit
//
//	Licensed under the Apache License, Version 2.0 (the "License");
//	you may not use this file except in compliance with the License.
//	You may obtain a copy of the License at
//
//		http://www.apache.org/licenses/LICENSE-2.0
//
//	Unless required by applicable law or agreed to in writing, software
//	distributed under the License is distributed on an "AS IS" BASIS,
//	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//	See the License for the specific language governing permissions and
//	limitations under the License.
//! END_REPLACE()

module.exports = {
	add: function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.Templates.Html.Make'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			dependencies: [
				'doodad-js-make',
				'doodad-js-minifiers',
				'doodad-js-templates',
			],
			
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";

				//===================================
				// Get namespaces
				//===================================
					
				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					nodejs = doodad.NodeJs,
					files = tools.Files,
					make = root.Make,
					io = doodad.IO,
					minifiers = io.Minifiers,
					templates = doodad.Templates,
					templatesHtml = templates.Html,
					templatesHtmlMake = templatesHtml.Make,
					
					nodeFs = require('fs');

				//===================================
				// Natives
				//===================================
					
				//types.complete(_shared.Natives, {
				//});
					
				//===================================
				// Internal
				//===================================
					
				const __Internal__ = {
				};
				
				
				templatesHtmlMake.REGISTER(make.Operation.$extend(
				{
					$TYPE_NAME: 'Compile',

					execute: doodad.OVERRIDE(function execute(command, item, /*optional*/options) {
						const Promise = types.getPromise();

						const source = this.taskData.parseVariables(item.source, { isPath: true });
						const dest = this.taskData.parseVariables(item.destination, { isPath: true });

						console.info(tools.format("Compiling template '~0~' to '~1~'...", [source, dest]));

						const variables = types.extend({
							task: command,
						}, types.get(item, 'variables'), types.get(options, 'variables'));

						return templatesHtml.compileTemplate(source, item)
							.thenCreate(function(code, resolve, reject) {
								const minify = types.get(item, 'minify', false);

								const outputStream = nodeFs.createWriteStream(dest.toApiString());

								const builder = new make.JavascriptBuilder({taskData: this.taskData, runDirectives: true, keepComments: !minify, keepSpaces: !minify});

								tools.forEach(variables, function(value, name) {
									builder.define(name, value);
								});

								const cleanup = function() {
									types.DESTROY(builder);
									types.DESTROY(outputStream);
								};

								builder.onError.attachOnce(this, function(ev) {
									cleanup();
									reject(ev.error);
								});

								outputStream
									.once('close', () => {
										cleanup();
										resolve();
									})
									.once('error', err => {
										cleanup();
										reject(err);
									});

								builder.pipe(outputStream);

								builder.write(code);
								builder.write(io.EOF);
							}, this);
					}),
				}));
				

				//===================================
				// Init
				//===================================
				//return function init(/*optional*/options) {
				//};
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()