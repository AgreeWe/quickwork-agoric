# Quickwork Contract

Quickwork is a smart contract built on the Agoric platform. It allows a manager to create tasks, which can be approved
or rejected by an approver. Funds can be deposited for tasks and withdrawn by the payee or manager.

## Features

- **Task Creation**: A manager can create tasks with associated details such as payer, payee, and approver addresses, as
  well as the amount allocated for the task.

- **Task Approval & Rejection**: An approver can approve or reject tasks. Upon approval, the allocated funds are
  transferred to the payee. Upon rejection, the funds are returned to the manager.

- **Balance Management**: Users can check their balance, and funds can be withdrawn by the payee or manager.

## Contract Details

The contract uses the `@agoric/zoe` library for contract execution and the `@agoric/ertp` library for electronic rights
transfer. The contract's currency is represented by the `USDT` brand.

Deploy contract:
```bash
agoric deploy contract/quickwork.js
```

## API

- `setManagerAddress(newManagerAddress)`: Set the manager's address. This can only be set once.

- `getManagerAddress()`: Retrieve the manager's address.

- `addTask()`: Create a new task. This requires the manager's approval.

- `approveTask(taskId)`: Approve a task based on its ID.

- `rejectTask(taskId)`: Reject a task based on its ID.

- `getBalance(address)`: Check the balance of a given address.

- `getTask(taskId)`: Retrieve details of a task based on its ID.

- `askWithdraw(callerAddress)`: Withdraw funds for a given address.

## Author
AgreeWe Team
