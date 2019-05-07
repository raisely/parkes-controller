const _ = require('lodash');
const sinon = require('sinon');
const MockModel = require('./util/mockModel');
const ParkesController = require('../index.js');
const ParkesRouter = require('parkes-router');
const Koa = require('koa');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');
const describeApi = require('parkes-api-test');
const bodyParser = require('koa-bodyparser')();

chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);

const { mockKoaContext } = require('./util/mockKoa');

const { expect } = chai;

const sandbox = sinon.createSandbox();

const dummyRecord = { id: 1, name: 'Harvey Milk' };
dummyRecord.toPublic = () => dummyRecord;
const dummyPost = { job: 'Mayor' };

const restrictedKeys = {
	id: 1,
	uuid: 'new-uuid',
};

// eslint-disable-next-line no-empty-function
async function noop() {}

const authObj = {
	authorize: function nestedAuth() {},
};
authObj.authorize.original = true;
function authorize(...param) {
	authObj.authorize(...param);
}

const allActions = ['index', 'show', 'create', 'update', 'destroy'];

class UserController extends ParkesController {}

describe('ParkesController', () => {
	let userController;
	let models;
	let authSpy;
	let ctx;
	let server;
	let serverCount = 0;
	const hookSpies = {};

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};
		authSpy = sandbox.spy(authObj, 'authorize');
		userController = new UserController('user', {
			attributes: {
				include: [
					'arbitraryAttribute',
				],
			},
			models,
			authorize,
		});
		setupHookSpies();
		server = startServer(userController);
	});

	after(() => {
		closeServer(server);
	});

	function getServer() {
		return server;
	}

	describeApi(getServer, '/users', [
		{
			note: 'index',
			_expect: {
				data: [Object.assign({ arbitraryAttribute: 1 }, dummyRecord)],
				pagination: { pages: 1, total: 1 },
			},
			describe: () => {
				prepareRequest();

				itAuthorizesAgainstModel('index');
				it('calls authorize a second time with the records', () => {
					expect(authSpy).to.have.been.calledWith(sinon.match(ctx), sinon.match({
						action: 'index', model: [dummyRecord],
					}));
				});

				itCallsBeforeAndAfterHooks('index', { after: [[dummyRecord]] });
			},
		},

		{
			note: 'show',
			path: '/1',
			expect: dummyRecord,
			describe: () => {
				prepareRequest();
				itAuthorizesAgainstRecord('show');
				itCallsBeforeAndAfterHooks('show', { after: [dummyRecord] });
			},
		},

		{
			note: 'create',
			method: 'POST',
			expect: dummyRecord,
			body: dummyPost,

			describe: () => {
				prepareRequest(dummyPost);
				itAuthorizesAgainstModel('create');
				itCallsBeforeAndAfterHooks('create', { before: [dummyPost], after: [dummyRecord] });
			},
		},

		{
			note: 'create with restrcited keys',
			method: 'POST',
			expect: 'You may not update the fields: id, uuid',
			status: 400,
			body: restrictedKeys,
			describe: () => {
				prepareRequest(dummyPost);
			},
		},

		{
			note: 'update',
			method: 'PATCH',
			path: '/1',
			expect: dummyRecord,
			body: dummyPost,
			describe: () => {
				prepareRequest(dummyPost);
				itAuthorizesAgainstRecord('update');
				itCallsBeforeAndAfterHooks('update', { before: [dummyRecord, dummyPost], after: [dummyRecord] });
			},
		},

		{
			note: 'update with restrcited keys',
			method: 'PATCH',
			path: '/1',
			expect: 'You may not update the fields: id, uuid',
			status: 400,
			body: restrictedKeys,
			describe: () => {
				prepareRequest(dummyPost);
			},
		},

		{
			note: 'destroy',
			method: 'DELETE',
			path: '/1',
			expect: dummyRecord,
			describe: () => {
				itAuthorizesAgainstRecord('destroy');
				itCallsBeforeAndAfterHooks('destroy', { before: [dummyRecord], after: [dummyRecord] });
			},
		},
	]);

	// TODO honours id column
	// TODO passes scoping into authorisation

	function prepareRequest(body) {
		beforeRoute(async () => {
			const opt = body ? { body } : {};
			ctx = mockKoaContext(opt);
		});

		afterRoute(() => {
			sandbox.reset();
		});
	}

	function itAuthorizesAgainstModel(action) {
		it('authorizes against the model', () => {
			const params = [sinon.match(ctx), sinon.match({ action, model: models.User })];
			expect(authSpy).to.have.been.calledWith(...params);
		});
	}

	function itAuthorizesAgainstRecord(action) {
		it('authorizes against record', () => {
			const params = [sinon.match(ctx), sinon.match({ action, model: dummyRecord })];
			expect(authSpy).to.have.been.calledWith(...params);
		});
	}

	function itCallsBeforeAndAfterHooks(action, payload) {
		['before', 'after'].forEach((when) => {
			const hook = when + _.capitalize(action);

			it(`calls ${hook}`, () => {
				const params = [sinon.match(ctx)];
				if (payload[when]) {
					payload[when].forEach((param) => {
						params.push(sinon.match(param));
					});
				}
				expect(hookSpies[hook]).to.have.been.calledWith(...params);
			});
		});
	}

	function setupHookSpies() {
		['before', 'after'].forEach((time) => {
			allActions.forEach((action) => {
				const hook = time + _.capitalize(action);
				userController[hook] = noop;
				hookSpies[hook] = sandbox.spy(userController, hook);
			});
		});
	}

	function startServer(controller) {
		const api = new ParkesRouter();
		api
			.resource('user', controller);

		const app = new Koa();
		app
			.use(errorHandler)
			.use(bodyParser)
			.use(api.routes());

		serverCount++;
		console.log('servers:', serverCount);

		return app.listen();
	}

	function closeServer(s) {
		serverCount--;
		console.log('servers:', serverCount);
		s.close();
	}
});

async function errorHandler(ctx, next) {
	try {
		await next();
	} catch (err) {
		ctx.body = { data: err.message };
		ctx.status = 400;
	}
}
