/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

// const HDWalletProvider = require('@truffle/hdwallet-provider');
// const infuraKey = "fj4jll3k.....";
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();

require('dotenv').config();
const HDWalletProvider = require('truffle-hdwallet-provider-privkey');

let INFURA_PROJECT_ID;
let DEPLOYMENT_ACCOUNT_PK;
let GAS_PRICE;

if (process.env.NODE_ENV !== 'test') {
  [INFURA_PROJECT_ID, DEPLOYMENT_ACCOUNT_PK, GAS_PRICE] = getEnv();
}

module.exports = {
  networks: {
    ganache: {
      host: '127.0.0.1', // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: '*', // Any network (default: none)
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          [DEPLOYMENT_ACCOUNT_PK],
          `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`
        ),
      network_id: 3,
      gas: 4000000,
      gasPrice: GAS_PRICE,
      skipDryRun: true,
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider(
          [DEPLOYMENT_ACCOUNT_PK],
          `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`
        ),
      network_id: 1,
      gas: 4000000,
      gasPrice: GAS_PRICE,
      timeoutBlocks: 200,
    },
  },

  plugins: ['solidity-coverage'],

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.6.6', // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: false,
          runs: 200,
        },
        //  evmVersion: "byzantium"
      },
    },
  },
};

function getEnv() {
  const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
  const DEPLOYMENT_ACCOUNT_PK = (
    process.env.DEPLOYMENT_ACCOUNT_PK || ''
  ).replace(/^0x/, '');
  const GAS_PRICE = process.env.GAS_PRICE || 10000000000;
  const KYBER_DAO_ADDRESS = process.env.KYBER_DAO_ADDRESS;
  const EPOCH_NOTICE = process.env.EPOCH_NOTICE;
  const INITIAL_DELEGATION_FEE = process.env.INITIAL_DELEGATION_FEE;

  if (
    !INFURA_PROJECT_ID ||
    !DEPLOYMENT_ACCOUNT_PK ||
    !KYBER_DAO_ADDRESS ||
    !EPOCH_NOTICE ||
    !INITIAL_DELEGATION_FEE
  ) {
    throw 'Missing env';
  }

  return [INFURA_PROJECT_ID, DEPLOYMENT_ACCOUNT_PK, GAS_PRICE];
}
