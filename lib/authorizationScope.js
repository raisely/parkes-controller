'use strict';

const _ = require('lodash');
const mergeQueryParams = require('./mergeQueryParams');

/**
  * Returns the scope of the request for the purposes of authorization
  * Checks if the modelScopes are present on the query/params and
  * returns the FIRST matching one and adds .private if the request is private
  *
  * @param {string[]} modelScopes The scopes to check
  * @param {Object} ctx Koa context (or object containing query and params)
  * @example
  *		const action = 'list' + authorizationScope(['user', 'campaign'])
  */
function authorizationScope(modelScopes, ctx) {
	const allParams = mergeQueryParams(ctx);

	const presentScopes = _.intersection(modelScopes || [], Object.keys(allParams));

	let scope = '';

	if (presentScopes.length) {
		scope += `.${presentScopes[0]}`;
	}

	if (isPrivate(context)) scope += '.private';

	return scope;
}

module.exports = authorizationScope;
