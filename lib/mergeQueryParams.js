'use strict';

/**
  * Returns a new object that merges ctx.query and ctx.params
  */
function mergeQueryParams(ctx) {
	return Object.assign({}, ctx.query, ctx.params);
}

module.exports = mergeQueryParams;
