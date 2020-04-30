const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const TestToken = artifacts.require('Token.sol');

const {expect} = require('chai');
const {expectRevert} = require('@openzeppelin/test-helpers');
const {precisionUnits} = require('./helper.js');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;
const BN = web3.utils.BN;

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
    it('should not allow to deploy a KyberPoolMaster zero address kncToken', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0
        ),
        'ctor: kncToken is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster zero address kyberDAO', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0
        ),
        'ctor: kyberDAO is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster zero address kyberStaking', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0
        ),
        'ctor: kyberStaking is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster zero address kyberFeeHandler', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0
        ),
        'ctor: kyberFeeHandler is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with epochNotice lower than the minimum', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          0,
          0
        ),
        'ctor: Epoch Notice too low.'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with delegationFee greater than 100%', async () => {
      await expectRevert(
        KyberPoolMaster.new(
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          NO_ZERO_ADDRESS,
          1,
          MAX_DELEGATION_FEE + 1
        ),
        'ctor: Delegation Fee greater than 100%'
      );
    });

    it('should set the right parameters', async () => {
      kyberPoolMaster = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        2,
        1,
        {from: poolMasterOwner}
      );

      const kncToken = await kyberPoolMaster.kncToken();
      expect(kncToken).to.equal(NO_ZERO_ADDRESS);

      const kyberDAO = await kyberPoolMaster.kyberDAO();
      expect(kyberDAO).to.equal(NO_ZERO_ADDRESS);

      const kyberStaking = await kyberPoolMaster.kyberStaking();
      expect(kyberStaking).to.equal(NO_ZERO_ADDRESS);

      const kyberFeeHandler = await kyberPoolMaster.kyberFeeHandler();
      expect(kyberFeeHandler).to.equal(NO_ZERO_ADDRESS);

      const epochNotice = await kyberPoolMaster.epochNotice();
      expect(epochNotice.toString()).to.equal('2');

      const delegationFee = await kyberPoolMaster.delegationFees(0);
      expect(delegationFee.fromEpoch.toString()).to.equal('0');
      expect(delegationFee.fee.toString()).to.equal('1');
      expect(delegationFee.applied).to.equal(true);
    });

    it('poolMaster should be able to claim ERC20 tokens', async () => {
      await erc20.transfer(kyberPoolMaster.address, mulPrecision(10), {
        from: mike,
      });
      let mikeBalance = await erc20.balanceOf(mike);
      expect(mikeBalance.toString()).to.equal(
        mulPrecision(1000000).sub(mulPrecision(10)).toString()
      );

      await kyberPoolMaster.claimErc20Tokens(erc20.address, mike, {
        from: poolMasterOwner,
      });

      mikeBalance = await erc20.balanceOf(mike);
      expect(mikeBalance.toString()).to.equal(mulPrecision(1000000).toString());
    });
  });
});

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
