const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');
const KyberDAOWithRewardPercentageSetter = artifacts.require(
  'KyberDAOWithRewardPercentageSetter'
);
const KyberDAOClaimReward = artifacts.require('KyberDAOClaimReward');
const KyberFeeHandlerWithRewardPerEposhSetter = artifacts.require(
  'KyberFeeHandlerWithRewardPerEposhSetter'
);
const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const KyberStakingWithgetStakerDataForPastEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForPastEpoch'
);

const PoolMasterNoFallbackMock = artifacts.require('PoolMasterNoFallbackMock');

const {expect} = require('chai');
const {
  expectEvent,
  expectRevert,
  balance,
  ether,
} = require('@openzeppelin/test-helpers');

const Reverter = require('./utils/reverter');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

const BN = web3.utils.BN;

let kyberPoolMaster;
let kyberDAO;
let kyberFeeHandler;
let daoSetter;
let kncToken;
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

  const prepareEpochForClaim = async ({
    epoch,
    staker,
    stakerRewardPercentage,
    rewardsPerEpoch,
    stakerStake = '0',
    delegatedStake = '1',
  }) => {
    await kyberDAO.setStakerRewardPercentage(
      staker,
      epoch,
      stakerRewardPercentage
    );
    await kyberFeeHandler.setRewardsPerEpoch(epoch, rewardsPerEpoch);
    await kyberStaking.setStakerData(
      epoch,
      staker,
      stakerStake,
      delegatedStake,
      staker
    );
  };

  describe('#claimRewardsMaster', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      kyberStaking = await KyberStakingWithgetStakerDataForPastEpoch.new();
      kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new();
      kyberDAO = await KyberDAOClaimReward.new(kyberFeeHandler.address);
      kyberPoolMaster = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        kyberDAO.address,
        kyberStaking.address,
        kyberFeeHandler.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler.send('10000000000000000000', {from: bank});
    });

    it('should only be able to receive ETH from KyberFeeHandler', async () => {
      await expectRevert(
        kyberPoolMaster.send('10', {from: mike}),
        'only accept ETH from Kyber'
      );
    });

    it('should revert if epoch rewards has been already claimed', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedReward).to.equal(true);

      await expectRevert(
        kyberPoolMaster.claimRewardsMaster(1, {from: mike}),
        'cRMaster: rewards already claimed'
      );
    });

    it('should revert if no unclaimed reward for the epoch', async () => {
      // this makes getUnclaimedRewards to return 0
      await kyberDAO.setStakerRewardPercentage(kyberPoolMaster.address, 1, 0);
      await expectRevert(
        kyberPoolMaster.claimRewardsMaster(1, {from: mike}),
        'cRMaster: no rewards to claim'
      );
    });

    it('should revert if poolMaster can receive its share', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: '3000000000000000000', // 3ETH
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.claimRewardsMaster(1, {from: mike}),
        'cRMaste: poolMaster share transfer failed'
      );
    });

    it('should not revert after transfering ownership to someone who can receive ETH', async () => {
      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: '3000000000000000000', // 3ETH,
      });

      await kyberPoolMaster.transferOwnership(
        poolMasterNoFallbackMock.address,
        {
          from: poolMasterOwner,
        }
      );

      await expectRevert(
        kyberPoolMaster.claimRewardsMaster(1, {from: mike}),
        'cRMaste: poolMaster share transfer failed'
      );

      await poolMasterNoFallbackMock.transferPoolMasterOwnership(
        poolMasterOwner
      );

      const receipt = await kyberPoolMaster.claimRewardsMaster(1, {from: mike});
      expectEvent(receipt, 'MasterClaimReward');
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
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: rewardsPerEpoch, // 3ETH,
      });

      const poolMasterOwnerBalance = await balance.current(poolMasterOwner);

      const receipt = await kyberPoolMaster.claimRewardsMaster(1, {from: mike});
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        poolMaster: poolMasterOwner,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: '0',
      });

      const poolMasterOwnerBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedBalance = poolMasterOwnerBalance.add(new BN(feeAmount));
      expect(poolMasterOwnerBalanceAfter.toString()).to.equal(
        expectedBalance.toString()
      );

      const poolMembersShare = await kyberPoolMaster.memberRewards(1);
      const expectedPoolMembersShare = new BN(unclaimReward).sub(
        new BN(feeAmount)
      );
      expect(poolMembersShare.totalRewards.toString()).to.equal(
        expectedPoolMembersShare.toString()
      );

      const claimedPoolReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(claimedPoolReward).to.equal(true);
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
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: rewardsPerEpoch, // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      const poolMasterOwnerBalance = await balance.current(poolMasterOwner);

      const receipt = await kyberPoolMaster.claimRewardsMaster(1, {from: mike});
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        poolMaster: poolMasterOwner,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: share,
      });

      const poolMasterOwnerBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedBalance = poolMasterOwnerBalance
        .add(new BN(feeAmount))
        .add(new BN(share));
      expect(poolMasterOwnerBalanceAfter.toString()).to.equal(
        expectedBalance.toString()
      );

      const poolMembersShare = await kyberPoolMaster.memberRewards(1);
      const expectedPoolMembersShare = new BN(unclaimReward)
        .sub(new BN(feeAmount))
        .div(new BN(2));
      expect(poolMembersShare.totalRewards.toString()).to.equal(
        expectedPoolMembersShare.toString()
      );

      const claimedPoolReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(claimedPoolReward).to.equal(true);
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
      const share = ether('0.297');

      await prepareEpochForClaim({
        epoch: 1,
        staker: kyberPoolMaster.address,
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: rewardsPerEpoch, // 3ETH,
        stakerStake: '1',
        delegatedStake: '0',
      });

      const poolMasterOwnerBalance = await balance.current(poolMasterOwner);

      const receipt = await kyberPoolMaster.claimRewardsMaster(1, {from: mike});
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '1',
        poolMaster: poolMasterOwner,
        totalRewards: unclaimReward,
        feeApplied: '100',
        feeAmount: feeAmount,
        poolMasterShare: new BN(unclaimReward)
          .sub(new BN(feeAmount))
          .toString(),
      });

      const poolMasterOwnerBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedBalance = poolMasterOwnerBalance.add(new BN(unclaimReward));

      expect(poolMasterOwnerBalanceAfter.toString()).to.equal(
        expectedBalance.toString()
      );

      const poolMembersShare = await kyberPoolMaster.memberRewards(1);
      expect(poolMembersShare.totalRewards.toString()).to.equal('0');

      const claimedPoolReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(claimedPoolReward).to.equal(true);
    });

    it('should apply the fee used if it was pending', async () => {
      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: ether('3'), // 3ETH,
        stakerStake: '1',
        delegatedStake: '1',
      });

      // new fee 2%
      await kyberPoolMaster.commitNewFee(200, {
        from: poolMasterOwner,
      });

      await kyberDAO.setCurrentEpochNumber(2);
      const receipt = await kyberPoolMaster.claimRewardsMaster(2, {from: mike});
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

      kyberStaking = await KyberStakingWithgetStakerDataForPastEpoch.new();
      kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new();
      kyberDAO = await KyberDAOClaimReward.new(kyberFeeHandler.address);
      kyberPoolMaster = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        kyberDAO.address,
        kyberStaking.address,
        kyberFeeHandler.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        {from: poolMasterOwner}
      );

      poolMasterNoFallbackMock = await PoolMasterNoFallbackMock.new(
        kyberPoolMaster.address,
        {value: '10000000000000000000', from: bank}
      );

      await kyberFeeHandler.send('10000000000000000000', {from: bank});
    });

    it('should return 0 if PoolMaster has not called claimRewardMaster', async () => {
      const calimedReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedReward).to.equal(false);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(1);

      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has previously claimed reward for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      await kyberPoolMaster.setClaimedDelegateReward(1, mike);
      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(true);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(1, {
        from: mike,
      });
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('0');

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(1, {
        from: mike,
      });
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return 0 if PoolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('1');
      expect(stakerDataForPastEpoch[2]).not.to.equal(kyberPoolMaster.address);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(1, {
        from: mike,
      });
      expect(unclaimed.toString()).to.equal('0');
    });

    it('should return unclaimed poolMember reward amount', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('1');
      expect(stakerDataForPastEpoch[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setMemberRewards(1, 10, 5);

      const unclaimed = await kyberPoolMaster.getUnclaimedRewardsMember(1, {
        from: mike,
      });
      expect(unclaimed.toString()).to.equal('2');
    });
  });
  describe('#claimRewardMember', () => {
    beforeEach('running before each test', async () => {
      await reverter.revert();

      bank = accounts[0];
      daoSetter = accounts[1];
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];
      paula = accounts[5];
      cris = accounts[6];

      kyberStaking = await KyberStakingWithgetStakerDataForPastEpoch.new();
      kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new();
      kyberDAO = await KyberDAOClaimReward.new(kyberFeeHandler.address);
      kyberPoolMaster = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        kyberDAO.address,
        kyberStaking.address,
        kyberFeeHandler.address,
        2,
        100, // Denominated in 1e4 units - 100 = 1%
        {from: poolMasterOwner, value: '1000000000000000000'}
      );
    });

    it('should revert if poolMaster has not claimed the epoch rewards yet', async () => {
      const calimedReward = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedReward).to.equal(false);

      await expectRevert(
        kyberPoolMaster.claimRewardMember(1, {from: mike}),
        'cRMember: poolMaster has not claimed yet'
      );
    });

    it('should revert if poolMember has already clamined its share for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      await kyberPoolMaster.setClaimedDelegateReward(1, mike);
      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(true);

      await expectRevert(
        kyberPoolMaster.claimRewardMember(1, {from: mike}),
        'cRMember: rewards already claimed'
      );
    });

    it('should revert if unclaimer reward member is 0 due to the poolMember has not stake for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 0, 0, kyberPoolMaster.address);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('0');

      await expectRevert(
        kyberPoolMaster.claimRewardMember(1, {from: mike}),
        'cRMember: no rewards to claim'
      );
    });

    it('should revert if unclaimer reward member is 0 due to the poolMember has not delegated it stake to this contract for the epoch', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, notOwner);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('1');
      expect(stakerDataForPastEpoch[2]).not.to.equal(kyberPoolMaster.address);

      await expectRevert(
        kyberPoolMaster.claimRewardMember(1, {from: mike}),
        'cRMember: no rewards to claim'
      );
    });

    it('poolMember should receive its share', async () => {
      await kyberPoolMaster.setClaimedPoolReward(1);
      const calimedRewardMaster = await kyberPoolMaster.claimedPoolReward(1);
      expect(calimedRewardMaster).to.equal(true);

      const calimedRewardMember = await kyberPoolMaster.claimedDelegateReward(
        1,
        mike
      );
      expect(calimedRewardMember).to.equal(false);

      await kyberStaking.setStakerData(1, mike, 1, 0, kyberPoolMaster.address);
      const stakerDataForPastEpoch = await kyberStaking.getStakerDataForPastEpoch(
        mike,
        1
      );
      expect(stakerDataForPastEpoch[0].toString()).to.equal('1');
      expect(stakerDataForPastEpoch[2]).to.equal(kyberPoolMaster.address);

      await kyberPoolMaster.setMemberRewards(1, 10, 5);

      const mikeBalance = await balance.current(mike);

      const txInfo = await kyberPoolMaster.claimRewardMember(1, {from: mike});
      expectEvent(txInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
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

    it('should distribute pool members share and keep remainings from rounding', async () => {
      // totalStaked = 100
      // total reward to share among members = 9999
      // mike staked 35, its share is 35 * 9999 / 100 = 3499
      // cris staked 5, its share is 5 * 9999 / 100 = 499
      // paula staked 60, its share is 60 * 9999 / 100 = 5999
      // total distributed = 3499 + 499 + 5999 = 9997
      // remainings = 3
      // values are in wei

      await kyberPoolMaster.setClaimedPoolReward(1);
      await kyberStaking.setStakerData(1, mike, 35, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(1, cris, 5, 0, kyberPoolMaster.address);
      await kyberStaking.setStakerData(
        1,
        paula,
        60,
        0,
        kyberPoolMaster.address
      );

      await kyberPoolMaster.setMemberRewards(1, 9999, 100);

      const mikeBalance = await balance.current(mike);
      const crisBalance = await balance.current(cris);
      const paulaBalance = await balance.current(paula);
      const poolBalance = await balance.current(kyberPoolMaster.address);

      const mikeTxInfo = await kyberPoolMaster.claimRewardMember(1, {
        from: mike,
      });
      expectEvent(mikeTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: mike,
        reward: '3499',
      });

      const crisTxInfo = await kyberPoolMaster.claimRewardMember(1, {
        from: cris,
      });
      expectEvent(crisTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: cris,
        reward: '499',
      });

      const paulaTxInfo = await kyberPoolMaster.claimRewardMember(1, {
        from: paula,
      });
      expectEvent(paulaTxInfo, 'MemberClaimReward', {
        epoch: '1',
        poolMember: paula,
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

      const expecteBalancePool = poolBalance
        .sub(new BN('3499'))
        .sub(new BN('499'))
        .sub(new BN('5999'));
      expect(poolBalanceAfter.toString()).to.equal(
        expecteBalancePool.toString()
      );
    });
  });
});
