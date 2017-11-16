'use strict';

const RestHandler = require('./restHandler');
const { isPrivate } = require('parkes-router');
const { RestError } = require('parkes-rest-error');

/**
  * @class ParkesController
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
  * @param {array} options.include Includes for findOne or findAll
  *
  * @see restQuery for additional options that are passed through
  *
  * @example
  *		restUp.init({ models: { User }, authorize });
  *		const userController = restUp.controller('User');
  */
class ParkesController {
	constructor(name, options) {
		this.model = name;
		this.options = options || {};

		if ((this.options.authorize !== false) && (!this.options.authorize)) {
			throw new Error("options.authorize is undefined. If you're really sure you don't want to authorize requests, it must be explicitly set to false when you instantiate your controller.");
		}

		this.rest = new RestHandler(name, options);
	}

	/**
	  * Shortcut to call this.options.authorize unless it's set to false
	  * @param {Koa context} ctx The context of the request
	  * @param {object} options.model Sequealize class or instance
	  * @param {Sequelize} options.parent Parent object of class to be instantiated
	  * @param {boolean} options.scopes If true, the authorisation scopes will be calculated
	  * 	and passed on to options.authorize
	  *
	  * Will add the isPrivate boolean to the options before calling authorize
	  */
	authorize(ctx, options) {
		if (this.options.authorize === false) return;

		const opts = Object.assign({}, options, {
			isPrivate: isPrivate(ctx),
		});

		if (opts.scopes) {
			const authScope = this.rest.scopesPresent(ctx);
			opts.scopes = authScope;
		}

		this.options.authorize(ctx, options);
	}

	/**
	  * Go through each of the includes passed in and verify that
	  * 1) A model can be found
	  * 2) The user is authorized to view it
	  *
	  * Called when findAll returns an empty set to check
	  * if this is the reason the set is empty
	  *
	  * @param {User} user The user to authorize against the includes
	  * @param {Object[]} includes The sequelize include objects to check if the user
									is authorized to view those
	  * @throws {RestError} If one of the models is not found or the user is not
	   *							authorized to view them
	  */
	async verifyIncludes(ctx, includes) {
		for (let i = 0; i < includes.length; i++) {
			const include = includes[i];
			const model = await include.model.findOne({ where: include.where });

			if (model) {
				this.authorize(ctx, { model, action: 'view' });
			} else {
				throw new RestError({
					status: 404,
					code: 'not found',
					message: `${include.as} with ${this.options.resourceIdColumn} ${include.where[this.options.resourceIdColumn]} could not be found`,
				});
			}
		}
	}

	async show(ctx, next) {
		const model = await this.rest.show(ctx);
		this.authorize(ctx, { model, action: 'show', scopes: true });
		ctx.state.data = model;

		if (next) await next();
	}

	async index(ctx, next) {
		const action = 'index';

		this.authorize(ctx, { action, model: this.rest.modelClass, scopes: true });
		const models = await this.rest.index(ctx);

		if (models.collection.length) {
			this.authorize(ctx, { action, model: models.collection, scopes: true });
		} else {
			// If the results are empty, it could be because they filtered
			// on a model outside of their organisation (or that does not exist)
			// in which case we should check for these things and throw a clear
			// error for the user
			await this.verifyIncludes(ctx, this.rest.filterIncludes(ctx));
		}

		ctx.state.data = models;

		if (next) await next();
	}

	async create(ctx, next) {
		this.authorize(ctx, { action: 'create', model: this.rest.modelClass });
		const model = await this.rest.create(ctx);

		ctx.state.data = model;

		await next();
	}

	async update(ctx, next) {
		const model = await this.rest.find(ctx);

		this.authorize(ctx, { model, action: 'update' });

		await this.rest.update(ctx, model);

		ctx.state.data = model;

		await next();
	}

	async destroy(ctx, next) {
		const model = await this.rest.find(ctx);
		this.authorize(ctx, { model, action: 'destroy' });

		await this.rest.destroy(ctx, model);

		ctx.state.data = model;

		await next();
	}
}

module.exports = ParkesController;
