const _ = require('lodash');
const sinon = require('sinon');
const MockModel = require('./util/mockModel');
const ParkesController = require('../index.js');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);

const { mockKoaContext } = require('./util/mockKoa');

const { expect } = chai;

const sandbox = sinon.createSandbox();

const dummyRecord = { id: 1, name: 'Harvey Milk' };
const dummyPost = { job: 'Mayor' };
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
	const hookSpies = {};

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};
		authSpy = sandbox.spy(authObj, 'authorize');
		userController = new UserController('user', { models, authorize });
		setupHookSpies();
	});

	describe('index', () => {
		basicRequest('index');

		itAuthorizesAgainstModel('index');
		it('calls authorize a second time with the records', () => {
			expect(authSpy).to.have.been.calledWith(ctx, sinon.match({
				action: 'index', model: [dummyRecord],
			}));
		});

		it('assigns records to state.data.collection', async () => {
			expect(ctx.state.data.collection).to.containSubset([dummyRecord]);
		});

		it('assigns pagination to state.data.pagination', async () => {
			expect(ctx.state.data.pagination).to.containSubset({ pages: 1, total: 1 });
		});
		itCallsBeforeAndAfterHooks('index', { after: [[dummyRecord]] });
	});

	describe('show', () => {
		basicRequest('show');
		itAuthorizesAgainstRecord('show');
		itAssignsRecordToStateData();
		itCallsBeforeAndAfterHooks('show', { after: [dummyRecord] });
	});

	describe('create', () => {
		context('When request is simple and correct', () => {
			basicRequest('create', dummyPost);
			itAuthorizesAgainstModel('create');
			itAssignsRecordToStateData();
			itCallsBeforeAndAfterHooks('create', { before: [dummyPost], after: [dummyRecord] });
		});

		context('When request tries to update restricted keys', () => {
			itRejectsRestrictedKeys('create');
		});
	});

	describe('update', () => {
		context('When request is simple and correct', () => {
			basicRequest('update', dummyPost);
			itAuthorizesAgainstRecord('update');
			itAssignsRecordToStateData();
			itCallsBeforeAndAfterHooks('update', { before: [dummyRecord, dummyPost], after: [dummyRecord] });
		});

		context('When request tries to update restricted keys', () => {
			itRejectsRestrictedKeys('update');
		});
	});

	describe('destroy', () => {
		basicRequest('destroy');
		itAuthorizesAgainstRecord('destroy');
		itAssignsRecordToStateData();
		itCallsBeforeAndAfterHooks('destroy', { before: [dummyRecord], after: [dummyRecord] });
	});

	// TODO honours id column
	// TODO passes scoping into authorisation


	function basicRequest(action, body) {
		before(async () => {
			ctx = mockKoaContext({ body });
			await userController[action](ctx, noop);
		});

		after(() => {
			sandbox.reset();
		});
	}

	function itAuthorizesAgainstModel(action) {
		it('calls authorize', async () => {
			expect(authSpy).to.have.been.calledWith(ctx, sinon.match({ action, model: models.User }));
		});
	}

	function itAuthorizesAgainstRecord(action) {
		it('calls authorize', async () => {
			// eslint-disable-next-line no-unused-expressions
			expect(authSpy).to.have.been.calledWith(ctx, sinon.match({ action, model: dummyRecord }));
		});
	}

	function itAssignsRecordToStateData() {
		it('assigns record to state.data', async () => {
			expect(ctx.state.data).to.containSubset(dummyRecord);
		});
	}

	function itRejectsRestrictedKeys(action) {
		it('rejects restricted keys', async () => {
			const badBody = {
				id: 1,
				uuid: 'new-uuid',
			};
			const message = 'You may not update the fields: id, uuid';
			ctx = mockKoaContext({ body: badBody });
			await expect(userController[action](ctx, noop)).to.be.rejectedWith(message);
		});
	}

	function itCallsBeforeAndAfterHooks(action, payload) {
		['before', 'after'].forEach((when) => {
			const hook = when + _.capitalize(action);

			it(`calls ${hook}`, () => {
				const params = [ctx];
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
});
