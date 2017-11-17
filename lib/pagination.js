'use strict';

const qs = require('qs');

function buildFindAllQuery(ctx, include, where, query) {
	const sort = ctx.query.sort || 'id';
	const order = ctx.query.order || 'DESC';

	return Object.assign({
		where, order: [[sort, order]], include, distinct: true,
	}, query);
}

async function paginate(ctx, include, where, query, model, options) {
	const q = buildFindAllQuery(ctx, include, where, query);
	q.limit = parseInt(ctx.query.limit, 10) || options.defaultPageLength;
	q.offset = parseInt(ctx.query.offset, 10) || 0;

	const result = await model.findAndCountAll(q);
	const total = result.count;
	const data = result.rows;

	return formatPaginate(data, total, q.limit, q.sort, q.order, q.offset, ctx.href.split('?')[0], ctx.query);
}

function formatPaginate(data, total, limit, sort, order, offset, slug, query) {
	// eslint-disable-next-line no-param-reassign
	offset = parseInt(offset, 10);
	const pages = Math.ceil(total / limit);

	if (query.type) query.type = query.type.toUpperCase();
	else delete query.type;

	if (!query.parentId) delete query.parentId;

	const newQuery = Object.assign({}, query, { limit });

	let prevUrl = false;
	let nextUrl = false;

	if (offset > 0) {
		newQuery.offset = Math.max(offset - limit, 0);
		prevUrl = `${slug}?${qs.stringify(newQuery)}`;
	}

	if (total > offset + limit) {
		newQuery.offset = offset + limit;
		nextUrl = `${slug}?${qs.stringify(newQuery)}`;
	}

	return {
		collection: data,
		pagination: {
			total, pages, prevUrl, nextUrl, offset, limit,
		},
	};
}

module.exports = {
	formatPaginate,
	paginate,
	buildFindAllQuery,
};
