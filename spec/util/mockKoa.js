const _ = require('lodash');

function mockKoaContext(options) {
	// eslint-disable-next-line no-param-reassign
	options = options || {};
	const ctx = _.defaults(options, {
		query: {},
		params: {},
		request: {},
	});

	delete ctx.body;

	if (options.body) {
		ctx.request.body = { data: options.body };
	}

	return ctx;
}

exports.mockKoaContext = mockKoaContext;
