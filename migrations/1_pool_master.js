const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const configs = require('../configs.json');

const KYBER_DAO_ADDRESS = configs.KYBER_DAO_ADDRESS;
const KYBER_FEE_HANDLERS_ADDRESS = configs.KYBER_FEE_HANDLERS_ADDRESS;
const REWARD_TOKENS = configs.REWARD_TOKENS;
const EPOCH_NOTICE = configs.EPOCH_NOTICE;
const INITIAL_DELEGATION_FEE = configs.INITIAL_DELEGATION_FEE;

module.exports = async function (deployer) {
  if (process.env.NODE_ENV !== 'test') {
    await deployer.deploy(
      KyberPoolMaster,
      KYBER_DAO_ADDRESS,
      EPOCH_NOTICE,
      INITIAL_DELEGATION_FEE,
      KYBER_FEE_HANDLERS_ADDRESS,
      REWARD_TOKENS
    );
  }
};
