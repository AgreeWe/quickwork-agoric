import { test } from './prepare-test-env-ava.js';
import path from 'path';
import bundleSource from '@endo/bundle-source';
import '@agoric/zoe/exported.js';
import { E } from '@endo/eventual-send';
import { makeFakeVatAdmin } from '@agoric/zoe/tools/fakeVatAdmin.js';
import { makeZoeKit } from '@agoric/zoe';
import { AmountMath, makeIssuerKit } from '@agoric/ertp';

const filename = new URL(import.meta.url).pathname;
const dirname = path.dirname(filename);
const contractPath = `${dirname}/../src/quickwork.js`;

/**
 * Setup the test environment.
 * This function initializes Zoe, bundles the contract source, and sets up the initial state for testing.
 */
const setupTest = async () => {
  // Initialize Zoe and bind the default fee purse
  const { zoeService } = makeZoeKit(makeFakeVatAdmin().admin);
  const feePurse = E(zoeService).makeFeePurse();
  const zoe = E(zoeService).bindDefaultFeePurse(feePurse);

  // Bundle the contract and install it on Zoe
  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  // Create a new issuer kit for USDT
  const { brand, mint, issuer } = makeIssuerKit('USDT');

  // Define the manager address and start the Zoe instance
  const managerAddress = '0x1234';
  const { creatorInvitation, publicFacet } = await E(zoe).startInstance(installation, { USDT: issuer }, { managerAddress });

  // Define a sample task and the deposit amount
  const task = {
    taskId: '1',
    payerAddress: '0x5678',
    payeeAddress: '0x9abc',
    approverAddress: '0xdef0',
  };
  const depositAmount = 100n;

  // Manager asks to add a task
  const { addTask } = publicFacet.askAddTask(managerAddress);
  const addTaskProposal = {
    give: { USDT: AmountMath.make(brand, depositAmount) },
    want: {},
    exit: { onDemand: null },
  };

  // Create a payment for the deposit and offer it
  const payment = mint.mintPayment(AmountMath.make(brand, depositAmount));
  const depositSeat = await E(zoe).offer(addTask, addTaskProposal, { USDT: payment }, task);

  return {
    zoe,
    publicFacet,
    depositSeat,
    task,
    brand,
    mint,
    issuer,
    managerAddress,
    payment,
    addTask,
    addTaskProposal,
    depositAmount,
    creatorInvitation,
  };
};

/**
 * Main test for the quickwork contract.
 * This test covers the basic functionality of the contract, including depositing, approving, and withdrawing funds.
 */
test('zoe - quickwork - basic functionality', async (t) => {
  const {
    zoe,
    publicFacet,
    depositSeat,
    task,
    brand,
    mint,
    managerAddress,
    depositAmount,
    creatorInvitation,
  } = await setupTest();

  // Alice offers the creator invitation
  const proposal = { give: {}, want: {}, exit: { onDemand: null } };
  const aliceSeat = await E(zoe).offer(creatorInvitation, proposal);
  const aliceOfferResult = await aliceSeat.getOfferResult();
  t.is(aliceOfferResult, managerAddress, 'Stored manager');

  // Validate the stored manager address
  const storedManagerAddress = publicFacet.getManagerAddress();
  t.is(storedManagerAddress, managerAddress, 'Validate stored manager');

  // Check the allocation after the deposit
  const allocation = await depositSeat.getCurrentAllocation();
  t.deepEqual(allocation.USDT, AmountMath.make(brand, depositAmount), 'Manager has correctly allocated the USDT');

  // Retrieve and validate the task details
  const storedTask = publicFacet.getTask(task.taskId);
  t.is(storedTask.amount, depositAmount, 'Validate task amount');
  t.is(storedTask.status, 'PENDING', 'Validate task status');

  // Approver approves the task
  const approverAddress = task.approverAddress;
  const withdrawInvitation = publicFacet.approveTask(task.taskId, approverAddress);
  t.truthy(withdrawInvitation, 'Withdraw invitation received');

  // Retrieve and validate the updated task status
  const updatedTask = publicFacet.getTask(task.taskId);
  t.is(updatedTask.status, 'APPROVED', 'Validate task status');

  // Check and validate the payee's balance
  const payeeBalance = publicFacet.getBalance(task.payeeAddress);
  t.is(payeeBalance, storedTask.amount, 'Validate payee balance');

  // Payee withdraws the USDT
  const withdrawalIssuer = publicFacet.getIssuer();
  const payeeWithdrawalPayment = publicFacet.askWithdraw(task.payeeAddress);
  const payeeWithdrawalAmount = await withdrawalIssuer.getAmountOf(payeeWithdrawalPayment);
  const contractBrand = publicFacet.getBrand();
  t.deepEqual(payeeWithdrawalAmount.value, AmountMath.make(contractBrand, depositAmount).value, 'Payee has withdrawn the correct amount');

  // Check and validate the payee's balance after withdrawal
  const payeeBalanceAfterWithdrawal = publicFacet.getBalance(task.payeeAddress);
  t.is(payeeBalanceAfterWithdrawal, 0n, 'Payee balance is 0 after withdrawal');
});

