'use strict';

const _ = require('lodash');
const pluralize = require('pluralize');
const mergeQueryParams = require('./mergeQueryParams');
const globals = require('./globals');
const { buildFindAllQuery, paginate } = require('./pagination');
const { RestError } = require('parkes-rest-error');

// Default limit for pagination
const DEFAULT_LIMIT = 100;

/**
  * @class restQuery
  * @description Provides Create, Read, Update, and Destroy helper methods
  *	Provides helper layer between controller and model to perform generic
  * fetches with default include scopes
  *
  * filterModels allows you to scope requests by specified joined models
  * Each element in the array is the name of the model to join and will be expanded into
  * an appropriate include statement.
  *
  * @param {string} name Name of the model to use
  * @param {array} options.include Default includes for find or findAll (can be overridden per call)
  * @param {array} options.filterAttributes Attributes to filter against from the query
  * @param {string} options.resourceIdColumn Name of the column to use as the id in the API
  * @param {string} options.scopeModels Models in query arguments or params that
  *		will be used to scope findAll if present
  * @param {string} options.search Array of fields to compare ?q= text against
  *		(defaults to ['name'])
  * @param {string} options.restricted Array of fields that may not be changed by
  *		create/update (see below for default)
  * @param {integer} options.defaultPageLength Default limit for pagination
  *
  * @example
  * scopeModels = ['user'];
  *
  * // Becomes:
  * [{
  *		name: 'user',
  *		include: {
  *			model: models.User,
  *			where: { uuid: this.params.user || this.query.user },
  *			required: true,
  *		}
  *	}]
  * // NOTE: The include is only generated if the HTTP url includes the parameter
  *
  * rest = restQuery('Post',
  *		search: ['title'],
  *		scopeModels: ['user']
  *		include: [
  *			{
  *				model: models.Comments,
  *			}
  *		]
  *	})
  *
  * let campaign = await rest.findOne();
  *
  */

// Restrict updating these attributes by default
const DEFAULT_RESTRICTED = ['id', 'uuid', 'password', 'permission', 'internal',
	'privateKey', 'publicKey', 'userId', 'organisationId'];

class RestHandler {
	constructor(name, options) {
		if (!name) throw new Error('You must pass a model name to RestHandler constructor');
		if (!options.models) throw new Error('You must supply options.models to the RestHandler constructor');

		this.options = _.defaults(options, {
			defaultPageLength: DEFAULT_LIMIT,
			filterAttributes: [],
			include: [],
			resourceIdColumn: 'uuid',
			scopeModels: [],
			search: ['name'],
		});

		this.options.resourceIdColumnSuffix = _.capitalize(this.options.resourceIdColumn);

		// If restricted is unset, default it to the defaults, plus the ID column
		if (!this.options.restricted) {
			this.options.restricted = DEFAULT_RESTRICTED.slice().push(options.resourceIdColumn);
		}

		this.name = modelName(name);
		this.models = options.models;
		this.modelClass = options.models[modelName(name)];
		if (!this.modelClass) {
			throw new Error(`Model ${this.name} cannot be found in options.models`);
		}
	}

	/**
	  * Called by update and create to prevent attempted mass assignment to restricted fields
	  * eg password, uuid
	  * Throws an error on the context naming the bad fields
	  * otherwise returns
	  */
	blockRestrictedKeys(ctx, newRecord) {
		const keys = Object.keys(newRecord);
		const badFields = this.options.restricted.filter(k => keys.includes(k));
		if (badFields.length) {
			throw new RestError({
				status: 400,
				message: `You may not update the fields: ${badFields.join(', ')}`,
				code: 'restricted field',
			});
		}

		return badFields;
	}

	/**
	  * Returns list of model names that are used to scope the request
	  *
	  * @param {Object} ctx Koa context (or object containing query and params)
	  * @returns {string[]} List of authorisation scopes that are present in the request
	  */
	scopesPresent(ctx) {
		const allParams = mergeQueryParams(ctx);

		return _.intersection(this.options.scopeModels || [], Object.keys(allParams));
	}

