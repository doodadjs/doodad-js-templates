//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2017 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: Templates_Html.js - Templates module
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
		DD_MODULES['Doodad.Templates.Html'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			namespaces: ['DDTX'],
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";
				
				//===================================
				// Get namespaces
				//===================================
				
				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					widgets = doodad.Widgets,
					safeEval = tools.SafeEval,
					namespaces = doodad.Namespaces,
					modules = doodad.Modules,
					files = tools.Files,
					config = tools.Config,
					xml = tools.Xml,
					templates = doodad.Templates,
					templatesHtml = templates.Html,
					templatesDDTX = templatesHtml.DDTX;
				
				
				const __Internal__ = {
					entities: null,
					templatesCached: types.nullObject(),
					ddtxCache: types.nullObject(),
				};
				
				
				const __options__ = types.extend({
					resourcesPath: './res/', // Combined with package's root folder
				}, _options);

				types.freezeObject(__options__);

				templatesHtml.ADD('getOptions', function getOptions() {
					return __options__;
				});

				
				
				// TODO: Make a better and common resources locator and loader
				__Internal__.resourcesLoader = {
					locate: function locate(fileName, /*optional*/options) {
						const Promise = types.getPromise();
						return Promise.try(function tryLocate() {
							const path = tools.getCurrentScript((global.document?document.currentScript:module.filename)||(function(){try{throw new Error("");}catch(ex){return ex;}})())
								.set({file: null})
								.combine(files.parsePath(__options__.resourcesPath), {includePathInRoot: true})
								.combine(files.parsePath(fileName));
							return path;
						});
					},
					load: function load(path, /*optional*/options) {
						return config.load(path, { async: true, watch: true, encoding: 'utf-8' }, types.get(options, 'callback'));
					},
				};
				
				templatesHtml.ADD('setResourcesLoader', function setResourcesLoader(loader) {
					__Internal__.resourcesLoader = loader;
				});



				templatesHtml.REGISTER(doodad.BASE(widgets.Widget.$extend(
					{
						$TYPE_NAME: 'TemplateBase',
						$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('TemplateBase')), true) */,

						$onUnload: doodad.EVENT(false),

						$options: doodad.PUBLIC(doodad.READ_ONLY( {} )),

						renderTemplate: doodad.PROTECTED(doodad.ASYNC(doodad.MUST_OVERRIDE())),

						render: doodad.OVERRIDE(function render() {
							return this.renderTemplate()
								.then(function() {
									// Flush buffer
									return this.asyncWrite(null, true);
								}, null, this);
						}),

						// <PRB> Because of async/await, the following must be PUBLIC...

						asyncWrite: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(code, /*optional*/flush)
						asyncForEach: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(items, fn)
						asyncInclude: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(fn)
						asyncScript: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(fn)

						compileAttr: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, value)
						compileIntegrityAttr: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()), // function(key, value, src)
						asyncWriteAttrs: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function()

						asyncCache: doodad.PUBLIC(doodad.ASYNC(doodad.NOT_IMPLEMENTED())), // function(id, duration, fn)
					})));



				__Internal__.surroundAsync = function surroundAsync(code) {
					return (types.hasAsyncAwait() ? 'await ' + code : 'pagePromise = pagePromise.then(function() {return ' + code + '}, null, this);'); 
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
								ddi = __Internal__.templatesCached[key] = new this(path, type, options);
								
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

									files.watch(path, function watchFileCallback() {
										deleteFn(key, ddi);
									}, {once: true});
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
						cacheDuration: null,
						
						getScriptVariables: function getScriptVariables() {
							return (function() {
								const Promise = root.Doodad.Types.getPromise();
								const escapeHtml = root.Doodad.Tools.escapeHtml;
							}).toString().match(/^[^{]*[{]((.|\n|\r)*)[}][^}]*$/)[1];
						},
						
						getScriptHeader: function getScriptHeader() {
							// NOTE: Returns the header of the "renderTemplate" function
							return (function() {
								// Gives 'page' object everywhere in "renderTemplate" to avoid using 'this' which is less descriptive.
								const page = this;
							}).toString().match(/^[^{]*[{]((.|\n|\r)*)[}][^}]*$/)[1];
						},
						
						getScriptFooter: function getScriptFooter() {
							// NOTE: Returns the footer of the "renderTemplate" function
							//return (function() {
							//}).toString().match(/^[^{]*[{]((.|\n|\r)*)[}][^}]*$/)[1];
							return "";
						},
						
						parse: function parse() {
							const Promise = types.getPromise();

							const DDI_URI = "http://www.doodad-js.local/schemas/ddi"
							const DDT_URI = "http://www.doodad-js.local/schemas/ddt"
							const HTML_URI = "http://www.doodad-js.local/schemas/html5"
							
							const doctype = this.doc.getDocumentType() && tools.trim(this.doc.getDocumentType().getValue()).split(' ');
							if (!doctype || (doctype[0].toLowerCase() !== this.type)) {
								throw new types.ParseError("Document type is missing or invalid.");
							};

							const ddi = this.doc.getRoot(),
								self = this,
								codeParts = self.codeParts;

							let cache = false;
							let cacheDuration = null;
							if (self.type === 'ddt') {
								cache = types.toBoolean(ddi.getAttr('cache'));
								if (cache) {
									cacheDuration = types.toInteger(ddi.getAttr('cacheDuration'));
								};
							};

							const writeHTML = function writeHTML(state) {
								if (state.html) {
									state.writes += types.toSource(state.html) + ' + ';
									state.html = '';
								};
							};
							
							const fnHeader = function fnHeader() {
								if (!types.hasAsyncAwait()) {
									codeParts[codeParts.length] = 'let pagePromise = Promise.resolve();';
								};
							};

							const startFn = function startFn(/*optional*/args) {
								if (types.hasAsyncAwait()) {
									codeParts[codeParts.length] = '(async function(' + (args || '') + ') {';
								} else {
									codeParts[codeParts.length] = '(function(' + (args || '') + ') {';
								};
								fnHeader();
							};

							const startAsync = function startAsync(code) {
								if (types.hasAsyncAwait()) {
									return 'await ' + code;
								} else {
									return 'pagePromise = pagePromise.then(function() {return ' + code;
								};
							};

							const endAsync = function endAsync(/*optional*/code) {
								if (types.hasAsyncAwait()) {
									return (code || '');
								} else {
									return (code || '') + '}, null, this);';
								};
							};

							const fnFooter = function fnFooter() {
								if (!types.hasAsyncAwait()) {
									codeParts[codeParts.length] = 'return pagePromise;';
								};
							};

							const endFn = function endFn() {
								fnFooter();
								codeParts[codeParts.length] = '})';
							};

							const writeAsyncWrites = function writeAsyncWrites(state) {
								if (state.writes) {
									codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncWrite(' + state.writes.slice(0, -3) + ');');   // remove extra " + "
									state.writes = '';
								};
							};
							
							// TODO: Possible stack overflow ("parseNode" is recursive) : Rewrite in a while loop ?
							// TODO: SafeEval on expressions

							const parseNode = function parseNode(node, state) {
								let hasVariables = false;
										
								node.getChildren().forEach(function forEachChild(child, pos, ar) {
									if (child instanceof xml.Element) {
										const name = child.getName(),
											ns = child.getBaseURI();

										if (ns === DDI_URI) {
											if (name === 'body') {
												parseNode(child, state);
											};
										} else if (ns === DDT_URI) {
											writeHTML(state);
											writeAsyncWrites(state);
											if (name === 'when-true') {
												if (!state.isIf) {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!(' + child.getAttr('expr') + ');');
												};
												codeParts[codeParts.length] = 'if (__expr__) {';
												const newState = types.extend({}, state, {isIf: false});
												parseNode(child, newState);
												writeHTML(newState);
												writeAsyncWrites(newState);
												codeParts[codeParts.length] = '};';
											} else if (name === 'when-false') {
												if (!state.isIf) {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!(' + child.getAttr('expr') + ');');
												};
												codeParts[codeParts.length] = 'if (!__expr__) {';
												const newState = types.extend({}, state, {isIf: false});
												parseNode(child, newState);
												writeHTML(newState);
												writeAsyncWrites(newState);
												codeParts[codeParts.length] = '};';
											} else if (!state.isIf) {
												if (name === 'html') {
													parseNode(child, state);
												} else if (name === 'if') {
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('const __expr__ = !!(' + child.getAttr('expr') + ');');
													const newState = types.extend({}, state, {isIf: true});
													parseNode(child, newState);
													writeHTML(newState);
													writeAsyncWrites(newState);
												} else if (name === 'script') {
													const vars = (child.getAttr('vars') || '').split(' ').filter(function filterVar(v) {return !!v});
													if (vars.length) {
														codeParts[codeParts.length] = ('var ' + vars.join(' = null, ') + ' = null;');
													};
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncScript(function() {' + (child.getChildren().getCount() && child.getChildren().getAt(0).getValue()) + '});'); // CDATA or Text
												} else if (name === 'for-each') {
													codeParts[codeParts.length] = startAsync('page.asyncForEach(' + (child.getAttr('items') || 'items') + ', ');
													startFn(child.getAttr('item') || 'item');
													parseNode(child, state);
													writeHTML(state);
													writeAsyncWrites(state);
													endFn();
													codeParts[codeParts.length] = endAsync(');');
												} else if (name === 'eval') {
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncScript(function() {' + 'return page.asyncWrite(escapeHtml((' + child.getChildren().getAt(0).getValue() + ') + ""))});'); // CDATA or Text
												} else if (name === 'variable') {
													// TODO: Fix identation
													const name = (child.getAttr('name') || 'x');
													if (!hasVariables) {
														hasVariables = true;
														codeParts[codeParts.length] = startAsync('page.asyncScript(');
														startFn();
													};
													codeParts[codeParts.length] = ('let ' + name + ' = null;');
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncScript(function() {' + name + ' = (' + (child.getAttr('expr') || '""') + ')});');
												} else if (name === 'include') {
													let path = child.getAttr('src');
													path = self.path.set({file: null}).combine(path);
													const ddi = templatesHtml.DDI.$get(path, 'ddi', self.options);
													codeParts[codeParts.length] = ddi;
													state.promises[state.promises.length] = ddi.open();
													ddi.parents.set(self, self.path.toString());
												} else if ((name === 'cache') && !state.cacheId) {
													state.cacheId = child.getAttr('id');
													const duration = child.getAttr("duration");
													codeParts[codeParts.length] = startAsync('page.asyncCache(' + types.toSource(state.cacheId) + ', ' + types.toSource(duration) + ', ');
													startFn();
													parseNode(child, state);
													writeHTML(state);
													writeAsyncWrites(state);
													endFn();
													codeParts[codeParts.length] = endAsync(');');
													state.cacheId = null;
												};
											};
										} else if (ns === HTML_URI) {
											if (!state.isIf) {
												let addCharset = false;
												if (name === 'head') {
													// TODO: Replace by an XPATH search when they will be available in doodad-js-xml.
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
												};
												state.html += '<' + name;
												const ignoreAttrs = [];
												if (name === 'script') {
													if (child.hasAttr('async')) {
														state.html += ' async';
														ignoreAttrs.push('async');
													};
												};
												const attrs = child.getAttrs();
												if (tools.findItem(attrs, function(attr) {
													return (attr.getBaseURI() === DDT_URI);
												}) === null) {
													attrs.forEach(function forEachAttr(attr) {
														const key = attr.getName();
														if (ignoreAttrs.indexOf(key) <= 0) {
															const value = attr.getValue();
															state.html += ' ' + tools.escapeHtml(key) + '="' + tools.escapeHtml(value) + '"';
														};
													}, this);
												} else {
													writeHTML(state);
													writeAsyncWrites(state);
													const integrities = [];
													attrs.forEach(function forEachAttr(attr) {
														const key = attr.getName();
														if (ignoreAttrs.indexOf(key) <= 0) {
															const value = attr.getValue(),
																compute = (attr.getBaseURI() === DDT_URI);
															if (compute) {
																let integrity = null;
																if ((name === 'script') && (key === 'integrity')) {
																	integrity = 'src';
																} else if ((name === 'link') && (key === 'integrity')) {
																	integrity = 'href';
																};
																if (integrity) {
																	integrities[integrities.length] = __Internal__.surroundAsync('page.compileIntegrityAttr(' + types.toSource(key) + ',' + types.toSource(value) + ',' + types.toSource(integrity) + ');');
																} else {
																	codeParts[codeParts.length] = __Internal__.surroundAsync('page.compileAttr(' + types.toSource(key) + ',(' + value + '));');
																};
															} else {
																codeParts[codeParts.length] = __Internal__.surroundAsync('page.compileAttr(' + types.toSource(key) + ',' + types.toSource(value) + ');');
															};
														};
													}, this);
													types.append(codeParts, integrities);
													codeParts[codeParts.length] = __Internal__.surroundAsync('page.asyncWriteAttrs();');
												};
												const children = child.getChildren();
												// <PRB> Browsers do not well support "<name />"
												const mandatoryContent = (tools.indexOf(['area', 'base', 'br', 'col', 'head', 'hr', 'img', 'input', 'link', 'param', 'track'], name) < 0);
												let hasChildren = addCharset || !!children.getCount() || mandatoryContent;
												if (hasChildren) {
													state.html += '>';
													if (addCharset) {
														state.html += '<meta charset="UTF-8"/>';
													};
													parseNode(child, state);
													state.html += '</' + name + '>';
												} else {
													state.html += '/>';
												};
											};
										};
									} else if ((!state.isIf) && (child instanceof xml.Text)) {
										state.html += tools.escapeHtml(child.getValue().replace(/\r|\n|\t/g, ' ').replace(/[ ]+/g, ' '));
									} else if ((!state.isIf) && (child instanceof xml.CDATASection)) {
										state.html += '<![CDATA[' + child.getValue().replace(/\]\]\>/g, "]]]]><![CDATA[>") + ']]>';
									};
								}, this);

								if (hasVariables) {
									endFn();
									codeParts[codeParts.length] = endAsync(');');
								};
							};
							
							const state = {
								html: '',
								writes: '',
								isIf: false,
								promises: [],
								cacheId: null,
							};


							fnHeader();

							if (this.type === 'ddt') {
								// TODO: Replace by XPATH search when it will be available in doodad-js-xml.
								const doctypeNodes = ddi.getChildren().find('doctype')
									.filter(function(doctypeNode) {
										return doctypeNode.getBaseURI() === DDT_URI;
									});
								if (doctypeNodes.length) {
									const valueNodes = doctypeNodes.getAt(0).getChildren();
									state.html += '<!DOCTYPE ' + (valueNodes.getCount() && valueNodes.getAt(0).getValue() || 'html') + '>\n'
								} else {
									state.html += '<!DOCTYPE html>\n'
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
						},

						_new: types.SUPER(function _new(path, type, /*optional*/options) {
							this._super();
							this.type = type;
							this.options = types.extend({}, options);
							this.name = path.file.replace(/\./g, '_');
							this.path = path;
							this.parents = new types.Map();
						}),
						
						open: function open() {
							const Promise = types.getPromise();
							if (this.doc) {
								// Already opened.
								return Promise.resolve();
							};
							const encoding = types.getDefault(this.options, 'encoding', 'utf-8');
							return files.openFile(this.path, {encoding: encoding})
								.then(function openFilePromise(stream) {
									let promise = Promise.resolve(null);
									if (xml.isAvailable({schemas: true})) {
										promise = __Internal__.resourcesLoader.locate('./schemas/');
									};
									promise = promise.then(function(xsdRoot) {
										let xsd = null;
										if (xsdRoot) {
											xsd = xsdRoot.combine(files.parsePath(this.type === 'ddt' ? "./ddt/ddt.xsd" : "./ddt/ddi.xsd"), {includePathInRoot: true});
										};
										return xml.parse(stream, {entities: __Internal__.entities, discardEntities: true, xsd: xsd});
									}, null, this);
									return promise
										.then(function parseXmlPromise(doc) {
											types.DESTROY(stream);
											this.doc = doc;
//console.log(require('util').inspect(this.doc));
											this.codeParts = [];
											return this.parse();
										}, null, this);
								}, null, this);
						},

						toString: function toString(/*optional*/level, /*optional*/writeHeader) {
							let code = '';
							if (types.isNothing(level)) {
								level = '';
							};
							const newLevel = level + '    ';
							if (this.codeParts && this.codeParts.length) {
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
								return level + (types.hasAsyncAwait() ? 'async ' : '') + 'function ' + this.name + '() {' + 
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

									const type = namespaces.get(name);
								
									return Promise.try(function() {
											if (!type) {
												return modules.load([
														{
															path: this.path.set({extension: (root.getOptions().fromSource ? 'js' : 'min.js')}),
														},
													], {startup: {secret: _shared.SECRET}})
													.nodeify(function(err, dummy) {
														if (err) {
															return type;
														};
														return namespaces.get(name);
													});
											};
											return type;
										}, this)
										.then(function(type) {
											if (!types._implements(type, templatesHtml.PageTemplate)) {
												throw new types.TypeError("Unknown page template '~0~'.", [name]);
											};
								
											const code = this.toString('', true);
								//console.log(code);
											const locals = {root: root};
											let fn = safeEval.createEval(types.keys(locals))
											fn = fn.apply(null, types.values(locals));
											fn = fn('(function() {' + this.getScriptVariables() + ';\nreturn (' + code + ')})()');
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
											}));

											let listener;
											this.addEventListener('unload', listener = function(ev) {
												this.removeEventListener('unload', listener);
												_shared.invoke(templ, '$onUnload', null, _shared.SECRET);
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
										modules.load([{module: module, path: path}], {startup: {secret: _shared.SECRET}, global: {ddtxId: key}}),
									])
									.then(function(results) {
										const ddtx = __Internal__.ddtxCache[key] = results[0];
										return ddtx;
									});
							} else {
								return modules.locate(module, path)
									.then(function(resolvedPath) {
										const ddt = templatesHtml.DDT.$get(resolvedPath, options);
										return ddt.build();
									});
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
								__Internal__.ddtxCache[key] = ddtx;
								return ddtx;
							};
						});
					});
				});


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
									__Internal__.entities = entities;
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