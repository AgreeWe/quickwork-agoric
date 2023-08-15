/* global harden */
import '@agoric/zoe/exported.js';
import { Far } from '@endo/marshal';
import { assert } from '@agoric/assert';
import { assertProposalShape } from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath } from '@agoric/ertp';

const start = async (zcf) => {

  let managerAddress;
  const tasks = new Map();
  const balances = new Map();

  const setManagerAddress = (newManagerAddress) => {
    assert(
      managerAddress === undefined, `Manager address has already been set and cannot be updated.`
    );
    managerAddress = newManagerAddress;
    return true;
  };
  const getManagerAddress = () => managerAddress;

  const addTask = (task, callerAddress) => {
    assert(managerAddress !== undefined, `Manager address has not been set.`);
    assert(callerAddress === managerAddress, `Only the manager can add tasks.`);
    assert(task.taskId && task.amount && task.payerAddress && task.payeeAddress && task.approverAddress, `All fields are required to create a task.`);
    assert(task.payerAddress !== task.payeeAddress, `Payer and Payee addresses must be distinct.`);
    assert(!tasks.has(task.taskId), `Task ID already exists.`);

    task.status = 'PENDING';
    tasks.set(task.taskId, task);
    return `Task added: ${task.taskId}`;
  };

  const approveTask = (taskId, callerAddress) => {
    const task = tasks.get(taskId);
    assert(task !== undefined, `Task does not exist.`);
    assert(task.status === 'PENDING', `Task is not in a PENDING status.`);
    assert(callerAddress === task.approverAddress, `Only the approver can approve the task.`);

    task.status = 'APPROVED';

    // Update the balance of the payee
    const currentBalance = balances.get(task.payeeAddress) || 0;
    const newBalance = currentBalance + task.amount;
    balances.set(task.payeeAddress, newBalance);

    return taskId;
  };

  const rejectTask = (taskId, callerAddress) => {
    const task = tasks.get(taskId);
    assert(task !== undefined, `Task does not exist.`);
    assert(task.status === 'PENDING', `Task is not in a PENDING status.`);
    assert(callerAddress === task.approverAddress, `Only the approver can reject the task.`);

    task.status = 'REJECTED';

    // Update the balance of the payee
    const currentBalance = balances.get(task.payerAddress) || 0;
    const newBalance = currentBalance + task.amount;
    balances.set(task.payerAddress, newBalance);

    return taskId;
  };

  const withdraw = (callerAddress) => {
    const balance = balances.get(callerAddress) || 0;
    assert(balance > 0, `No funds available for withdrawal.`);

    // Create a payment for the user
    // const payment = zcf.mintPayment(AmountMath.make(balance));
    balances.set(callerAddress, 0);

    return balance;
  };

  const getTask = (taskId) => {
    return tasks.get(taskId);
  };

  const getBalance = (address) => {
    return balances.get(address) || 0;
  };

  const publicFacet = {
    getManagerAddress,
    addTask,
    approveTask,
    rejectTask,
    withdraw,
    getTask,
    getBalance,
  };

  // Set the manager address during deployment
  const terms = zcf.getTerms();
  setManagerAddress(terms.managerAddress);

  // Create a creatorInvitation
  const creatorInvitation = zcf.makeInvitation(() => {
    return managerAddress;
  }, 'creator');

  return { creatorInvitation, publicFacet };
};

harden(start);
export { start };







//
// /* global harden */
// import '@agoric/zoe/exported.js';
// import { Far } from '@endo/marshal';
// import { assert } from '@agoric/assert';
//
// const start = (zcf) => {
//   const tasks = new Map();
//   // Store the manager's identity from the contract terms
//   const manager = zcf.getTerms().manager;
//
//   const addTask = (seat, taskId, payerAddress, payeeAddress, approverAddress) => {
//     // Ensure only the manager can call this method
//     assert(seat.hasExited() === false, 'The seat has already exited');
//     assert(seat.getNotifier().getUpdateSince().value.user === manager, 'Only the manager can add tasks');
//
//     assert(!tasks.has(taskId), "Task ID already exists");
//     assert(payerAddress !== payeeAddress, "Payer and Payee addresses must be distinct");
//
//     // Get the amount from the seat's current allocation
//     const amount = seat.getCurrentAllocation().RUN;
//     assert(amount, "Amount should be present");
//     assert(amount.value > 0n, "Amount should be greater than 0");
//
//     const task = {
//       id: taskId,
//       amount,
//       payerAddress,
//       payeeAddress,
//       approverAddress
//     };
//
//     tasks.set(taskId, task);
//
//     // Since the assets are already escrowed with Zoe when the offer is made,
//     // there's no need to handle the deposit here. The contract can use these assets as needed.
//
//     seat.exit();
//
//     return taskId;
//   };
//
//   const makeAddTaskInvitation = () => {
//     return zcf.makeInvitation((seat) => {
//       const offerArgs = seat.getOfferArgs();
//       const [taskId, payerAddress, payeeAddress, approverAddress] = offerArgs;
//       return addTask(seat, taskId, payerAddress, payeeAddress, approverAddress);
//     }, 'addTask');
//   };
//
//   const creatorFacet = Far('creatorFacet', {
//     makeAddTaskInvitation,
//   });
//
//   return { creatorFacet };
// };
//
// harden(start);
// export { start };
