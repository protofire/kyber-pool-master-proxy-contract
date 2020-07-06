const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const KyberDao = artifacts.require('KyberDaoHandleCurrentEpoch');
const KyberFeeHandler = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);
const TestToken = artifacts.require('Token.sol');

const {expect} = require('chai');
const {expectRevert, expectEvent, BN} = require('@openzeppelin/test-helpers');
const {
  precisionUnits,
  ZERO_ADDRESS,
  NO_ZERO_ADDRESS,
  MAX_DELEGATION_FEE,
  ETH_TOKEN_ADDRESS,
} = require('./helper.js');

let kyberPoolMaster;
let erc20;

contract('KyberPoolMaster deployment', async (accounts) => {
  before('one time init', async () => {
    erc20 = await TestToken.new('Some ERC20', 'TKN', 18);
    poolMasterOwner = accounts[2];
    mike = accounts[4];

    await erc20.transfer(mike, mulPrecision(1000000));
  });

  describe('deployment', () => {
    it('should not allow to deploy a KyberPoolMaster zero address kyberDao', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          ZERO_ADDRESS,
          0,
          0,
          [NO_ZERO_ADDRESS],
          [ZERO_ADDRESS]
        ),
        'ctor: kyberDao is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with epochNotice lower than the minimum', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          0,
          0,
          [NO_ZERO_ADDRESS],
          [ZERO_ADDRESS]
        ),
        'ctor: Epoch Notice too low.'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with delegationFee greater than 100%', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          1,
          MAX_DELEGATION_FEE + 1,
          [NO_ZERO_ADDRESS],
          [ZERO_ADDRESS]
        ),
        'ctor: Delegation Fee greater than 100%'
      );
    });

    it('should not allow to deploy a KyberPoolMaster without at least', async () => {
      await expectRevert(
        KyberPoolMaster.new(NO_ZERO_ADDRESS, 1, 1, [], [ZERO_ADDRESS]),
        'ctor: at least one _kyberFeeHandlers require'
      );
    });

    it('should not allow to deploy a KyberPoolMaster when feeHandlers and rewardToken are not even', async () => {
      const kyberFeeHandler1 = await KyberFeeHandler.new(NO_ZERO_ADDRESS);
      const kyberFeeHandler2 = await KyberFeeHandler.new(NO_ZERO_ADDRESS);
      const ERC20RewartTokenA = await TestToken.new(
        'Reward Token A',
        'RTA',
        18
      );
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          1,
          1,
          [kyberFeeHandler1.address, kyberFeeHandler2.address],
          [ERC20RewartTokenA.address]
        ),
        'ctor: _kyberFeeHandlers and _rewardTokens uneven'
      );
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          1,
          1,
          [kyberFeeHandler1.address],
          [ERC20RewartTokenA.address, ERC20RewartTokenA.address]
        ),
        'ctor: _kyberFeeHandlers and _rewardTokens uneven'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with ZERO_ADDRESS feeHandler', async () => {
      await expectRevert.unspecified(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          1,
          1,
          [ZERO_ADDRESS],
          [NO_ZERO_ADDRESS]
        )
      );
    });

    it('should not allow to deploy a KyberPoolMaster with repeated feeHandler', async () => {
      const kyberFeeHandler1 = await KyberFeeHandler.new(NO_ZERO_ADDRESS);
      const ERC20RewartTokenA = await TestToken.new(
        'Reward Token A',
        'RTA',
        18
      );
      await expectRevert.unspecified(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          1,
          1,
          [kyberFeeHandler1.address, kyberFeeHandler1.address],
          [ERC20RewartTokenA.address, ERC20RewartTokenA.address]
        )
      );
    });

    it('should set the right parameters', async () => {
      const kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, NO_ZERO_ADDRESS);

      const kyberFeeHandler = await KyberFeeHandler.new(kyberDao.address);

      const ERC20RewartToken = await TestToken.new('Reward Token A', 'RTA', 18);

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        1,
        [kyberFeeHandler.address],
        [ERC20RewartToken.address],
        {
          from: poolMasterOwner,
        }
      );

      const kncTokenAddress = await kyberPoolMaster.kncToken();
      expect(kncTokenAddress).to.equal(NO_ZERO_ADDRESS);

      const kyberDaoAddress = await kyberPoolMaster.kyberDao();
      expect(kyberDaoAddress).to.equal(kyberDao.address);

      const kyberStakingAddress = await kyberPoolMaster.kyberStaking();
      expect(kyberStakingAddress).to.equal(NO_ZERO_ADDRESS);

      const kyberFeeHandlerAddress = await kyberPoolMaster.feeHandlersList(0);
      expect(kyberFeeHandlerAddress).to.equal(kyberFeeHandler.address);

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        kyberFeeHandler.address
      );
      expect(rewardToken).to.equal(ERC20RewartToken.address);

      const epochNotice = await kyberPoolMaster.epochNotice();
      expect(epochNotice.toString()).to.equal('2');

      const delegationFee = await kyberPoolMaster.delegationFees(0);
      expect(delegationFee.fromEpoch.toString()).to.equal('0');
      expect(delegationFee.fee.toString()).to.equal('1');
      expect(delegationFee.applied).to.equal(true);
    });

    it('should set ETH as reward token when ZERO_ADDRESS is used', async () => {
      const kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, NO_ZERO_ADDRESS);

      const kyberFeeHandler = await KyberFeeHandler.new(kyberDao.address);

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        1,
        [kyberFeeHandler.address],
        [ZERO_ADDRESS],
        {
          from: poolMasterOwner,
        }
      );

      const rewardToken = await kyberPoolMaster.rewardTokenByFeeHandle(
        kyberFeeHandler.address
      );
      expect(rewardToken).to.equal(ETH_TOKEN_ADDRESS);
    });
  });

  describe('ownership', () => {
    before('one time init', async () => {
      const kyberDao = await KyberDao.new(NO_ZERO_ADDRESS, NO_ZERO_ADDRESS);

      const kyberFeeHandler = await KyberFeeHandler.new(kyberDao.address);
      const ERC20RewartToken = await TestToken.new('Reward Token A', 'RTA', 18);

      kyberPoolMaster = await KyberPoolMaster.new(
        kyberDao.address,
        2,
        1,
        [kyberFeeHandler.address],
        [ERC20RewartToken.address],
        {
          from: poolMasterOwner,
        }
      );
    });

    it('should have the right owner', async () => {
      const owner = await kyberPoolMaster.owner();
      expect(owner).to.equal(poolMasterOwner);
    });

    it('non owner should not be able to transfer ownership', async () => {
      await expectRevert(
        kyberPoolMaster.transferOwnership(mike, {from: mike}),
        'Ownable: caller is not the owner'
      );
    });

    it('owner should be able to transfer ownership', async () => {
      const receipt = await kyberPoolMaster.transferOwnership(mike, {
        from: poolMasterOwner,
      });

      expectEvent(receipt, 'OwnershipTransferred', {
        previousOwner: poolMasterOwner,
        newOwner: mike,
      });
    });
  });
});

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
