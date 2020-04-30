const KyberPoolMaster = artifacts.require('KyberPoolMaster');

// Mocks
const TestToken = artifacts.require('Token.sol');
const DAOContract = artifacts.require('MockKyberDaoMoreGetters.sol');
const StakingContract = artifacts.require('MockStakingContract.sol');
const MockFeeHandler = artifacts.require('MockFeeHandlerNoContructor.sol');

const {expect} = require('chai');
const {time, expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const {precisionUnits, zeroAddress} = require('./helper.js');
const Helper = require('./helper.js');
const BN = web3.utils.BN;

let daoSetter;

let currentChainTime;
let poolMasterOwner;
let notOwner;

let poolMaster;

let currentTimestamp;
let currentBlock;
let daoStartTime;

let epochPeriod = 20;
let startBlock;
let blockTime;
let kncToken;
let stakingContract;
let feeHandler;
let daoContract;
let victor;
let loi;
let mike;
let minCampPeriod = 10; // 160s - equivalent to 10 blocks
let defaultNetworkFee = 25;
let defaultRewardBps = 3000; // 30%
let defaultRebateBps = 2000; // 20%
let minPercentageInPrecision = new BN(precisionUnits).div(new BN(5)); // 20%
// Y = C - t * X
// Example: X = 20%, C = 100%, t = 1
// Y = 100% - 1 * 20% = 80%
let cInPrecision = new BN(precisionUnits); // 100%
let tInPrecision = new BN(precisionUnits); // 1

const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

contract(
  'KyberPoolMaster masterDeposit and masterWithdraw',
  async (accounts) => {
    before('one time init', async () => {
      campCreator = accounts[1];
      kncToken = await TestToken.new('Kyber Network Crystal', 'KNC', 18);
      poolMasterOwner = accounts[2];
      notOwner = accounts[3];
      mike = accounts[4];
      feeHandler = await MockFeeHandler.new();

      await kncToken.transfer(poolMasterOwner, mulPrecision(1000000));
      await kncToken.transfer(notOwner, mulPrecision(1000000));
      await kncToken.transfer(mike, mulPrecision(1000000));

      currentBlock = await Helper.getCurrentBlock();
      currentChainTime = await Helper.getCurrentBlockTime();
      blockTime = 16; // each block is mined after 16s

      epochPeriod = 50;
      startBlock = currentBlock + 20;
      daoStartTime = blockToTimestamp(startBlock);

      stakingContract = await StakingContract.new(
        kncToken.address,
        blocksToSeconds(epochPeriod),
        daoStartTime,
        campCreator
      );

      daoContract = await DAOContract.new(
        blocksToSeconds(epochPeriod),
        daoStartTime,
        stakingContract.address,
        feeHandler.address,
        kncToken.address,
        blocksToSeconds(minCampPeriod),
        defaultNetworkFee,
        defaultRewardBps,
        defaultRebateBps,
        campCreator
      );
      await stakingContract.updateDAOAddressAndRemoveSetter(
        daoContract.address,
        {from: campCreator}
      );

      poolMaster = await KyberPoolMaster.new(
        kncToken.address,
        daoContract.address,
        stakingContract.address,
        feeHandler.address,
        2,
        1,
        {from: poolMasterOwner}
      );

      await kncToken.approve(poolMaster.address, mulPrecision(100), {
        from: poolMasterOwner,
      });

      await poolMaster.masterDeposit(mulPrecision(20), {
        from: poolMasterOwner,
      });

      let link = web3.utils.fromAscii('https://kyberswap.com');
      await updateCurrentBlockAndTimestamp();
      await submitNewCampaignAndDelayToStart(
        daoContract,
        0,
        currentBlock + 2,
        currentBlock + 2 + minCampPeriod,
        minPercentageInPrecision,
        cInPrecision,
        tInPrecision,
        [1, 2, 3, 4],
        link,
        {from: campCreator}
      );
    });

    const blockToTimestamp = function (block) {
      return currentChainTime + (block - currentBlock) * blockTime;
    };

    const blocksToSeconds = function (blocks) {
      return blocks * blockTime;
    };

    // future epoches
    const increaseToEpoch = async (epoch) => {
      const epochStartTime =
        daoStartTime + (epoch - 1) * epochPeriod * blockTime;
      return time.increaseTo(epochStartTime);
    };

    const increaseOneEpoch = async (epoch) => {
      const currentEpoch = await stakingContract.getCurrentEpochNumber();
      return increaseToEpoch(Number(currentEpoch.toString()) + 1);
    };

    const updateCurrentBlockAndTimestamp = async () => {
      currentBlock = await Helper.getCurrentBlock();
      currentTimestamp = await Helper.getCurrentBlockTime();
    };

    const submitNewCampaignAndDelayToStart = async (
      daoContract,
      campaignType,
      startBlock,
      endBlock,
      minPercentageInPrecision,
      cInPrecision,
      tInPrecision,
      options,
      link,
      opt
    ) => {
      await daoContract.submitNewCampaign(
        campaignType,
        blockToTimestamp(startBlock),
        blockToTimestamp(endBlock),
        minPercentageInPrecision,
        cInPrecision,
        tInPrecision,
        options,
        link,
        opt
      );
      await Helper.mineNewBlockAt(blockToTimestamp(startBlock));
    };

    describe('#Vote Tests', () => {
      it('should be able to vote', async function () {
        const currentEpoch = await stakingContract.getCurrentEpochNumber();

        const {tx} = await poolMaster.vote(1, 1, {
          from: poolMasterOwner,
        });

        await expectEvent.inTransaction(tx, daoContract, 'Voted', {
          epoch: currentEpoch.toString(),
          staker: poolMaster.address,
          campaignID: '1',
          option: '1',
        });
      });

      it('non owner should not be able to vote', async function () {
        await expectRevert(
          poolMaster.vote(1, 1, {
            from: notOwner,
          }),
          'Ownable: caller is not the owner'
        );
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
