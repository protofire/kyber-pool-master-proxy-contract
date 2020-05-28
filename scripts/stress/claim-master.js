const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');

const KyberDAOClaimReward = artifacts.require('KyberDAOClaimReward');

const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const KyberStakingWithgetStakerDataForEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForEpoch'
);

const {expect} = require('chai');
const {expectEvent, balance, ether, BN} = require('@openzeppelin/test-helpers');

const Reverter = require('../../test/utils/reverter');
const {NO_ZERO_ADDRESS} = require('../../test/helper.js');

let kyberPoolMaster;
let kyberDAO;
let kyberFeeHandler;
let poolMasterOwner;
let mike;
let reverter;
let kyberStaking;

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
      const poolMaster = new BN(poolMasterStakesDelegatedStakes[0]);
      const delegatedStake = new BN(poolMasterStakesDelegatedStakes[1]);
      const totalStake = poolMaster.add(delegatedStake);

      const unclaimReward = new BN(rewardPerEpoch)
        .mul(new BN(stakerRewardPercentage))
        .div(ether('1'));
      const feeAmount = new BN(unclaimReward)
        .mul(new BN(fee))
        .div(new BN(10000));
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

      poolMasterOwner = accounts[1];
      mike = accounts[2];

      kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
      kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new();
      kyberDAO = await KyberDAOClaimReward.new(
        NO_ZERO_ADDRESS,
        kyberStaking.address,
        kyberFeeHandler.address
      );
      kyberPoolMaster = await KyberPoolMaster.new(kyberDAO.address, 2, 1, {
        from: poolMasterOwner,
      });

      await Promise.all(
        Array.from({length: 17}, (v, i) =>
          kyberFeeHandler.send('90000000000000000000000', {
            from: accounts[i + 3],
          })
        )
      );
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
