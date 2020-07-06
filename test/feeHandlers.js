const KyberPoolMaster = artifacts.require('KyberPoolMasterWithSetters');
const KyberDao = artifacts.require('KyberDaoWithRewardPercentageSetter');
const KyberFeeHandlerWithClaimStakerRewardERC20 = artifacts.require(
  'KyberFeeHandlerWithClaimStakerRewardERC20'
);
const KyberStakingWithgetStakerDataForEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForEpoch'
);
const TestToken = artifacts.require('Token.sol');

const {expect, assert} = require('chai');
const {
  expectEvent,
  expectRevert,
  BN,
  ether,
} = require('@openzeppelin/test-helpers');

const {
  NO_ZERO_ADDRESS,
  ZERO_ADDRESS,
  ETH_TOKEN_ADDRESS,
} = require('./helper.js');

const Reverter = require('./utils/reverter');

const BN_ONE = new BN(1);

const FEE_HANDLER_A = '0x000000000000000000000000000000000000000A';
const FEE_HANDLER_B = '0x000000000000000000000000000000000000000b';
const FEE_HANDLER_C = '0x000000000000000000000000000000000000000C';
const FEE_HANDLER_D = '0x000000000000000000000000000000000000000d';
const FEE_HANDLER_E = '0x000000000000000000000000000000000000000e';
const FEE_HANDLER_F = '0x000000000000000000000000000000000000000F';

const REWARD_TOKEN_1 = '0x00000000000000000000000000000000000000A1';
const REWARD_TOKEN_2 = '0x00000000000000000000000000000000000000B2';

let kyberPoolMaster;
let kyberDao;
let daoSetter;
let poolMasterOwner;
let notOwner;
let mike;
let reverter;
let kyberStaking;

