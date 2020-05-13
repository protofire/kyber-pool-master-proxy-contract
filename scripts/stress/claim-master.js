const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');

const KyberDAOClaimReward = artifacts.require('KyberDAOClaimReward');

const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const KyberStakingWithgetStakerDataForPastEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForPastEpoch'
);

const {expect} = require('chai');
const {
  expectEvent,
  expectRevert,
  balance,
  ether,
} = require('@openzeppelin/test-helpers');

const Reverter = require('../../test/utils/reverter');

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

  describe('rewards distribution on multiple scenarios', async () => {
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
      expect(epochPoolMembersShare.totalRewards.toString()).to.equal(
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

    const fees = [
      '1',
      '10',
      '100',
      // '500',
      '900',
      // '2500',
      // '5000',
      '9000',
    ]; //0.01% 0.1% 1% 5% 9% 25% 50% 90%
    const rewardPerEpochs = [
      // '1000',
      // '1000000',
      // '1000000000',
      // '1000000000000',
      // '1000000000000000',
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
