const globals = require('./globals');

exports.controller = require('./restController')

exports.init = function init(options) {
	Object.assign(globals, options);
};
