const KyberPoolMaster = artifacts.require('KyberPoolMasterWithClaimOnlyNewFee');
const KyberDAO = artifacts.require('KyberDAOHandleCurrentEpoch');

const {expect} = require('chai');
const {expectRevert} = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

let kyberPoolMaster;
let kyberDAO;
let daoSetter;
let kncToken;
let poolMasterOwner;
let notOwner;
let mike;

contract('KyberPoolMaster delegationFee', async (accounts) => {
  before('one time init', async () => {
    daoSetter = accounts[1];
    poolMasterOwner = accounts[2];
    notOwner = accounts[3];
    mike = accounts[4];

    kyberDAO = await KyberDAO.new();
    kyberPoolMaster = await KyberPoolMaster.new(
      NO_ZERO_ADDRESS,
      kyberDAO.address,
      NO_ZERO_ADDRESS,
      NO_ZERO_ADDRESS,
      1,
      1,
      {from: poolMasterOwner}
    );
  });

  describe('deployment', () => {
    it('should not allow to deploy a KyberPoolMaster zero address kncToken', async () => {
      const test = await kyberPoolMaster.delegationFees(0);

      console.log('TEST', test);
    });
  });
});
