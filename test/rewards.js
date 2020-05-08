const KyberPoolMaster = artifacts.require(
  'KyberPoolMasterWithClaimedPoolRewardSetter'
);
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
const Kamikaze = artifacts.require('Kamikaze');

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

    it('should revert if claimed reward lower than expected'); // TBD - is this check really necessary

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
      expect(poolMembersShare.toString()).to.equal(
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
      expect(poolMembersShare.toString()).to.equal(
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
      expect(poolMembersShare.toString()).to.equal('0');

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

  describe('rewards distribution on multiple scenarios', async () => {
    const prepareFee = async (fee) => {
      await kyberPoolMaster.commitNewFee(fee, {
        from: poolMasterOwner,
      });
      const curEpoch = await kyberDAO.getCurrentEpochNumber();
      const nextEpoch = Number(curEpoch) + 2;
      await kyberDAO.setCurrentEpochNumber(nextEpoch);
      await kyberPoolMaster.applyPendingFee({from: poolMasterOwner});

      return nextEpoch;
    };
    const prepareScenario = async (
      epoch,
      rewardsPerEpoch,
      stakerRewardPercentage,
      poolMasterStakesDelegatedStakes
    ) => {
      // console.log('prepareScenario', epoch, rewardsPerEpoch, stakerRewardPercentage, poolMasterStakesDelegatedStakes)
      await prepareEpochForClaim({
        epoch,
        staker: kyberPoolMaster.address,
        stakerRewardPercentage,
        rewardsPerEpoch, // 3ETH,
        stakerStake: poolMasterStakesDelegatedStakes[0],
        delegatedStake: poolMasterStakesDelegatedStakes[1],
      });
    };

    const checkResults = async (
      epoch,
      fee,
      rewardPerEpoch,
      stakerRewardPercentage,
      poolMasterStakesDelegatedStakes
    ) => {
      // 82     '1' '1000000'            '10000000000000000' [ 0, 1 ]

      const poolMaster = new BN(poolMasterStakesDelegatedStakes[0]);
      const delegatedStake = new BN(poolMasterStakesDelegatedStakes[1]);
      const totalStake = poolMaster.add(delegatedStake);

      const rewardsPerEpoch = ether('3');
      const unclaimReward = new BN(rewardPerEpoch)
        .mul(new BN(stakerRewardPercentage))
        .div(ether('1')); // 1000000 * 10000000000000000 / 10^18 = 10000
      const feeAmount = new BN(unclaimReward)
        .mul(new BN(fee))
        .div(new BN(10000)); // 10000 * 1 /
      const poolMemberShare = delegatedStake
        .mul(unclaimReward.sub(feeAmount))
        .div(totalStake);
      const poolMasterShare = unclaimReward.sub(poolMemberShare);

      const poolMasterOwnerBalance = await balance.current(poolMasterOwner);

      const receipt = await kyberPoolMaster.claimRewardsMaster(epoch, {
        from: mike,
      });
      expectEvent(receipt, 'MasterClaimReward', {
        epoch: epoch.toString(),
        poolMaster: poolMasterOwner,
        totalRewards: unclaimReward.toString(),
        feeApplied: fee,
        feeAmount: feeAmount.toString(),
        poolMasterShare: poolMasterShare.sub(feeAmount).toString(),
      });

      const poolMasterOwnerBalanceAfter = await balance.current(
        poolMasterOwner
      );
      const expectedBalance = poolMasterOwnerBalance.add(poolMasterShare);

      expect(poolMasterOwnerBalanceAfter.toString()).to.equal(
        expectedBalance.toString()
      );

      const epochPoolMembersShare = await kyberPoolMaster.memberRewards(epoch);
      expect(epochPoolMembersShare.toString()).to.equal(
        poolMemberShare.toString()
      );

      const claimedPoolReward = await kyberPoolMaster.claimedPoolReward(epoch);
      expect(claimedPoolReward).to.equal(true);
    };

    before('one time', async () => {
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
        1,
        {from: poolMasterOwner}
      );

      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[5],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[6],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[7],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[8],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[8],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[9],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[10],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[11],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[12],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[13],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[14],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[15],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[16],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[17],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[18],
      });
      await kyberFeeHandler.send('90000000000000000000000', {
        from: accounts[19],
      });
    });

    const fees = ['1', '10', '100', '500', '900', '2500', '5000', '9000']; //0.01% 0.1% 1% 5% 9% 25% 50% 90%
    const rewardPerEpochs = [
      '1000',
      '1000000',
      '1000000000',
      '1000000000000',
      '1000000000000000',
      '1000000000000000000',
      '10000000000000000000',
    ];
    const stakerRewardPercentages = [
      '1000000000000000',
      '10000000000000000',
      '100000000000000000',
      '1000000000000000000',
    ]; // 0.1%, 1%, 10%, 100%
    const poolMasterStakesDelegatedStakes = [
      [0, 1],
      [1, 1],
      [1, 10],
      [1, 100],
      [1, 1000],
      [10, 1],
      [100, 1],
      [1000, 1],
    ];

    let scenario = 1;
    for (let f = 0; f < fees.length; f++) {
      for (let r = 0; r < rewardPerEpochs.length; r++) {
        for (let s = 0; s < stakerRewardPercentages.length; s++) {
          for (let p = 0; p < poolMasterStakesDelegatedStakes.length; p++) {
            it(`should distribute rewards ${scenario}: ${fees[f]}-${rewardPerEpochs[r]}-${stakerRewardPercentages[s]}-${poolMasterStakesDelegatedStakes[p]}`, async () => {
              const epoch = await prepareFee(fees[f]);
              await prepareScenario(
                epoch,
                rewardPerEpochs[r],
                stakerRewardPercentages[s],
                poolMasterStakesDelegatedStakes[p]
              );
              await checkResults(
                epoch,
                fees[f],
                rewardPerEpochs[r],
                stakerRewardPercentages[s],
                poolMasterStakesDelegatedStakes[p]
              );
            });
            scenario++;
          }
        }
      }
    }
  });
});