	// eslint-disable-next-line class-methods-use-this
	whereByResourceId(key, record) {
		const where = {};
		where[key] = record[key];
		return where;
	}

	/**
	  * @description
	  * Used by create or update to map uuid foreign keys to ids
	  *
	  * @param {object} record The data to be used to create the record. NOTE this will be changed
	  * @param {object[]} foreignKeys Array of keys to map (will only be mapped if present)
	  * Takes the form
	  * [{
	  *		modelName: 'profile',
	  *		attribute: 'parent',
	  * }]
      * If the modelName and attribute are the same, then you can use a string as a shorthand
	  *
	  * @example
	  *		rest.mapForeignKeyToId(record, ['campaign'])
	  *
	  *		// This will do
	  *		model = yeild Models.campaigns.findOne({where: { uuid: record.campaignUuid});
	  *		record.campaignId = model.id;
	  */
	async mapForeignKeyToId(record, foreignKeys) {
		const promises = [];

		for (let i = 0; i < foreignKeys.length; i++) {
			let foreign = foreignKeys[i];

			if (typeof foreign === 'string') {
				foreign = {
					modelName: modelName(foreign),
					attribute: foreign,
				};
			}

			const id = `${foreign.attribute}Id`;
			const key = columnKeyName(foreign.attribute, this.options.resourceIdColumn);

			if (record[key]) {
				const where = this.whereByResourceId(key, record);
				const promise = this.models[foreign.modelName].findOne({ where });

				// Fetch updates in parallel
				promise.then((model) => {
					if (!model) throw new RestError(404, `Could not find ${foreign.attribute} with ${this.options.resourceIdColumn} ${record[key]}`);
					record[id] = model.id;
					delete record[key];
				});
			}
		}

		// Wait for all assignments to complete
		await Promise.all(promises);

		return record;
	}

	/**
	  * Creates an array of includes that will filter the findAll query based
	  * on query or params provided by the user
	  */
	buildFilterIncludes(ctx, filterModels) {
		// Search for params on the query or params
		// (params take precedence)
		const allParams = mergeQueryParams(ctx);

		const includes = [];

		// For each paramter, add an include statement
		filterModels.forEach((model) => {
			const simple = (typeof model === 'string');

			const modelClassName = simple ? modelName(model) : model.name;
			const queryName = paramName(modelName);

			// If the parameter is specified
			// push an include to filter by that model's uuid
			if (allParams[paramName]) {
				let includeToPush;

				if (simple) {
					includeToPush = {
						model: this.models[modelClassName],
						as: modelClassName,
						where: this.whereByAlias(allParams[queryName], modelClassName),
						required: true,
					};
				} else {
					throw new Error('Complex include filtering not implemented yet');
					// FIXME need to iterate through the include (or nested includes)
					// and look for where: { field: { $param: queryName } }
					// to replace with { field: allParams[queryName] }
				}

				includes.push(includeToPush);
			}
		});

		return includes;
	}

	/**
	  * Helper to create where clause for finding model by alias or uuid
	  */
	whereByAlias(key, model = this.name) {
		if (this.models[model].whereByAlias) {
			return this.models[model].whereByAlias(key);
		}

		const where = {};
		where[this.options.resourceIdColumn] = key;

		return where;
	}

	async fid(ctx, _opts) {
		const opts = _opts || {};
		const include = opts.include || this.options.include;
		const query = opts.query || {};

		const q = Object.assign({ where: this.whereByAlias(ctx.params[paramName(this.name)]) }, query);

		if (include) q.include = include;

		const data = await this.modelClass.findOne(q);

		if (!data) {
			throw new globals.RestError({
				status: 404,
				code: 'not found',
				message: `Resource ${this.name} with ${this.options.resourceIdColumn} ${ctx.params[paramName(this.name)]} was not found`,
			});
		}

		return data;
	}

