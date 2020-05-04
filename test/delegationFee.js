const KyberPoolMaster = artifacts.require('KyberPoolMasterWithClaimOnlyNewFee');
const KyberDAO = artifacts.require('KyberDAOHandleCurrentEpoch');

const {expect} = require('chai');
const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

let kyberPoolMaster;
let kyberDAO;
let daoSetter;
let kncToken;
let poolMasterOwner;
let notOwner;
let mike;

contract('KyberPoolMaster delegationFee', async (accounts) => {
  before('one time init', async () => {
    daoSetter = accounts[1];
    poolMasterOwner = accounts[2];
    notOwner = accounts[3];
    mike = accounts[4];

    kyberDAO = await KyberDAO.new();
    kyberPoolMaster = await KyberPoolMaster.new(
      NO_ZERO_ADDRESS,
      kyberDAO.address,
      NO_ZERO_ADDRESS,
      NO_ZERO_ADDRESS,
      2,
      1,
      {from: poolMasterOwner}
    );
  });

  describe('delegationFee setting', () => {
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
        deadline: '1',
        feeRate: '2',
      });

      const delegationFeesLength = await kyberPoolMaster.delegationFeesLength();
      expect(delegationFeesLength.toString()).to.equal('2');

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('2');
      expect(delegationFee.fee.toString()).to.equal('2');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should rewrite the pending delegationFee fee when create a delegationFee with one still pending in the same epoch', async () => {
      const receipt = await kyberPoolMaster.commitNewFee(3, {
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'CommitNewFees', {
        deadline: '1',
        feeRate: '3',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('2');
      expect(delegationFee.fee.toString()).to.equal('3');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should rewrite the pending delegationFee fee and fromEpoch when create a delegationFee with one still pending in the same epoch', async () => {
      const curEpoch = await kyberDAO.getCurrentEpochNumber();
      await kyberDAO.setCurrentEpochNumber(curEpoch + 1);

      const receipt = await kyberPoolMaster.commitNewFee(5, {
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'CommitNewFees', {
        deadline: '2',
        feeRate: '5',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('3');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(false);
    });

    it('non owner should not be able to apply a new delegationFee', async () => {
      await expectRevert(
        kyberPoolMaster.applyPendingFee({from: notOwner}),
        'Ownable: caller is not the owner'
      );
    });

    it('should not apply a pending delegationFee early ', async () => {
      await kyberPoolMaster.applyPendingFee({from: poolMasterOwner});

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('3');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(false);
    });

    it('should apply a pending delegationFee if the epoch is beyond the deadLine', async () => {
      await kyberDAO.setCurrentEpochNumber(3);

      const receipt = await kyberPoolMaster.applyPendingFee({
        from: poolMasterOwner,
      });
      expectEvent(receipt, 'NewFees', {
        fromEpoch: '3',
        feeRate: '5',
      });

      const delegationFee = await kyberPoolMaster.delegationFees(1);
      expect(delegationFee.fromEpoch.toString()).to.equal('3');
      expect(delegationFee.fee.toString()).to.equal('5');
      expect(delegationFee.applied).to.equal(true);
    });

    it('should apply a pending delegationFee when creating a new one afte pending deadline', async () => {
      const receipt1 = await kyberPoolMaster.commitNewFee(1, {
        from: poolMasterOwner,
      });
      expectEvent(receipt1, 'CommitNewFees', {
        deadline: '4',
        feeRate: '1',
      });

      await kyberDAO.setCurrentEpochNumber(5);

      const receipt2 = await kyberPoolMaster.commitNewFee(2, {
        from: poolMasterOwner,
      });
      expectEvent(receipt2, 'CommitNewFees', {
        deadline: '6',
        feeRate: '2',
      });

      expectEvent(receipt2, 'NewFees', {
        fromEpoch: '5',
        feeRate: '1',
      });

      const delegationFeesLength = await kyberPoolMaster.delegationFeesLength();
      expect(delegationFeesLength.toString()).to.equal('4');

      const prevDelegationFee = await kyberPoolMaster.delegationFees(2);
      expect(prevDelegationFee.fromEpoch.toString()).to.equal('5');
      expect(prevDelegationFee.fee.toString()).to.equal('1');
      expect(prevDelegationFee.applied).to.equal(true);

      const pendingDelegationFee = await kyberPoolMaster.delegationFees(3);
      expect(pendingDelegationFee.fromEpoch.toString()).to.equal('7');
      expect(pendingDelegationFee.fee.toString()).to.equal('2');
      expect(pendingDelegationFee.applied).to.equal(false);
    });
  });
});
