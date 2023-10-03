// @ts-check

import '@agoric/zoe/exported.js';
import { makeHelpers } from '@agoric/deploy-script-support';

/**
 * @template T
 * @typedef {import('@endo/eventual-send').ERef<T>} ERef
 */

/**
 * @typedef {object} DeployPowers The special powers that agoric deploy gives us
 * @property {(path: string) => string} pathResolve
 * @property {(bundle: unknown) => any} publishBundle
 * @typedef {object} Board
 * @property {(id: string) => unknown} getValue
 * @property {(value: unknown) => string} getId
 * @property {(value: unknown) => boolean} has
 * @property {() => [string]} ids
 */

/**
 * @param {Promise<{zoe: ERef<ZoeService>, board: ERef<Board>, agoricNames:
 * object, wallet: ERef<object>, faucet: ERef<object>}>} homePromise
 * @param {DeployPowers} endowments
 */
const deployContract = async (homePromise, endowments) => {
  const { pathResolve } = endowments;
  const { install } = await makeHelpers(homePromise, endowments);

  // Set the contract name for production
  const CONTRACT_NAME = 'Quickwork';
  await install('./src/quickwork.js', CONTRACT_NAME);

  console.log(`Contract ${CONTRACT_NAME} has been deployed.`);
};

export default deployContract;
