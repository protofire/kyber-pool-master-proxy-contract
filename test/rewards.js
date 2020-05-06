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

    it('should return 0 if total reward for the epoch is 0', async () => {
      const calimedReward = await kyberPoolMaster.claimedPoolReward(2);
      expect(calimedReward).to.equal(false);

      await kyberDAO.setStakerRewardPercentage(kyberPoolMaster.address, 2, 10);
      const stakerReward = await kyberDAO.getStakerRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('10');

      await kyberFeeHandler.setRewardsPerEpoch(2, 0);
      const rewardPerEpoch = await kyberFeeHandler.rewardsPerEpoch(2);
      expect(rewardPerEpoch.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(2);
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed reward amount', async () => {
      const calimedReward = await kyberPoolMaster.claimedPoolReward(2);
      expect(calimedReward).to.equal(false);

      await kyberDAO.setStakerRewardPercentage(
        kyberPoolMaster.address,
        2,
        '200000000000000000'
      ); // 20%
      const stakerReward = await kyberDAO.getStakerRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('200000000000000000'); // 20%

      await kyberFeeHandler.setRewardsPerEpoch(2, '3000000000000000000'); // 3ETH
      const rewardPerEpoch = await kyberFeeHandler.rewardsPerEpoch(2);
      expect(rewardPerEpoch.toString()).to.equal('3000000000000000000');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(2);
      expect(unclaimed.toString()).to.equal('600000000000000000'); // 3ETH -> 20% = 0.6ETH
    });
  });

  describe('#claimRewardsMaster', () => {
    beforeEach('running before each test', async () => {
      await updateCurrentBlockAndTimestamp();
      console.log(
        `chain start block: ${currentBlock}, start time: ${currentTimestamp}`
      );
      blockTime = 16; // each block is mined after 16s
    });

    it('should only be able to reveive ETH from KyberFeeHandler');
    it('should revert if epoch rewards has been already claimed');
    it('should revert if no unclaimed reward for the epoch');
    it('should revert if claimed reward lower than expected'); // TBD - is this check really necessary
    it('should revert if poolMaster can receive its share');
    it(
      "should only transfer fee to poolMaster if it hasn't stake for the epoch"
    );
    it(
      "epoch memberRewards should be totalReward - fee if poolMaster hasn't stake for the epoch"
    );
    it(
      'should transfer fee + share to poolMaster if it has stak for the epoch'
    );
    it(
      'epoch memberRewards should be totalReward - fee - poolMasterShare if poolMaster has stak for the epoch'
    );
    it('should distribute rewards the right way on multiple scenarios');
    it('should apply the fee used if it was pending');
    it('should emit MasterClaimReward event when everithing ended right');
  });
});
