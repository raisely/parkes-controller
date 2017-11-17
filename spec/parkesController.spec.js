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

class UserController extends ParkesController {}

describe('restController', () => {
	let userController;
	let models;
	let authSpy;
	let ctx;

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

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};

		authSpy = sandbox.spy(authObj, 'authorize');

		userController = new UserController('user', { models, authorize });
	});

	describe('index', () => {
		basicRequest('index');

		itAuthorizesAgainstModel('index');
		it('calls authorize a second time with the records', () => {
			expect(authSpy).to.have.been.calledWith(ctx, sinon.match({
				action: 'index', model: [dummyRecord],
			}));
		});

		it('assigns records to state.data', async () => {
			expect(ctx.state.collection).to.eq([dummyRecord]);
		});

		it('assigns pagination to state.pagination', async () => {
			expect(ctx.state.pagination).to.eq({ page: 1 });
		});
	});

	describe('show', () => {
		basicRequest('show');
		itAuthorizesAgainstRecord('show');
		itAssignsRecordToStateData();
	});

	describe('create', () => {
		context('When request is simple and correct', () => {
			basicRequest('create', dummyPost);
			itAuthorizesAgainstModel();
			itAssignsRecordToStateData();
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
		});

		context('When request tries to update restricted keys', () => {
			itRejectsRestrictedKeys('update');
		});
	});

	describe('destroy', () => {
		basicRequest('destroy');
		itAuthorizesAgainstRecord('destroy');
		itAssignsRecordToStateData();
	});

	// TODO honours id column
	// TODO passes scoping into authorisation
});
