const _ = require('lodash');

function mockKoaContext(options) {
	const ctx = _.defaults(options, {
		query: {},
		params: {},
	});

	return ctx;
}

exports.mockKoaContext = mockKoaContext;