contract('KyberPoolMaster FeeHandlers', async (accounts) => {
  before('one time init', async () => {
    daoSetter = accounts[1];
    poolMasterOwner = accounts[2];
    notOwner = accounts[3];
    mike = accounts[4];

    kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();
    kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, kyberStaking.address);
    await kyberDao.setCurrentEpochNumber(2);

    kyberPoolMaster = await KyberPoolMaster.new(
      kyberDao.address,
      2,
      1,
      [FEE_HANDLER_F],
      [ZERO_ADDRESS],
      {
        from: poolMasterOwner,
      }
    );

    const feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
    expect(feeHandlersListLength.toString()).to.equal('1');

    reverter = new Reverter(web3);
    await reverter.snapshot();
  });

  describe('add new FeeHandler', () => {
    it('non owner should not be able to add a new fee handler', async () => {
      await expectRevert(
        kyberPoolMaster.addFeeHandler(FEE_HANDLER_A, REWARD_TOKEN_1, {
          from: notOwner,
        }),
        'Ownable: caller is not the owner'
      );
    });

    it('should not be able to add a new fee handler with zero address', async () => {
      await expectRevert(
        kyberPoolMaster.addFeeHandler(ZERO_ADDRESS, REWARD_TOKEN_1, {
          from: poolMasterOwner,
        }),
        'addFeeHandler: _feeHandler is missing'
      );
    });

    it('should add a new fee handler', async () => {
      const initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      const receipt = await kyberPoolMaster.addFeeHandler(
        FEE_HANDLER_A,
        REWARD_TOKEN_1,
        {
          from: poolMasterOwner,
        }
      );
      expectEvent(receipt, 'AddFeeHandler', {
        feeHandler: FEE_HANDLER_A,
        rewardToken: REWARD_TOKEN_1,
      });

      const feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.add(BN_ONE).toString()
      );

      const feeHandlersList = await kyberPoolMaster.feeHandlersList(
        initialFeeHandlersListLength.toString()
      );
      expect(feeHandlersList).to.equal(FEE_HANDLER_A);

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        FEE_HANDLER_A
      );
      expect(rewardToken).to.equal(REWARD_TOKEN_1);
    });

    it('should not be able to add an existing new fee handler', async () => {
      await expectRevert(
        kyberPoolMaster.addFeeHandler(FEE_HANDLER_A, REWARD_TOKEN_1, {
          from: poolMasterOwner,
        }),
        'addFeeHandler: already added'
      );
    });

    it('should add a new fee handler for ETH when second argument is ZERO_ADDRESS', async () => {
      const initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      const receipt = await kyberPoolMaster.addFeeHandler(
        FEE_HANDLER_B,
        ZERO_ADDRESS,
        {
          from: poolMasterOwner,
        }
      );

      expectEvent(receipt, 'AddFeeHandler', {
        feeHandler: FEE_HANDLER_B,
        rewardToken: ETH_TOKEN_ADDRESS,
      });

      const feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.add(BN_ONE).toString()
      );

      const feeHandlersList = await kyberPoolMaster.feeHandlersList(
        initialFeeHandlersListLength.toString()
      );
      expect(feeHandlersList).to.equal(FEE_HANDLER_B);

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        FEE_HANDLER_B
      );
      expect(rewardToken).to.equal(ETH_TOKEN_ADDRESS);
    });
  });

  describe('remove new FeeHandler', () => {
    before('one time init', async () => {
      await reverter.revert();

      await kyberPoolMaster.addFeeHandler(FEE_HANDLER_A, REWARD_TOKEN_1, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.addFeeHandler(FEE_HANDLER_B, REWARD_TOKEN_2, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.addFeeHandler(FEE_HANDLER_C, ZERO_ADDRESS, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.addFeeHandler(FEE_HANDLER_D, ZERO_ADDRESS, {
        from: poolMasterOwner,
      });

      await reverter.snapshot();
    });

    afterEach('after each test', async () => {
      await reverter.revert();
    });

    it('non owner should not be able to remove fee handler', async () => {
      await expectRevert(
        kyberPoolMaster.removeFeeHandler(FEE_HANDLER_A, {from: notOwner}),
        'Ownable: caller is not the owner'
      );
    });

    it('should not be able to remove a non existing fee handler', async () => {
      await expectRevert(
        kyberPoolMaster.removeFeeHandler(FEE_HANDLER_E, {
          from: poolMasterOwner,
        }),
        'removeFeeHandler: not added'
      );
    });

    it('should be able to remove a fee handler from last position', async () => {
      const initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      const receipt = await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_D, {
        from: poolMasterOwner,
      });

      expectEvent(receipt, 'RemoveFeeHandler', {
        feeHandler: FEE_HANDLER_D,
      });

      const feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.sub(BN_ONE).toString()
      );

      const feeHandlersList = await Promise.all(
        Array.from(
          new Array(Number(feeHandlersListLength.toString())),
          (_, i) => kyberPoolMaster.feeHandlersList(i)
        )
      );
      expect(feeHandlersList.includes(FEE_HANDLER_D)).to.equal(false);

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        FEE_HANDLER_D
      );
      expect(rewardToken).to.equal(ZERO_ADDRESS);
    });

    it('should be able to remove a fee handler from fist position', async () => {
      const initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      const receipt = await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_F, {
        from: poolMasterOwner,
      });

      expectEvent(receipt, 'RemoveFeeHandler', {
        feeHandler: FEE_HANDLER_F,
      });

      const feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.sub(BN_ONE).toString()
      );

      const feeHandlersList = await Promise.all(
        Array.from(
          new Array(Number(feeHandlersListLength.toString())),
          (_, i) => kyberPoolMaster.feeHandlersList(i)
        )
      );
      expect(feeHandlersList.includes(FEE_HANDLER_F)).to.equal(false);

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        FEE_HANDLER_F
      );
      expect(rewardToken).to.equal(ZERO_ADDRESS);
    });

    it('should be able to remove a fee handler from somewhere in a middle position', async () => {
      let initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      let receipt = await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_B, {
        from: poolMasterOwner,
      });

      expectEvent(receipt, 'RemoveFeeHandler', {
        feeHandler: FEE_HANDLER_B,
      });

      let feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.sub(BN_ONE).toString()
      );

      let feeHandlersList = await Promise.all(
        Array.from(
          new Array(Number(feeHandlersListLength.toString())),
          (_, i) => kyberPoolMaster.feeHandlersList(i)
        )
      );
      expect(feeHandlersList.includes(FEE_HANDLER_B)).to.equal(false);

      let rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        FEE_HANDLER_B
      );
      expect(rewardToken).to.equal(ZERO_ADDRESS);

      initialFeeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();

      receipt = await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_C, {
        from: poolMasterOwner,
      });

      expectEvent(receipt, 'RemoveFeeHandler', {
        feeHandler: FEE_HANDLER_C,
      });

      feeHandlersListLength = await kyberPoolMaster.feeHandlersListLength();
      expect(feeHandlersListLength.toString()).to.equal(
        initialFeeHandlersListLength.sub(BN_ONE).toString()
      );

      feeHandlersList = await Promise.all(
        Array.from(
          new Array(Number(feeHandlersListLength.toString())),
          (_, i) => kyberPoolMaster.feeHandlersList(i)
        )
      );
      expect(feeHandlersList.includes(FEE_HANDLER_C)).to.equal(false);

      rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(FEE_HANDLER_C);
      expect(rewardToken).to.equal(ZERO_ADDRESS);
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

    it('should not be able to remove a fee handler that has already claimed', async () => {
      await kyberDao.setCurrentEpochNumber(4);
      await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_A, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_B, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_C, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_D, {
        from: poolMasterOwner,
      });
      await kyberPoolMaster.removeFeeHandler(FEE_HANDLER_F, {
        from: poolMasterOwner,
      });
      const rewardToken = await TestToken.new('Reward Token A', 'RTA', 18);
      const kyberFeeHandler = await KyberFeeHandlerWithClaimStakerRewardERC20.new(
        kyberDao.address,
        rewardToken.address
      );
      await rewardToken.transfer(kyberFeeHandler.address, ether('100'));
      await kyberPoolMaster.addFeeHandler(
        kyberFeeHandler.address,
        rewardToken.address,
        {
          from: poolMasterOwner,
        }
      );

      await prepareEpochForClaim({
        epoch: 3,
        staker: kyberPoolMaster.address,
        feeHandlers: [kyberFeeHandler],
        stakerRewardPercentage: '200000000000000000', // 20%
        rewardsPerEpoch: [ether('3')], // 3ETH,
      });

      const receipt = await kyberPoolMaster.claimRewardsMaster([3], {
        from: mike,
      });

      expectEvent(receipt, 'MasterClaimReward', {
        epoch: '3',
      });

      await expectRevert(
        kyberPoolMaster.removeFeeHandler(kyberFeeHandler.address, {
          from: poolMasterOwner,
        }),
        'removeFeeHandler: can not remove FeeHandler successfully claimed'
      );
    });
  });
});
