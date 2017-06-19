"doodad-js\" Templates (alpha).

[![NPM Version][npm-image]][npm-url]
 
<<<< PLEASE UPGRADE TO THE LATEST VERSION AS OFTEN AS POSSIBLE >>>>

## Installation

```bash
$ npm install doodad-js-templates
```

## Features

  -  Write your templates in HTML 5.
  -  Use DTD and XSD schema files to validate.
  -  Include other templates in your templates.
  -  Write Javascript code blocks.
  -  "if" Conditions.
  -  "for each" Loops.
  -  Write HTML escaped values.
  -  Widgets.
  -  ...
  -  Non-blocking (uses Promises).
  -  Client-side (browsers) and server-side (node.js).

NOTE: Starting from version 5, HTML should be valid XML. Obviously, some misconceptions of HTML 5 break this rule, so some "negligible" parts of HTML 5 *MIGHT* not be usable. I will fix that later.

NOTE: HTML version 4.x and lower versions are not supported because they almost break XML.

NOTE: I'm waiting for more elaborated DTD and XSD files from " http://www.html5dtd.org/ ". But the author seems very busy.

## Example

Please install "doodad-js-test" and browse its source code. Begin by "./src/server/res/templates/Folder.ddt" in package "doodad-js-http". It is an XML file.

## Other available packages

  - **doodad-js**: Object-oriented programming framework (release)
  - **doodad-js-cluster**: Cluster manager (alpha)
  - **doodad-js-dates**: Dates formatting (beta)
  - **doodad-js-http**: Http server (alpha)
  - **doodad-js-http_jsonrpc**: JSON-RPC over http server (alpha)
  - **doodad-js-io**: I/O module (alpha)
  - **doodad-js-ipc**: IPC/RPC server (alpha)
  - **doodad-js-json**: JSON parser (alpha)
  - **doodad-js-loader**: Scripts loader (beta)
  - **doodad-js-locale**: Locales (beta)
  - **doodad-js-make**: Make tools for doodad (alpha)
  - **doodad-js-mime**: Mime types (beta)
  - **doodad-js-minifiers**: Javascript minifier used by doodad (alpha)
  - **doodad-js-safeeval**: SafeEval (beta)
  - **doodad-js-server**: Servers base module (alpha)
  - **doodad-js-templates**: HTML page templates (alpha)
  - **doodad-js-terminal**: Terminal (alpha)
  - **doodad-js-test**: Test application
  - **doodad-js-unicode**: Unicode Tools (beta)
  - **doodad-js-widgets**: Widgets base module (alpha)
  - **doodad-js-xml**: XML Parser (beta)
  
## License

  [Apache-2.0][license-url]

[npm-image]: https://img.shields.io/npm/v/doodad-js-templates.svg
[npm-url]: https://npmjs.org/package/doodad-js-templates
[license-url]: http://opensource.org/licenses/Apache-2.0