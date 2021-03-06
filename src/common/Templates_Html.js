//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2018 Claude Petit, licensed under Apache License version 2.0\n", true)
	// doodad-js - Object-oriented programming framework
	// File: Templates_Html.js - Templates module
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

//! IF_SET("mjs")
//! ELSE()
	"use strict";
//! END_IF()

exports.add = function add(modules) {
	modules = (modules || {});
	modules['Doodad.Templates.Html'] = {
		version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
		//dependencies: [
		//],
		namespaces: ['DDTX'],
		create: function create(root, /*optional*/_options, _shared) {
			//===================================
			// Get namespaces
			//===================================

			const doodad = root.Doodad,
				types = doodad.Types,
				tools = doodad.Tools,
				html = tools.Html,
				widgets = doodad.Widgets,
				//safeEval = tools.SafeEval,
				namespaces = doodad.Namespaces,
				modules = doodad.Modules,
				resources = doodad.Resources,
				files = tools.Files,
				//config = tools.Config,
				xml = tools.Xml,
				templates = doodad.Templates,
				templatesHtml = templates.Html,
				templatesDDTX = templatesHtml.DDTX;


			const __Internal__ = {
				templatesCached: tools.nullObject(),
				ddtxCache: tools.nullObject(),

				buildFiles: new types.Map(),  // <FUTURE> Global to thread
			};


			//===================================
			// Options
			//===================================

			const __options__ = tools.extend({
				enableAsyncAwait: false, // false = To be compatible with Node.js < v 8
			}, _options);

			__options__.enableAsyncAwait = types.toBoolean(__options__.enableAsyncAwait);

			types.freezeObject(__options__);

			templatesHtml.ADD('getOptions', function getOptions() {
				return __options__;
			});


			//===================================
			// useAsyncAwait flag
			//===================================


			templatesHtml.ADD('useAsyncAwait', (__options__.enableAsyncAwait && types.hasAsyncAwait() ? function useAsyncAwait() {
				return true;
			} : function useAsyncAwait() {
				return false;
			}));

			//===================================
			// ClientScripts
			//===================================

			templatesHtml.REGISTER(doodad.Object.$extend(
				doodad.MixIns.Events,
				{
					$TYPE_NAME: 'BuildFile',

					onApply: doodad.PUBLIC(doodad.EVENT()),  // function(ev)

					apply: doodad.PUBLIC(function apply(scripts) {
						const ev = new doodad.Event({scripts});
						this.onApply(ev);
					}),
				}));

			templatesHtml.REGISTER(doodad.Object.$extend(
				{
					$TYPE_NAME: 'ClientScripts',

					scripts: doodad.PROTECTED(null),

					create: doodad.OVERRIDE(function create() {
						this._super();
						this.scripts = new types.Map();
					}),

					get: doodad.PUBLIC(function get() {
						return [...(this.scripts.entries())];
					}),

					register: doodad.PUBLIC(function register(srcs, /*optional*/options) {
						srcs = (types.isArray(srcs) ? srcs : [srcs]);
						options = tools.nullObject(options);
						tools.forEach(srcs, (src) => this.scripts.set(types.toString(src), options));
					}),
				}));

			//===================================
			// TemplateBase
			//===================================

			templatesHtml.REGISTER(doodad.BASE(widgets.Widget.$extend(
				{
					$TYPE_NAME: 'TemplateBase',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('TemplateBase')), true) */,

					$onUnload: doodad.EVENT(false),

					$options: doodad.PUBLIC(doodad.READ_ONLY( {} )),

					renderTemplate: doodad.PROTECTED(doodad.ASYNC(doodad.MUST_OVERRIDE())),  // function()

					render: doodad.OVERRIDE(function render() {
						return this.renderTemplate()
							.then(function() {
								// Flush buffer
								return this.writeAsync(null, {flush: true});
							}, null, this);
					}),

					// <PRB> Because of async/await, the following must be all PUBLIC...

					$getLocals: doodad.TYPE(doodad.PUBLIC(function $getLocals() {
						return {
							root,
							doodad,
							types,
							tools,
							Promise: types.getPromise(),
						};
					})),

					$getCreateEvalExpr: doodad.TYPE(doodad.PUBLIC(function $getCreateEvalExpr(page, locals) {
						return (function _createEvalExpr(dynVars) {
							let evalFn = null;
							const evalExpr = function _evalExpr(expr, /*optional*/refresh) {
								if (evalExpr.forceRefresh) {
									refresh = true;
									evalExpr.forceRefresh = false;
								};
								if (refresh) {
									evalFn = null;
								};
								let fn = evalFn;
								if (!evalFn) {
									const variables = tools.nullObject(page.options.variables, evalExpr.dynVars, locals);
									fn = tools.createEval(types.keys(variables)).apply(null, types.values(variables));
								};
								const result = (expr ? fn(expr) : undefined);
								if (!evalFn && !refresh) {
									evalFn = fn;
								};
								return result;
							};
							evalExpr.dynVars = dynVars;
							evalExpr.forceRefresh = false;
							return evalExpr;
						});
					})),

					asyncRunBuildFiles: doodad.PUBLIC(function asyncRunBuildFiles(files, evalExpr) {
						const Promise = types.getPromise();
						return Promise.map(files, function(file) {
							let promise;
							if (file.module) {
								promise = resources.locate(file.path, {module: file.module});
							} else {
								promise = Promise.resolve(file.path);
							};
							return promise.then(function(path) {
								const pathStr = types.toString(path);
								let buildFile = __Internal__.buildFiles.get(pathStr);
								let promise;
								if (buildFile) {
									promise = Promise.resolve();
								} else {
									buildFile = new templatesHtml.BuildFile();
									promise = modules.load([{path}], {startup: {secret: _shared.SECRET}, 'Doodad.Templates.Html': {buildFile}})
										.then(function() {
											__Internal__.buildFiles.set(pathStr, buildFile);
										}, null, this);
									//.catch(function(ex) {
									//	throw ex;
									//});
								};
								promise = promise.then(function() {
									const scripts = new templatesHtml.ClientScripts();
									buildFile.apply(scripts);
									let promise = Promise.resolve();
									tools.forEach(scripts.get(), function(item) {
										const src = item[0];
										const options = item[1];
										promise = promise.then(() => this.writeAsync('<script' + (options.async ? ' async' : '')));
										promise = promise.then(() => this.compileAttr('src', evalExpr('modulesUri.combine(' + tools.toSource(src) + ')', false)));
										if (file.integrity) {
											promise = promise.then(() => this.compileIntegrityAttr('integrity', file.integrity, 'src'));
										};
										if (file.mjs || src.endsWith('.mjs')) {
											promise = promise.then(() => this.compileAttr('type', 'module'));
										};
										promise = promise.then(() => this.asyncWriteAttrs());
										promise = promise.then(() => this.writeAsync('></script>'));
									}, this);
									return promise;
								}, null, this);
								return promise;
							}, null, this);
						}, {concurrency: 1, thisObj: this});
					}),

					compileAttr: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, value)
					compileIntegrityAttr: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()), // function(key, value, src)

					asyncForEach: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(items, fn)
					asyncInclude: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(fn)
					asyncScript: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(fn)
					asyncLoad: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(options, mods, defaultIntegrity, doodadPackageUrl, bootTemplateUrl)
					asyncWriteAttrs: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function()
					asyncCache: doodad.PUBLIC(doodad.ASYNC(doodad.NOT_IMPLEMENTED())), // function(id, duration, fn)
				})));


			__Internal__.surroundAsync = function surroundAsync(code) {
				return (templatesHtml.useAsyncAwait() ? 'await ' + code : 'pagePromise = pagePromise.then(function() {return ' + code + '}, null, this);');
			};

			templatesHtml.ADD('DDI', types.CustomEventTarget.$inherit(
				/*typeProto*/
				{
					$TYPE_NAME: 'DDI',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('DDI')), true) */,

					$get: function $get(path, type, /*optional*/options) {
						const key = path.toString();

						let ddi;
						if (types.has(__Internal__.templatesCached, key)) {
							//console.log('CACHED ' + key);
							ddi = __Internal__.templatesCached[key];

						} else {
							ddi = new this(path, type, options);

							__Internal__.templatesCached[key] = ddi;

							if (root.getOptions().debug) {
								const deleteFn = function _deleteFn(key, ddi) {
									if (key in __Internal__.templatesCached) {
										delete __Internal__.templatesCached[key];
										tools.forEach(ddi.parents, function(key, ddi) {
											deleteFn(key, ddi);
										});
										ddi.dispatchEvent(new types.CustomEvent('unload'));
									};
								};

								try {
									files.watch(path, function watchFileCallback() {
										deleteFn(key, ddi);
									}, {once: true});
								} catch(ex) {
									// Do nothing
								};
							};
						};

						return ddi;
					},
				},
				/*instanceProto*/
				{
					onunload: null, // "unload" event

					name: null,
					path: null,
					doc: null,
					type: null,
					options: null,
					codeParts: null,
					parents: null,
					cache: true,
					cacheDuration: 'P1D',

					parse: function parse() {
						/* eslint no-useless-concat: "off" */

						const Promise = types.getPromise();

						return Promise.try(function() {
							const DDI_URI = "http://www.doodad-js.local/schemas/ddi";
							const DDT_URI = "http://www.doodad-js.local/schemas/ddt";
							const HTML_URI = "http://www.doodad-js.local/schemas/html5";

							const DEFAULT_DOODAD_PKG_URL = '?res=@doodad-js/core/core.min.js';
							const DEFAULT_BOOT_TEMPL_URL = '?res=@doodad-js/templates/Boot.min.js';

							const RESERVED_OBJ_PROPS = ['__proto__', 'toString', 'toValue', 'toJSON', 'toSource'];

							const doctype = this.doc.getDocumentType() && tools.trim(this.doc.getDocumentType().getValue()).split(' ');
							if (!doctype || (doctype[0].toLowerCase() !== this.type)) {
								throw new types.ParseError("Document type is missing or invalid.");
							};

							const ddi = this.doc.getRoot(),
								self = this,
								codeParts = self.codeParts;

							const getAttrValue = function _getAttrValue(attrs, name, type, defaultValue, exprIsValid) {
								const result = attrs.find(name);
								let isExpr = false;
								let value = null;
								if (result.length > 0) {
									const attr = result[0];
									value = attr.getValue();
									if (attr.getBaseURI() === DDT_URI) {
										if (exprIsValid) {
											isExpr = true;
										} else {
											value = defaultValue;
										};
									};
								} else {
									value = defaultValue;
								};
								if (type && !isExpr) {
									value = type(value);
								};
								return [value, isExpr];
							};


							// Values only
							let cache = types.toBoolean(self.cache),
								cacheDuration = types.toString(self.cacheDuration),
								defaultIntegrity = null;

							// Expressions or values
							let doodadPackageUrl = null,
								doodadPackageUrlIsExpr = false,
								bootTemplateUrl = null,
								bootTemplateUrlIsExpr = false;

							if (self.type === 'ddt') {
								const attrs = ddi.getAttrs();

								[cache] = getAttrValue(attrs, 'cache', types.toBoolean, cache, false);
								[cacheDuration] = getAttrValue(attrs, 'cacheDuration', types.toString, cacheDuration, false);
								[defaultIntegrity] = getAttrValue(attrs, 'defaultIntegrity', types.toString, '', false);

								[doodadPackageUrl, doodadPackageUrlIsExpr] = getAttrValue(attrs, 'doodadPackageUrl', types.toString, DEFAULT_DOODAD_PKG_URL, true);
								[bootTemplateUrl, bootTemplateUrlIsExpr] = getAttrValue(attrs, 'bootTemplateUrl', types.toString, DEFAULT_BOOT_TEMPL_URL, true);
							};


							const writeHTML = function _writeHTML(state) {
								if (state.html) {
									state.writes += tools.toSource(state.html) + ' + ';
									state.html = '';
								};
							};

							const fnHeader = function _fnHeader() {
								if (!templatesHtml.useAsyncAwait()) {
									codeParts[codeParts.length] = "let pagePromise = Promise.resolve();";
								};

								// Expressions
								codeParts[codeParts.length] = "const dynVars = tools.nullObject(oldDynVars);";
								codeParts[codeParts.length] = "const evalExpr = createEvalExpr(dynVars);";
							};

							const startFn = function _startFn(...argNames) {
								codeParts[codeParts.length] = '(function(oldDynVars) {';
								if (templatesHtml.useAsyncAwait()) {
									codeParts[codeParts.length] = 'return (async function(' + argNames.join(', ') + ') {';
								} else {
									codeParts[codeParts.length] = 'return (function(' + argNames.join(', ') + ') {';
								};
								fnHeader();
							};

							const startAsync = function _startAsync(code) {
								if (templatesHtml.useAsyncAwait()) {
									return 'await ' + code;
								} else {
									return 'pagePromise = pagePromise.then(function() {return ' + code;
								};
							};

							const endAsync = function _endAsync(/*optional*/code) {
								if (templatesHtml.useAsyncAwait()) {
									return (code || '');
								} else {
									return (code || '') + '}, null, this);';
								};
							};

							const fnFooter = function _fnFooter() {
								if (!templatesHtml.useAsyncAwait()) {
									codeParts[codeParts.length] = 'return pagePromise;';
								};
							};

							const endFn = function _endFn() {
								fnFooter();
								codeParts[codeParts.length] = '})';
								codeParts[codeParts.length] = '})(dynVars)';
							};

							const writeAsyncWrites = function _writeAsyncWrites(state) {
								if (state.writes) {
									codeParts[codeParts.length] = __Internal__.surroundAsync('page.writeAsync(' + state.writes.slice(0, -3) + ');');   // remove extra " + "
									state.writes = '';
								};
							};

							const prepareExpr = function _prepareExpr(expr, /*optional*/refresh) {
								return 'evalExpr(' + tools.toSource(expr) + ', ' + tools.toSource(types.toBoolean(refresh)) + ')';
							};

							const getExprFromAttrVal = function _getExprFromAttrVal(attrVal, isExpr) {
								return (isExpr ? 'types.toString(' + prepareExpr(attrVal, false) + ')' : tools.toSource(attrVal));
							};

							const reduceStateOptions = function _reduceStateOptions(options) {
								return '{' + tools.reduce(options, function(result, val, name) {
									if (types.isJsObject(val)) {
										return result + ',' + tools.toSource(name) + ':' + reduceStateOptions(val);
									} else {
										return result + ',' + tools.toSource(name) + ':' + getExprFromAttrVal(...val);
									};
								}, '').slice(1) + '}';
							};

							const insertCharset = function _insertCharset(state) {
								state.html += '<meta charset="UTF-8"/>';
							};

							const insertClientScripts = function _insertClientScripts(state) {
								writeHTML(state);
								writeAsyncWrites(state);
								codeParts[codeParts.length] = __Internal__.surroundAsync("page.asyncRunBuildFiles(" + tools.toSource(state.buildFiles, {depth: 2, itemsCount: Infinity}) + ", evalExpr);");
							};

							const insertModules = function _insertModules(state) {
								if (state.modules) {
									writeHTML(state);
									writeAsyncWrites(state);
									codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncLoad(' + reduceStateOptions(state.options) + ',' + tools.toSource(state.modules, {depth: 5, itemsCount: Infinity}) + ',' + tools.toSource(defaultIntegrity) + ',' + getExprFromAttrVal(doodadPackageUrl, doodadPackageUrlIsExpr) + ',' + getExprFromAttrVal(bootTemplateUrl, bootTemplateUrlIsExpr) + ');');
									state.modules = null;
								};
							};


							// TODO: Possible stack overflow ("parseNode" is recursive) : Rewrite in a while loop ?
							// TODO: SafeEval on expressions

							const preParse = function _preParse(node, state) {
								return Promise.try(function tryPreParse() {
									const promises = [];
									node.getChildren().forEach(function forEachChild(child, pos, ar) {
										if (types._instanceof(child, xml.Element)) {
											const name = child.getName(),
												ns = child.getBaseURI();

											if (ns === DDT_URI) {
												if (!state.isModules && (name === 'modules')) {
													const newState = tools.extend({}, state, {isModules: true});
													promises.push(preParse(child, newState));
												} else if (state.isModules && (name === 'load')) {
													if (types.toBoolean(child.getAttr("build"))) {
														const module = child.getAttr("module");
														const path = child.getAttr("path");
														const file = {
															module,
															path,
															optional: types.toBoolean(child.getAttr("optional")),
															integrity: child.getAttr("integrity") || defaultIntegrity || null,
															mjs: types.toBoolean(child.getAttr("mjs") || false),
															dontForceMin: types.toBoolean(child.getAttr("dontForceMin") || false),
														};
														state.buildFiles.push(file);
													};
												};
											};
										};
									});
									return Promise.all(promises);
								})
									.then(function() {
										return state;
									});
							};

							const parseNode = function _parseNode(node, state) {
								let hasVariables = false;

								node.getChildren().forEach(function forEachChild(child, pos, ar) {
									if (types._instanceof(child, xml.Element)) {
										const name = child.getName(),
											ns = child.getBaseURI();

										if (ns === DDI_URI) {
											if (name === 'body') {
												const isHtml = state.isHtml;
												state.isHtml = false;
												parseNode(child, state);
												state.isHtml = isHtml;
											};
										} else if ((ns === DDT_URI) && (name !== 'html')) {
											writeHTML(state);
											writeAsyncWrites(state);
											if (!state.isModules && (name === 'when-true')) {
												if (!state.isIf) {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!' + prepareExpr(child.getAttr('expr'), false) + ';');
												};
												codeParts[codeParts.length] = 'if (__expr__) {';
												const isHtml = state.isHtml;
												const isIf = state.isIf;
												state.isHtml = false;
												state.isIf = false;
												parseNode(child, state);
												state.isHtml = isHtml;
												state.isIf = isIf;
												writeHTML(state);
												writeAsyncWrites(state);
												codeParts[codeParts.length] = '};';
											} else if (!state.isModules && (name === 'when-false')) {
												if (!state.isIf) {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!' + prepareExpr(child.getAttr('expr', false)) + ';');
												};
												codeParts[codeParts.length] = 'if (!__expr__) {';
												const isHtml = state.isHtml;
												const isIf = state.isIf;
												state.isHtml = false;
												state.isIf = false;
												parseNode(child, state);
												state.isHtml = isHtml;
												state.isIf = isIf;
												writeHTML(state);
												writeAsyncWrites(state);
												codeParts[codeParts.length] = '};';
											} else if (!state.isIf) {
												if (!state.isModules && (name === 'if')) {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!' + prepareExpr(child.getAttr('expr'), false) + ';');
													const isHtml = state.isHtml;
													const isIf = state.isIf;
													state.isHtml = false;
													state.isIf = true;
													parseNode(child, state);
													state.isHtml = isHtml;
													state.isIf = isIf;
													writeHTML(state);
													writeAsyncWrites(state);
												} else if (!state.isModules && (name === 'script')) {
													const vars = (child.getAttr('vars') || '').split(' ').filter(function filterVar(v) { return !!v; });
													if (vars.length) {
														codeParts[codeParts.length] = ('var ' + vars.join(' = null, ') + ' = null;');
													};
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncScript(function() {' + (child.getChildren().getCount() && child.getChildren().getAt(0).getValue()) + '});'); // CDATA or Text
												} else if (!state.isModules && (name === 'for-each')) {
													codeParts[codeParts.length] = startAsync('page.asyncForEach(' + (child.getAttr('items') || 'items') + ', ');
													startFn('item');
													codeParts[codeParts.length] = 'dynVars[' + tools.toSource(child.getAttr('item') || 'item') + '] = item;';
													codeParts[codeParts.length] = 'evalExpr.forceRefresh = true;';
													const isHtml = state.isHtml;
													state.isHtml = false;
													parseNode(child, state);
													state.isHtml = isHtml;
													writeHTML(state);
													writeAsyncWrites(state);
													endFn();
													codeParts[codeParts.length] = endAsync(');');
												} else if (!state.isModules && (name === 'eval')) {
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncScript(function() {' + 'return page.writeAsync(tools.escapeHtml(' + prepareExpr(child.getChildren().getAt(0).getValue(), false) + ' + "", true))});'); // CDATA or Text
												} else if (!state.isModules && (name === 'variable')) {
													const name = child.getAttr('name'); // required
													const expr = child.getAttr('expr'); // required
													if (name && expr) {
														codeParts[codeParts.length] = 'dynVars[' + tools.toSource(name) + '] = ' + prepareExpr(expr, true) + ';';
													};
												} else if (!state.isModules && (name === 'include')) {
													let path = child.getAttr('src');
													path = self.path.set({file: null}).combine(path);
													const ddi = templatesHtml.DDI.$get(path, 'ddi', self.options);
													codeParts[codeParts.length] = ddi;
													state.promises[state.promises.length] = ddi.open();
													ddi.parents.set(self, self.path.toString());
												} else if (!state.isModules && (name === 'cache') && !state.cacheId) {
													cache = false;
													state.cacheId = child.getAttr('id'); // required
													const duration = child.getAttr("duration") || cacheDuration;
													codeParts[codeParts.length] = startAsync('page.asyncCache(' + tools.toSource(state.cacheId) + ', ' + tools.toSource(duration) + ', ');
													startFn();
													const isHtml = state.isHtml;
													state.isHtml = false;
													parseNode(child, state);
													state.isHtml = isHtml;
													writeHTML(state);
													writeAsyncWrites(state);
													endFn();
													codeParts[codeParts.length] = endAsync(');');
													state.cacheId = null;
												} else if (!state.isModules && (name === 'modules')) {
													const newState = tools.extend({}, state, {isModules: true, modules: [], isHtml: false});
													parseNode(child, newState);
													state.modules = newState.modules;
												} else if (state.isModules && !state.isOptions && (name === 'options')) {
													const newState = tools.extend({}, state, {isOptions: true, modules: null, isHtml: false});
													parseNode(child, newState);
												} else if (state.isModules && state.isOptions && (name === 'option')) {
													const optModule = child.getAttr('module'); // required
													if (optModule && (tools.indexOf(RESERVED_OBJ_PROPS, optModule) < 0)) {
														const attrs = child.getAttrs();
														const [optKey] = getAttrValue(attrs, 'key', types.toString, null, false); // optional
														const optVal = getAttrValue(attrs, 'value', null, null, true); // required
														if (optKey) {
															const MAX_DEPTH = 15;
															const opt = state.options[optModule] || {};
															const keys = optKey.split('.'),
																keysLen = keys.length;
															let lastOpt = opt;
															for (let i = 0; (i < MAX_DEPTH) && (i < keysLen - 1); i++) {
																const key = keys[i];
																if (!key || (tools.indexOf(RESERVED_OBJ_PROPS, key) >= 0)) {
																	// Empty string or reserved key.
																	lastOpt = null;
																	break;
																};
																const newOpt = lastOpt[key] || {};
																lastOpt[key] = newOpt;
																lastOpt = newOpt;
															};
															const lastKey = keys[keysLen - 1];
															if (lastKey && lastOpt && (tools.indexOf(RESERVED_OBJ_PROPS, lastKey) < 0)) {
																lastOpt[lastKey] = optVal;
																state.options[optModule] = opt;
															} else {
																throw new types.ParseError("Invalid value for the 'key' attribute in an 'option' element.");
															};
														} else {
															state.options[optModule] = optVal;
														};
													} else {
														throw new types.ParseError("Invalid value for the 'module' attribute in an 'option' element.");
													};
												} else if (state.isModules && !state.isOptions && state.modules && (name === 'load')) {
													if (!types.toBoolean(child.getAttr("build"))) {
														state.modules.push({
															module: child.getAttr("module") || null,
															path: child.getAttr("path") || null,
															optional: types.toBoolean(child.getAttr("optional") || false),
															integrity: child.getAttr("integrity") || defaultIntegrity || null,
															mjs: types.toBoolean(child.getAttr("mjs") || false),
															dontForceMin: types.toBoolean(child.getAttr("dontForceMin") || false),
														});
													};
												};
											};
										} else if ((ns === HTML_URI) || ((ns === DDT_URI) && (name === 'html'))) {
											if (!state.isIf && !state.isModules) {
												let addCharset = false,
													addModules = false,
													addClientScripts = false;
												if (name === 'head') {
													// TODO: Replace by an XPATH search when they will be available in @doodad-js/xml.
													const metaNodes = child.getChildren().find('meta');
													const len = metaNodes.length;
													addCharset = true;
													for (let i = 0; i < len; i++) {
														const metaNode = metaNodes[i];
														if (metaNode.hasAttr('charset') || (metaNode.hasAttr('http-equiv') && (metaNode.getAttr('http-equiv').toLowerCase() === 'content-type'))) {
															addCharset = false;
															break;
														};
													};
													state.hasHead = true;
												} else if (name === 'body') {
													if (!state.hasHead) {
														state.html += '<head>';
														insertCharset(state);
														state.html += '</head>';
														state.hasHead = true;
													};
													addModules = !!state.modules;
													addClientScripts = state.buildFiles.length > 0;
													state.hasBody = true;
												};
												state.html += '<' + name;
												const ignoreAttrs = ['async'];
												if (name === 'script') {
													if (child.hasAttr('async')) {
														state.html += ' async';
													};
												};
												const attrs = child.getAttrs();
												let integrity = null;
												if (name === 'script') {
													integrity = 'src';
												} else if (name === 'link') {
													integrity = 'href';
												};
												if ((!integrity || !defaultIntegrity) && tools.findItem(attrs, function(attr) {
													return (attr.getBaseURI() === DDT_URI);
												}) === null) {
													attrs.forEach(function forEachAttr(attr) {
														const key = attr.getName();
														if (ignoreAttrs.indexOf(key) < 0) {
															const value = attr.getValue();
															state.html += ' ' + tools.escapeHtml(key, true) + '="' + tools.escapeHtml(value, false) + '"';
														};
													}, this);
												} else {
													writeHTML(state);
													writeAsyncWrites(state);
													const integrityValue = defaultIntegrity;
													attrs.forEach(function forEachAttr(attr) {
														const key = attr.getName();
														if (ignoreAttrs.indexOf(key) < 0) {
															const value = attr.getValue(),
																compute = (attr.getBaseURI() === DDT_URI);
															if (compute) {
																codeParts[codeParts.length] = __Internal__.surroundAsync('page.compileAttr(' + tools.toSource(key) + ', ' + prepareExpr(value, false) + ');');
															} else {
																codeParts[codeParts.length] = __Internal__.surroundAsync('page.compileAttr(' + tools.toSource(key) + ', ' + tools.toSource(value) + ');');
															};
														};
													}, this);
													if (integrity && integrityValue) {
														codeParts[codeParts.length] = __Internal__.surroundAsync('page.compileIntegrityAttr(' + tools.toSource('integrity') + ',' + tools.toSource(integrityValue) + ',' + tools.toSource(integrity) + ');');
													};
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncWriteAttrs();');
												};
												const children = child.getChildren();
												// <PRB> Browsers do not well support "<name />"
												const mandatoryContent = (tools.indexOf(['area', 'base', 'br', 'col', 'hr', 'img', 'input', 'link', 'param', 'track'], name) < 0);
												const hasChildren = mandatoryContent || addCharset || addClientScripts || addModules || (children.getCount() > 0);
												if (hasChildren) {
													state.html += '>';
													if (addCharset) {
														insertCharset(state);
													};
													if (addClientScripts) {
														insertClientScripts(state);
													};
													if (addModules) {
														insertModules(state);
													};
													const isHtml = state.isHtml;
													state.isHtml = true;
													parseNode(child, state);
													state.isHtml = isHtml;
													if (name === 'html') {
														if (!state.hasHead) {
															state.html += '<head>';
															insertCharset(state);
															state.html += '</head>';
															state.hasHead = true;
														};
														if (!state.hasBody) {
															state.html += '<body>';
															insertClientScripts(state);
															insertModules(state);
															state.html += '</body>';
															state.hasBody = true;
														};
													};
													state.html += '</' + name + '>';
												} else {
													state.html += '/>';
												};
											};
										};
									} else if (state.isHtml && types._instanceof(child, xml.Text)) {
										state.html += tools.escapeHtml(child.getValue().replace(/\r|\n|\t/g, ' ').replace(/[ ]+/g, ' '), true);
									} else if (state.isHtml && types._instanceof(child, xml.CDATASection)) {
										state.html += '<![CDATA[' + child.getValue().replace(/\]\]>/g, "]]]]><![CDATA[>") + ']]>';
									};
								}, this);

								if (hasVariables) {
									endFn();
									codeParts[codeParts.length] = endAsync(');');
								};
							};

							const mainParse = function _mainParse(state) {
								fnHeader();

								if (self.type === 'ddt') {
									// TODO: Replace by XPATH search when it will be available in @doodad-js/xml.
									const doctypeNodes = ddi.getChildren().find('doctype')
										.filter(function(doctypeNode) {
											return doctypeNode.getBaseURI() === DDT_URI;
										});
									if (doctypeNodes.length) {
										const valueNodes = doctypeNodes.getAt(0).getChildren();
										state.html += '<!DOCTYPE ' + (valueNodes.getCount() && valueNodes.getAt(0).getValue() || 'html') + '>\n';
									} else {
										state.html += '<!DOCTYPE html>\n';
									};
									writeHTML(state);
								};

								parseNode(ddi, state);

								writeHTML(state);
								writeAsyncWrites(state);

								fnFooter();

								self.cache = cache;
								self.cacheDuration = cacheDuration;

								return Promise.all(state.promises);
							};

							const state = {
								html: '',
								writes: '',
								isIf: false,
								isModules: false,
								isOptions: false,
								isHtml: false,
								promises: [],
								cacheId: null,
								modules: null,
								options: tools.nullObject(),
								hasHead: false,
								hasBody: false,
								isModule: false,
								buildFiles: [],
							};

							return preParse(ddi, state)
								.then(mainParse);
						}, this);
					},

					_new: types.SUPER(function _new(path, type, /*optional*/options) {
						this._super();
						this.type = type;
						this.options = tools.nullObject(options);
						this.name = path.file.replace(/\./g, '_');
						this.path = path;
						this.parents = new types.Map();
					}),

					open: function open() {
						const Promise = types.getPromise();

						return Promise.try(function() {
							if (this.doc) {
								// Already opened.
								return undefined;
							};
							const encoding = types.getDefault(this.options, 'encoding', 'utf-8');
							return files.openFile(this.path, {encoding: encoding})
								.then(function openFilePromise(stream) {
									let promise;
									if (xml.isAvailable({schemas: true})) {
										promise = resources.locate('./common/res/schemas/', {module: '@doodad-js/templates'});
									} else {
										promise = Promise.resolve(null);
									};
									promise = promise.then(function(xsdRoot) {
										let xsd = null;
										if (xsdRoot) {
											xsd = xsdRoot.combine(files.parsePath(this.type === 'ddt' ? "./ddt/ddt.xsd" : "./ddt/ddi.xsd"), {includePathInRoot: true});
										};
										return xml.parse(stream, {entities: html.getEntities(), discardEntities: true, xsd});
									}, null, this);
									return promise
										.nodeify(function parseXmlPromise(err, doc) {
											types.DESTROY(stream);
											if (err) {
												throw err;
											};
											//console.log(require('util').inspect(doc));
											this.doc = doc;
										}, this);
								}, null, this);
						}, this)
							.then(function(dummy) {
								this.codeParts = [];
								return this.parse();
							}, null, this);
					},

					toString: function toString(/*optional*/level, /*optional*/writeHeader) {
						if (!this.codeParts || !this.codeParts.length) {
							return '';
						};

						if (types.isNothing(level)) {
							level = '';
						};

						const newLevel = level + '    ';

						let code = '\n' + level;

						if (templatesHtml.useAsyncAwait()) {
							code += 'async ';
						};

						code += 'function ' + this.name + '() {';

						if (writeHeader) {
							// TODO: .writeHeader
							code += '\n' + newLevel + 'const page = this;' +
								'\n' + newLevel + 'const pageType = types.getType(this);' +
								'\n' + newLevel + 'const locals = pageType.$getLocals();' +
								'\n' + newLevel + 'locals.page = page;' +
								// TODO: Find a better place (modulesUri).
								'\n' + newLevel + "locals.modulesUri = locals.tools.Files.parseUrl(page.options.variables && page.options.variables.modulesUri || '/');" +
								'\n' + newLevel + 'const createEvalExpr = pageType.$getCreateEvalExpr(page, locals);' +
								'\n' + newLevel + 'const oldDynVars = null;';
						};

						for (let i = 0; i < this.codeParts.length; i++) {
							const part = this.codeParts[i];
							if (types._instanceof(part, templatesHtml.DDI)) {
								code += part.toString(newLevel);
							};
						};

						for (let i = 0; i < this.codeParts.length; i++) {
							const part = this.codeParts[i];
							if (types._instanceof(part, templatesHtml.DDI)) {
								code += '\n' + newLevel + __Internal__.surroundAsync('page.asyncInclude(' + part.name + ');');
							} else {
								code += '\n' + newLevel + part;
							};
						};

						// TODO: .writeFooter
						//if (writeHeader) {
						//	code += ...;
						//};

						code += '\n' + level + '}';

						return code;
					},
				}
			));


			templatesHtml.ADD('DDT', templatesHtml.DDI.$inherit(
				/*typeProto*/
				{
					$TYPE_NAME: 'DDT',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('DDT')), true) */,

					$get: types.SUPER(function $get(path, /*optional*/options) {
						return this._super(path, 'ddt', options);
					}),
				},
				/*instanceProto*/
				{
					build: function() {
						const Promise = types.getPromise();
						return this.open()
							.then(function(dummy) {
								const ddtNode = this.doc.getRoot(),
									name = ddtNode.getAttr('type'),
									templName = name.replace(/\./g, "_");

								let templ = types.get(templatesDDTX, templName);
								if (templ) {
									return templ;
								};

								return Promise.try(function() {
									const type = namespaces.get(name);
									if (!type) {
										return modules.load(
											[
												{
													path: this.path.set({extension: (root.getOptions().fromSource ? 'js' : 'min.js')}),
												},
											], {startup: {secret: _shared.SECRET}})
											.then(function(dummy) {
												return namespaces.get(name);
											});
									};
									return type;
								}, this)
									.then(function(type) {
										if (!types._implements(type, templatesHtml.PageTemplate)) {
											throw new types.ValueError("Unknown page template '~0~'.", [name]);
										};

										const code = this.toString('', true);
										//console.log(code);
										const locals = type.$getLocals();
										let fn = tools.createEval(types.keys(locals));
										fn = fn.apply(null, types.values(locals));
										fn = fn('(' + code + ')');
										//console.log(fn);

										templ = templatesDDTX.REGISTER(/*protect*/false, /*args*/null, /*type*/type.$extend(
											{
												$TYPE_NAME: templName,

												$options: {
													cache: this.cache,
													cacheDuration: this.cacheDuration,
													encoding: this.options.encoding,
												},

												renderTemplate: doodad.OVERRIDE(fn),
											})
										);

										let listener;
										this.addEventListener('unload', listener = function(ev) {
											this.removeEventListener('unload', listener);
											types.invoke(templ, '$onUnload', null, _shared.SECRET);
											templatesDDTX.UNREGISTER(templ);
											types.DESTROY(templ);
										});

										return templ;
									}, null, this);
							}, null, this);
					},
				}
			));


			templatesHtml.ADD('getTemplate', function getTemplate(/*optional*/module, path, /*optional*/options) {
				const Promise = types.getPromise();

				return Promise.try(function() {
					path = files.parseLocation(path);

					const pathDDTX = path.set({extension: 'ddtx'});

					const key = pathDDTX.toApiString();
					if (types.has(__Internal__.ddtxCache, key)) {
						return __Internal__.ddtxCache[key];
					};

					const loadFile = function loadFile(path) {
						if (path.extension === 'ddtx') {
							return Promise.all([
								Promise.create(function(resolve, reject) {
									templatesDDTX.addEventListener('newDDTX', function(ev) {
										if (ev.detail.id === key) {
											if (ev.detail.error) {
												reject(ev.detail.error);
											} else {
												resolve(ev.detail.ddtx);
											};
										};
									});
								}),
								modules.load([{module, path}], {startup: {secret: _shared.SECRET}, "Doodad.Templates.Html.DDTX": {ddtxId: key}}),
							])
								.then(function(results) {
									const ddtx = results[0];
									return ddtx;
								}, null, this);
						} else {
							return modules.locate(module, path)
								.then(function(resolvedPath) {
									const ddt = templatesHtml.DDT.$get(resolvedPath, options);
									return ddt.build();
								}, null, this);
						};
					};

					let promise = null;
					if ((path.extension === 'ddtx') || root.getOptions().fromSource) {
						promise = loadFile(path);
					} else {
						// NOTE: Use "exists" because loading the script with the browser doesn't tell if it 404.
						promise = files.existsAsync(pathDDTX, {type: 'file'})
							.then(function(exists) {
								if (exists) {
									return loadFile(pathDDTX);
								} else {
									return loadFile(path);
								};
							});
					};

					// Temporary store the Promise so that another call requiring the same DDT/DDTX will not get duplicated.
					__Internal__.ddtxCache[key] = promise;

					return promise.nodeify(function(err, ddtx) {
						// Get rid of the Promise and store the value instead.
						if (err) {
							delete __Internal__.ddtxCache[key];
							throw err;
						} else {
							ddtx.$onUnload.attachOnce(null, function(ev) {
								delete __Internal__.ddtxCache[key];
							});
							__Internal__.ddtxCache[key] = ddtx;
							return ddtx;
						};
					});
				});
			});


			//return function init(options) {
			//};
		},
	};
	return modules;
};

//! END_MODULE()
