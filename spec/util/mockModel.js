function MockModel(name, dummyRecord) {
	const mock = {
		findAll: async () => [dummyRecord],
		findOne: async () => dummyRecord,
		create: async () => dummyRecord,
	};

	return mock;
}

module.exports = MockModel;
