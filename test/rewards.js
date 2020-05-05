const KyberPoolMaster = artifacts.require(
  'KyberPoolMasterWithClaimedPoolRewardSetter'
);
const KyberDAOWithRewardPercentageSetter = artifacts.require(
  'KyberDAOWithRewardPercentageSetter'
);
const KyberFeeHandlerWithRewardPerEposhSetter = artifacts.require(
  'KyberFeeHandlerWithRewardPerEposhSetter'
);

const {expect} = require('chai');
const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

let kyberPoolMaster;
let kyberDAO;
let kyberFeeHandler;
let daoSetter;
let kncToken;
let poolMasterOwner;
let notOwner;
let mike;

contract('KyberPoolMaster claiming', async (accounts) => {
  describe('#getUnclaimedRewards', () => {
    before('one time init', async () => {
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberDAO = await KyberDAOWithRewardPercentageSetter.new();
      kyberFeeHandler = await KyberFeeHandlerWithRewardPerEposhSetter.new();
      kyberPoolMaster = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        kyberDAO.address,
        NO_ZERO_ADDRESS,
        kyberFeeHandler.address,
        2,
        1,
        {from: poolMasterOwner}
      );
    });

    it('should return 0 if PoolMaster has calledRewardMaster', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedReward).to.equal(true);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(1);
      expect(unclaimed.toString()).to.equal('0');
    });

    it("should return 0 if staker's reward percentage in precision for the epoch is 0", async () => {
      const calimedReward = await kyberPoolMaster.claimedPoolReward(2);
      expect(calimedReward).to.equal(false);

      await kyberDAO.setStakerRewardPercentage(kyberPoolMaster.address, 2, 0);
      const stakerReward = await kyberDAO.getStakerRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(2);
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if total reward for the epoch is 0');

    it('should return unclaimed reward amount');
  });
});
