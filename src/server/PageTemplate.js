//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2018 Claude Petit, licensed under Apache License version 2.0\n", true)
	// doodad-js - Object-oriented programming framework
	// File: PageTemplate.js - PageTemplate base class (server)
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
	//! INJECT("import {default as nodeCrypto} from 'crypto';");
//! ELSE()
	"use strict";

	const nodeCrypto = require('crypto');
//! END_IF()

const nodeCryptoCreateHash = nodeCrypto.createHash;


exports.add = function add(modules) {
	modules = (modules || {});
	modules['Doodad.Templates.Html/PageTemplate'] = {
		version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
		create: function create(root, /*optional*/_options, _shared) {
			//===================================
			// Get namespaces
			//===================================

			const doodad = root.Doodad,
				types = doodad.Types,
				tools = doodad.Tools,
				//modules = doodad.Modules,
				namespaces = doodad.Namespaces,
				templates = doodad.Templates,
				templatesHtml = templates.Html,
				io = doodad.IO,
				ioMixIns = io.MixIns,
				//ioInterfaces = io.Interfaces,
				//nodeJs = doodad.NodeJs,
				//nodeJsIO = nodeJs.IO,
				//nodejsIOInterfaces = nodeJsIO.Interfaces,
				//safeEval = tools.SafeEval,
				files = tools.Files,
				modules = doodad.Modules;


			//const __Internal__ = {
			//};


			templatesHtml.REGISTER(doodad.BASE(templatesHtml.TemplateBase.$extend(
				{
					$TYPE_NAME: 'PageTemplate',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('PageTemplateBase')), true) */,

					request: doodad.PUBLIC(doodad.READ_ONLY(null)),

					__writeBuffer: doodad.PROTECTED(null),
					__cacheStream: doodad.PROTECTED(null),
					__cacheHandler: doodad.PROTECTED(null),
					__compiledAttrs: doodad.PROTECTED(null),
					__loadDone: doodad.PROTECTED(false),

					create: doodad.OVERRIDE(function create(request, cacheHandler, /*optional*/options) {
						this._super(options);

						this.__cacheHandler = cacheHandler;

						const type = types.getType(this);

						const state = request.getHandlerState(cacheHandler);
						const cache = types.get(type.$options, 'cache', false);
						state.noMain = !cache;
						state.defaultDuration = (cache ? types.get(type.$options, 'cacheDuration', null) : '');

						// Disable client (browser) and proxy cache.
						request.response.addHeaders({
							'Cache-Control': 'no-cache, no-store, must-revalidate',
							'Pragma': 'no-cache',
							'Expires': '0',
						});

						types.setAttribute(this, 'request', request);
					}),

					render: doodad.OVERRIDE(function render() {
						this.__writeBuffer = '';
						this.__cacheStream = null;

						return this._super();
					}),

					writeAsync: doodad.OVERRIDE(function writeAsync(code, /*optional*/options) {
						const flush = types.get(options, 'flush', false);
						if (code) {
							this.__writeBuffer += code;
						};
						const buffer = this.__writeBuffer;
						if (buffer && (flush || (buffer.length >= (1024 * 1024 * 1)))) {  // TODO: Add an option in DDT for max buffer length
							this.__writeBuffer = '';
							return this._super(buffer, options)
								.then(function() {
									if (this.__cacheStream) {
										return this.__cacheStream.writeAsync(buffer);
									};
									return undefined;
								}, null, this);
							//.catch(function(err) {
							//	types.DEBUGGER();
							//});
						};
						this.overrideSuper();
						return undefined;
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

					asyncCache: doodad.OVERRIDE(function asyncCache(id, duration, fn) {
						const Promise = types.getPromise();
						const type = types.getType(this);
						const start = function start() {
							let cached = null;
							if (this.__cacheHandler) {
								const sectionKey = this.__cacheHandler.createKey({
									type: 'cacheSection',
									id: id,
								});
								types.freezeObject(sectionKey);   // key is complete
								cached = this.__cacheHandler.getCached(this.request, {create: true, section: sectionKey});
							};
							if (cached && cached.isValid()) {
								return this.__cacheHandler.openFile(this.request, cached)
									.then(function(cacheStream) {
										if (cacheStream) {
											const promise = cacheStream.onEOF.promise();
											cacheStream.pipe(this, {end: false});
											cacheStream.flush();
											return promise;
										} else {
											return start.call(this); // cache file has been deleted
										};
									}, null, this);
							} else if (cached && cached.isInvalid() && (this.request.verb !== 'HEAD')) {
								return this.__cacheHandler.createFile(this.request, cached, {encoding: types.get(type.$options, 'encoding', 'utf-8'), duration: duration})
									.then(function(cacheStream) {
										this.__cacheStream = cacheStream;
										// <PRB> Because of async/await, must convert the Promise back to a DDPromise using DDPromise.resolve().
										return Promise.resolve(fn.call(this))
											.then(function() {
												return this.writeAsync(null, {flush: true});
											}, null, this)
											.then(function() {
												this.__cacheStream = null;
												if (cacheStream) {
													// TODO: Write a helper for that, like ".end"
													if (cacheStream._implements(ioMixIns.BufferedStreamBase)) {
														return cacheStream.flushAsync({purge: true})
															.then(function() {
																if (cacheStream.canWrite()) {
																	cacheStream.write(io.EOF);
																	return cacheStream.flushAsync({purge: true});
																};
																return undefined;
															});
													} else {
														return cacheStream.writeAsync(io.EOF);
													};
												};
												return undefined;
											}, null, this)
											.then(function outputOnEOF(ev) {
												cached.validate();
												type.$onUnload.attachOnce(null, function(ev) {
													cached.invalidate();

													types.DESTROY(cached);
												});
											}, null, this)
											.catch(function(err) {
												cached.abort();
												throw err;
											}, this);
									}, null, this);
							} else {
								this.__cacheStream = null;
								return Promise.resolve(fn.call(this))
									.then(function() {
										return this.writeAsync(null, {flush: true});
									}, null, this);
							};
						};
						return this.writeAsync(null, {flush: true})
							.then(start, null, this);
					}),

					asyncLoad: doodad.OVERRIDE(function(options, mods, defaultIntegrity, doodadPackageUrl, bootTemplateUrl) {
						// TODO: Startups

						if (this.__loadDone) {
							throw new types.NotAvailable("'asyncLoad' has already been called.");
						};

						this.__loadDone = true;

						const Promise = types.getPromise();

						if (options || mods) {
							const url = this.request.url.set({file: null}).removeArgs();
							//url = url.setArgs({sessionId: this.request.url.getArg('sessionId', true)})  TODO: User Sessions
							let doodadUrl = url.combine(doodadPackageUrl);
							let bootUrl = url.combine(bootTemplateUrl);

							const ddOptions = root.getOptions();

							if (!ddOptions.debug && !ddOptions.fromSource) {
								// TODO: Move "isMinJs" to "Tools.File"
								const isMinJs = function _isMinJs(path) {
									const ext = "." + path.extension + ".";
									return ext.indexOf('.min.') >= 0;
								};
								if (!isMinJs(doodadUrl)) {
									// TODO: Create "toMinJs" function in "Tools.Files"
									doodadUrl = doodadUrl.set({extension: 'min.' + doodadUrl.extension});
								};
								if (!isMinJs(bootUrl)) {
									// TODO: Create "toMinJs" function in "Tools.Files"
									bootUrl = bootUrl.set({extension: 'min.' + bootUrl.extension});
								};
							};

							const isMJS = function _isMJS(path) {
								const ext = "." + path.extension;
								return ext.endsWith('.mjs');
							};

							const modulesUri = files.parseUrl(this.options.variables && this.options.variables.modulesUri || '/');

							return Promise.map(mods || [], function(mod) {
								let integrityMode = mod.integrity;
								if (integrityMode === 'auto') {
									integrityMode = defaultIntegrity;
								};
								if (integrityMode) {
									return modules.clientLocate(mod.module, mod.path, {debug: true, baseUrl: this.request.url})
										.then(function(modUrl) {
											return modules.clientResolve(modUrl, {modulesUri, baseUrl: this.request.url});
										}, null, this)
										.then(function(modUrl) {
											return this.getIntegrityValue(integrityMode, modUrl.set({extension: 'js'}))
												.catch(function(err) {
													return null;
												}, this)
												.then(function(integrity) {
													mod.integrity = integrity;
													return this.getIntegrityValue(integrityMode, modUrl.set({extension: 'min.js'}));
												}, null, this)
												.catch(function(err) {
													return null;
												}, this)
												.then(function(integrity) {
													mod.integrityMin = integrity;
													return this.getIntegrityValue(integrityMode, modUrl.set({extension: 'mjs'}));
												})
												.catch(function(err) {
													return null;
												}, this)
												.then(function(integrity) {
													mod.integrityMjs = integrity;
													return this.getIntegrityValue(integrityMode, modUrl.set({extension: 'min.mjs'}));
												})
												.catch(function(err) {
													return null;
												}, this)
												.then(function(integrity) {
													mod.integrityMjsMin = integrity;
												}, null, this);
										}, null, this)
										.then(function() {
											return mod;
										}, null, this);
								};
								return mod;
							}, {thisObj: this, concurrency: 1})
								.then(function(mods) {
									return this.request.resolve(doodadUrl, 'Doodad.Server.Http.StaticPage')
										.then(function(doodadResult) {
											if (!doodadResult) {
												throw new types.Error("Can't resolve resource at '~0~'.", [doodadUrl.toApiString()]);
											};

											const doodadResolved = doodadResult[0];
											//const doodadHandler = doodadResolved.handler;
											//const doodadState = this.request.getHandlerState(doodadHandler);

											return this.request.resolve(bootUrl, 'Doodad.NodeJs.Server.Http.JavascriptFileSystemPage')
												.then(function(bootResult) {
													if (!bootResult) {
														throw new types.Error("Can't resolve resource at '~0~'.", [bootUrl.toApiString()]);
													};

													const bootResolved = bootResult[0];
													const bootHandler = bootResolved.handler;
													//const bootState = this.request.getHandlerState(bootHandler);

													return bootHandler.setJsVars(this.request, {options: options || null, modules: (mods && mods.length > 0 ? mods : null), startups: null})
														.then(function(varsId) {
															const bootUrlVars = bootResolved.url.setArgs({vars: varsId});

															// TODO: invalidate "bootUrlVars" on "varsId" expiration

															return (defaultIntegrity ? this.getIntegrityValue(defaultIntegrity, doodadResolved.url) : Promise.resolve(null))
																.then(function(integrity) {
																	const mjs = isMJS(doodadResolved.url);
																	// Put integrity in URL so that different versions of the same file are uploaded to the browser (because of the cache).
																	const url = (integrity ? doodadResolved.url.setArgs({integrity}) : doodadResolved.url);
																	return this.writeAsync('<script async src="' + url.toApiString() + '"' + (integrity ? ' integrity="' + integrity + '"' : '') + (mjs ? ' type="module"' : '') + '></script>');
																}, null, this)
																.then(function(dummy) {
																	return (defaultIntegrity ? this.getIntegrityValue(defaultIntegrity, bootUrlVars) : Promise.resolve(null))
																		.then(function(integrity) {
																			const mjs = isMJS(bootUrlVars);
																			// Put integrity in URL so that different versions of the same file are uploaded to the browser (because of the cache).
																			const url = (integrity ? bootUrlVars.setArgs({integrity}) : bootUrlVars);
																			return this.writeAsync('<script async src="' + url.toApiString() + '"' + (integrity ? ' integrity="' + integrity + '"' : '') + (mjs ? ' type="module"' : '') + '></script>');
																		}, null, this);
																}, null, this);
														}, null, this);
												}, null, this);
										}, null, this);
								}, null, this);
						};

						return undefined;
					}),

					getFileHash: doodad.PROTECTED(doodad.ASYNC(function getFileHash(type, fileStream) {
						const Promise = types.getPromise();

						const list = tools.split(type.toLowerCase(), ',', 2); // "algorithm,encoding"

						return Promise.create(function hashPromise(resolve, reject) {
							const hashStream = nodeCryptoCreateHash(list[0]);

							const end = function end(err, hash) {
								if (err) {
									reject(err);
								} else {
									resolve(hash);
								};
								types.DESTROY(hashStream);
							};

							hashStream.once('error', function(err) {
								end(err, null);
							});

							hashStream.once('finish', function(err) {
								end(null, hashStream.read().toString(list[1]));
							});

							fileStream.pipe(hashStream);
						});
					})),

					getIntegrityValue: doodad.PROTECTED(doodad.ASYNC(function getIntegrityValue(type, url) {
						url = files.parseUrl(url);
						type = type.split(',')[0];

						if (type.toLowerCase() === 'auto') {
							type = 'sha256'; // default hash type
						};

						//const handlerState = this.request.getHandlerState();

						// TODO: Combine URLs with "baseURI" attribute or "base" element if present
						const fullUrl = this.request.url.set({file: null}).combine(url);

						return this.request.resolve(fullUrl, 'Doodad.Server.Http.StaticPage')
							.then(function(result) {
								if (!result) {
									throw new types.Error("Can't resolve URL '~0~'.", [url]);
								};
								const resolved = result[0];
								return resolved.handler.createStream(this.request, {url: resolved.url})
									.then(function(stream) {
										const getHash = function _getHash() {
											return this.getFileHash(type + ',base64', stream)
												.then(function(hash) {
													return (type + '-' + hash);
												})
												.catch(function(err) {
													throw new types.Error("Can't get the integrity value of the file at the URL '~0~' : ~1~.", [url, err]);
												});
										};

										const start = function _start() {
											let cached = null;
											if (this.__cacheHandler) {
												const key = this.__cacheHandler.createKey({
													hash: type,
													url: resolved.url.toApiString(),
												});
												types.freezeObject(key); // Key is complete
												const FileSystemPage = root.getOptions().debug && namespaces.get('Doodad.NodeJs.Server.Http.FileSystemPage');
												const request = this.request;
												cached = this.__cacheHandler.getCached(request, {
													isMain: false,
													create: true,
													key: key,
													onNew: (FileSystemPage && types.isLike(resolved.handler, FileSystemPage) ? function(cached) {
														const path = resolved.handler.getSystemPath(request, resolved.url);

														if (path) {
															let onUnloadListener = null;

															cached.addEventListener('validate', function() {
																if (!onUnloadListener) {
																	try {
																		files.watch(path, onUnloadListener = function() {
																			cached.invalidate();
																		}, {once: true});
																	} catch(ex) {
																		// Do nothing
																	};
																};
															});

															cached.addEventListener('invalidate', function() {
																if (onUnloadListener) {
																	files.unwatch(path, onUnloadListener);
																	onUnloadListener = null;
																};
															});
														};
													} : null)
												}
												);
											};
											if (cached && cached.isValid()) {
												return this.__cacheHandler.openFile(this.request, cached)
													.then(function(cacheStream) {
														if (cacheStream) {
															// NOTE: "CacheStream" is binary.
															return cacheStream.readAsync()
																.then(function(buf) {
																	const promise = cacheStream.onEOF.promise()
																		.then(function() {
																			const hash = io.TextData.$decode(buf, 'ascii');
																			return hash;
																		}, null, this);
																	cacheStream.flush({purge: true});
																	return promise;
																}, null, this);
														} else {
															return start.call(this); // cache file has been deleted
														};
													}, null, this);

											} else if (cached && cached.isInvalid() && (this.request.verb !== 'HEAD')) {
												return getHash.call(this)
													.then(function(hash) {
														if (cached.isInvalid()) {
															return this.__cacheHandler.createFile(this.request, cached, {encoding: 'utf-8'})
																.then(function(cacheStream) {
																	return cacheStream && cacheStream.writeAsync(hash)
																		.then(function() {
																			if (cacheStream) {
																				// TODO: Write a helper for that, like ".end"
																				if (cacheStream._implements(ioMixIns.BufferedStreamBase)) {
																					return cacheStream.flushAsync({purge: true})
																						.then(function() {
																							if (cacheStream.canWrite()) {
																								cacheStream.write(io.EOF);
																								return cacheStream.flushAsync({purge: true});
																							};
																							return undefined;
																						}, null, this);
																				} else {
																					return cacheStream.writeAsync(io.EOF);
																				};
																			};
																			return undefined;
																		}, null, this)
																		.then(function() {
																			cached.validate();
																			return hash;
																		}, null, this)
																		.catch(function(err) {
																			cached.abort();
																			throw err;
																		}, this);
																}, null, this);
														} else {
															return start.call(this);
														};
													}, null, this);

											} else {
												return getHash.call(this);

											};
										};
										return start.call(this);
									}, null, this);
							}, null, this);
					})),

					compileIntegrityAttr: doodad.OVERRIDE(function compileIntegrityAttr(key, value, src) {
						const Promise = types.getPromise();
						let compiledAttrs = this.__compiledAttrs;
						if (!compiledAttrs) {
							compiledAttrs = tools.nullObject();
							this.__compiledAttrs = compiledAttrs;
						};
						compiledAttrs[key] = function() {
							let srcAttr = compiledAttrs[src];
							if (types.isFunction(srcAttr)) {
								srcAttr = srcAttr.call(this);
							};
							return Promise.resolve(srcAttr)
								.then(function(srcVal) {
									return this.getIntegrityValue(value, srcVal)
										.then(function(integrity) {
											// Put integrity in URL so that different versions of the same file are uploaded to the browser (because of the cache).
											const url = (integrity ? files.Url.parse(srcVal).setArgs({integrity}).toApiString() : srcVal);
											compiledAttrs[src] = url;
											return integrity;
										}, null, this);
								}, null, this);
						};
					}),

					compileAttr: doodad.OVERRIDE(function asyncCompileAttr(key, value) {
						let compiledAttrs = this.__compiledAttrs;
						if (!compiledAttrs) {
							compiledAttrs = tools.nullObject();
							this.__compiledAttrs = compiledAttrs;
						};
						value = types.toString(value);
						compiledAttrs[key] = function() {
							return value;
						};
					}),

					asyncWriteAttrs: doodad.OVERRIDE(function asyncWriteAttrs() {
						const Promise = types.getPromise();
						const compiledAttrs = this.__compiledAttrs;
						this.__compiledAttrs = null;
						return Promise.map(types.keys(compiledAttrs), function(name) {
							let attr = compiledAttrs[name];
							if (types.isFunction(attr)) {
								attr = attr.call(this);
							};
							return Promise.resolve(attr)
								.then(function(value) {
									compiledAttrs[name] = value;
								}, null, this);
						}, {thisObj: this, concurrency: 1})
							.then(function() {
								return Promise.map(types.keys(compiledAttrs), function(name) {
									const value = compiledAttrs[name];
									return this.writeAsync(' ' + tools.escapeHtml(types.toString(name), true) + '="' + tools.escapeHtml(types.toString(value), false) + '"');
								}, {thisObj: this, concurrency: 1});
							}, null, this);
					}),
				})));


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
