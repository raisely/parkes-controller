'use strict';

/* using Promises instead of async functions forces the async await to reject
 while also resolving the promise (not leaving it handing around).
 */

const hook = (source, event, ...params) => new Promise((resolve, reject) => {
	if (source[event]) source[event](...params).then(resolve).catch(reject);
	else resolve(null); // do nothing
});

function createProxyHooks(origin, proxy, hooks) {
	hooks.forEach((event) => {
		const hookProxy = (...params) => new Promise((resolve, reject) =>
			// Repeat it to any hooks on the proxy object
			hook(proxy, event, ...params).then(resolve).catch(reject));

		// When the hook is fired on origin
		origin[event] = hookProxy;
	});
}

module.exports = { createProxyHooks, hook };
