'use strict';

async function hook(source, event, ...params) {
	if (source[event]) return source[event](...params);

	return undefined; // don't throw but tell context it's undefined
}

function createProxyHooks(origin, proxy, hooks) {
	hooks.forEach((event) => {
		// When the hook is fired on origin
		origin[event] = async function hookProxy(...params) {
			// Repeat it to any hooks on the proxy object
			return hook(proxy, event, ...params);
		};
	});
}

module.exports = { createProxyHooks, hook };
