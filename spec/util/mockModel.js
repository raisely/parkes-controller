// eslint-disable-next-line no-empty-function
async function noop() {}
async function returnSelf() { return this; }

function MockModel(name, dummyRecord) {
	const mock = {
		findAll: async () => [dummyRecord],
		findAndCountAll: async () => ({ count: 1, rows: [dummyRecord] }),
		findOne: async () => Object.assign({ destroy: noop, update: returnSelf }, dummyRecord),
		create: async () => dummyRecord,
		destroy: async () => undefined,
		update: async () => dummyRecord,
	};

	return mock;
}

module.exports = MockModel;
