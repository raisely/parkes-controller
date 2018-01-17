'use strict';

const { RestError } = require('parkes-rest-error');

async function hook(source, event, ...params) {
	if (source[event]) return await source[event](...params);

	return undefined; // don't throw but tell context it's undefined
}

function createProxyHooks(origin, proxy, hooks) {
	hooks.forEach((event) => {
		// When the hook is fired on origin
		origin[event] = async function hookProxy(...params) {
			// Repeat it to any hooks on the proxy object
			return await hook(proxy, event, ...params);
		};
	});
}

// detect if an asyncronous hook has thrown
function hookHasThrown(hookReturn) {
	return (hookReturn instanceof Error || hookReturn instanceof RestError);
}

module.exports = { createProxyHooks, hook, hookHasThrown };
