const sinon = require('sinon');
const MockModel = require('./util/mockModel');
const ParkesController = require('../index.js');
const chai = require('chai');
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

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};

		authSpy = sinon.stub(authObj, 'authorize');
		// eslint-disable-next-line prefer-destructuring
		authorize = authObj.authorize;

		userController = new UserController('user', { models, authorize });
	});

	// Set the basic request context for all of them
	['index', 'show', 'create', 'update', 'destroy'].forEach((action) => {
		describe(action, () => {
			before(async () => {
				ctx = mockKoaContext();
				await userController[action](ctx, noop);
			});
		});
	});

	/** Authorization */
	['show', 'update', 'destroy'].forEach((action) => {
		describe(action, () => {
			it('calls authorize with context and record', async () => {
				expect(authSpy).to.have.been.calledOnce();
				expect(authSpy.getCall(0).args[0]).to.eq(ctx);
				expect(authSpy.getCall(0).args[1]).to.containSubset({ action, model: dummyRecord });
			});
		});
	});

	['create', 'index'].forEach((action) => {
		describe(action, () => {
			it('calls authorize', async () => {
				expect(authSpy).to.have.been.calledTwice();
				expect(authSpy.getCall(0).args[0]).to.eq(ctx);
				// First call is with the class
				expect(authSpy.getCall(0).args[1]).to.containSubset({ action, model: models.User });
			});

			if (action === 'index') {
				// Index calls will also authorise the individual records once loaded
				it('calls authorize a second time with the records', () => {
					expect(authSpy).to.have.been.calledTwice();
					expect(authSpy.getCall(1).args[0]).to.eq(ctx);
					expect(authSpy.getCall(1).args[1]).to.containSubset({ action, model: [dummyRecord] });
				});
			}
		});
	});

	/** Record is assigned */
	describe('index', () => {
		it('assigns records to state.data', async () => {
			expect(ctx.state.collection).to.eq([dummyRecord]);
		});

		it('assigns pagination to state.pagination', async () => {
			expect(ctx.state.pagination).to.eq({ page: 1 });
		});
	});

	['show', 'update'].forEach((action) => {
		describe(action, () => {
			it('assigns record to state.data', async () => {
				expect(ctx.state.data).to.eq(dummyRecord);
			});
		});
	});

	// TODO honours id column
	// TODO passes scoping into authorisation
});
