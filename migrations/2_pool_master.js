const KyberPoolMaster = artifacts.require('KyberPoolMaster');

const KYBER_DAO_ADDRESS = process.env.KYBER_DAO_ADDRESS;
const EPOCH_NOTICE = process.env.EPOCH_NOTICE;
const INITIAL_DELEGATION_FEE = process.env.INITIAL_DELEGATION_FEE;

module.exports = async function (deployer) {
  if (process.env.NODE_ENV !== 'test') {
    await deployer.deploy(
      KyberPoolMaster,
      KYBER_DAO_ADDRESS,
      EPOCH_NOTICE,
      INITIAL_DELEGATION_FEE
    );
  }
};
