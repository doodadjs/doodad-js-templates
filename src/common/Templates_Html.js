//! REPLACE_BY("// Copyright 2015 Claude Petit, licensed under Apache License version 2.0\n")
// dOOdad - Class library for Javascript (BETA) with some extras (ALPHA)
// File: Templates_Html.js - Templates module
// Project home: https://sourceforge.net/projects/doodad-js/
// Trunk: svn checkout svn://svn.code.sf.net/p/doodad-js/code/trunk doodad-js-code
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2015 Claude Petit
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

(function() {
	var global = this;

	global.DD_MODULES = (global.DD_MODULES || {});
	global.DD_MODULES['Doodad.Templates.Html'] = {
		type: null,
		version: '0d',
		namespaces: null,
		dependencies: ['Doodad.Types', 'Doodad.Tools', 'Doodad', 'Doodad.Widgets', 'Doodad.Tools.Xml'],
		
		create: function create(root, /*optional*/_options) {
			"use strict";

			//===================================
			// Get namespaces
			//===================================

			var doodad = root.Doodad,
				types = doodad.Types,
				tools = doodad.Tools,
				namespaces = doodad.Namespaces,
				files = tools.Files,
				widgets = doodad.Widgets,
				xml = tools.Xml,
				templates = doodad.Templates,
				templatesHtml = templates.Html;

				
			var __Internal__ = {
				templatesCached: {},
			};
				
				
			templatesHtml.REGISTER(doodad.BASE(widgets.Widget.$extend(
			{
				$TYPE_NAME: 'PageTemplate',
				
				request: doodad.PUBLIC(doodad.READ_ONLY( null )),

				__buffer: doodad.PROTECTED( null ),
				
				renderPromise: doodad.PUBLIC( null ),
				
				renderTemplate: doodad.PROTECTED(doodad.MUST_OVERRIDE()), // function(stream)
				
				create: doodad.OVERRIDE(function create(request, ddt) {
					this._super();

					this.setAttribute('request', request);
				}),
				
				render: doodad.OVERRIDE(function render(stream) {
					var Promise = tools.getPromise();
					this.renderPromise = Promise.resolve();
					this.__buffer = '';

					this.renderTemplate(stream);
				}),

				asyncWrite: doodad.PROTECTED(function asyncWrite(code, /*optional*/flush) {
					var Promise = tools.getPromise();
					this.renderPromise = this.renderPromise.then(new tools.PromiseCallback(this, function() {
						this.__buffer += (code || '');
						if (flush || (this.__buffer.length >= (1024 * 1024 * 10))) {  // TODO: Find the magic buffer length value
							var self = this;
							return new Promise(function(resolve, reject) {
								self.stream.write(self.__buffer, {callback: function(ex) {
									if (ex) {
								//console.log(ex);
										reject(ex);
									} else {
										resolve();
									};
								}});
								self.__buffer = '';
							});
						} else {
							return Promise.resolve();
						};
					}));
				}),
				
				asyncForEach: doodad.PROTECTED(function asyncForEach(items, fn) {
					var Promise = tools.getPromise();
					this.renderPromise = this.renderPromise.then(new tools.PromiseCallback(this, function() {
						this.renderPromise = Promise.resolve();
						tools.forEach(items, fn);
						return this.renderPromise;
					}));
				}),
				
				asyncInclude: doodad.PROTECTED(function asyncInclude(fn) {
					var Promise = tools.getPromise();
					this.renderPromise = this.renderPromise.then(new tools.PromiseCallback(this, function() {
						this.renderPromise = Promise.resolve();
						fn();
						return this.renderPromise;
					}));
				}),
				
				asyncScript: doodad.PROTECTED(function asyncScript(fn) {
					var Promise = tools.getPromise();
					this.renderPromise = this.renderPromise.then(new tools.PromiseCallback(this, function() {
						this.renderPromise = Promise.resolve();
						var result = fn();
						if (result instanceof Promise) {
							this.renderPromise = result;
						};
						return this.renderPromise;
					}));
				}),
			})));


			templatesHtml.DDI = types.INIT(types.Type.$inherit(
				/*typeProto*/
				{
					$TYPE_NAME: 'DDI',
					
					$get: function $get(path, type, /*optional*/options) {
						var templates = __Internal__.templatesCached,
							key = path.toString();
							
						var ddi;
						if (types.hasKey(templates, key)) {
							//console.log('CACHED ' + key);
							ddi = templates[key];
						} else {
							ddi = templates[key] = new this(path, type, options);
							
							var deleteFn = function(key, ddi) {
								if (delete __Internal__.templatesCached[key]) {
									tools.forEach(ddi.parents, function(key, ddi) {
										deleteFn(key, ddi);
									});
								};
							};

							files.watch(path, new doodad.Callback(this, function() {
								deleteFn(key, ddi);
							}), {once: true});
							
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
					
					getScriptVariables: function getScriptVariables() {
						return {
							Promise: tools.getPromise(),
							console: console,
							escapeHtml: tools.escapeHtml,
						};
					},
					
					getScriptHeader: function getScriptHeader() {
						// NOTE: Returns the header of the "renderTemplate" function
						return (function() {/**START**/
							// Gives access to page object everywhere in "renderTemplate"
							var page = this;
						/**END**/}).toString().match(/[/][*][*]START[*][*][/]((.|\n|\r)*)[/][*][*]END[*][*][/]/)[1];
					},
					
					getScriptFooter: function getScriptFooter() {
						// NOTE: Returns the footer of the "renderTemplate" function
						return (function() {/**START**/
							// Flush buffer
							page.asyncWrite(null, true);
						/**END**/}).toString().match(/[/][*][*]START[*][*][/]((.|\n|\r)*)[/][*][*]END[*][*][/]/)[1];
					},
					
					parse: function parse(parentPath) {
						// TODO: ES7 (async/await) when widely supported (both in all supported browsers & nodejs)
						
						const DDT_URI = "http://www.doodad-js.local/schemas/ddt"
						
						var doctype = this.doc.doctype && this.doc.doctype.nodeValue.trim().split(' ');
						if (!doctype || (doctype[0].toLowerCase() !== this.type)) {
							throw new types.ParseError("Document type is missing or invalid.");
						};

						var ddi = this.doc.root,
							self = this;

						var writeHTML = function writeHTML(state) {
							if (state.html) {
								state.writes += types.toSource(state.html) + ' + ';
								state.html = '';
							};
						};
						
						var writeAsyncWrites = function writeAsyncWrites(state) {
							if (state.writes) {
								self.codeParts.push('page.asyncWrite(' + state.writes.slice(0, -3) + ');');   // remove extra " + "
								state.writes = '';
							};
						};
						
						var parseNode = function parseNode(node, state) {
							for (var i = 0; i < node.childNodes.length; i++) {
								var child = node.childNodes[i];
								if (child.nodeType === xml.NodeTypes.Element) {
									var name = child.nodeName,
										ns = child.baseURI;

									if ((ns === 't') && (name === 'doctype') && !state.hasDocType) {
										state.html += '<!DOCTYPE ' + (child.nodeValue || 'html') + '>\n'
										state.hasDocType = true;
									} else if (!state.hasDocType) {
										state.html += '<!DOCTYPE html>\n'
										state.hasDocType = true;
									};
									
									if (ns === DDT_URI) {
										writeHTML(state);
										writeAsyncWrites(state);
										if ((!state.isIf) && (name === 'script')) {
											var vars = (child.getAttr('vars') || '').split(' ').filter(function(e) {return !!e});
											if (vars.length) {
												self.codeParts.push('var ' + vars.join(', ') + ' = null;');
											};
											self.codeParts.push('page.asyncScript(function() {' + (child.childNodes.length && child.childNodes[0].nodeValue) + '});'); // CDATA or Text
										} else if ((!state.isIf) && (name === 'for-each')) {
											self.codeParts.push('page.asyncForEach(' + (child.getAttr('items') || 'items') + ', function(' + (child.getAttr('item') || 'item') + ') {');
											parseNode(child, state);
											writeHTML(state);
											writeAsyncWrites(state);
											self.codeParts.push('});');
										} else if ((!state.isIf) && (name === 'eval')) {
											self.codeParts.push('page.asyncScript(function() {' + 'page.asyncWrite(escapeHtml((' + child.childNodes[0].nodeValue + ') + ""))});'); // CDATA or Text
										} else if ((!state.isIf) && (name === 'if') && (state.expr = child.getAttr('expr'))) {
											self.codeParts.push('page.asyncScript(function() {var __expr__ = !!(' + state.expr + ');');
											var newState = types.extend({}, state, {isIf: true});
											parseNode(child, newState);
											writeHTML(newState);
											writeAsyncWrites(newState);
											self.codeParts.push('});');
										} else if (name === 'when-true') {
											if (!state.isIf) {
												self.codeParts.push('page.asyncScript(function() {var __expr__ = !!(' + child.getAttr('expr') + ');');
											};
											self.codeParts.push('if (__expr__) {');
											var newState = types.extend({}, state, {isIf: false});
											parseNode(child, newState);
											writeHTML(newState);
											writeAsyncWrites(newState);
											self.codeParts.push('};');
											if (!state.isIf) {
												self.codeParts.push('});');
											};
										} else if (name === 'when-false') {
											if (!state.isIf) {
												self.codeParts.push('page.asyncScript(function() {var __expr__ = !!(' + child.getAttr('expr') + ');');
											};
											self.codeParts.push('if (!__expr__) {');
											var newState = types.extend({}, state, {isIf: false});
											parseNode(child, newState);
											writeHTML(newState);
											writeAsyncWrites(newState);
											self.codeParts.push('};');
											if (!state.isIf) {
												self.codeParts.push('});');
											};
										} else if ((!state.isIf) && (name === 'include')) {
											var path = child.getAttr('src');
											path = self.path.combine(path, {isRelative: true, os: 'linux'});
											var ddi = templatesHtml.DDI.$get(path, 'ddi', self.options);
											self.codeParts.push(ddi);
											state.promises.push(ddi.promise);
											ddi.parents.set(self, parentPath.toString());
											//console.log('SIZE ' + ddi.parents.size);
										};
									} else if ((!state.isIf) && (child.nodeName === 'html') && (self.type === 'ddi')) {
										parseNode(child, state);
									} else if (!state.isIf) {
										if (name === 'head') {
											state.isHead = true;
										} else if (state.isHead && (child.nodeName === 'meta') && (child.hasAttr('charset') || (child.getAttr('http-equiv').toLowerCase() === 'content-type'))) {
											state.hasCharset = true;
										};
										state.html += '<' + name;
										var attrs = types.keys(child.attributes);
										for (var j = 0; j < attrs.length; j++) {
											var key = attrs[j],
												attr = child.attributes[key],
												value = attr.nodeValue,
												ns = attr.baseURI;
											state.html += ' ' + key + '="';
											if (ns === DDT_URI) {
												writeHTML(state);
												writeAsyncWrites(state);
												self.codeParts.push('page.asyncScript(function() {' + 'page.asyncWrite(escapeHtml((' + value + ') + ""))});'); // CDATA or Text
											} else {
												state.html += value;
											};
											state.html += '"';
										};
										// <PRB> Browsers do not well support "<name />"
										var hasChildren = !!child.childNodes.length || (name === 'head') || (['link', 'meta', 'area', 'base', 'br', 'col', 'hr', 'img', 'input', 'param'].indexOf(name) < 0);
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
								} else if ((!state.isIf) && (child.nodeType === xml.NodeTypes.Text)) {
									state.html += child.nodeValue.replace(/\r|\n|\t/g, '').replace(/[ ]+/g, ' ');
								} else if ((!state.isIf) && (child.nodeType === xml.NodeTypes.CDATASection)) {
									state.html += '<![CDATA[' + child.nodeValue + ']]';
								};
							};
						};
						
						var state = {
							hasDocType: (this.type !== 'ddt'),
							hasCharset: false,
							isHead: false,
							html: '',
							writes: '',
							expr: '',
							isIf: false,
							promises: [],
						};
						
						parseNode(ddi, state);
						writeHTML(state);
						writeAsyncWrites(state);
						
						var Promise = tools.getPromise();
						return Promise.all(state.promises);
					},

					_new: types.SUPER(function _new(path, type, /*optional*/options) {
						this._super();
						path = tools.options.hooks.pathParser(path, types.get(options, 'pathOptions'));
						this.type = type;
						this.options = options;
						this.name = path.file.replace(/[.]/g, '_');
						this.path = path;
						this.parents = new types.Map();
						this.promise = files.openFile(path, {encoding: types.get(options, 'encoding', 'utf8')})
							.then(new tools.PromiseCallback(this, function(stream) {
								return xml.parse(stream, {discardEntities: true})
									.then(new tools.PromiseCallback(this, function(doc) {
										this.doc = doc;
							//console.log(require('util').inspect(this.doc));
										this.codeParts = [];
										return this.parse(path)
											.then(new tools.PromiseCallback(this, function() {
												return this;
											}))
									}));
							}));
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
							return level + 'function ' + this.name + '(' + (writeHeader ? 'stream' : '') +') {' + 
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
					pageType: null,
					
					_new: types.SUPER(function _new(path, type, /*optional*/options) {
						this._super(path, type, options);
						
						this.promise = this.promise.then(tools.PromiseCallback(this, function() {
							var ddtNode = this.doc.root,
								name = ddtNode.attributes['type'].nodeValue;
								
								var type = namespaces.getNamespace(name);
								
								root.DD_ASSERT && root.DD_ASSERT(types._implements(type, templatesHtml.PageTemplate), "Unknown page template '~0~'.", [name])
								
								var code = this.toString('', true);
					//console.log(code);
								var locals = this.getScriptVariables();
								var fn = tools.safeEval.createEval(types.keys(locals))
								fn = fn.apply(null, types.values(locals));
								fn = fn('(' + code + ')');
					//console.log(fn);

								return type.$extend(
								{
									$TYPE_NAME: '__' + type.$TYPE_NAME,
									
									renderTemplate: doodad.OVERRIDE(fn),
								});
						}));
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
			//return function init(/*optional*/options) {
			//};
		},
	};
})();