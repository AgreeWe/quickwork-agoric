/* global harden */

import '@agoric/zoe/exported.js';
import { assert } from '@agoric/assert';
import { assertProposalShape } from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath, makeIssuerKit } from '@agoric/ertp';

/**
 * Contract for Quickwork.
 *
 * This contract allows a manager to create tasks, which can be approved or rejected by an approver.
 * Funds can be deposited for tasks and withdrawn by the payee or manager.
 */

const start = async (zcf) => {
  const terms = zcf.getTerms();
  const issuer = terms.issuers.USDT;
  const brand = terms.brands.USDT;

  const tasks = new Map();
  const balances = new Map();

  const { mint: withdrawalMint, issuer: withdrawalIssuer } = makeIssuerKit('USDT');
  let managerAddress;

  const setManagerAddress = (newManagerAddress) => {
    assert(
      managerAddress === undefined,
      `Manager address has already been set and cannot be updated.`
    );
    managerAddress = newManagerAddress;
    return true;
  };

  const getManagerAddress = () => managerAddress;

  const addTask = zcf.makeInvitation((seat, rawTask) => {
    assertProposalShape(seat, { give: { USDT: null } });
    const depositedAmount = seat.getAmountAllocated('USDT', brand);
    assert(depositedAmount.value > 0n, 'Amount must be greater than 0');

    const task = {
      taskId: rawTask.taskId,
      payerAddress: rawTask.payerAddress,
      payeeAddress: rawTask.payeeAddress,
      approverAddress: rawTask.approverAddress,
      amount: depositedAmount.value,
      status: 'PENDING',
    };

    assert(
      task.taskId && task.payerAddress && task.payeeAddress && task.approverAddress,
      `All fields are required to create a task.`
    );
    assert(
      task.payerAddress !== task.payeeAddress,
      `Payer and Payee addresses must be distinct.`
    );
    assert(!tasks.has(task.taskId), `Task ID already exists.`);

    tasks.set(task.taskId, task);
    balances.set(task.taskId, depositedAmount.value);
    seat.exit();

    return task;
  }, 'deposit');

  const askAddTask = (callerAddress) => {
    assert(managerAddress !== undefined, `Manager address has not been set.`);
    assert(callerAddress === managerAddress, `Only the manager can add tasks.`);
    return { addTask };
  };

  const approveTask = (taskId, callerAddress) => {
    const task = tasks.get(taskId);
    assert(task !== undefined, `Task does not exist.`);
    assert(task.status === 'PENDING', `Task is not in a PENDING status.`);
    assert(callerAddress === task.approverAddress, `Only the approver can approve the task.`);

    const updatedTask = { ...task, status: 'APPROVED' };
    tasks.set(taskId, updatedTask);

    const currentBalance = balances.get(task.payeeAddress) || 0n;
    const newBalance = currentBalance + task.amount;
    balances.set(task.payeeAddress, newBalance);

    return taskId;
  };

  const rejectTask = (taskId, callerAddress) => {
    const task = tasks.get(taskId);
    assert(task !== undefined, `Task does not exist.`);
    assert(task.status === 'PENDING', `Task is not in a PENDING status.`);
    assert(callerAddress === task.approverAddress, `Only the approver can reject the task.`);

    const updatedTask = { ...task, status: 'REJECTED' };
    tasks.set(taskId, updatedTask);

    const currentBalance = balances.get(managerAddress) || 0n;
    const newBalance = currentBalance + task.amount;
    balances.set(managerAddress, newBalance);

    return taskId;
  };

  const getBalance = (address) => {
    return balances.get(address) || 0n;
  };

  const getTask = (taskId) => {
    return tasks.get(taskId);
  };

  setManagerAddress(terms.managerAddress);

  const withdraw = (address) => {
    const balance = getBalance(address);
    const withdrawalBrand = withdrawalIssuer.getBrand();
    const payment = withdrawalMint.mintPayment(AmountMath.make(withdrawalBrand, balance));
    balances.set(address, 0n);
    return payment;
  };

  const askWithdraw = (callerAddress) => {
    assert(balances.has(callerAddress), `No balance for address ${callerAddress}`);
    return withdraw(callerAddress);
  };

  const publicFacet = {
    getManagerAddress,
    askAddTask,
    approveTask,
    rejectTask,
    getBalance,
    getTask,
    askWithdraw,
    getIssuer: () => withdrawalIssuer,
    getBrand: () => brand,
  };

  const creatorInvitation = zcf.makeInvitation(() => {
    return managerAddress;
  }, 'creator');

  return { creatorInvitation, publicFacet };
};

harden(start);
export { start };
