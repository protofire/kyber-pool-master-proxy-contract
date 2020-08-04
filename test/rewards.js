const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');
const KyberDao = artifacts.require('KyberDaoWithRewardPercentageSetter');
const KyberFeeHandlerWithRewardPerEposhSetter = artifacts.require(
  'KyberFeeHandlerWithRewardPerEposhSetter'
);
const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const KyberFeeHandlerWithClaimStakerRewardERC20 = artifacts.require(
  'KyberFeeHandlerWithClaimStakerRewardERC20'
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

const {
  NO_ZERO_ADDRESS,
  ZERO_ADDRESS,
  precisionUnits,
  ETH_TOKEN_ADDRESS,
} = require('./helper.js');

let kyberPoolMaster;
let kyberDao;
let kyberFeeHandler1;
let kyberFeeHandler2;
let kyberFeeHandler3;
let kyberFeeHandler4;
let rewardTokenA;
let rewardTokenB;
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

  describe('#getUnclaimedRewards - getUnclaimedRewardsData', () => {
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
        2,
        1,
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
        ],
        [ETH_TOKEN_ADDRESS, rewardTokenA.address, rewardTokenB.address],
        {
          from: poolMasterOwner,
        }
      );
    });

    it('should return 0 if PoolMaster has not claimed', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(
        1,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it("should return 0 if staker's reward percentage in precision for the epoch is 0", async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 2, 0);
      const stakerReward = await kyberDao.getPastEpochRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if total reward for the epoch is 0', async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 2, 10);
      const stakerReward = await kyberDao.getPastEpochRewardPercentageInPrecision(
        kyberPoolMaster.address,
        2
      );
      expect(stakerReward.toString()).to.equal('10');

      await kyberFeeHandler1.setRewardsPerEpoch(2, 0);
      const rewardPerEpoch = await kyberFeeHandler1.rewardsPerEpoch(2);
      expect(rewardPerEpoch.toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed reward amount', async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

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

      const unclaimed = await kyberPoolMaster.getUnclaimedRewards(
        2,
        kyberFeeHandler1.address
      );
      expect(unclaimed.toString()).to.equal('600000000000000000'); // 3ETH -> 20% = 0.6ETH
    });

    it('should return all epochs/feeHandlers with unclaimed rewards', async () => {
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

      const unclaimedEpochsFeeHandlers = await kyberPoolMaster.methods[
        'getUnclaimedRewardsData()'
      ]();

      expect(unclaimedEpochsFeeHandlers.length).to.equal(4);

      expect(unclaimedEpochsFeeHandlers[0].epoch).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[0].feeHandler).to.equal(
        kyberFeeHandler1.address
      );
      expect(unclaimedEpochsFeeHandlers[0].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[0].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      rewardTokenA.address;
      expect(unclaimedEpochsFeeHandlers[1].epoch).to.equal('3');
      expect(unclaimedEpochsFeeHandlers[1].feeHandler).to.equal(
        kyberFeeHandler1.address
      );
      expect(unclaimedEpochsFeeHandlers[1].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[1].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      expect(unclaimedEpochsFeeHandlers[2].epoch).to.equal('6');
      expect(unclaimedEpochsFeeHandlers[2].feeHandler).to.equal(
        kyberFeeHandler2.address
      );
      expect(unclaimedEpochsFeeHandlers[2].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[2].rewardToken).to.equal(
        rewardTokenA.address
      );

      expect(unclaimedEpochsFeeHandlers[3].epoch).to.equal('6');
      expect(unclaimedEpochsFeeHandlers[3].feeHandler).to.equal(
        kyberFeeHandler3.address
      );
      expect(unclaimedEpochsFeeHandlers[3].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[3].rewardToken).to.equal(
        rewardTokenB.address
      );
    });

    it('should return all epochs/feeHander with unclaimed rewards from the given groups of epochs and feeHandlers', async () => {
      await kyberDao.setCurrentEpochNumber(7);

      await kyberDao.setStakerRewardPercentage(
        kyberPoolMaster.address,
        3,
        '200000000000000000'
      ); // 20%
      await kyberDao.setStakerRewardPercentage(kyberPoolMaster.address, 4, '0'); // 00%
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

      await kyberFeeHandler1.setRewardsPerEpoch(4, '3000000000000000000'); // 3ETH
      await kyberFeeHandler2.setRewardsPerEpoch(4, '3000000000000000000'); // 3ETH
      await kyberFeeHandler3.setRewardsPerEpoch(4, '3000000000000000000'); // 3ETH

      await kyberFeeHandler1.setRewardsPerEpoch(5, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(5, '0'); // 0ETH
      await kyberFeeHandler3.setRewardsPerEpoch(5, '0'); // 0ETH

      await kyberFeeHandler1.setRewardsPerEpoch(6, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(6, '3000000000000000000'); // 3ETH
      await kyberFeeHandler3.setRewardsPerEpoch(6, '3000000000000000000'); // 3ETH

      await kyberFeeHandler1.setRewardsPerEpoch(7, '0'); // 0ETH
      await kyberFeeHandler2.setRewardsPerEpoch(7, '3000000000000000000'); // 3ETH
      await kyberFeeHandler3.setRewardsPerEpoch(7, '0'); // 0ETH

      const unclaimedEpochsFeeHandlers = await kyberPoolMaster.methods[
        'getUnclaimedRewardsData(uint256[],address[])'
      ]([3, 4, 5, 6, 7], [kyberFeeHandler1.address, kyberFeeHandler2.address]);

      expect(unclaimedEpochsFeeHandlers.length).to.equal(2);

      expect(unclaimedEpochsFeeHandlers[0].epoch).to.equal('3');
      expect(unclaimedEpochsFeeHandlers[0].feeHandler).to.equal(
        kyberFeeHandler1.address
      );
      expect(unclaimedEpochsFeeHandlers[0].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[0].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      expect(unclaimedEpochsFeeHandlers[1].epoch).to.equal('6');
      expect(unclaimedEpochsFeeHandlers[1].feeHandler).to.equal(
        kyberFeeHandler2.address
      );
      expect(unclaimedEpochsFeeHandlers[1].rewards.toString()).to.equal(
        '600000000000000000'
      );
      expect(unclaimedEpochsFeeHandlers[1].rewardToken).to.equal(
        rewardTokenA.address
      );
    });
  });

  const prepareEpochForClaim = async ({
    epoch,
    staker,
    feeHandlers,
    stakerRewardPercentage,
    rewardsPerEpoch,
    stakerStake = '0',
    delegatedStake = '1',
  }) => {
    await kyberDao.setStakerRewardPercentage(
      staker,
      epoch,
      stakerRewardPercentage
    );
    await Promise.all(
      feeHandlers.map((feeHandler, i) =>
        feeHandler.setRewardsPerEpoch(epoch, rewardsPerEpoch[i])
      )
    );
    await kyberStaking.setStakerData(
      epoch,
      staker,
      stakerStake,
      delegatedStake,
      staker
    );
  };

  describe('#claimRewardsMaster(uint256[])', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();

      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);

      kyberFeeHandler1 = await KyberFeeHandlerWithClaimStakerReward.new(
        kyberDao.address
      );

      rewardTokenA = await TestToken.new('Reward Token A', 'RTA', 18);
      kyberFeeHandler2 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenA.address
      );

      rewardTokenB = await TestToken.new('Reward Token B', 'RTB', 18);
      kyberFeeHandler3 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberFeeHandler4 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        [
          ETH_TOKEN_ADDRESS,
          rewardTokenA.address,
          rewardTokenB.address,
          rewardTokenB.address,
        ],
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler1.send('10000000000000000000', {from: bank});
      await rewardTokenA.transfer(kyberFeeHandler2.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberFeeHandler3.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberFeeHandler4.address, mulPrecision(100));
    });

    it('should only be able to receive ETH from KyberFeeHandler1', async () => {
      await expectRevert(
        kyberPoolMaster.send('10', {from: mike}),
        'only accept ETH from a KyberFeeHandler'
      );
    });

    it('should revert when rewards is in ETH and poolMaster can not receive its share', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[])']([1], {
          from: mike,
        }),
        'cRMaster: poolMaster share transfer failed'
      );
    });

    it('should not revert after transferring ownership to someone who can receive ETH', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH,
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[])']([1], {
          from: mike,
        }),
        'cRMaster: poolMaster share transfer failed'
      );

      await poolMasterNoFallbackMock.transferPoolMasterOwnership(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1], {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimReward');
    });

    it('should revert when trying to claim with no epoch', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[])']([], {
          from: mike,
        }),
        'cRMaster: _epochGroup required'
      );
    });

    it('should revert when trying to claim with repeated epochs', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[])']([1, 1], {
          from: mike,
        }),
        'cRMaster: order and uniqueness required'
      );
    });

    it('should revert when trying to claim with unordered epochs', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[])']([2, 1], {
          from: mike,
        }),
        'cRMaster: order and uniqueness required'
      );
    });

    it("should only transfer fee to poolMaster if it hasn't stake for the epoch", async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // poolMasterShare only 1% of unclaimReward = 0.6 ETH x 1 / 100 = 0.006 ETH
      // poolMembersShare unclaimReward - poolMasterShare = 0.6 ETH - 0.006 ETH
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1, 2], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler4.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const expectedETHBalance = poolMasterOwnerETHBalance.add(
        new BN(feeAmount)
      );
      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const expectedRTABalance = poolMasterOwnerRTABalance.add(
        new BN(feeAmount)
      );
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const expectedRTBBalance = poolMasterOwnerRTBBalance.add(
        new BN(feeAmount).mul(new BN(2))
      );
      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );

      //

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolETHMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolETHMembersShare.toString()
      );

      const epochFeeHandlerClaimsETH = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETH.claimedByPool).to.equal(true);

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolRTAMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolRTAMembersShare.toString()
      );

      const epochFeeHandlerClaimsRTA = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTA.claimedByPool).to.equal(true);

      //
      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      const expectedPoolRTBMembersShare3 = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      const expectedPoolRTBMembersShare4 = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal(
        expectedPoolRTBMembersShare3.toString()
      );
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal(
        expectedPoolRTBMembersShare4.toString()
      );

      const epochFeeHandlerClaimsRTB3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTB3.claimedByPool).to.equal(true);

      const epochFeeHandlerClaimsRTB4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTB4.claimedByPool).to.equal(true);
    });

    it('should transfer fee + share to poolMaster if it has stake for the epoch', async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // delegatedStake 1
      // stake 1
      // poolMasterShare fee (1% of unclaimReward = 0.6 ETH x 1 / 100 = 0.006 ETH) + it stake share (50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH) = 0.303 ETH
      // poolMembersShare 50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1, 2], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler4.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedETHBalance = poolMasterOwnerETHBalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolMembersETHShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolMembersETHShare.toString()
      );

      const epochFeeHandlerClaimsETH = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETH.claimedByPool).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTA = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTA.claimedByPool).to.equal(true);

      //
      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );
      const expectedRTBBalance = poolMasterOwnerRTBBalance
        .add(new BN(feeAmount).mul(new BN(2)))
        .add(new BN(share).mul(new BN(2)));
      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );

      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      const expectedPoolMembersRTBShare3 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare3.toString()
      );

      const epochFeeHandlerClaimsRTB3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTB3.claimedByPool).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      const expectedPoolMembersRTBShare4 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare4.toString()
      );

      const epochFeeHandlerClaimsRTB4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTB4.claimedByPool).to.equal(true);
    });

    it('poolMaster should receive all the reward if no one has delegated its stake to him', async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // delegatedStake 0
      // stake 1
      // poolMasterShare = unclaimReward
      // poolMembersShare 0
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '0',
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '0',
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1, 2], {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler4.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedETHBalance = poolMasterOwnerETHBalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsETHReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETHReward.claimedByPool).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);
      //

      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );
      const expectedRTBBalance = poolMasterOwnerRTBBalance.add(
        new BN(unclaimReward.mul(new BN(2)))
      );

      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );

      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTBReward3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTBReward3.claimedByPool).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTBReward4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTBReward4.claimedByPool).to.equal(true);
    });

    it('claimRewardsMaster should work after someone claimed using FeeHandler#claimStakerReward', async () => {
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );

      await kyberFeeHandler2.claimStakerReward(kyberPoolMaster.address, 1);

      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);
    });

    it('should apply the fee used if it was pending', async () => {
      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [ether('3'), ether('3')], // 3ETH
        stakerStake: '1',
        delegatedStake: '1',
      });

      // new fee 2%
      await kyberPoolMaster.commitNewFee(200, {
        from: poolMasterOwner,
      });

      await kyberDao.setCurrentEpochNumber(2);
      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([2], {
        from: mike,
      });
      expectEvent(receipt, 'NewFees', {
        fromEpoch: '2',
        feeRate: '200',
      });
    });
  });

  describe('#claimRewardsMaster(uint256[],address[])', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();

      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);

      kyberFeeHandler1 = await KyberFeeHandlerWithClaimStakerReward.new(
        kyberDao.address
      );

      rewardTokenA = await TestToken.new('Reward Token A', 'RTA', 18);
      kyberFeeHandler2 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenA.address
      );

      rewardTokenB = await TestToken.new('Reward Token B', 'RTB', 18);
      kyberFeeHandler3 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberFeeHandler4 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        [
          ETH_TOKEN_ADDRESS,
          rewardTokenA.address,
          rewardTokenB.address,
          rewardTokenB.address,
        ],
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler1.send('10000000000000000000', {from: bank});
      await rewardTokenA.transfer(kyberFeeHandler2.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberFeeHandler3.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberFeeHandler4.address, mulPrecision(100));
    });

    it('should only be able to receive ETH from KyberFeeHandler1', async () => {
      await expectRevert(
        kyberPoolMaster.send('10', {from: mike}),
        'only accept ETH from a KyberFeeHandler'
      );
    });

    it('should revert when rewards is in ETH and poolMaster can not receive its share', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [1],
          [kyberFeeHandler1.address],
          {from: mike}
        ),
        'cRMaster: poolMaster share transfer failed'
      );
    });

    it('should not revert after transferring ownership to someone who can receive ETH', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH,
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [1],
          [kyberFeeHandler1.address],
          {from: mike}
        ),
        'cRMaster: poolMaster share transfer failed'
      );

      await poolMasterNoFallbackMock.transferPoolMasterOwnership(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ]([1], [kyberFeeHandler1.address], {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimReward');
    });

    it('should revert when trying to claim with no epoch', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [],
          [kyberFeeHandler1.address],
          {from: mike}
        ),
        'cRMaster: _epochGroup required'
      );
    });

    it('should revert when trying to claim with repeated epochs', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [1, 1],
          [kyberFeeHandler1.address],
          {from: mike}
        ),
        'cRMaster: order and uniqueness required'
      );
    });

    it('should revert when trying to claim with unordered epochs', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [2, 1],
          [kyberFeeHandler1.address],
          {from: mike}
        ),
        'cRMaster: order and uniqueness required'
      );
    });

    it('should revert when trying to claim with no feeHandlers', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ['3000000000000000000'], // 3ETH
      });

      await expectRevert(
        kyberPoolMaster.methods['claimRewardsMaster(uint256[],address[])'](
          [1],
          [],
          {from: mike}
        ),
        'cRMaster: _feeHandlerGroup required'
      );
    });

    it("should only transfer fee to poolMaster if it hasn't stake for the epoch, claiming on a given feeHandler", async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // poolMasterShare only 1% of unclaimReward = 0.6 ETH x 1 / 100 = 0.006 ETH
      // poolMembersShare unclaimReward - poolMasterShare = 0.6 ETH - 0.006 ETH
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ]([1, 2], [kyberFeeHandler1.address], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const expectedETHBalance = poolMasterOwnerETHBalance.add(
        new BN(feeAmount)
      );
      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        poolMasterOwnerRTABalance.toString()
      );

      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        poolMasterOwnerRTBBalance.toString()
      );

      //

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolETHMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolETHMembersShare.toString()
      );

      const epochFeeHandlerClaimsETH = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETH.claimedByPool).to.equal(true);

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolRTAMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTA = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTA.claimedByPool).to.equal(false);

      //
      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      const expectedPoolRTBMembersShare3 = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      const expectedPoolRTBMembersShare4 = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal('0');
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTB3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTB3.claimedByPool).to.equal(false);

      const epochFeeHandlerClaimsRTB4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTB4.claimedByPool).to.equal(false);
    });

    it('should transfer fee + share to poolMaster if it has stake for the epoch, claiming on a given feeHandler', async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // delegatedStake 1
      // stake 1
      // poolMasterShare fee (1% of unclaimReward = 0.6 ETH x 1 / 100 = 0.006 ETH) + it stake share (50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH) = 0.303 ETH
      // poolMembersShare 50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ]([1, 2], [kyberFeeHandler1.address], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedETHBalance = poolMasterOwnerETHBalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolMembersETHShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolMembersETHShare.toString()
      );

      const epochFeeHandlerClaimsETH = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETH.claimedByPool).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        poolMasterOwnerRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTA = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTA.claimedByPool).to.equal(false);

      //
      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );
      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal('0');

      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTB3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTB3.claimedByPool).to.equal(false);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTB4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTB4.claimedByPool).to.equal(false);
    });

    it('poolMaster should receive all the reward if no one has delegated its stake to him, claiming on a given feeHandler', async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // delegatedStake 0
      // stake 1
      // poolMasterShare = unclaimReward
      // poolMembersShare 0
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '0',
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '0',
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ](
        [1, 2],
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
        ],
        {
          from: mike,
        }
      );
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedETHBalance = poolMasterOwnerETHBalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsETHReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETHReward.claimedByPool).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);
      //

      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );
      const expectedRTBBalance = poolMasterOwnerRTBBalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );

      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTBReward3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTBReward3.claimedByPool).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal('0');

      const epochFeeHandlerClaimsRTBReward4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTBReward4.claimedByPool).to.equal(false);
    });

    it('claimRewardsMaster should work after someone claimed using FeeHandler#claimStakerReward', async () => {
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );

      await kyberFeeHandler2.claimStakerReward(kyberPoolMaster.address, 1);

      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ]([1], [kyberFeeHandler2.address], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);
    });

    it('should transfer fee + share to poolMaster if it has stake for the epoch, for some given feeHandlers', async () => {
      // fee 1%
      // rewardPerEpoch 3ETH
      // stakerRewardPercentage 20%
      // unclaimReward = 3 ETH x 20 / 100 = 0.6 ETH
      // delegatedStake 1
      // stake 1
      // poolMasterShare fee (1% of unclaimReward = 0.6 ETH x 1 / 100 = 0.006 ETH) + it stake share (50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH) = 0.303 ETH
      // poolMembersShare 50% of unclaimReward - fee = (0.6 ETH - 0.006 ETH) / 2 = 0.297 ETH
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler3, kyberFeeHandler4],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch, rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerETHBalance = await balance.current(poolMasterOwner);
      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const poolMasterOwnerRTBBalance = await rewardTokenB.balanceOf(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ](
        [1, 2],
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        {
          from: mike,
        }
      );

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
        feeHandler: kyberFeeHandler4.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerETHBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedETHBalance = poolMasterOwnerETHBalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const poolMembersETHShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolMembersETHShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolMembersETHShare.toString()
      );

      const epochFeeHandlerClaimsETH = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaimsETH.claimedByPool).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTA = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTA.claimedByPool).to.equal(true);

      //
      const poolMasterOwnerRTBBalanceAfter = await rewardTokenB.balanceOf(
        poolMasterOwner
      );
      const expectedRTBBalance = poolMasterOwnerRTBBalance
        .add(new BN(feeAmount).mul(new BN(2)))
        .add(new BN(share).mul(new BN(2)));
      expect(poolMasterOwnerRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );

      const poolMembersRTBShare3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      const expectedPoolMembersRTBShare3 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare3.toString()
      );

      const epochFeeHandlerClaimsRTB3 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address
      );
      expect(epochFeeHandlerClaimsRTB3.claimedByPool).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      const expectedPoolMembersRTBShare4 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare4.toString()
      );

      const epochFeeHandlerClaimsRTB4 = await kyberPoolMaster.epochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address
      );
      expect(epochFeeHandlerClaimsRTB4.claimedByPool).to.equal(true);
    });

    it('should apply the fee used if it was pending', async () => {
      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler1, kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [ether('3'), ether('3')], // 3ETH
        stakerStake: '1',
        delegatedStake: '1',
      });

      // new fee 2%
      await kyberPoolMaster.commitNewFee(200, {
        from: poolMasterOwner,
      });

      await kyberDao.setCurrentEpochNumber(2);
      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[],address[])'
      ]([2], [kyberFeeHandler1.address], {
        from: mike,
      });
      expectEvent(receipt, 'NewFees', {
        fromEpoch: '2',
        feeRate: '200',
      });
    });
  });

  describe('#getUnclaimedRewardsMember', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);
      kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new(
        kyberDao.address
      );
      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [kyberFeeHandler.address],
        [ETH_TOKEN_ADDRESS],
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler.send('10000000000000000000', {from: bank});
    });

    it('should return 0 if PoolMaster has not called claimRewardMaster', async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );

      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has previously claimed reward for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setClaimedDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(true);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).not.to.equal(kyberPoolMaster.address);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed poolMember reward amount', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler.address,
        10,
        5
      );

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('2');
    });

    it('should return all epochs with pending to claim rewards', async () => {
      await kyberDao.setCurrentEpochNumber(7);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        3,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        4,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        5,
        kyberFeeHandler.address,
        1,
        1
      );

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(3, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(5, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        3,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        5,
        kyberFeeHandler.address,
        10,
        5
      );

      const unclaimedEpochsFeeHandlers = await kyberPoolMaster.getAllUnclaimedRewardsDataMember(
        mike
      );

      expect(unclaimedEpochsFeeHandlers.length).to.equal(3);

      expect(unclaimedEpochsFeeHandlers[0].epoch).to.equal('1');
      expect(unclaimedEpochsFeeHandlers[0].feeHandler).to.equal(
        kyberFeeHandler.address
      );
      expect(unclaimedEpochsFeeHandlers[0].rewards.toString()).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[0].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      expect(unclaimedEpochsFeeHandlers[1].epoch).to.equal('3');
      expect(unclaimedEpochsFeeHandlers[1].feeHandler).to.equal(
        kyberFeeHandler.address
      );
      expect(unclaimedEpochsFeeHandlers[1].rewards.toString()).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[1].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      expect(unclaimedEpochsFeeHandlers[2].epoch).to.equal('5');
      expect(unclaimedEpochsFeeHandlers[2].feeHandler).to.equal(
        kyberFeeHandler.address
      );
      expect(unclaimedEpochsFeeHandlers[2].rewards.toString()).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[2].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );
    });

    it('should return all epochs with pending to claim rewards with custom from and end epochs', async () => {
      await kyberDao.setCurrentEpochNumber(7);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        3,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        4,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        5,
        kyberFeeHandler.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        6,
        kyberFeeHandler.address,
        1,
        1
      );

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(3, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(5, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(6, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        3,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        5,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        6,
        kyberFeeHandler.address,
        10,
        5
      );

      const unclaimedEpochsFeeHandlers = await kyberPoolMaster.methods[
        'getAllUnclaimedRewardsDataMember(address,uint256,uint256)'
      ](mike, 3, 5);
      // expect(JSON.stringify(unclaimedEpochs)).to.equal('["3","5"]');
      expect(unclaimedEpochsFeeHandlers.length).to.equal(2);

      expect(unclaimedEpochsFeeHandlers[0].epoch).to.equal('3');
      expect(unclaimedEpochsFeeHandlers[0].feeHandler).to.equal(
        kyberFeeHandler.address
      );
      expect(unclaimedEpochsFeeHandlers[0].rewards.toString()).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[0].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );

      expect(unclaimedEpochsFeeHandlers[1].epoch).to.equal('5');
      expect(unclaimedEpochsFeeHandlers[1].feeHandler).to.equal(
        kyberFeeHandler.address
      );
      expect(unclaimedEpochsFeeHandlers[1].rewards.toString()).to.equal('2');
      expect(unclaimedEpochsFeeHandlers[1].rewardToken).to.equal(
        ETH_TOKEN_ADDRESS
      );
    });
  });

  describe('#claimRewardsMember(address,uint256[])', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];
      paula = accounts[5];
      cris = accounts[6];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);

      kyberFeeHandler1 = await KyberFeeHandlerWithClaimStakerReward.new(
        kyberDao.address
      );

      rewardTokenA = await TestToken.new('Reward Token A', 'RTA', 18);
      kyberFeeHandler2 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenA.address
      );

      rewardTokenB = await TestToken.new('Reward Token B', 'RTB', 18);
      kyberFeeHandler3 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberFeeHandler4 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );
      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        [
          ETH_TOKEN_ADDRESS,
          rewardTokenA.address,
          rewardTokenB.address,
          rewardTokenB.address,
        ],
        {from: poolMasterOwner, value: '1000000000000000000'}
      );

      await rewardTokenA.transfer(kyberPoolMaster.address, mulPrecision(100));
      await rewardTokenA.transfer(kyberFeeHandler2.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberPoolMaster.address, mulPrecision(100));
    });

    it('should transfer nothing if poolMaster has not claimed the epoch rewards yet', async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if poolMember has already claimed its share for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      await kyberPoolMaster.setClaimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      const claimedDelegateReward = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedDelegateReward).to.equal(true);

      await kyberPoolMaster.setClaimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(true);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if unclaimed reward member is 0 due to the poolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('0');

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if unclaimed reward member is 0 due to the poolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).not.to.equal(kyberPoolMaster.address);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '2',
      });

      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance
        .sub(gasUsed.mul(gasPrice))
        .add(new BN('2'));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share after someone claimed using FeeHandler#claimStakerReward', async () => {
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);

      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );

      await kyberFeeHandler2.claimStakerReward(kyberPoolMaster.address, 1);

      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler2.address
      );
      expect(claimedRewardMember).to.equal(false);

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);

      const mikeBalance = await rewardTokenA.balanceOf(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {from: mike});
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler2.address,
        rewardToken: rewardTokenA.address,
        reward: share,
      });

      const mikeBalanceAfter = await rewardTokenA.balanceOf(mike);
      const expectedBalance = mikeBalance.add(share);
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share from multiple feeHandlers claiming in multiple epochs', async () => {
      //epoch 1 - fh1 - fh2
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address,
        1,
        1
      );

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address,
        10,
        5
      );

      // epoch 2 - fh3 - fh4
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address,
        1,
        1
      );

      await kyberStaking.setStakerData(2, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address,
        10,
        5
      );

      const mikeETHBalance = await balance.current(mike);
      const mikeRTABalance = await rewardTokenA.balanceOf(mike);
      const mikeRTBBalance = await rewardTokenB.balanceOf(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1, 2], {
        from: mike,
      });
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler2.address,
        rewardToken: rewardTokenA.address,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '2',
        poolMember: mike,
        feeHandler: kyberFeeHandler3.address,
        rewardToken: rewardTokenB.address,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '2',
        poolMember: mike,
        feeHandler: kyberFeeHandler4.address,
        rewardToken: rewardTokenB.address,
        reward: '2',
      });

      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeETHBalanceAfter = await balance.current(mike);
      const expectedETHBalance = mikeETHBalance
        .sub(gasUsed.mul(gasPrice))
        .add(new BN('2'));
      expect(mikeETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const mikeRTABalanceAfter = await rewardTokenA.balanceOf(mike);
      const expectedRTABalance = mikeRTABalance.add(new BN('2'));
      expect(mikeRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const mikeRTBBalanceAfter = await rewardTokenB.balanceOf(mike);
      const expectedRTBBalance = mikeRTBBalance.add(new BN('4'));
      expect(mikeRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );
    });

    it('should distribute pool members share and keep remainings from rounding', async () => {
      // totalStaked = 100
      // total reward to share among members = 9999
      // mike staked 35, its share is 35 * 9999 / 100 = 3499
      // cris staked 5, its share is 5 * 9999 / 100 = 499
      // paula staked 60, its share is 60 * 9999 / 100 = 5999
      // total distributed = 3499 + 499 + 5999 = 9997
      // remainings = 3
      // values are in wei

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      await kyberStaking.setStakerData(1, mike, 35, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(1, cris, 5, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(
        1,
        paula,
        60,
        0,
        kyberPoolMaster.address
      );

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        9999,
        100
      );

      const mikeBalance = await balance.current(mike);
      const crisBalance = await balance.current(cris);
      const paulaBalance = await balance.current(paula);
      const poolBalance = await balance.current(kyberPoolMaster.address);

      const mikeTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](mike, [1], {
        from: mike,
      });
      expectEvent(mikeTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '3499',
      });

      const crisTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](cris, [1], {
        from: cris,
      });
      expectEvent(crisTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: cris,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '499',
      });

      const paulaTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[])'
      ](paula, [1], {
        from: paula,
      });
      expectEvent(paulaTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: paula,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '5999',
      });

      const mikeBalanceAfter = await balance.current(mike);
      const crisBalanceAfter = await balance.current(cris);
      const paulaBalanceAfter = await balance.current(paula);
      const poolBalanceAfter = await balance.current(kyberPoolMaster.address);

      const txMike = await web3.eth.getTransaction(mikeTxInfo.tx);
      const gasUsedMike = new BN(mikeTxInfo.receipt.gasUsed);
      const gasPriceMike = new BN(txMike.gasPrice);

      const txCris = await web3.eth.getTransaction(crisTxInfo.tx);
      const gasUsedCris = new BN(crisTxInfo.receipt.gasUsed);
      const gasPriceCris = new BN(txCris.gasPrice);

      const txPaula = await web3.eth.getTransaction(paulaTxInfo.tx);
      const gasUsedPaula = new BN(paulaTxInfo.receipt.gasUsed);
      const gasPricePaula = new BN(txPaula.gasPrice);

      const expectedBalanceMike = mikeBalance
        .sub(gasUsedMike.mul(gasPriceMike))
        .add(new BN('3499'));
      expect(mikeBalanceAfter.toString()).to.equal(
        expectedBalanceMike.toString()
      );

      const expectedBalanceCris = crisBalance
        .sub(gasUsedCris.mul(gasPriceCris))
        .add(new BN('499'));
      expect(crisBalanceAfter.toString()).to.equal(
        expectedBalanceCris.toString()
      );

      const expectedBalancePaula = paulaBalance
        .sub(gasUsedPaula.mul(gasPricePaula))
        .add(new BN('5999'));
      expect(paulaBalanceAfter.toString()).to.equal(
        expectedBalancePaula.toString()
      );

      const expectedBalancePool = poolBalance
        .sub(new BN('3499'))
        .sub(new BN('499'))
        .sub(new BN('5999'));
      expect(poolBalanceAfter.toString()).to.equal(
        expectedBalancePool.toString()
      );
    });
  });
  describe('#claimRewardsMember(address,uint256[],address[])', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];
      paula = accounts[5];
      cris = accounts[6];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
      kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);

      kyberFeeHandler1 = await KyberFeeHandlerWithClaimStakerReward.new(
        kyberDao.address
      );

      rewardTokenA = await TestToken.new('Reward Token A', 'RTA', 18);
      kyberFeeHandler2 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenA.address
      );

      rewardTokenB = await TestToken.new('Reward Token B', 'RTB', 18);
      kyberFeeHandler3 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );

      kyberFeeHandler4 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardTokenB.address
      );
      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        [
          ETH_TOKEN_ADDRESS,
          rewardTokenA.address,
          rewardTokenB.address,
          rewardTokenB.address,
        ],
        {from: poolMasterOwner, value: '1000000000000000000'}
      );

      await rewardTokenA.transfer(kyberPoolMaster.address, mulPrecision(100));
      await rewardTokenA.transfer(kyberFeeHandler2.address, mulPrecision(100));
      await rewardTokenB.transfer(kyberPoolMaster.address, mulPrecision(100));
    });

    it('should revert when trying to claim with no epochs', async () => {
      await expectRevert(
        kyberPoolMaster.methods[
          'claimRewardsMember(address,uint256[],address[])'
        ](mike, [], [kyberFeeHandler1.address], {from: mike}),
        'cRMember: _epochGroup required'
      );
    });

    it('should revert when trying to claim with no feeHandlers', async () => {
      await expectRevert(
        kyberPoolMaster.methods[
          'claimRewardsMember(address,uint256[],address[])'
        ](mike, [1], [], {from: mike}),
        'cRMember: _feeHandlerGroup required'
      );
    });

    it('should transfer nothing if poolMaster has not claimed the epoch rewards yet', async () => {
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if poolMember has already claimed its share for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      await kyberPoolMaster.setClaimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      const claimedDelegateReward = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedDelegateReward).to.equal(true);

      await kyberPoolMaster.setClaimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(true);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if unclaimed reward member is 0 due to the poolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('0');

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('should transfer nothing if unclaimed reward member is 0 due to the poolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).not.to.equal(kyberPoolMaster.address);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {from: mike});
      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance.sub(gasUsed.mul(gasPrice));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share', async () => {
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler1.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {from: mike});
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '2',
      });

      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeBalanceAfter = await balance.current(mike);
      const expectedBalance = mikeBalance
        .sub(gasUsed.mul(gasPrice))
        .add(new BN('2'));
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share after someone claimed using FeeHandler#claimStakerReward', async () => {
      const rewardsPerEpoch = ether('3');
      const unclaimReward = ether('0.6');
      const feeAmount = ether('0.006');
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler2],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [rewardsPerEpoch], // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);

      const poolMasterOwnerRTABalance = await rewardTokenA.balanceOf(
        poolMasterOwner
      );

      await kyberFeeHandler2.claimStakerReward(kyberPoolMaster.address, 1);

      const epochFeeHandlerClaims = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaims.claimedByPool).to.equal(false);

      const claimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike,
        kyberFeeHandler2.address
      );
      expect(claimedRewardMember).to.equal(false);

      const receipt = await kyberPoolMaster.methods[
        'claimRewardsMaster(uint256[])'
      ]([1], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const epochFeeHandlerClaimsRTAReward = await kyberPoolMaster.epochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address
      );
      expect(epochFeeHandlerClaimsRTAReward.claimedByPool).to.equal(true);

      const mikeBalance = await rewardTokenA.balanceOf(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler2.address], {from: mike});
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler2.address,
        rewardToken: rewardTokenA.address,
        reward: share,
      });

      const mikeBalanceAfter = await rewardTokenA.balanceOf(mike);
      const expectedBalance = mikeBalance.add(share);
      expect(mikeBalanceAfter.toString()).to.equal(expectedBalance.toString());
    });

    it('poolMember should receive its share from multiple feeHandlers claiming in multiple epochs', async () => {
      //epoch 1 - fh1 - fh2
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address,
        1,
        1
      );

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler2.address,
        10,
        5
      );

      // epoch 2 - fh3 - fh4
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address,
        1,
        1
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address,
        1,
        1
      );

      await kyberStaking.setStakerData(2, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler3.address,
        10,
        5
      );
      await kyberPoolMaster.setEpochFeeHandlerClaims(
        2,
        kyberFeeHandler4.address,
        10,
        5
      );

      const mikeETHBalance = await balance.current(mike);
      const mikeRTABalance = await rewardTokenA.balanceOf(mike);
      const mikeRTBBalance = await rewardTokenB.balanceOf(mike);

      const txInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](
        mike,
        [1, 2],
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        {
          from: mike,
        }
      );
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler2.address,
        rewardToken: rewardTokenA.address,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '2',
        poolMember: mike,
        feeHandler: kyberFeeHandler3.address,
        rewardToken: rewardTokenB.address,
        reward: '2',
      });

      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '2',
        poolMember: mike,
        feeHandler: kyberFeeHandler4.address,
        rewardToken: rewardTokenB.address,
        reward: '2',
      });

      const tx = await web3.eth.getTransaction(txInfo.tx);
      const gasUsed = new BN(txInfo.receipt.gasUsed);
      const gasPrice = new BN(tx.gasPrice);

      const mikeETHBalanceAfter = await balance.current(mike);
      const expectedETHBalance = mikeETHBalance
        .sub(gasUsed.mul(gasPrice))
        .add(new BN('2'));
      expect(mikeETHBalanceAfter.toString()).to.equal(
        expectedETHBalance.toString()
      );

      const mikeRTABalanceAfter = await rewardTokenA.balanceOf(mike);
      const expectedRTABalance = mikeRTABalance.add(new BN('2'));
      expect(mikeRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const mikeRTBBalanceAfter = await rewardTokenB.balanceOf(mike);
      const expectedRTBBalance = mikeRTBBalance.add(new BN('4'));
      expect(mikeRTBBalanceAfter.toString()).to.equal(
        expectedRTBBalance.toString()
      );
    });

    it('should distribute pool members share and keep remainings from rounding', async () => {
      // totalStaked = 100
      // total reward to share among members = 9999
      // mike staked 35, its share is 35 * 9999 / 100 = 3499
      // cris staked 5, its share is 5 * 9999 / 100 = 499
      // paula staked 60, its share is 60 * 9999 / 100 = 5999
      // total distributed = 3499 + 499 + 5999 = 9997
      // remainings = 3
      // values are in wei

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        1,
        1
      );
      await kyberStaking.setStakerData(1, mike, 35, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(1, cris, 5, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(
        1,
        paula,
        60,
        0,
        kyberPoolMaster.address
      );

      await kyberPoolMaster.setEpochFeeHandlerClaims(
        1,
        kyberFeeHandler1.address,
        9999,
        100
      );

      const mikeBalance = await balance.current(mike);
      const crisBalance = await balance.current(cris);
      const paulaBalance = await balance.current(paula);
      const poolBalance = await balance.current(kyberPoolMaster.address);

      const mikeTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](mike, [1], [kyberFeeHandler1.address], {
        from: mike,
      });
      expectEvent(mikeTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '3499',
      });

      const crisTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](cris, [1], [kyberFeeHandler1.address], {
        from: cris,
      });
      expectEvent(crisTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: cris,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '499',
      });

      const paulaTxInfo = await kyberPoolMaster.methods[
        'claimRewardsMember(address,uint256[],address[])'
      ](paula, [1], [kyberFeeHandler1.address], {
        from: paula,
      });
      expectEvent(paulaTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: paula,
        feeHandler: kyberFeeHandler1.address,
        rewardToken: ETH_TOKEN_ADDRESS,
        reward: '5999',
      });

      const mikeBalanceAfter = await balance.current(mike);
      const crisBalanceAfter = await balance.current(cris);
      const paulaBalanceAfter = await balance.current(paula);
      const poolBalanceAfter = await balance.current(kyberPoolMaster.address);

      const txMike = await web3.eth.getTransaction(mikeTxInfo.tx);
      const gasUsedMike = new BN(mikeTxInfo.receipt.gasUsed);
      const gasPriceMike = new BN(txMike.gasPrice);

      const txCris = await web3.eth.getTransaction(crisTxInfo.tx);
      const gasUsedCris = new BN(crisTxInfo.receipt.gasUsed);
      const gasPriceCris = new BN(txCris.gasPrice);

      const txPaula = await web3.eth.getTransaction(paulaTxInfo.tx);
      const gasUsedPaula = new BN(paulaTxInfo.receipt.gasUsed);
      const gasPricePaula = new BN(txPaula.gasPrice);

      const expectedBalanceMike = mikeBalance
        .sub(gasUsedMike.mul(gasPriceMike))
        .add(new BN('3499'));
      expect(mikeBalanceAfter.toString()).to.equal(
        expectedBalanceMike.toString()
      );

      const expectedBalanceCris = crisBalance
        .sub(gasUsedCris.mul(gasPriceCris))
        .add(new BN('499'));
      expect(crisBalanceAfter.toString()).to.equal(
        expectedBalanceCris.toString()
      );

      const expectedBalancePaula = paulaBalance
        .sub(gasUsedPaula.mul(gasPricePaula))
        .add(new BN('5999'));
      expect(paulaBalanceAfter.toString()).to.equal(
        expectedBalancePaula.toString()
      );

      const expectedBalancePool = poolBalance
        .sub(new BN('3499'))
        .sub(new BN('499'))
        .sub(new BN('5999'));
      expect(poolBalanceAfter.toString()).to.equal(
        expectedBalancePool.toString()
      );
    });
  });
});

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
