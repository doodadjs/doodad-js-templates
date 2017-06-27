//! BEGIN_MODULE()
module.exports = {
	add: function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES[/*! INJECT(TO_SOURCE("Doodad.Templates.Html.DDTX/" + VAR("ddtType"))) */] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";

				const doodad = root.Doodad,
					types = doodad.Types,
					namespaces = doodad.Namespaces,
					templates = doodad.Templates,
					templatesHtml = templates.Html,
					templatesDDTX = templatesHtml.DDTX;

				const __Internal__ = {};

				// Create a function to isolate variables injected by VAR("ddtVariables")
				__Internal__.createDDTX = function() {
					const type = namespaces.get(/*! INJECT(TO_SOURCE(VAR("ddtType"))) */);

					if (!types._implements(type, templatesHtml.PageTemplate)) {
						throw new types.TypeError("Unknown page template '~0~'.", [name]);
					};

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

				try {
					templatesDDTX.dispatchEvent(new types.CustomEvent('newDDTX', {detail: {ddtx: __Internal__.createDDTX(), error: null}}));
				} catch(ex) {
					templatesDDTX.dispatchEvent(new types.CustomEvent('newDDTX', {detail: {ddtx: null, error: ex}}));
				};
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()