'use strict';

const RestHandler = require('./restHandler');
const { isPrivate } = require('parkes-router');
const { RestError } = require('parkes-rest-error');
const { createProxyHooks, hook } = require('./hook');

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
  *		class UserController extends ParkesController();
  *		const userController = new UserController('User', {});
  */
class ParkesController {
	constructor(name, options) {
		this.model = name;
		this.options = options || {};

		if ((this.options.authorize !== false) && (!this.options.authorize)) {
			throw new Error("options.authorize is undefined. If you're really sure you don't want to authorize requests, it must be explicitly set to false when you instantiate your controller.");
		}

		this.rest = new RestHandler(name, options);

		createProxyHooks(this.rest, this, ['beforeCreate', 'beforeUpdate']);
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
	async authorize(ctx, options) {
		if (this.options.authorize === false) return;

		const opts = Object.assign({}, options, {
			isPrivate: isPrivate(ctx),
		});

		if (opts.scopes) {
			const authScope = this.rest.scopesPresent(ctx);
			opts.scopes = authScope;
		}

		await this.options.authorize(ctx, opts);
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
				await this.authorize(ctx, { model, action: 'view' });
			} else {
				throw new RestError({
					status: 404,
					code: 'not found',
					message: `${include.as} with ${this.options.resourceIdColumn} ${include.where[this.options.resourceIdColumn]} could not be found`,
				});
			}
		}
	}

	/* start basic CRUD method definitions */

	async show(ctx, next) {
		await hook(this, 'beforeShow', ctx); // bind hook

		const model = await this.rest.show(ctx);
		await this.authorize(ctx, { model, action: 'show', scopes: true });

		await hook(this, 'afterShow', ctx, model); // bind hook

		ctx.state.data = model;

		if (next) await next();
	}

	async index(ctx, next) {
		const action = 'index';
		// there's no point in trying to authenticate models we don't have

		await hook(this, 'beforeIndex', ctx); // bind hook

		const models = await this.rest.index(ctx);

		if (models.collection.length) {
			await this.authorize(ctx, { action, model: models.collection, scopes: true });
		} else {
			// If the results are empty, it could be because they filtered
			// on a model outside of their organisation (or that does not exist)
			// in which case we should check for these things and throw a clear
			// error for the user
			await this.verifyIncludes(ctx, this.rest.filterIncludes(ctx));
		}

		await hook(this, 'afterIndex', ctx, models.collection); // bind hook

		ctx.state.data = models;

		if (next) await next();
	}

	async create(ctx, next) {
		await this.authorize(ctx, { action: 'create', model: this.rest.modelClass, postBody: ctx.request.body });
		const model = await this.rest.create(ctx);

		await hook(this, 'afterCreate', ctx, model); // bind hook

		ctx.state.data = model;

		await next();
	}

	async update(ctx, next) {
		const model = await this.rest.find(ctx);

		await this.authorize(ctx, { model, action: 'update' });

		await this.rest.update(ctx, model);

		await hook(this, 'afterUpdate', ctx, model); // bind hook

		ctx.state.data = model;

		await next();
	}

	async destroy(ctx, next) {
		const model = await this.rest.find(ctx);

		await this.authorize(ctx, { model, action: 'destroy' });

		await hook(this, 'beforeDestroy', ctx, model); // bind hook

		await this.rest.destroy(ctx, model);

		await hook(this, 'afterDestroy', ctx, model); // bind hook

		ctx.state.data = model;

		await next();
	}
}

module.exports = ParkesController;
