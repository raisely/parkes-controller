const _ = require('lodash');

function mockKoaContext(options) {
	// eslint-disable-next-line no-param-reassign
	options = options || {};
	const ctx = _.defaults(options, {
		query: {},
		params: {},
		state: {},
		request: {
			body: {
				data: options.body || {},
			},
		},
	});

	return ctx;
}

exports.mockKoaContext = mockKoaContext;
