const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');
const KyberDao = artifacts.require('KyberDaoWithRewardPercentageSetter');
const KyberFeeHandlerWithClaimStakerRewardERC20 = artifacts.require(
  'KyberFeeHandlerWithClaimStakerRewardERC20'
);
const KyberStakingWithgetStakerDataForEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForEpoch'
);
const TestToken = artifacts.require('Token.sol');

const {expect} = require('chai');
const {
  expectRevert,
  expectEvent,
  BN,
  ether,
} = require('@openzeppelin/test-helpers');
const {
  precisionUnits,
  ZERO_ADDRESS,
  NO_ZERO_ADDRESS,
  MAX_DELEGATION_FEE,
  ETH_TOKEN_ADDRESS,
} = require('./helper.js');

let kyberPoolMaster;
let erc20;
let kyberDao;
let kyberStaking;
let kyberFeeHandler;
let kyberFeeHandler2;
let rewardToken;
let rewardToken2;

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

contract('KyberPoolMaster deployment', async (accounts) => {
  before('one time init', async () => {
    erc20 = await TestToken.new('Some ERC20', 'TKN', 18);
    poolMasterOwner = accounts[2];
    mike = accounts[4];

    kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
    kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);
    await kyberDao.setCurrentEpochNumber(1);

    rewardToken = await TestToken.new('Reward Token A', 'RTA', 18);
    kyberFeeHandler = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
      kyberDao.address,
      rewardToken.address
    );
    await rewardToken.transfer(kyberFeeHandler.address, ether('100'));

    rewardToken2 = await TestToken.new('Reward Token A', 'RTA', 18);
    kyberFeeHandler2 = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
      kyberDao.address,
      rewardToken2.address
    );

    kyberPoolMaster = await KyberPoolMaster.new(
      kyberDao.address,
      2,
      1,
      [kyberFeeHandler.address, kyberFeeHandler2.address],
      [rewardToken.address, rewardToken2.address],
      {
        from: poolMasterOwner,
      }
    );

    await erc20.transfer(mike, ether('1000000'));
  });

  describe('#claimErc20Tokens', () => {
    it('poolMaster should not be able to claim a reward token asociated to a claimed FeeHandler', async () => {
      await kyberDao.setCurrentEpochNumber(3);
      await prepareEpochForClaim({
        epoch: 2,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [ether('3')], // 3ETH,
      });

      const receipt = await kyberPoolMaster.claimRewardsMaster([2], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '2',
      });

      const successfulClaimByFeeHandler = await kyberPoolMaster.successfulClaimByFeeHandler(
        kyberFeeHandler.address
      );
      console.log('successfulClaimByFeeHandler', successfulClaimByFeeHandler);

      await expectRevert(
        kyberPoolMaster.claimErc20Tokens(rewardToken.address, mike, {
          from: poolMasterOwner,
        }),
        'not allowed to claim rewardTokens'
      );
    });

    it('non poolMaster should not be able to claim ERC20 non reward tokens', async () => {
      await erc20.transfer(kyberPoolMaster.address, ether('10'), {
        from: mike,
      });

      await expectRevert(
        kyberPoolMaster.claimErc20Tokens(rewardToken.address, mike, {
          from: mike,
        }),
        'Ownable: caller is not the owner'
      );
    });

    it('poolMaster should be able to claim ERC20 non reward tokens', async () => {
      let mikeBalanceBefore = await erc20.balanceOf(mike);
      let kyberPoolMasterBefore = await erc20.balanceOf(
        kyberPoolMaster.address
      );

      await kyberPoolMaster.claimErc20Tokens(erc20.address, mike, {
        from: poolMasterOwner,
      });

      const mikeBalance = await erc20.balanceOf(mike);
      expect(mikeBalance.toString()).to.equal(
        mikeBalanceBefore.add(kyberPoolMasterBefore).toString()
      );
    });

    it('poolMaster should be able to claim ERC20 a reward token asociated to a NON claimed FeeHandler', async () => {
      await rewardToken2.transfer(kyberPoolMaster.address, ether('10'));
      let kyberPoolMasterBefore = await rewardToken2.balanceOf(
        kyberPoolMaster.address
      );
      let mikeBalanceBefore = await rewardToken2.balanceOf(mike);

      await kyberPoolMaster.claimErc20Tokens(rewardToken2.address, mike, {
        from: poolMasterOwner,
      });

      mikeBalance = await rewardToken2.balanceOf(mike);
      expect(mikeBalance.toString()).to.equal(
        mikeBalanceBefore.add(kyberPoolMasterBefore).toString()
      );
    });
  });
});
