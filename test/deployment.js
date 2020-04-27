const KyberPoolMaster = artifacts.require('KyberPoolMaster');

const {expect} = require('chai');
const {expectRevert} = require('@openzeppelin/test-helpers');

contract('KyberPoolMaster test', async (accounts) => {
  describe('deplyment', () => {
    it('should not allow to deploy a KyberPoolMaster with epochNotice lower than the minimum', async () => {
      await expectRevert(KyberPoolMaster.new(0, 0), 'Epoch Notice too low.');
    });
  });
});
