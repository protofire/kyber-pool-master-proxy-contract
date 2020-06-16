const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const KyberDAO = artifacts.require('KyberDAOHandleCurrentEpoch');

const {expect, assert} = require('chai');
const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');

const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';

let kyberPoolMaster;
let kyberDAO;
let daoSetter;
let poolMasterOwner;
let notOwner;
let mike;

contract('KyberPoolMaster delegationFee', async (accounts) => {
  before('one time init', async () => {
    daoSetter = accounts[1];
    poolMasterOwner = accounts[2];
    notOwner = accounts[3];
    mike = accounts[4];

    kyberDAO = await KyberDAO.new(NO_ZERO_ADDRESS, NO_ZERO_ADDRESS);
    await kyberDAO.setCurrentEpochNumber(2);

    kyberPoolMaster = await KyberPoolMaster.new(
      kyberDAO.address,
      NO_ZERO_ADDRESS,
      2,
      1,
      {
        from: poolMasterOwner,
      }
    );
  });

  describe('delegation fees', () => {
    it('should set the right values when deploying the contract', async () => {
      await expectEvent.inConstruction(kyberPoolMaster, 'CommitNewFees', {
        deadline: '2',
        feeRate: '1',
      });

      await expectEvent.inConstruction(kyberPoolMaster, 'NewFees', {
        fromEpoch: '2',
        feeRate: '1',
      });

      const {fromEpoch, fee, applied} = await kyberPoolMaster.delegationFee();
      expect(fromEpoch.toString()).to.equal('2');
      expect(fee.toString()).to.equal('1');
      expect(applied).to.equal(true);
    });

    it('non owner should not be able to create a new delegationFee', async () => {
      await expectRevert(
        kyberPoolMaster.commitNewFee(2, {from: notOwner}),
        'Ownable: caller is not the owner'
      );
    });

    it('should create a new pending delegationFee starting in the right epoch', async () => {
      const receipt = await kyberPoolMaster.commitNewFee(2, {
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'CommitNewFees', {
        deadline: '3',
        feeRate: '2',
      });

      const delegationFeesLength = await kyberPoolMaster.delegationFeesLength();
      expect(delegationFeesLength.toString()).to.equal('2');

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('4');
      expect(delegationFee.fee.toString()).to.equal('2');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should rewrite the pending delegationFee fee when create a delegationFee with one still pending in the same epoch', async () => {
      const receipt = await kyberPoolMaster.commitNewFee(3, {
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'CommitNewFees', {
        deadline: '3',
        feeRate: '3',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('4');
      expect(delegationFee.fee.toString()).to.equal('3');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should rewrite the pending delegationFee fee and fromEpoch when create a delegationFee with one still pending in the same epoch', async () => {
      const curEpoch = await kyberDAO.getCurrentEpochNumber();
      await kyberDAO.setCurrentEpochNumber(Number(curEpoch) + 1);

      const receipt = await kyberPoolMaster.commitNewFee(5, {
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'CommitNewFees', {
        deadline: '4',
        feeRate: '5',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('5');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should not apply a pending delegationFee early ', async () => {
      await kyberPoolMaster.applyPendingFee({from: poolMasterOwner});

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('5');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(false);
    });

    it('anyone should be able to apply a pending delegationFee if the epoch is beyond the deadLine', async () => {
      await kyberDAO.setCurrentEpochNumber(5);

      const receipt = await kyberPoolMaster.applyPendingFee({
        from: notOwner,
      });
      expectEvent(receipt, 'NewFees', {
        fromEpoch: '5',
        feeRate: '5',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('5');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(true);
    });

    it('should not apply a delegationFee when creating a new one and there is no pending one', async () => {
      await kyberPoolMaster.commitNewFee(1, {
        from: poolMasterOwner,
      });
      await kyberDAO.setCurrentEpochNumber(7);

      await kyberPoolMaster.applyPendingFee({
        from: notOwner,
      });

      const receipt = await kyberPoolMaster.commitNewFee(10, {
        from: poolMasterOwner,
      });

      try {
        expectEvent(receipt, 'NewFees');
      } catch (error) {
        await kyberDAO.setCurrentEpochNumber(9);
        await kyberPoolMaster.applyPendingFee({
          from: notOwner,
        });
        return;
      }

      assert.fail('should throw error');
    });

    it('should apply a pending delegationFee when creating a new one after pending deadline', async () => {
      const receipt1 = await kyberPoolMaster.commitNewFee(1, {
        from: poolMasterOwner,
      });
      expectEvent(receipt1, 'CommitNewFees', {
        deadline: '10',
        feeRate: '1',
      });

      await kyberDAO.setCurrentEpochNumber(11);

      const receipt2 = await kyberPoolMaster.commitNewFee(2, {
        from: poolMasterOwner,
      });
      expectEvent(receipt2, 'CommitNewFees', {
        deadline: '12',
        feeRate: '2',
      });

      expectEvent(receipt2, 'NewFees', {
        fromEpoch: '11',
        feeRate: '1',
      });

      const delegationFeesLength = await kyberPoolMaster.delegationFeesLength();
      expect(delegationFeesLength.toString()).to.equal('6');

      const prevDelegationFee = await kyberPoolMaster.delegationFees(4);
      expect(prevDelegationFee.fromEpoch.toString()).to.equal('11');
      expect(prevDelegationFee.fee.toString()).to.equal('1');
      expect(prevDelegationFee.applied).to.equal(true);

      const pendingDelegationFee = await kyberPoolMaster.delegationFees(5);
      expect(pendingDelegationFee.fromEpoch.toString()).to.equal('13');
      expect(pendingDelegationFee.fee.toString()).to.equal('2');
      expect(pendingDelegationFee.applied).to.equal(false);
    });

    it('should get the right fees', async () => {
      await kyberDAO.setCurrentEpochNumber(14);

      const current = await kyberPoolMaster.delegationFee();
      expect(current.fromEpoch.toString()).to.equal('13');
      expect(current.fee.toString()).to.equal('2');
      expect(current.applied).to.equal(false);

      const epochData = await kyberPoolMaster.getEpochDFeeData(7);
      expect(epochData.fromEpoch.toString()).to.equal('7');
      expect(epochData.fee.toString()).to.equal('1');
      expect(epochData.applied).to.equal(true);

      const firstEpochData = await kyberPoolMaster.getEpochDFeeData(0);
      expect(firstEpochData.fromEpoch.toString()).to.equal('2');
      expect(firstEpochData.fee.toString()).to.equal('1');
      expect(firstEpochData.applied).to.equal(true);
    });
  });
});
