'use strict';

const _ = require('lodash');
const mergeQueryParams = require('./mergeQueryParams');
const { isPrivate } = require('../../raiselyRouter');
const globals = require('./globals');
const { buildFindAllQuery, paginate } = require('./pagination');

// Default limit for pagination
const DEFAULT_LIMIT = 100;

/**
  * @class restQuery
  * @description Provides Create, Read, Update, and Delete helper methods
  *	Provides helper layer between controller and model to perform generic
  * fetches with default include scopes
  *
  * filterModels allows you to scope requests by specified joined models
  * Each element in the array is the name of the model to join and will be expanded into
  * an appropriate include statement.
  *
  * @param {string} name Name of the model to use
  * @param {array} options.include Default includes for find or findAll (can be overridden per call)
  * @param {boolean} options.destroyOnDelete Unless true, the remove() method
  *		will simply change the status column to "DELETED". If true, it will delete the record
  *		If false, findAll will filter out "DELETED" by default
  * @param {string} options.scopeModels Models in query arguments or params that
  *		will be used to scope findAll if present
  * @param {string} options.search Array of fields to compare ?q= text against
  *		(defaults to ['name'])
  * @param {string} options.queryPublicFields True if the controller accepts queries like
  *		?public.X=... to filter on the public object
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

// Restrict updating this attributes by default
const DEFAULT_RESTRICTED = ['id', 'uuid', 'password', 'permission', 'internal',
	'privateKey', 'publicKey', 'userId', 'organisationId'];

const restQuery = function restCrud(name, options) {
	if (!name) throw new Error('You must pass a model name to restQuery constructor');

	options.search = options.search || ['name'];
	options.include = options.include || [];
	options.scopeModels = options.scopeModels || [];
	options.restricted = options.restricted || DEFAULT_RESTRICTED;
	options.defaultPageLength = options.defaultPageLength || DEFAULT_LIMIT;

	/**
	  * Called by update and create to prevent attempted mass assignment to restricted fields
	  * eg password, uuid
	  * Throws an error on the context naming the bad fields
	  * otherwise returns
	  */
	function blockRestrictedKeys(ctx, newRecord) {
		const keys = Object.keys(newRecord);
		const badFields = options.restricted.filter(k => keys.includes(k));
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
	  *		rest.mapForeignUuidToId(record, ['campaign'])
	  *
	  *		// This will do
	  *		model = yeild Models.campaigns.findOne({where: { uuid: record.campaignUuid});
	  *		record.campaignId = model.id;
	  */
	function* mapForeignUuidToId(record, foreignKeys) {
		for (let i = 0; i < foreignKeys.length; i++) {
			let foreign = foreignKeys[i];

			if (typeof foreign === 'string') {
				foreign = {
					modelName: foreign,
					attribute: foreign,
				};
			}

			const id = foreign.attribute + 'Id';
			const uuid = foreign.attribute + 'Uuid';

			if (record[uuid]) {
				const model = yield models[`${foreign.modelName}s`].findOne({ where: { uuid: record[uuid] } });
				if (!model) throw new RestError(401, `Could not find ${foreign.attribute} with uuid ${record[uuid]}`);
				record[id] = model.id;
				delete record[uuid];
			}
		}

		return record;
	}

	/**
	  * Creates an array of includes that will filter the findAll query based
	  * on query or params provided by the user
	  */
	function buildFilterIncludes(filterModels, ctx) {
		// Search for params on the query or params
		// (params take precedence)
		const allParams = mergeQueryParams(ctx);

		const includes = [];

		// For each paramter, add an include statement
		filterModels.forEach((model) => {
			const simple = (typeof model === 'string');

			const modelName = simple ? model : model.name;
			// NOTE we can get away with this because none of our models
			// have difficult names to singularise
			let paramName = modelName;
			if (paramName[paramName.length - 1] === 's') paramName = paramName.slice(0, paramName.length);
			const pluralName = modelName[modelName.length - 1] === 's' ? modelName : `${modelName}s`;

			// If the parameter is specified
			// push an include to filter by that model's uuid
			if (allParams[paramName]) {
				let includeToPush;

				if (simple) {
					includeToPush = {
						model: models[pluralName],
						as: modelName,
						where: whereByAlias(allParams[paramName], modelName),
						required: true,
					};
				} else {
					console.log('Complex include filtering not implemented yet');
					throw new Error('Complex include filtering not implemented yet');
					// FIXME need to iterate through the include (or nested includes)
					// and look for where: { field: { $param: paramName } }
					// to replace with { field: allParams[paramName] }
				}

				includes.push(includeToPush);
			}
		});

		return includes;
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

	/**
	  * Helper to create where clause for finding model by alias or uuid
	  */
	function whereByAlias(uuid, modelName = name) {
		if (models[`${modelName}s`].whereByAlias) {
			return models[`${modelName}s`].whereByAlias(uuid);
		}

		return { uuid };
	}

	return {
		authorizationScope,
		modelClass: models[`${name}s`],

		find: async function find(ctx, _opts) {
			const opts = _opts || {};
			const include = opts.include || options.include;
			const query = opts.query || {};

			const q = Object.assign({ where: whereByAlias(ctx.params[name]) }, query);

			if (!options.destroyOnDelete) q.where.status = { $ne: 'DELETED' };

			if (include) q.include = include;

			let data;

			data = await globals.models[`${name}`].findOne(q);

			if (!data) {
				throw new globals.RestError({
					status: 404,
					code: 'not found',
					message: `${name} with uuid ${ctx.params[name]} was not found` });
			}

			return data;
		},

		filterIncludes: function(ctx) {
			return buildFilterIncludes(options.filterModels, ctx);
		},

		findAll: function* (ctx, opts){
			opts = opts || {};
			let include = opts.include || options.include;
			const where = opts.where || {};
			const query = opts.query || {};

			where.$and = where.$and || [];

			include = mergeIncludes(include, buildFilterIncludes(options.filterModels, ctx));

			// If records aren't deleted from the DB, then filter out "DELETED" records
			if (!options.destroyOnDelete) where.$and.push({ status: { $ne: 'DELETED' } });

			if (ctx.passport.user && ctx.passport.user.permission !== 'ROOT') {
				where.$and.push({ organisationId: ctx.passport.user.organisationId });
			}

			// basic search text fields
			if (ctx.query.q) {
				const searchFields = options.search;
				const searchQueries = { $or: [] };
				searchFields.map(prop => searchQueries.$or.push({ [prop]: { $iLike: `%${ctx.query.q}%` } }));
				where.$and.push(searchQueries);
			}

			// basic public field search
			if (options.queryPublicFields) {
				for (let key in ctx.query) {
					if (key.indexOf('public.') > -1){
						where.$and.push({ [key]: { $iLike: `%${ctx.query[key]}%` } });
					}
				}
			}

			// Get filter params from model
			if (models[`${name}s`].filterAttributes) {
				for (let i = 0; i < models[`${name}s`].filterAttributes.length; i++) {
					const attribute = models[`${name}s`].filterAttributes[i];
					const value = ctx.query[models[`${name}s`].filterAttributes[i]];
					if (value) where.$and.push({ [attribute]: value })
				}
			}

			let data;

			if (opts.skipPaginate) {
				const q = buildFindAllQuery.apply(ctx, [include, where, query]);
				const result = yield models[`${name}s`].findAll(q);
				data = { data: result };
			} else {
				data = yield paginate.apply(ctx, [include, where, query]);
			}
			return data;
		},

		create: function* (ctx){
			const newRecord = ctx.request.body.data;

			if (!newRecord) throw new globals.RestError({
				status: 400, code: 'empty body', message: 'The data attribute in the body must not be empty',
			});

			blockRestrictedKeys(ctx, newRecord);

			// Set the organisaitonId to that of the user
			// Unless we're creating an organisation
			if (name !== 'organisation') {
				newRecord.organisationId = ctx.passport.user.organisationId;
			}

			// If merge is requested, see if we can do an update
			if (options.allowMerge && ctx.request.body.merge) {
				const model = yield models[`${name}s`].findUpsert(newRecord);
				// Will cause an exception to be thrown
				delete newRecord.organisationId;
				if (model) return yield this.update(ctx, model);
			}

			const valid = yield models[`${name}s`].validCreate(newRecord);

			const model = yield models[`${name}s`].create(valid);

			return model;
		},

		update: function* (ctx, record){
			const newRecord = ctx.request.body.data;

			if (!newRecord) throw new globals.RestError({
				status: 400, code: 'empty body', message: 'The data attribute in the JSON body must not be empty',
			});

			blockRestrictedKeys(ctx, newRecord);
			// run validation on body
			const valid = yield record.validUpdate(newRecord);
			// update record

			yield record.update(valid);

			return record;
		},

		remove: function* (ctx, record){
			const data = options.destroyOnDelete ?
				yield record.destroy() :
				yield record.update({ status: 'DELETED' });

			return data;
		},
	};

}

restQuery.DEFAULT_RESTRICTED = DEFAULT_RESTRICTED;

module.exports = restQuery;
