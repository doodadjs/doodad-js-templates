//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2018 Claude Petit, licensed under Apache License version 2.0\n", true)
	// doodad-js - Object-oriented programming framework
	// File: Templates_Html_Make.js - Make extension
	// Project home: https://github.com/doodadjs/
	// Author: Claude Petit, Quebec city
	// Contact: doodadjs [at] gmail.com
	// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
	// License: Apache V2
	//
	//	Copyright 2015-2018 Claude Petit
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

/* eslint no-console: "off" */   // That's a CLI extension

//! IF_SET("mjs")
//! ELSE()
	"use strict";
//! END_IF()

exports.add = function add(modules) {
	modules = (modules || {});
	modules['Doodad.Templates.Html.Make'] = {
		version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
		dependencies: [
			{
				name: '@doodad-js/make',
				version: /*! REPLACE_BY(TO_SOURCE(VERSION('@doodad-js/make'))) */ null /*! END_REPLACE() */,
				type: /*! REPLACE_BY(TO_SOURCE(MAKE_MANIFEST("type", "@doodad-js/make"))) */ 'Package' /*! END_REPLACE()*/,
			},
			{
				name: '@doodad-js/templates',
				version: /*! REPLACE_BY(TO_SOURCE(VERSION('@doodad-js/templates'))) */ null /*! END_REPLACE() */,
				type: /*! REPLACE_BY(TO_SOURCE(MAKE_MANIFEST("type", "@doodad-js/templates"))) */ 'Package' /*! END_REPLACE()*/,
			},
		],

		create: function create(root, /*optional*/_options, _shared) {
			//===================================
			// Get namespaces
			//===================================

			const doodad = root.Doodad,
				types = doodad.Types,
				tools = doodad.Tools,
				resources = doodad.Resources,
				modules = doodad.Modules,
				//nodejs = doodad.NodeJs,
				//files = tools.Files,
				make = root.Make,
				file = make.File,
				//io = doodad.IO,
				//minifiers = io.Minifiers,
				templates = doodad.Templates,
				templatesHtml = templates.Html,
				templatesHtmlMake = templatesHtml.Make,
				xml = tools.Xml;


			//===================================
			// Natives
			//===================================

			//tools.complete(_shared.Natives, {
			//});

			//===================================
			// Internal
			//===================================

			const __Internal__ = {
				xsdWarned: false,
			};


			templatesHtmlMake.REGISTER(make.Operation.$extend(
				{
					$TYPE_NAME: 'Compile',

					execute: doodad.OVERRIDE(function execute(command, item, /*optional*/options) {
						//const Promise = types.getPromise();

						const source = this.taskData.parseVariables(item.source, { isPath: true });
						const dest = this.taskData.parseVariables(item.destination, { isPath: true });

						tools.log(tools.LogLevels.Info, "Compiling template '~0~' to '~1~'...", [source, dest]);

						if (!__Internal__.xsdWarned && !xml.isAvailable({schemas: true})) {
							__Internal__.xsdWarned = true;
							tools.log(tools.LogLevels.Warning, "*** Warning *** : XML validation by XSD schemas is not available. Please set the 'NODE_ENV' environment variable to 'development' to enable 'libxml2'.");
						};

						let promise;
						if (xml.isAvailable({messages: true})) {
							promise = Promise.resolve();
						} else {
							promise = resources.locate("common/res/Tools_Xml_Parsers_Libxml2_Errors.js", {module: '@doodad-js/xml'})
								.then(function(path) {
									return modules.load([{path}]);
								});
						};

						return promise.then(function thenCompileDdt() {
							const ddt = templatesHtml.DDT.$get(source, options);

							return ddt.open()
								.then(function(dummy) {
									const ddtType = ddt.doc.getRoot().getAttr('type');

									const variables = tools.extend({}, types.get(item, 'variables'), types.get(options, 'variables'), {
										ddtType: ddtType,
										cacheEnabled: ddt.cache,
										cacheDuration: ddt.cacheDuration,
										encoding: ddt.options.encoding,
										renderTemplateBody: ddt.toString('', true),
									});

									return {
										'class': file.Javascript,
										source: '~@doodad-js/templates/src/make/res/ddtx.templ.js',
										destination: dest,
										runDirectives: true,
										variables: variables,
									};
								}, null, this);
						});
					}),
				}));


			//===================================
			// Init
			//===================================
			//return function init(/*optional*/options) {
			//};
		},
	};
	return modules;
};
//! END_MODULE()
