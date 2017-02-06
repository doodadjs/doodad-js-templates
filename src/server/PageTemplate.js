//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2017 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: PageTemplate.js - PageTemplate base class (server)
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
		DD_MODULES['Doodad.Templates.Html/PageTemplate'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";
				
				//===================================
				// Get namespaces
				//===================================
				
				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					templates = doodad.Templates,
					templatesHtml = templates.Html,
					io = doodad.IO,
					safeEval = tools.SafeEval,
					files = tools.Files,
				
					nodeCrypto = require('crypto'),
					nodeFs = require('fs');
				
				//const __Internal__ = {
				//};
				

				
				templatesHtml.REGISTER(doodad.BASE(templatesHtml.TemplateBase.$extend(
					{
						$TYPE_NAME: 'PageTemplate',
						$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('PageTemplateBase')), true) */,
						
						request: doodad.PUBLIC(doodad.READ_ONLY(null)),
						
						__buffer: doodad.PROTECTED(null),
						__cacheStream: doodad.PROTECTED(null),
						__cacheHandler: doodad.PROTECTED(null),
						__compiledAttrs: doodad.PROTECTED(null),
						
						create: doodad.OVERRIDE(function create(request, cacheHandler) {
							this._super();
							
							this.__cacheHandler = cacheHandler;
	
							const type = types.getType(this);

							const cached = cacheHandler.getCached(request)
							cached.disabled = !type.$ddt.cache;
							cached.duration = type.$ddt.cacheDuration;

							_shared.setAttribute(this, 'request', request);
						}),
						
						render: doodad.OVERRIDE(function render() {
							this.__buffer = '';
							this.__cacheStream = null;
							
							return this._super();
						}),

						asyncWrite: doodad.OVERRIDE(function asyncWrite(code, /*optional*/flush) {
							this.__buffer += (code || '');
							if (flush || (this.__buffer.length >= (1024 * 1024 * 1))) {  // TODO: Add an option in DDT for max buffer length
								const buffer = this.__buffer;
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
						}),
						
						asyncForEach: doodad.OVERRIDE(function asyncForEach(items, fn) {
							const Promise = types.getPromise();
							return Promise.resolve(items) // Items can be a Promise or a value
								.then(function(items) {
									return Promise.map(items, fn, {concurrency: 1, thisObj: this});
								}, null, this);
						}),
						
						asyncInclude: doodad.OVERRIDE(function asyncInclude(fn) {
							return fn.call(this);
						}),
						
						asyncScript: doodad.OVERRIDE(function asyncScript(fn) {
							return fn.call(this);
						}),

						asyncCache: doodad.OVERRIDE(function asyncStartCache(id, duration, fn) {
							const Promise = types.getPromise();
							const type = types.getType(this);
							const start = function start() {
								const cached = this.__cacheHandler.getCached(this.request, {section: id});
								if (cached.isValid()) {
									return this.__cacheHandler.openFile(this.request, cached)
										.then(function(cacheStream) {
											if (cacheStream) {
												const promise = cacheStream.onEOF.promise();
												cacheStream.pipe(this.stream, {end: false});
												cacheStream.flush();
												return promise;
											} else {
												return start.call(this); // cache file has been deleted
											};
										}, null, this);
								} else if (cached.isInvalid()) {
									return this.__cacheHandler.createFile(this.request, cached, {encoding: type.$ddt.options.encoding, duration: duration})
										.then(function(cacheStream) {
											this.__cacheStream = cacheStream;
											// <PRB> Because of async/await, must convert the Promise back to a DDPromise using DDPromise.resolve().
											return Promise.resolve(fn.call(this))
												.then(function() {
													return this.asyncWrite(null, true);
												}, null, this)
												.then(function() {
													this.__cacheStream = null;
													return cacheStream.writeAsync(io.EOF);
												}, null, this)
												.then(function outputOnEOF(ev) {
													cached.validate();
													let listener;
													type.$ddt.addEventListener('unload', listener = function(ev) {
														type.$ddt.removeEventListener('unload', listener);
														cached.invalidate();
													});
												}, null, this)
												.catch(function(err) {
													cacheStream.write(io.EOF);
													cached.abort();
													throw err;
												}, this);
										}, null, this);
								};
							};
							return this.asyncWrite(null, true)
								.then(start, null, this);
						}),

						getFileHash: doodad.PROTECTED(doodad.ASYNC(function getFileHash(type, path) {
							const Promise = types.getPromise();

							const list = tools.split(type.toLowerCase(), ',', 2); // "algorithm,encoding"

							return Promise.create(function hashPromise(resolve, reject) {
								const hashStream = nodeCrypto.createHash(list[0]);
								const fileStream = nodeFs.createReadStream(types.toString(path));

								const end = function end(err) {
									if (err) {
										reject(err);
									} else {
										resolve(hashStream.digest(list[1]));
									};
									types.DESTROY(fileStream);
									types.DESTROY(hashStream);
								};

								hashStream.once('error', function(err) {
									end(err);
								});

								fileStream.once('error', function(err) {
									end(err);
								});
								fileStream.on('data', function(data) {
									hashStream.update(data);
								});
								fileStream.once('end', function() {
									end(null);
								});
							});
						})),

						getIntegrityValue: doodad.PROTECTED(doodad.ASYNC(function getIntegrityValue(type, url) {
							type = type.split(',')[0];
							const handlerState = this.request.getHandlerState();
							// TODO: Combine URLs with "baseURI" attribute or "base" element if present
							url = handlerState.matcherResult.url.combine(url);
							const handler = this.request.resolve(url, 'Doodad.Server.Http.StaticPage');
							if (handler) {
								const start = function start() {
									const cached = this.__cacheHandler.getCached(this.request, {section: types.toString(url)});
									if (cached.isValid()) {
										return this.__cacheHandler.openFile(this.request, cached)
											.then(function(cacheStream) {
												if (cacheStream) {
													return cacheStream.read().valueOf();
												} else {
													return start.call(this); // cache file has been deleted
												};
											}, null, this);
									} else if (cached.isInvalid()) {
										const path = handler.getSystemPath(this.request, url);
										return this.getFileHash(type + ',base64', path)
											.then(function(hash) {
												hash = (type + '-' + hash);
												return this.__cacheHandler.createFile(this.request, cached, {encoding: 'utf-8'})
													.then(function(cacheStream) {
														return cacheStream.writeAsync(hash)
															.then(function() {
																return cacheStream.writeAsync(io.EOF);
															}, null, this)
															.then(function() {
																cached.validate();
																let listener;
																const type = types.getType(this);
																type.$ddt.addEventListener('unload', listener = function(ev) {
																	type.$ddt.removeEventListener('unload', listener);
																	cached.invalidate();
																});
																if (root.getOptions().debug) {
																	files.watch(path, listener, {once: true});
																};
																return hash;
															}, null, this)
															.catch(function(err) {
																cacheStream.write(io.EOF);
																cached.abort();
																throw err;
															}, this);
													}, null, this)
											}, null, this);
									};
								};
								return start.call(this);
							} else {
								throw new types.Error("Can't resolve URL '~0~'.", [url]);
							};
						})),

						compileIntegrityAttr: doodad.OVERRIDE(function asyncCompileAttr(key, value, src) {
							const Promise = types.getPromise();
							if (!this.__compiledAttrs) {
								this.__compiledAttrs = types.nullObject();
							};
							const compiledAttrs = this.__compiledAttrs;
							if (value.toLowerCase() === 'auto') {
								value = 'sha256'; // default hash type
							};
							this.__compiledAttrs[key] = function() {
								let srcAttr = compiledAttrs[src];
								if (types.isFunction(srcAttr)) {
									srcAttr = srcAttr.call(this);
								};
								return Promise.resolve(srcAttr)
									.then(function(srcVal) {
										compiledAttrs[src] = srcVal;
										return this.getIntegrityValue(value, srcVal);
									}, null, this);
							};
						}),

						compileAttr: doodad.OVERRIDE(function asyncCompileAttr(key, value) {
							if (!this.__compiledAttrs) {
								this.__compiledAttrs = types.nullObject();
							};
							this.__compiledAttrs[key] = function() {
								return value;
							};
						}),

						asyncWriteAttrs: doodad.OVERRIDE(function asyncWriteAttrs() {
							const Promise = types.getPromise();
							const compiledAttrs = this.__compiledAttrs;
							this.__compiledAttrs = null;
							return Promise.map(types.entries(compiledAttrs), function(entry) {
								let attr = entry[1];
								if (types.isFunction(attr)) {
									attr = attr.call(this);
								};
								return Promise.resolve(attr)
									.then(function(value) {
										entry[1] = value;
										return this.asyncWrite(' ' + tools.escapeHtml(types.toString(entry[0])) + '="' + tools.escapeHtml(types.toString(value)) + '"');
									}, null, this);
							}, {thisObj: this});
						}),
					})));
				
				
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