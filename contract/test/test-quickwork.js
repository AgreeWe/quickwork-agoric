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

test('zoe - quickwork', async (t) => {
  const { zoeService } = makeZoeKit(makeFakeVatAdmin().admin);
  const feePurse = E(zoeService).makeFeePurse();
  const zoe = E(zoeService).bindDefaultFeePurse(feePurse);

  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  // Alice deploys the contract and sets the initial manager
  const managerAddress = '0x1234';
  const { creatorInvitation, publicFacet, instance } = await E(zoe).startInstance(installation, {}, { managerAddress });

  const proposal = {
    give: {},
    want: {},
    exit: { onDemand: null },
  };

  const aliceSeat = await E(zoe).offer(creatorInvitation, proposal);
  const aliceOfferResult = await aliceSeat.getOfferResult();
  t.is(aliceOfferResult, managerAddress, 'Stored manager');

  const storedManagerAddress = publicFacet.getManagerAddress();
  t.is(storedManagerAddress, managerAddress, 'Validate stored manager');

  // Manager adds a task
  const task = {
    taskId: '1',
    amount: 100,
    payerAddress: '0x5678',
    payeeAddress: '0x9abc',
    approverAddress: '0xdef0',
  };

  const addTaskResult = publicFacet.addTask(task, managerAddress);
  t.is(addTaskResult, `Task added: ${task.taskId}`, 'Task added');

  // Retrieve the task
  const storedTask = publicFacet.getTask(task.taskId);
  t.deepEqual(storedTask, task, 'Validate stored task');
  t.is(storedTask.status, 'PENDING', 'Validate task status');

  // Approver approves the task
  const approverAddress = task.approverAddress;
  const approveTaskResult = publicFacet.approveTask(task.taskId, approverAddress);
  t.is(approveTaskResult, task.taskId, 'Task added');

  // Retrieve the updated task
  const updatedTask = publicFacet.getTask(task.taskId);
  t.is(updatedTask.status, 'APPROVED', 'Validate task status');

  // Check the balance of the payee
  const payeeBalance = publicFacet.getBalance(task.payeeAddress);
  t.is(payeeBalance, task.amount, 'Validate payee balance');

  // Payee withdraws their funds
  const payeeWithdrawal = publicFacet.withdraw(task.payeeAddress);
  t.is(payeeWithdrawal, task.amount, 'Validate payee withdrawal');

  // Check the balance of the payee after withdrawal
  const payeeBalanceAfterWithdrawal = publicFacet.getBalance(task.payeeAddress);
  t.is(payeeBalanceAfterWithdrawal, 0, 'Validate payee balance after withdrawal');



  // Manager adds a second task
  const task2 = {
    taskId: '2',
    amount: 200,
    payerAddress: '0xabcd',
    payeeAddress: '0xef01',
    approverAddress: '0x2345',
  };

  const addTaskResult2 = publicFacet.addTask(task2, managerAddress);
  t.is(addTaskResult2, `Task added: ${task2.taskId}`, 'Task 2 added');

  // Approver rejects the second task
  const rejectTaskResult = publicFacet.rejectTask(task2.taskId, task2.approverAddress);
  t.is(rejectTaskResult, task2.taskId, 'Task 2 rejected');

  // Retrieve the updated task
  const updatedTask2 = publicFacet.getTask(task2.taskId);
  t.is(updatedTask2.status, 'REJECTED', 'Validate task 2 status');

  // Check the balance of the payer
  const payerBalance = publicFacet.getBalance(task2.payerAddress);
  t.is(payerBalance, task2.amount, 'Validate payer balance');

});

