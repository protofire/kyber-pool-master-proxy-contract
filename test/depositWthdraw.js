const KyberPoolMaster = artifacts.require('KyberPoolMaster');
const KyberDAO = artifacts.require('KyberDAOHandleCurrentEpoch');

// Mocks
const TestToken = artifacts.require('Token.sol');
const StakingContract = artifacts.require('MockStakingContract.sol');

const {expect} = require('chai');
const {
  time,
  expectRevert,
  expectEvent,
  BN,
} = require('@openzeppelin/test-helpers');
const {precisionUnits} = require('./helper.js');

let daoSetter;

let currentBlock;

let epochPeriod = 20;
let startBlock;
let blockTime;
let currentChainTime;
let kncToken;
let kyberDAO;
let stakingContract;
let poolMasterOwner;
let notOwner;
let mike;

let poolMaster;

const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';

contract(
  'KyberPoolMaster masterDeposit and masterWithdraw',
  async (accounts) => {
    before('one time init', async () => {
      daoSetter = accounts[1];
      kncToken = await TestToken.new('Kyber Network Crystal', 'KNC', 18);
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];

      currentBlock = Number((await time.latestBlock()).toString());
      currentChainTime = Number((await time.latest()).toString());
      blockTime = 16; // each block is mined after 16s

      epochPeriod = 10;
      startBlock = currentBlock + 10;
      firstEpochStartTimestamp = blockToTimestamp(startBlock);

      stakingContract = await StakingContract.new(
        kncToken.address,
        blocksToSeconds(epochPeriod),
        blockToTimestamp(startBlock),
        daoSetter
      );

      kyberDAO = await KyberDAO.new(
        kncToken.address,
        stakingContract.address,
        NO_ZERO_ADDRESS
      );

      poolMaster = await KyberPoolMaster.new(kyberDAO.address, 2, 1, {
        from: poolMasterOwner,
      });
    });

    const blockToTimestamp = function (block) {
      return currentChainTime + (block - currentBlock) * blockTime;
    };

    const blocksToSeconds = function (blocks) {
      return blocks * blockTime;
    };

    describe('#Deposit Tests', () => {
      it('should not be able to deposit 0 amount', async function () {
        await kncToken.transfer(poolMasterOwner, mulPrecision(100));
        await kncToken.approve(poolMaster.address, mulPrecision(100), {
          from: poolMasterOwner,
        });

        await expectRevert(
          poolMaster.masterDeposit(mulPrecision(0), {
            from: poolMasterOwner,
          }),
          'masterDeposit: amount to deposit should be positive'
        );
      });

      it('should deposit into staking contract', async function () {
        await kncToken.transfer(poolMasterOwner, mulPrecision(100));
        await kncToken.approve(poolMaster.address, mulPrecision(100), {
          from: poolMasterOwner,
        });

        const initialBalance = await kncToken.balanceOf(poolMasterOwner);
        const currentEpoch = await stakingContract.getCurrentEpochNumber();

        const {tx} = await poolMaster.masterDeposit(mulPrecision(20), {
          from: poolMasterOwner,
        });

        await expectEvent.inTransaction(tx, stakingContract, 'Deposited', {
          curEpoch: currentEpoch.toString(),
          staker: poolMaster.address,
          amount: mulPrecision(20),
        });

        const finalBalance = await kncToken.balanceOf(poolMasterOwner);

        const expectedKNCBalance = initialBalance.sub(mulPrecision(20));

        expect(finalBalance.toString()).to.equal(expectedKNCBalance.toString());
      });

      it('non owner should not be able to deposit', async function () {
        await kncToken.transfer(notOwner, mulPrecision(100));
        await kncToken.approve(poolMaster.address, mulPrecision(100), {
          from: notOwner,
        });

        const initialBalance = await kncToken.balanceOf(notOwner);

        await expectRevert(
          poolMaster.masterDeposit(mulPrecision(20), {
            from: notOwner,
          }),
          'Ownable: caller is not the owner'
        );

        const finalBalance = await kncToken.balanceOf(notOwner);

        expect(finalBalance.toString()).to.equal(initialBalance.toString());
      });
    });
    describe('#Withdraw Tests', () => {
      it('should not be able to withdraw 0 amount', async function () {
        await expectRevert(
          poolMaster.masterWithdraw(mulPrecision(0), {
            from: poolMasterOwner,
          }),
          'masterWithdraw: amount is 0'
        );
      });

      it('should withdraw some amount from staking contract', async function () {
        const initialBalance = await kncToken.balanceOf(poolMasterOwner);
        const currentEpoch = await stakingContract.getCurrentEpochNumber();

        const {tx} = await poolMaster.masterWithdraw(mulPrecision(10), {
          from: poolMasterOwner,
        });

        await expectEvent.inTransaction(tx, stakingContract, 'Withdraw', {
          curEpoch: currentEpoch.toString(),
          staker: poolMaster.address,
          amount: mulPrecision(10),
        });

        const finalBalance = await kncToken.balanceOf(poolMasterOwner);

        const expectedKNCBalance = initialBalance.add(mulPrecision(10));

        expect(finalBalance.toString()).to.equal(expectedKNCBalance.toString());
      });

      it('non owner should not be able to withdraw', async function () {
        const initialBalance = await kncToken.balanceOf(notOwner);

        await expectRevert(
          poolMaster.masterWithdraw(mulPrecision(20), {
            from: notOwner,
          }),
          'Ownable: caller is not the owner'
        );

        const finalBalance = await kncToken.balanceOf(notOwner);

        expect(finalBalance.toString()).to.equal(initialBalance.toString());
      });
    });
  }
);

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
