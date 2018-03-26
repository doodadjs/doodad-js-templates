//! BEGIN_MODULE()

exports.add = function add(modules) {
	modules = (modules || {});
	modules[/*! INJECT(TO_SOURCE("Doodad.Templates.Html.DDTX/" + VAR("ddtType"))) */] = {
		version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
		create: function create(root, /*optional*/_options, _shared) {
			"use strict";

			const doodad = root.Doodad,
				tools = doodad.Tools,
				types = doodad.Types,
				modules = doodad.Modules,
				namespaces = doodad.Namespaces,
				templates = doodad.Templates,
				templatesHtml = templates.Html,
				templatesDDTX = templatesHtml.DDTX;

			const __Internal__ = {};

			// Create a function to isolate variables injected by VAR("ddtVariables")
			__Internal__.createDDTX = function() {
				const Promise = types.getPromise();
				const name = /*! INJECT(TO_SOURCE(VAR("ddtType"))) */;

				return Promise.try(function() {
					const type = namespaces.get(name);

					if (!type) {
						const path = tools.getCurrentScript((global.document?document.currentScript:module.filename)||(function(){try{throw new Error("");}catch(ex){return ex;}})());
						return modules.load([{path: path.set({extension: 'min.js'})}], {startup: {secret: _shared.SECRET}})
							.then(function(dummy) {
								return namespaces.get(name);
							});
					};

					return type;
				})
				.then(function(type) {
					if (!types._implements(type, templatesHtml.PageTemplate)) {
						throw new types.ValueError("Unknown page template '~0~'.", [name]);
					};

					{
						/*! INJECT(VAR("ddtVariables")) */

						return templatesDDTX.REGISTER(type.$extend(
							{
								$TYPE_NAME: /*! INJECT(TO_SOURCE(VAR("ddtType").replace(/\./g, "_"))) */,

								$options: {
									cache: /*! INJECT(TO_SOURCE(VAR("cacheEnabled"))) */,
									cacheDuration: /*! INJECT(TO_SOURCE(VAR("cacheDuration"))) */,
									encoding: /*! INJECT(TO_SOURCE(VAR("encoding"))) */,
								},

								renderTemplate: doodad.OVERRIDE(/*! INJECT(VAR("renderTemplateBody")) */),
							}));
					};
				});
			};

			try {
				templatesDDTX.dispatchEvent(new types.CustomEvent('newDDTX', {detail: {id: types.get(_options, 'ddtxId'), ddtx: __Internal__.createDDTX(), error: null}}));
			} catch(ex) {
				templatesDDTX.dispatchEvent(new types.CustomEvent('newDDTX', {detail: {id: types.get(_options, 'ddtxId'), ddtx: null, error: ex}}));
			};
		},
	};
	return modules;
};

//! END_MODULE()
