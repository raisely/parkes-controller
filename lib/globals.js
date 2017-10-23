const globals = {
	models: null, // Sequelize models
	authorize: false, // Authorize function
	resourceIdColumn: 'uuid', // Column to used by API to identify resources
	getUser: ctx => ctx.passport.user,
};

module.exports = globals;
