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

const {NO_ZERO_ADDRESS, ZERO_ADDRESS, precisionUnits} = require('./helper.js');

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

  describe('#claimRewardsMasterEpochs', () => {
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
        kyberFeeHandler1.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [
          kyberFeeHandler1.address,
          kyberFeeHandler2.address,
          kyberFeeHandler3.address,
          kyberFeeHandler4.address,
        ],
        [
          ZERO_ADDRESS,
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
        kyberPoolMaster.claimRewardsMasterEpochs([1], {from: mike}),
        'cRMaste: poolMaster share transfer failed'
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
        kyberPoolMaster.claimRewardsMasterEpochs([1], {from: mike}),
        'cRMaste: poolMaster share transfer failed'
      );

      await poolMasterNoFallbackMock.transferPoolMasterOwnership(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.claimRewardsMasterEpochs([1], {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimRewardByFeeHandler'); // TODO - RENAME event
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

      const receipt = await kyberPoolMaster.claimRewardsMasterEpochs([1, 2], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      const poolMembersETHShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolETHMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolETHMembersShare.toString()
      );

      const claimedPoolETHReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler1.address
      );
      expect(claimedPoolETHReward).to.equal(true);

      const poolMembersRTAShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolRTAMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolRTAMembersShare.toString()
      );

      const claimedPoolRTAReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler2.address
      );
      expect(claimedPoolRTAReward).to.equal(true);

      //
      const poolMembersRTBShare3 = await kyberPoolMaster.memberRewardsByFeeHandler(
        2,
        kyberFeeHandler3.address
      );
      const poolMembersRTBShare4 = await kyberPoolMaster.memberRewardsByFeeHandler(
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

      const claimedPoolRTBReward3 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler3.address
      );
      expect(claimedPoolRTBReward3).to.equal(true);

      const claimedPoolRTBReward4 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler4.address
      );
      expect(claimedPoolRTBReward4).to.equal(true);
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

      const receipt = await kyberPoolMaster.claimRewardsMasterEpochs([1, 2], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '1',
        feeHandler: kyberFeeHandler1.address,
        poolMaster: poolMasterOwner,
        rewardToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '1',
        feeHandler: kyberFeeHandler2.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenA.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
        epoch: '2',
        feeHandler: kyberFeeHandler3.address,
        poolMaster: poolMasterOwner,
        rewardToken: rewardTokenB.address,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      const poolMembersETHShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler1.address
      );
      const expectedPoolMembersETHShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersETHShare.totalRewards.toString()).to.equal(
        expectedPoolMembersETHShare.toString()
      );

      const claimedPoolETHReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler1.address
      );
      expect(claimedPoolETHReward).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler2.address
      );
      const expectedPoolMembersRTAShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal(
        expectedPoolMembersRTAShare.toString()
      );

      const claimedPoolRTAReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler2.address
      );
      expect(claimedPoolRTAReward).to.equal(true);

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

      const poolMembersRTBShare3 = await kyberPoolMaster.memberRewardsByFeeHandler(
        2,
        kyberFeeHandler3.address
      );
      const expectedPoolMembersRTBShare3 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare3.toString()
      );

      const claimedPoolRTBReward3 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler3.address
      );
      expect(claimedPoolRTBReward3).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.memberRewardsByFeeHandler(
        2,
        kyberFeeHandler4.address
      );
      const expectedPoolMembersRTBShare4 = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal(
        expectedPoolMembersRTBShare4.toString()
      );

      const claimedPoolRTBReward4 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler4.address
      );
      expect(claimedPoolRTBReward4).to.equal(true);
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

      const receipt = await kyberPoolMaster.claimRewardsMasterEpochs([1, 2], {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      expectEvent(receipt, 'MasterClaimRewardByFeeHandler', {
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

      const poolMembersETHShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler1.address
      );
      expect(poolMembersETHShare.totalRewards.toString()).to.equal('0');

      const claimedPoolETHReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler1.address
      );
      expect(claimedPoolETHReward).to.equal(true);

      const poolMasterOwnerRTABalanceAfter = await rewardTokenA.balanceOf(
        poolMasterOwner
      );
      const expectedRTABalance = poolMasterOwnerRTABalance.add(
        new BN(unclaimReward)
      );

      expect(poolMasterOwnerRTABalanceAfter.toString()).to.equal(
        expectedRTABalance.toString()
      );

      const poolMembersRTAShare = await kyberPoolMaster.memberRewardsByFeeHandler(
        1,
        kyberFeeHandler2.address
      );
      expect(poolMembersRTAShare.totalRewards.toString()).to.equal('0');

      const claimedPoolRTAReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler2.address
      );
      expect(claimedPoolRTAReward).to.equal(true);
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

      const poolMembersRTBShare3 = await kyberPoolMaster.memberRewardsByFeeHandler(
        2,
        kyberFeeHandler3.address
      );
      expect(poolMembersRTBShare3.totalRewards.toString()).to.equal('0');

      const claimedPoolRTBReward3 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler3.address
      );
      expect(claimedPoolRTBReward3).to.equal(true);
      //
      const poolMembersRTBShare4 = await kyberPoolMaster.memberRewardsByFeeHandler(
        2,
        kyberFeeHandler4.address
      );
      expect(poolMembersRTBShare4.totalRewards.toString()).to.equal('0');

      const claimedPoolRTBReward4 = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler4.address
      );
      expect(claimedPoolRTBReward4).to.equal(true);
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
      const receipt = await kyberPoolMaster.claimRewardsMasterEpochs([2], {
        from: mike,
      });
      expectEvent(receipt, 'NewFees', {
        fromEpoch: '2',
        feeRate: '200',
      });
    });
  });

  describe('#getEpochFeeHandlerUnclaimedRewardsMember', () => {
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
        kyberFeeHandler.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        [kyberFeeHandler.address],
        [ZERO_ADDRESS],
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler.send('10000000000000000000', {from: bank});
    });

    it('should return 0 if PoolMaster has not called claimRewardMaster', async () => {
      const claimedReward = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      expect(claimedReward).to.equal(false);

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );

      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has previously claimed reward for the epoch', async () => {
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      const claimedRewardMaster = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      expect(claimedRewardMaster).to.equal(true);

      await kyberPoolMaster.setClaimedEpochFeeHandlerDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      const claimedRewardMember = await kyberPoolMaster.claimedEpochFeeHandlerDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(true);

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      const claimedRewardMaster = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      expect(claimedRewardMaster).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedEpochFeeHandlerDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      const claimedRewardMaster = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      expect(claimedRewardMaster).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedEpochFeeHandlerDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).not.to.equal(kyberPoolMaster.address);

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed poolMember reward amount', async () => {
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      const claimedRewardMaster = await kyberPoolMaster.claimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      expect(claimedRewardMaster).to.equal(true);

      const claimedRewardMember = await kyberPoolMaster.claimedEpochFeeHandlerDelegateReward(
        1,
        mike,
        kyberFeeHandler.address
      );
      expect(claimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerRawData = await kyberStaking.getStakerRawData(mike, 1);
      expect(stakerRawData[0].toString()).to.equal('1');
      expect(stakerRawData[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setMemberRewardsByFeeHandler(
        1,
        kyberFeeHandler.address,
        10,
        5
      );

      const unclaimed = await kyberPoolMaster.getEpochFeeHandlerUnclaimedRewardsMember(
        mike,
        1,
        kyberFeeHandler.address
      );
      expect(unclaimed.toString()).to.equal('2');
    });

    it('should return all epochs with pending to claim rewards', async () => {
      await kyberDao.setCurrentEpochNumber(7);

      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        1,
        kyberFeeHandler.address
      );
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        2,
        kyberFeeHandler.address
      );
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        3,
        kyberFeeHandler.address
      );
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        4,
        kyberFeeHandler.address
      );
      await kyberPoolMaster.setClaimedEpochFeeHandlerPoolReward(
        5,
        kyberFeeHandler.address
      );

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(3, mike, 1, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(5, mike, 1, 0, kyberPoolMaster.address);

      await kyberPoolMaster.setMemberRewardsByFeeHandler(
        1,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setMemberRewardsByFeeHandler(
        3,
        kyberFeeHandler.address,
        10,
        5
      );
      await kyberPoolMaster.setMemberRewardsByFeeHandler(
        5,
        kyberFeeHandler.address,
        10,
        5
      );

      const unclaimedEpochs = await kyberPoolMaster.getAllEpochWithUnclaimedRewardsMember(
        mike
      );
      expect(JSON.stringify(unclaimedEpochs)).to.equal('["1","3","5"]');
    });
  });
});

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
