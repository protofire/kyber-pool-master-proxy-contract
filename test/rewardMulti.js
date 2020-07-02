const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');
const KyberDao = artifacts.require('KyberDaoWithRewardPercentageSetter');
const KyberFeeHandlerWithRewardPerEposhSetter = artifacts.require(
  'KyberFeeHandlerWithRewardPerEposhSetter'
);
const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const KyberStakingWithgetStakerDataForEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForEpoch'
);

const PoolMasterNoFallbackMock = artifacts.require('PoolMasterNoFallbackMock');

const TestToken = artifacts.require('Token.sol');

const {expect} = require('chai');
const {
  expectEvent,
  expectRevert,
  balance,
  ether,
  BN,
} = require('@openzeppelin/test-helpers');

const Reverter = require('./utils/reverter');

const {NO_ZERO_ADDRESS, ZERO_ADDRESS} = require('./helper.js');

let kyberPoolMaster;
let kyberDao;
let kyberFeeHandler;
let daoSetter;
let poolMasterOwner;
let bank;
let notOwner;
let mike;
let reverter;
let poolMasterNoFallbackMock;

contract('KyberPoolMaster claiming', async (accounts) => {
  before('one time init', async () => {
    reverter = new Reverter(web3);
    await reverter.snapshot();
  });

  describe('#getEpochFeeHandlerUnclaimedRewards - getAllEpochWithUnclaimedRewards', () => {
    before('one time init', async () => {
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, NO_ZERO_ADDRESS);

      kyberFeeHandler1 = await KyberFeeHandlerWithRewardPerEposhSetter.new(
        kyberDao.address
      );
      kyberFeeHandler2 = await KyberFeeHandlerWithRewardPerEposhSetter.new(
        kyberDao.address
      );
      rewardTokenA = await TestToken.new('Reward Token A', 'RTA', 18);
      kyberFeeHandler3 = await KyberFeeHandlerWithRewardPerEposhSetter.new(
        kyberDao.address
      );
      rewardTokenB = await TestToken.new('Reward Token B', 'RTB', 18);

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        kyberFeeHandler1.address,
        2,
        1,
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
        ],
        [ZERO_ADDRESS, rewardTokenA.address, rewardTokenB.address],
        {
          from: poolMasterOwner,
        }
      );
    });

    it('should return 0 if PoolMaster has claimedEpochFeeHandlerPoolReward', async () => {
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler1.address
      );
      const claimedReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler1.address
      );
      expect(claimedReward).to.equal(true);

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewards(
        1,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it("should return 0 if staker's reward percentage in precision for the epoch is 0", async () => {
      const claimedReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler1.address
      );
      expect(claimedReward).to.equal(false);

      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 2, 0);
      const stakerReward = await kyberDao.getPastEpochRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if total reward for the epoch is 0', async () => {
      const claimedReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler1.address
      );
      expect(claimedReward).to.equal(false);

      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 2, 10);
      const stakerReward = await kyberDao.getPastEpochRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('10');

      await kyberFeeHandler1.setRewardsPerEpoch(2, 0);
      const rewardPerEpoch = await kyberFeeHandler1.rewardsPerEpoch(2);
      expect(rewardPerEpoch.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed reward amount', async () => {
      const claimedReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler1.address
      );
      expect(claimedReward).to.equal(false);

      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        2,
        '200000000000000000'
      ); // 20%
      const stakerReward = await kyberDao.getPastEpochRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('200000000000000000'); // 20%

      await kyberFeeHandler1.setRewardsPerEpoch(2, '3000000000000000000'); // 3ETH
      const rewardPerEpoch = await kyberFeeHandler1.rewardsPerEpoch(2);
      expect(rewardPerEpoch.toString()).to.equal('3000000000000000000');

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('600000000000000000'); // 3ETH -> 20% = 0.6ETH
    });

    it('should return all epochs with at least one FeeHandler paying rewards', async () => {
      await kyberDao.setCurrentEpochNumber(7);

      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        3,
        '200000000000000000'
      ); // 20%
      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 4, '0'); // 20%
      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        5,
        '200000000000000000'
      ); // 20%
      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        6,
        '200000000000000000'
      ); // 20%
      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        7,
        '200000000000000000'
      ); // 20%

      await kyberFeeHandler1.setRewardsPerEpoch(3, '3000000000000000000'); // 3ETH
      await kyberFeeHandler2.setRewardsPerEpoch(3, '0'); // 0ETH
      await kyberFeeHandler3.setRewardsPerEpoch(3, '0'); // 0ETH

      await kyberFeeHandler1.setRewardsPerEpoch(4, '3000000000000000000'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(4, '3000000000000000000'); // 0ETH
      await kyberFeeHandler3.setRewardsPerEpoch(4, '3000000000000000000'); // 0ETH

      await kyberFeeHandler1.setRewardsPerEpoch(5, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(5, '0'); // 0ETH
      await kyberFeeHandler3.setRewardsPerEpoch(5, '0'); // 0ETH

      await kyberFeeHandler1.setRewardsPerEpoch(6, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(6, '3000000000000000000'); // 3ETH
      await kyberFeeHandler3.setRewardsPerEpoch(6, '3000000000000000000'); // 3ETH

      await kyberFeeHandler1.setRewardsPerEpoch(7, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(7, '3000000000000000000'); // 3ETH
      await kyberFeeHandler3.setRewardsPerEpoch(7, '0'); // 0ETH

      const unclaimedEpochs = await kyberPoolMaster.getAllEpochWithUnclaimedRewards();
      expect(JSON.stringify(unclaimedEpochs)).to.equal('["2","3","6","7"]'); // epoch 2 is set in previos tests
    });
  });
});
