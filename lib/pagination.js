'use strict';

const qs = require('qs');

function buildFindAllQuery(include, where, query) {
	const sort = this.query.sort || 'id';
	const order = this.query.order || 'DESC';

	return Object.assign({
		where, order: [[sort, order]], include, distinct: true,
	}, query);
}

async function paginate(include, where, query) {
	const q = buildFindAllQuery.apply(this, [include, where, query]);
	q.limit = parseInt(this.query.limit, 10) || options.defaultPageLength;
	q.offset = parseInt(this.query.offset, 10) || 0;

	const result = await models[`${name}s`].findAndCountAll(q);
	const total = result.count;
	const data = result.rows;

	return formatPaginate(data, total, q.limit, q.sort, q.order, q.offset, this.href.split('?')[0], this.query)
}

function formatPaginate(data, total, limit, sort, order, offset, slug, query) {
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
		data,
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
