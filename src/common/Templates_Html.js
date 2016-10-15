//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2016 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: Templates_Html.js - Templates module
// Project home: https://github.com/doodadjs/
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2016 Claude Petit
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
		DD_MODULES['Doodad.Templates.Html'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";
				
				//===================================
				// Get namespaces
				//===================================
				
				var doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					safeEval = tools.SafeEval,
					namespaces = doodad.Namespaces,
					modules = doodad.Modules,
					files = tools.Files,
					config = tools.Config,
					widgets = doodad.Widgets,
					xml = tools.Xml,
					templates = doodad.Templates,
					templatesHtml = templates.Html,
					io = doodad.IO;
				
				
				var __Internal__ = {
					templatesCached: types.nullObject(),
				};
				
				
				var __options__ = types.extend({
					resourcesPath: './res/', // Combined with package's root folder
				}, _options);

				types.freezeObject(__options__);

				templatesHtml.getOptions = function getOptions() {
					return __options__;
				};

				
				
				// TODO: Make a better and common resources locator and loader
				__Internal__.resourcesLoader = {
					locate: function locate(fileName, /*optional*/options) {
						var Promise = types.getPromise();
						return Promise['try'](function tryLocate() {
							var path = tools.getCurrentScript((global.document?document.currentScript:module.filename)||(function(){try{throw new Error("");}catch(ex){return ex;}})())
								.set({file: null})
								.combine(_shared.pathParser(__options__.resourcesPath))
								.combine(_shared.pathParser(fileName));
							return path;
						});
					},
					load: function load(path, /*optional*/options) {
						return config.load(path, { async: true, watch: true, encoding: 'utf-8' }, types.get(options, 'callback'));
					},
				};
				
				templatesHtml.setResourcesLoader = function setResourcesLoader(loader) {
					__Internal__.resourcesLoader = loader;
				};

				
				
				templatesHtml.REGISTER(doodad.BASE(widgets.Widget.$extend(
					{
						$TYPE_NAME: 'PageTemplate',
						
						request: doodad.PUBLIC(doodad.READ_ONLY(null)),
						
						__buffer: doodad.PROTECTED(null),
						__renderPromise: doodad.PROTECTED(null),
						__cacheStream: doodad.PROTECTED(null),
						__cacheHandler: doodad.PROTECTED(null),
						
						renderTemplate: doodad.PROTECTED(doodad.MUST_OVERRIDE(function() {
							return this.__renderPromise;
						})),

						$ddt: doodad.PUBLIC(doodad.READ_ONLY(null)),
						
						$create: doodad.OVERRIDE(function $create(ddt) {
							this._super();
							
							_shared.setAttribute(this, '$ddt', ddt);
						}),

						create: doodad.OVERRIDE(function create(request, cacheHandler) {
							this._super();
							
							this.__cacheHandler = cacheHandler;
	
							var type = types.getType(this);

							var cached = cacheHandler.getCached(request)
							cached.disabled = !type.$ddt.cache;
							cached.duration = type.$ddt.cacheDuration;

							_shared.setAttribute(this, 'request', request);
						}),
						
						render: doodad.OVERRIDE(function render() {
							var Promise = types.getPromise();

							this.__buffer = '';
							this.__renderPromise = Promise.resolve();
							this.__cacheStream = null;
							
							return this.renderTemplate();
						}),

						__asyncWrite: doodad.PROTECTED(doodad.ASYNC(function asyncWrite(code, /*optional*/flush) {
								this.__buffer += (code || '');
								if (flush || (this.__buffer.length >= (1024 * 1024 * 1))) {  // TODO: Add an option in DDT for max buffer length
									var buffer = this.__buffer;
									this.__buffer = '';
									return this.stream.writeAsync(buffer)
										.then(function() {
											if (this.__cacheStream) {
												return this.__cacheStream.writeAsync(buffer);
											};
										}, null, this);
										//.catch(function(err) {
										//	debugger;
										//});
								};
						})),
						
						asyncWrite: doodad.PROTECTED(doodad.ASYNC(function asyncWrite(code, /*optional*/flush) {
							var Promise = types.getPromise();
							this.__renderPromise = this.__renderPromise.then(function asyncWritePromise() {
								return this.__asyncWrite(code, flush);
							}, null, this);
						})),
						
						asyncForEach: doodad.PROTECTED(doodad.ASYNC(function asyncForEach(items, fn) {
							var Promise = types.getPromise();
							this.__renderPromise = this.__renderPromise.then(function asyncForEachPromise() {
								return Promise.resolve(items) // Items can be a Promise or a value
									.then(function(items) {
										this.__renderPromise = Promise.resolve();
										tools.forEach(items, fn);
										return this.__renderPromise;
									}, null, this);
							}, null, this);
						})),
						
						asyncInclude: doodad.PROTECTED(doodad.ASYNC(function asyncInclude(fn) {
							var Promise = types.getPromise();
							this.__renderPromise = this.__renderPromise.then(function asyncIncludePromise() {
								this.__renderPromise = Promise.resolve();
								fn();
								return this.__renderPromise;
							}, null, this);
						})),
						
						asyncScript: doodad.PROTECTED(doodad.ASYNC(function asyncScript(fn) {
							var Promise = types.getPromise();
							this.__renderPromise = this.__renderPromise.then(function asyncScriptPromise() {
								this.__renderPromise = Promise.resolve();
								var result = fn();
								if (types.isPromise(result)) {
									this.__renderPromise = result;
								};
								return this.__renderPromise;
							}, null, this);
						})),

						asyncCache: doodad.PROTECTED(doodad.ASYNC(function asyncStartCache(id, duration, fn) {
							var Promise = types.getPromise();
							var type = types.getType(this);
							var start = function start() {
								var cached = this.__cacheHandler.getCached(this.request, {section: id});
								if (cached.isValid()) {
									return this.__cacheHandler.openFile(this.request, cached)
										.then(function(cacheStream) {
											if (cacheStream) {
												var promise = cacheStream.onEOF.promise();
												cacheStream.pipe(this.stream, {end: false});
												cacheStream.flush({output: false});
												return promise;
											} else {
												return start.call(this); // cache file has been deleted
											};
										}, null, this);
								} else if (cached.isInvalid()) {
									return this.__cacheHandler.createFile(this.request, cached, {encoding: type.$ddt.options.encoding, duration: duration})
										.then(function(cacheStream) {
											this.__cacheStream = cacheStream;
											this.__renderPromise = Promise.resolve();
											fn();
											return this.__renderPromise
												.then(function() {
													return this.__asyncWrite(null, true);
												}, null, this)
												.then(function() {
													this.__cacheStream = null;
													return cacheStream.writeAsync(io.EOF);
												}, null, this)
												.then(function outputOnEOF(ev) {
													cached.validate();
												}, null, this)
												.catch(function(err) {
													cacheStream.write(io.EOF);
													cached.abort();
													throw err;
												}, this);
										}, null, this);
								};
							};
							this.__renderPromise = this.__renderPromise.then(function asyncIncludePromise() {
								return this.__asyncWrite(null, true)
									.then(start, null, this);
							}, null, this);
						})),
					})));
				
				
				templatesHtml.DDI = types.INIT(types.Type.$inherit(
					/*typeProto*/
					{
						$TYPE_NAME: 'DDI',
						
						$get: function $get(path, type, /*optional*/options) {
							var templates = __Internal__.templatesCached,
								key = path.toString();
								
							var ddi;
							if (types.has(templates, key)) {
								//console.log('CACHED ' + key);
								ddi = templates[key];
							} else {
								ddi = templates[key] = new this(path, type, options);
								
								var deleteFn = function _deleteFn(key, ddi) {
									if (delete __Internal__.templatesCached[key]) {
										tools.forEach(ddi.parents, function(key, ddi) {
											deleteFn(key, ddi);
										});
									};
								};

								files.watch(path, function watchFileCallback() {
									deleteFn(key, ddi);
								}, {once: true});
								
							};
							
							return ddi;
						},
					},
					/*instanceProto*/
					{
						name: null,
						path: null,
						doc: null,
						type: null,
						options: null,
						promise: null,
						codeParts: null,
						parents: null,
						cache: true,
						cacheDuration: null,
						
						getScriptVariables: function getScriptVariables() {
							return {
								Promise: types.getPromise(),
								escapeHtml: tools.escapeHtml,
							};
						},
						
						getScriptHeader: function getScriptHeader() {
							// NOTE: Returns the header of the "renderTemplate" function
							return (function() {
								// Gives access to page object everywhere in "renderTemplate"
								var page = this;
							}).toString().match(/^[^{]*[{]((.|\n|\r)*)[}][^}]*$/)[1];
						},
						
						getScriptFooter: function getScriptFooter() {
							// NOTE: Returns the footer of the "renderTemplate" function
							return (function() {
								// Flush buffer
								page.asyncWrite(null, true);
								
								return this._super();
							}).toString().match(/^[^{]*[{]((.|\n|\r)*)[}][^}]*$/)[1];
						},
						
						parse: doodad.ASYNC(function parse(parentPath) {
							// TODO: ES7 (async/await) when widely supported (both in all supported browsers & nodejs)
							
							var DDT_URI = "http://www.doodad-js.local/schemas/ddt"
							var HTML_URI = "http://www.doodad-js.local/schemas/html5"
							
							var doctype = this.doc.getDocumentType() && tools.trim(this.doc.getDocumentType().getValue()).split(' ');
							if (!doctype || (doctype[0].toLowerCase() !== this.type)) {
								throw new types.ParseError("Document type is missing or invalid.");
							};

							var ddi = this.doc.getRoot(),
								self = this;

							var cache = false;
							var cacheDuration = null;
							if (self.type === 'ddt') {
								cache = types.toBoolean((self.type === 'ddt') && ddi.getAttr('cache') || 'false');
								cacheDuration = ddi.getAttr('cacheDuration');
							};

							var writeHTML = function writeHTML(state) {
								if (state.html) {
									state.writes += types.toSource(state.html) + ' + ';
									state.html = '';
								};
							};
							
							var writeAsyncWrites = function writeAsyncWrites(state) {
								if (state.writes) {
									self.codeParts[self.codeParts.length] = ('page.asyncWrite(' + state.writes.slice(0, -3) + ');');   // remove extra " + "
									state.writes = '';
								};
							};
							
							// TODO: Possible stack overflow ("parseNode" is recursive) : Rewrite in a while loop ?
							// TODO: More XML validation
							// TODO: Throw XML validation errors
							// TODO: Validation by XSL ?
							var parseNode = function parseNode(node, state) {
								node.getChildren().forEach(function forEachChild(child, pos, ar) {
									if (child instanceof xml.Element) {
										var name = child.getName(),
											ns = child.getBaseURI();

										if ((ns === DDT_URI) && (name === 'doctype') && !state.hasDocType) {
											state.html += '<!DOCTYPE ' + (child.getValue() || 'html') + '>\n'
											state.hasDocType = true;
										} else if (!state.hasDocType) {
											state.html += '<!DOCTYPE html>\n'
											state.hasDocType = true;
										};
										
										if (ns === DDT_URI) {
											writeHTML(state);
											writeAsyncWrites(state);
											if ((!state.isIf) && (name === 'script') && child.getChildren().getAt(0)) {
												var vars = (child.getAttr('vars') || '').split(' ').filter(function filterVar(v) {return !!v});
												if (vars.length) {
													self.codeParts[self.codeParts.length] = ('var ' + vars.join(' = null, ') + ' = null;');
												};
												self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {' + (child.getChildren().getCount() && child.getChildren().getAt(0).getValue()) + '});'); // CDATA or Text
											} else if ((!state.isIf) && (name === 'for-each') && child.hasAttr('items') && child.hasAttr('item')) {
												self.codeParts[self.codeParts.length] = ('page.asyncForEach(' + (child.getAttr('items') || 'items') + ', function(' + (child.getAttr('item') || 'item') + ') {');
												parseNode(child, state);
												writeHTML(state);
												writeAsyncWrites(state);
												self.codeParts[self.codeParts.length] = ('});');
											} else if ((!state.isIf) && (name === 'eval') && child.getChildren().getAt(0)) {
												self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {' + 'page.asyncWrite(escapeHtml((' + child.getChildren().getAt(0).getValue() + ') + ""))});'); // CDATA or Text
											} else if ((!state.isIf) && (name === 'if') && child.hasAttr('expr')) {
												self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {var __expr__ = !!(' + (child.getAttr('expr') || 'false') + ');');
												var newState = types.extend({}, state, {isIf: true});
												parseNode(child, newState);
												writeHTML(newState);
												writeAsyncWrites(newState);
												self.codeParts[self.codeParts.length] = ('});');
											} else if (name === 'when-true' && child.hasAttr('expr')) {
												if (!state.isIf) {
													self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {var __expr__ = !!(' + child.getAttr('expr') + ');');
												};
												self.codeParts[self.codeParts.length] = ('if (__expr__) {');
												var newState = types.extend({}, state, {isIf: false});
												parseNode(child, newState);
												writeHTML(newState);
												writeAsyncWrites(newState);
												self.codeParts[self.codeParts.length] = ('};');
												if (!state.isIf) {
													self.codeParts[self.codeParts.length] = ('});');
												};
											} else if (name === 'when-false' && child.hasAttr('expr')) {
												if (!state.isIf) {
													self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {var __expr__ = !!(' + child.getAttr('expr') + ');');
												};
												self.codeParts[self.codeParts.length] = ('if (!__expr__) {');
												var newState = types.extend({}, state, {isIf: false});
												parseNode(child, newState);
												writeHTML(newState);
												writeAsyncWrites(newState);
												self.codeParts[self.codeParts.length] = ('};');
												if (!state.isIf) {
													self.codeParts[self.codeParts.length] = ('});');
												};
											} else if ((!state.isIf) && (name === 'variable') && child.hasAttr('name') && child.hasAttr('expr')) {
												// TODO: Combine "variable" tags
												// FUTURE: "let" but must check if already defined in scope
												var name = (child.getAttr('name') || 'x');
												self.codeParts[self.codeParts.length] = ('var ' + name + ' = null;');
												self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {' + name + ' = (' + (child.getAttr('expr') || '""') + ')});');
											} else if ((!state.isIf) && (name === 'include') && child.hasAttr('src')) {
												var path = child.getAttr('src');
												path = self.path.set({file: null}).combine(path, {isRelative: true, os: 'linux'});
												var ddi = templatesHtml.DDI.$get(path, 'ddi', self.options);
												self.codeParts[self.codeParts.length] = (ddi);
												state.promises[state.promises.length] = (ddi.promise);
												ddi.parents.set(self, parentPath.toString());
											} else if ((!state.isIf) && (name === 'cache') && child.hasAttr('id') && !state.cacheId) {
												state.cacheId = child.getAttr('id');
												var duration = child.getAttr("duration");
												self.codeParts[self.codeParts.length] = 'page.asyncCache(' + types.toSource(state.cacheId) + ', ' + types.toSource(duration) + ', function() {';
												parseNode(child, state);
												writeHTML(state);
												writeAsyncWrites(state);
												self.codeParts[self.codeParts.length] = '});';
												state.cacheId = null;
											};
										} else if (ns === HTML_URI) {
											if ((!state.isIf) && (child.getName() === 'html') && (self.type === 'ddi')) {
												parseNode(child, state);
											} else if (!state.isIf) {
												if (name === 'head') {
													state.isHead = true;
												} else if (state.isHead && (child.getName() === 'meta') && (child.hasAttr('charset') || (child.getAttr('http-equiv').toLowerCase() === 'content-type'))) {
													state.hasCharset = true;
												};
												state.html += '<' + name;
												child.getAttrs().forEach(function forEachAttr(attr) {
													var key = attr.getName(),
														value = attr.getValue(),
														ns = attr.getBaseURI();
													state.html += ' ' + key + '="';
													if (ns === DDT_URI) {
														writeHTML(state);
														writeAsyncWrites(state);
														self.codeParts[self.codeParts.length] = ('page.asyncScript(function() {' + 'page.asyncWrite(escapeHtml((' + value + ') + ""))});'); // CDATA or Text
													} else {
														state.html += value;
													};
													state.html += '"';
												}, this);
												// <PRB> Browsers do not well support "<name />"
												var hasChildren = !!child.getChildren().getCount() || (name === 'head') || (tools.indexOf(['link', 'meta', 'area', 'base', 'br', 'col', 'hr', 'img', 'input', 'param'], name) < 0);
												if (hasChildren) {
													state.html += '>';
												};
												parseNode(child, state);
												if ((name === 'head') && !state.hasCharset) {
													state.html += '<meta charset="UTF-8"/>';
													state.hasCharset = true;
												};
												if (hasChildren) {
													state.html += '</' + name + '>';
												} else {
													state.html += '/>';
												};
												if (name === 'head') {
													state.isHead = false;
												};
											};
										};
									} else if ((!state.isIf) && (child instanceof xml.Text)) {
										state.html += tools.escapeHtml(child.getValue().replace(/\r|\n|\t/g, ' ').replace(/[ ]+/g, ' '));
									} else if ((!state.isIf) && (child instanceof xml.CDATASection)) {
										state.html += '<![CDATA[' + child.getValue().replace(/\]\]\>/g, "]]]]><![CDATA[>") + ']]>';
									};
								}, this);
							};
							
							var state = {
								hasDocType: (this.type !== 'ddt'),
								hasCharset: false,
								isHead: false,
								html: '',
								writes: '',
								isIf: false,
								promises: [],
								cacheId: null,
							};
							
							parseNode(ddi, state);
							writeHTML(state);
							writeAsyncWrites(state);
							
							self.cache = cache;
							self.cacheDuration = cacheDuration;

							var Promise = types.getPromise();
							return Promise.all(state.promises);
						}),

						_new: types.SUPER(function _new(path, type, /*optional*/options) {
							this._super();
							path = _shared.pathParser(path, types.get(options, 'pathOptions'));
							this.type = type;
							this.options = types.extend({}, options);
							this.name = path.file.replace(/[.]/g, '_');
							this.path = path;
							this.parents = new types.Map();
							var encoding = types.getDefault(this.options, 'encoding', 'utf-8');
							this.promise = files.openFile(path, {encoding: encoding})
								.then(function openFilePromise(stream) {
									return xml.parse(stream, {discardEntities: true})
										.then(function parseXmlPromise(doc) {
											stream.destroy();
											this.doc = doc;
								//console.log(require('util').inspect(this.doc));
											this.codeParts = [];
											return this.parse(path)
												.then(function resultPromise() {
													return this;
												}, null, this);
										}, null, this);
								}, null, this);
						}),
						
						toString: function toString(/*optional*/level, /*optional*/writeHeader) {
							var code = '';
							if (types.isNothing(level)) {
								level = '';
							};
							var newLevel = level + '    ';
							if (this.codeParts && this.codeParts.length) {
								for (var i = 0; i < this.codeParts.length; i++) {
									var part = this.codeParts[i];
									if (part instanceof templatesHtml.DDI) {
										code += part.toString(newLevel);
									};
								};
								for (var i = 0; i < this.codeParts.length; i++) {
									var part = this.codeParts[i];
									if (part instanceof templatesHtml.DDI) {
										code += '\n' + newLevel + 'page.asyncInclude(' + part.name + ');';
									} else {
										code += '\n' + newLevel + part;
									};
								};
								return level + 'function ' + this.name + '() {' + 
											'\n' + newLevel +
											(writeHeader && this.getScriptHeader() || '') +
											'\n' + code +
											(writeHeader && this.getScriptFooter() || '') +
										'\n' + level + '}\n';
							} else {
								return '';
							};
						},
					}
				));
				
									
				templatesHtml.DDT = types.INIT(templatesHtml.DDI.$inherit(
					/*typeProto*/
					{
						$TYPE_NAME: 'DDT',
						
						$get: types.SUPER(function $get(path, /*optional*/options) {
							return this._super(path, 'ddt', options);
						}),
					},
					/*instanceProto*/
					{
						_new: types.SUPER(function _new(path, type, /*optional*/options) {
							this._super(path, type, options);
							
							var code;
							
							this.promise = this.promise.then(function extendDDTPromise() {
								var ddtNode = this.doc.getRoot(),
									name = ddtNode.getAttr('type');
									
								var type = namespaces.get(name);
								
								root.DD_ASSERT && root.DD_ASSERT(types._implements(type, templatesHtml.PageTemplate), "Unknown page template '~0~'.", [name])
								
								code = this.toString('', true);
					//console.log(code);
								var locals = this.getScriptVariables();
								var fn = safeEval.createEval(types.keys(locals))
								fn = fn.apply(null, types.values(locals));
								fn = fn('(' + code + ')');
					//console.log(fn);

								return types.INIT(type.$extend(
								{
									$TYPE_NAME: '__' + type.$TYPE_NAME,
									
									renderTemplate: doodad.OVERRIDE(fn),
								}), [null, null, null, this]);
							}, null, this)
							['catch'](function catchExtendDDTPromise(err) {
								console.log(code);
								throw err;
							});
						}),
					}
				));
			

				templatesHtml.getTemplate = function getTemplate(path, /*optional*/options) {
					var ddt = templatesHtml.DDT.$get(path, options);
					return ddt.promise;
				};
				
				
				templatesHtml.isAvailable = function isAvailable() {
					return xml.isAvailable();
				};
				
				
				//===================================
				// Init
				//===================================
				return function init(/*optional*/options) {
					return __Internal__.resourcesLoader.locate('./schemas/html5/entities.json')
						.then(function loadXmlEntitiesPromise(location) {
							return __Internal__.resourcesLoader.load(location, {callback: function parseXmlEntritiesCallback(err, entities) {
								if (!err) {
									entities = tools.reduce(entities, function(newEntities, value, name) {
										newEntities[name.replace(/[&;]/g, '')] = value.characters;
										return newEntities;
									}, {});
									xml.addXmlEntities(entities);
								};
							}});
						});
				};
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()