/**
 * Test for Rejecting a Task.
 * This test covers the scenario where a task is rejected by the approver.
 */
test('zoe - quickwork - reject task', async (t) => {
  const { publicFacet, task } = await setupTest();

  // Approver rejects the task
  const approverAddress = task.approverAddress;
  const rejectInvitation = publicFacet.rejectTask(task.taskId, approverAddress);
  t.truthy(rejectInvitation, 'Reject invitation received');

  // Retrieve and validate the rejected task status
  const rejectedTask = publicFacet.getTask(task.taskId);
  t.is(rejectedTask.status, 'REJECTED', 'Validate task status after rejection');
});

/**
 * Test for Invalid Manager Address.
 * This test covers the scenario where an invalid manager address is used to add a task.
 */
test('zoe - quickwork - invalid manager address', async (t) => {
  const { publicFacet } = await setupTest();

  const invalidManagerAddress = '0x9999';
  t.throws(() => publicFacet.askAddTask(invalidManagerAddress), {
    message: 'Only the manager can add tasks.',
  }, 'Invalid manager address should throw an error');
});

/**
 * Test for Invalid Approver Address.
 * This test covers the scenario where an invalid approver address is used to approve or reject a task.
 */
test('zoe - quickwork - invalid approver address', async (t) => {
  const { publicFacet, task } = await setupTest();
  const invalidApproverAddress = '0x8888';
  t.throws(() => publicFacet.approveTask(task.taskId, invalidApproverAddress), {
    message: 'Only the approver can approve the task.',
  }, 'Invalid approver address should throw an error');
  t.throws(() => publicFacet.rejectTask(task.taskId, invalidApproverAddress), {
    message: 'Only the approver can reject the task.',
  }, 'Invalid approver address should throw an error for rejection');
});

/**
 * Test for Manager Withdrawal After Task Rejection.
 * This test covers the scenario where the manager withdraws funds after a task has been rejected.
 */
test('zoe - quickwork - manager withdrawal after task rejection', async (t) => {
  const { publicFacet, task, brand, mint, issuer, managerAddress, depositAmount } = await setupTest();

  publicFacet.rejectTask(task.taskId, task.approverAddress);

  // Check manager's balance after task rejection
  const managerBalanceAfterRejection = publicFacet.getBalance(managerAddress);
  t.is(managerBalanceAfterRejection, depositAmount, 'Manager balance should be equal to task amount after rejection');

  // Payee withdraws the USDT
  const withdrawalIssuer = publicFacet.getIssuer();
  const withdrawalPayment = publicFacet.askWithdraw(managerAddress);
  const withdrawalAmount = await withdrawalIssuer.getAmountOf(withdrawalPayment);
  const contractBrand = publicFacet.getBrand();
  t.deepEqual(withdrawalAmount.value, AmountMath.make(contractBrand, depositAmount).value, 'Manager has withdrawn the correct amount');

  // Check and validate the manager's balance after withdrawal
  const payeeBalanceAfterWithdrawal = publicFacet.getBalance(managerAddress);
  t.is(payeeBalanceAfterWithdrawal, 0n, 'Payee balance is 0 after withdrawal');
});

