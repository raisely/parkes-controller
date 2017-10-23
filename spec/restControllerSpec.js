const sinon = require('sinon');
const MockModel = require('./util/mockModel');
const restUp = require('../index.js');
const chai = require('chai');
const { mockKoaContext } = require('./util/mockKoa');

const { expect } = chai;

const dummyRecord = { id: 1, name: 'Harvey Milk' };
// eslint-disable-next-line no-empty-function
async function noop() {}

function authorize() {}

describe('restController', () => {
	let userController;
	let models;
	let authSpy;

	before(() => {
		models = {
			User: MockModel('User', dummyRecord),
		};

		authSpy = sinon.stub(authorize);

		restUp.init({ models, authorize });
		userController = restUp.controller('User');
	});

	describe('findOne', () => {
		let ctx;

		beforeEach(async () => {
			ctx = mockKoaContext();
			await userController(ctx, noop);
		});

		it('assigns records to state.data', async () => {
			expect(ctx.state.data).to.eq([dummyRecord]);
		});

		it('assigns pagination to state.pagination', async () => {
			expect(ctx.state.pagination).to.eq({ page: 1 });
		});

		it('calls authorize', async () => {
			expect(authSpy).to.have.been.calledOnce();
		});
	});
});
