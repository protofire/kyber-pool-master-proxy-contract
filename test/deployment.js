const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const KyberDAO = artifacts.require('KyberDAOHandleCurrentEpoch');
const TestToken = artifacts.require('Token.sol');

const {expect} = require('chai');
const {expectRevert, expectEvent, BN} = require('@openzeppelin/test-helpers');
const {
  precisionUnits,
  ZERO_ADDRESS,
  NO_ZERO_ADDRESS,
  MAX_DELEGATION_FEE,
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
    it('should not allow to deploy a KyberPoolMaster zero address kyberDAO', async () => {
      await expectRevert(
        KyberPoolMaster.new(ZERO_ADDRESS, 0, 0),
        'ctor: kyberDAO is missing'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with epochNotice lower than the minimum', async () => {
      await expectRevert(
        KyberPoolMaster.new(NO_ZERO_ADDRESS, 0, 0),
        'ctor: Epoch Notice too low.'
      );
    });

    it('should not allow to deploy a KyberPoolMaster with delegationFee greater than 100%', async () => {
      await expectRevert(
        KyberPoolMaster.new(NO_ZERO_ADDRESS, 1, MAX_DELEGATION_FEE + 1),
        'ctor: Delegation Fee greater than 100%'
      );
    });

    it('should set the right parameters', async () => {
      const kyberDAO = await KyberDAO.new(
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS
      );
      kyberPoolMaster = await KyberPoolMaster.new(kyberDAO.address, 2, 1, {
        from: poolMasterOwner,
      });

      const kncTokenAddress = await kyberPoolMaster.kncToken();
      expect(kncTokenAddress).to.equal(NO_ZERO_ADDRESS);

      const kyberDAOAddress = await kyberPoolMaster.kyberDAO();
      expect(kyberDAOAddress).to.equal(kyberDAO.address);

      const kyberStakingAddress = await kyberPoolMaster.kyberStaking();
      expect(kyberStakingAddress).to.equal(NO_ZERO_ADDRESS);

      const kyberFeeHandlerAddress = await kyberPoolMaster.kyberFeeHandler();
      expect(kyberFeeHandlerAddress).to.equal(NO_ZERO_ADDRESS);

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

  describe('ownership', () => {
    before('one time init', async () => {
      const kyberDAO = await KyberDAO.new(
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS
      );
      kyberPoolMaster = await KyberPoolMaster.new(kyberDAO.address, 2, 1, {
        from: poolMasterOwner,
      });
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
