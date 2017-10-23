'use strict';

const globals = require('./globals');
const restQuery = require('./restQuery');

/**
  * @mixin restController
  *
  * @description provides standard CRUD methods for a restful controller
  *
  * Use this as the base for restful controllers
  * Provides findOne, findAll, create, update, destroy
  *
  * All actions put the record(s) in ctx.state.data
  * It's up to the application to define a presentation layer that
  * puts that data into ctx.body
  *
  * @param {string} options.authorizationScopes Model scopes to append to action strings when authorizing
  * @param {array} options.include Includes for findOne or findAll
  *
  * @see restQuery for additional options that are passed through
  *
  * @example
  *		restUp.init({ models: { User }, authorize });
  *		const userController = restUp.controller('User');
  */
function restController(name, _options) {
	const options = _options || {};
	options.authorizationScopes = options.authorizationScopes || {};

	const rest = restQuery(name, options);

	/**
	  * Shortcut to call globals.authorize passing in  globals.getUser(ctx)
	  */
	function authorize(ctx, action, model) {
		globals.authorize(globals.getUser(ctx), action, model);
	}

	/**
	  * Go through each of the includes passed in and verify that
	  * 1) A model can be found
	  * 2) The user is authorized to view it
	  * Called when findAll returns an empty set to check
	  * if this is the reason the set is empty
	  *
	  * @param {User} user The user to authorize against the includes
	  * @param {Object[]} includes The sequelize include objects to check if the user
									is authorized to view those
	  * @throws {RestError} If one of the models is not found or the user is not
	   *							authorized to view them
	  */
	async function verifyIncludes(user, includes) {
		for (let i = 0; i < includes.length; i++) {
			const include = includes[i];
			const model = await include.model.findOne({ where: include.where });

			if (model) {
				globals.authorize(user, 'view', model);
			} else {
				throw new RestError({
					status: 404,
					code: 'not found',
					message: `${include.as} with ${globals.resourceIdColumn} ${include.where[globals.resourceIdColumn]} could not be found`,
				});
			}
		}
	}

	return {
		async findOne(ctx, next) {
			const model = await rest.find(this);
			const authScope = rest.authorizationScope(options.authorizationScopes.find || [], this);
			const action = `view${authScope}`;
			authorize(ctx, action, model);
			this.state.data = model;

			await next();
		},

		async findAll(ctx, next) {
			const authScope = rest.authorizationScope(options.authorizationScopes.findAll || [], this);
			const action = `list${authScope}`;

			authorize(ctx, action, rest.modelClass);
			const models = await rest.findAll(this);

			if (models.data.length) {
				authorize(ctx, action, models.data);
			} else {
				// If the results are empty, it could be because they filtered
				// on a model outside of their organisation (or that does not exist)
				// in which case we should check for these things and throw a clear
				// error for the user
				await verifyIncludes(this.passport.user, rest.filterIncludes(this));
			}

			this.state.data = models;

			await next();
		},

		async create(ctx, next) {
			authorize(ctx, 'create', rest.modelClass);
			const model = await rest.create(this);

			this.state.data = model;

			await next();
		},

		async update(ctx, next) {
			const model = await rest.find(this);

			authorize(ctx, 'update', model);

			await rest.update(this, model);

			this.state.data = model;

			await next();
		},

		async destroy(ctx, next) {
			const model = await rest.find(this);
			authorize(ctx, 'delete', model);

			await rest.remove(this, model);

			this.state.data = model;

			await next();
		},
	};
}

module.exports = restController;
