const sinon = require('sinon');
const MockModel = require('./util/mockModel');
const ParkesController = require('../index.js');
const chai = require('chai');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);

const { mockKoaContext } = require('./util/mockKoa');

const { expect } = chai;

const dummyRecord = { id: 1, name: 'Harvey Milk' };
// eslint-disable-next-line no-empty-function
async function noop() {}

const authObj = {
	authorize: function authorize() {},
};

class UserController extends ParkesController {}

describe('restController', () => {
	let userController;
	let models;
	let authSpy;
	let ctx;
	let authorize;

	function basicRequest(action) {
		before(async () => {
			ctx = mockKoaContext();
			await userController[action](ctx, noop);
		});
	}

	function itAuthorizesAgainstModel(action) {
		it('calls authorize', async () => {
			expect(authSpy.getCall(0).args[0]).to.eq(ctx);
			// First call is with the class
			expect(authSpy.getCall(0).args[1]).to.containSubset({ action, model: models.User });
		});
	}

	function itAuthorizesAgainstRecord(action) {
		it('calls authorize', async () => {
			expect(authSpy).to.have.been.calledOnce();
			expect(authSpy.getCall(0).args[0]).to.eq(ctx);
			// First call is with the class
			expect(authSpy.getCall(0).args[1]).to.containSubset({ action, model: dummyRecord });
		});
	}

	function itAssignsRecordToStateData() {
		it('assigns record to state.data', async () => {
			expect(ctx.state.data).to.eq(dummyRecord);
		});
	}

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};

		authSpy = sinon.stub(authObj, 'authorize');
		// eslint-disable-next-line prefer-destructuring
		authorize = authObj.authorize;

		userController = new UserController('user', { models, authorize });
	});

	describe('index', () => {
		basicRequest('index');

		itAuthorizesAgainstModel('index');
		it('calls authorize a second time with the records', () => {
			expect(authSpy).to.have.been.calledTwice();
			expect(authSpy.getCall(1).args[0]).to.eq(ctx);
			expect(authSpy.getCall(1).args[1]).to.containSubset({
				action: 'index', model: [dummyRecord],
			});
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
		before(async () => {
			ctx = mockKoaContext();
			await userController.create(ctx, noop);
		});
		itAuthorizesAgainstModel();
		itAssignsRecordToStateData();
	});

	describe('update', () => {
		basicRequest('update');
		itAuthorizesAgainstRecord('update');
		itAssignsRecordToStateData();
	});

	describe('destroy', () => {
		basicRequest('update');
		itAuthorizesAgainstRecord('update');
		itAssignsRecordToStateData();
	});

	// TODO honours id column
	// TODO passes scoping into authorisation
});
