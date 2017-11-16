async function noop() {};

function MockModel(name, dummyRecord) {
	const mock = {
		findAll: async () => [dummyRecord],
		findOne: async () => Object.assign({ destroy: noop }, dummyRecord),
		create: async () => dummyRecord,
		destroy: async () => undefined,
		update: async () => dummyRecord,
	};

	return mock;
}

module.exports = MockModel;
