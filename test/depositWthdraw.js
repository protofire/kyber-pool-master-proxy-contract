const KyberPoolMaster = artifacts.require('KyberPoolMaster');

// Mocks
const TestToken = artifacts.require('Token.sol');
const StakingContract = artifacts.require('MockStakingContract.sol');

const {expect} = require('chai');
const {expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const {precisionUnits, zeroAddress} = require('./helper.js');
const Helper = require('./helper.js');
const BN = web3.utils.BN;

let daoSetter;

let currentBlock;

let epochPeriod = 20;
let startBlock;
let blockTime;
let currentChainTime;
let kncToken;
let stakingContract;
let victor;
let loi;
let mike;

let poolMaster;

const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

contract(
  'KyberPoolMaster masterDeposit and masterWithdraw',
  async (accounts) => {
    before('one time init', async () => {
      daoSetter = accounts[1];
      kncToken = await TestToken.new('Kyber Network Crystal', 'KNC', 18);
      victor = accounts[2];
      loi = accounts[3];
      mike = accounts[4];

      currentBlock = await Helper.getCurrentBlock();
      currentChainTime = await Helper.getCurrentBlockTime();
      blockTime = 16; // each block is mined after 16s

      epochPeriod = 10;
      startBlock = currentBlock + 10;

      stakingContract = await StakingContract.new(
        kncToken.address,
        blocksToSeconds(epochPeriod),
        blockToTimestamp(startBlock),
        daoSetter
      );

      poolMaster = await KyberPoolMaster.new(
        kncToken.address,
        NO_ZERO_ADDRESS,
        stakingContract.address,
        NO_ZERO_ADDRESS,
        2,
        1,
        {from: victor}
      );
    });

    const blockToTimestamp = function (block) {
      return currentChainTime + (block - currentBlock) * blockTime;
    };

    const blocksToSeconds = function (blocks) {
      return blocks * blockTime;
    };

    describe('#Deposit Tests', () => {
      it('should deposit into staking contract', async function () {
        // await deployStakingContract(10, currentBlock + 10);

        await kncToken.transfer(victor, mulPrecision(100));
        await kncToken.approve(poolMaster.address, mulPrecision(100), {
          from: victor,
        });

        const initialBalance = await kncToken.balanceOf(victor);

        const {tx} = await poolMaster.masterDeposit(mulPrecision(20), {
          from: victor,
        });

        await expectEvent.inTransaction(tx, stakingContract, 'Deposited', {
          curEpoch: '0',
          staker: poolMaster.address,
          amount: mulPrecision(20),
        });

        const finalBalance = await kncToken.balanceOf(victor);

        const expectedKNCBalance = initialBalance.sub(mulPrecision(20));

        expect(finalBalance.toString()).to.equal(expectedKNCBalance.toString());
      });
    });
  }
);

function logInfo(message) {
  console.log('       ' + message);
}

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