	async show(ctx) {
		return this.find(ctx);
	}

	filterIncludes(ctx) {
		return this.buildFilterIncludes(ctx, this.options.scopeModels);
	}

	async index(ctx, _opts) {
		const opts = _opts || {};
		let include = opts.include || this.options.include;
		const where = opts.where || {};
		const query = opts.query || {};

		where.$and = where.$and || [];

		const filterIncludes = this.buildFilterIncludes(ctx, this.options.filterModels);
		include = mergeIncludes(include, filterIncludes);

		// basic search text fields
		if (ctx.query.q) {
			const searchFields = this.options.search;
			const searchQueries = { $or: [] };
			searchFields.map(prop => searchQueries.$or.push({ [prop]: { $iLike: `%${ctx.query.q}%` } }));
			where.$and.push(searchQueries);
		}

		// Get filter params from model
		for (let i = 0; i < this.options.filterAttributes.length; i++) {
			const attribute = this.options.filterAttributes[i];
			if (_.has(ctx.query, attribute)) {
				const value = ctx.query[attribute];
				where.$and.push({ [attribute]: value });
			}
		}

		let data;

		if (opts.skipPaginate) {
			const q = buildFindAllQuery.apply(ctx, [include, where, query]);
			const result = await this.modelClass.findAll(q);
			data = { data: result };
		} else {
			data = await paginate.apply(ctx, [include, where, query]);
		}
		return data;
	}

	async create(ctx) {
		const newRecord = ctx.request.body.data;

		if (!newRecord) {
			throw new globals.RestError({
				status: 400, code: 'empty body', message: 'The data attribute in the body must not be empty',
			});
		}

		this.blockRestrictedKeys(ctx, newRecord);

		// If merge is requested, see if we can do an update
		if (this.options.allowMerge && ctx.request.body.merge) {
			const model = await this.modelClass.findUpsert(newRecord);
			// Will cause an exception to be thrown
			delete newRecord.organisationId;
			if (model) return this.modelClass.update(ctx, model);
		}

		const valid = await this.modelClass.validCreate(newRecord);

		const model = await this.modelClass.create(valid);

		return model;
	}

	async update(ctx, record) {
		const newRecord = ctx.request.body.data;

		if (!newRecord) {
			throw new globals.RestError({
				status: 400, code: 'empty body', message: 'The data attribute in the JSON body must not be empty',
			});
		}

		this.blockRestrictedKeys(ctx, newRecord);
		// run validation on body
		const valid = await record.validUpdate(newRecord);
		// update record

		await record.update(valid);

		return record;
	}

	// eslint-disable-next-line class-methods-use-this
	async remove(ctx, record) {
		const data = await record.destroy();

		return data;
	}
}

function modelName(name) {
	return _.capitalize(pluralize.singular(name));
}

function paramName(name) {
	return pluralize.singular(name).toLowerCase();
}

function columnIdName(name) {
	return columnKeyName(name, 'id');
}

function columnKeyName(name, key) {
	// eslint-disable-next-line prefer-template
	return pluralize.signular(name).toLowerCase() + _.capitalize(key);
}

/**
  * Merge our includes with default includes
  * (our includes take precedence)
  */
function mergeIncludes(includes, newIncludes) {
	const newArray = [].concat(includes);

	newIncludes.forEach((include) => {
		const original = newArray.find(o => (o.model === include.model));
		if (original) {
			_.remove(newArray, o => (o === original));
		}

		// If an include for that model already exists
		// create a new object that merges the two
		const newInclude = original ? Object.assign({}, original, include) : include;

		newArray.push(newInclude);
	});

	return newArray;
}

RestHandler.DEFAULT_RESTRICTED = DEFAULT_RESTRICTED;

module.exports = RestHandler;
