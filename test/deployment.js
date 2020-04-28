const KyberPoolMaster = artifacts.require('KyberPoolMaster');

const {expect} = require('chai');
const {expectRevert} = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';

contract('KyberPoolMaster test', async (accounts) => {
  describe('deplyment', () => {
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

    it('should set the right parameters', async () => {
      const poolMater = await KyberPoolMaster.new(
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        NO_ZERO_ADDRESS,
        2,
        1
      );

      const kncToken = await poolMater.kncToken();
      expect(kncToken).to.equal(NO_ZERO_ADDRESS);

      const kyberDAO = await poolMater.kyberDAO();
      expect(kyberDAO).to.equal(NO_ZERO_ADDRESS);

      const kyberStaking = await poolMater.kyberStaking();
      expect(kyberStaking).to.equal(NO_ZERO_ADDRESS);

      const kyberFeeHandler = await poolMater.kyberFeeHandler();
      expect(kyberFeeHandler).to.equal(NO_ZERO_ADDRESS);

      const epochNotice = await poolMater.epochNotice();
      expect(epochNotice.toString()).to.equal('2');

      const delegationFee = await poolMater.delegationFee();
      expect(delegationFee.toString()).to.equal('1');
    });
  });
});