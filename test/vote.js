const KyberPoolMaster = artifacts.require('KyberPoolMaster');

// Mocks
const TestToken = artifacts.require('Token.sol');
const KyberDAOVote = artifacts.require('KyberDAOVote');
const KyberStakingWithgetStakerDataForEpoch = artifacts.require(
  'KyberStakingWithgetStakerDataForEpoch'
);
const KyberFeeHandlerWithClaimStakerReward = artifacts.require(
  'KyberFeeHandlerWithClaimStakerReward'
);

const {expectRevert, expectEvent, BN} = require('@openzeppelin/test-helpers');
const {precisionUnits, NO_ZERO_ADDRESS} = require('./helper.js');

let poolMasterOwner;
let notOwner;

let poolMaster;
let kncToken;
let kyberStaking;
let kyberDAO;
let mike;

contract('KyberPoolMaster vote', async (accounts) => {
  before('one time init', async () => {
    daoOperator = accounts[1];
    kncToken = await TestToken.new('Kyber Network Crystal', 'KNC', 18);
    poolMasterOwner = accounts[2];
    notOwner = accounts[3];
    mike = accounts[4];

    await kncToken.transfer(poolMasterOwner, mulPrecision(1000000));
    await kncToken.transfer(notOwner, mulPrecision(1000000));
    await kncToken.transfer(mike, mulPrecision(1000000));

    kyberStaking = await KyberStakingWithgetStakerDataForEpoch.new();

    kyberDAO = await KyberDAOVote.new(NO_ZERO_ADDRESS, kyberStaking.address);

    kyberFeeHandler = await KyberFeeHandlerWithClaimStakerReward.new(
      kyberDAO.address
    );

    poolMaster = await KyberPoolMaster.new(
      kyberDAO.address,
      kyberFeeHandler.address,
      2,
      1,
      {
        from: poolMasterOwner,
      }
    );

    await kncToken.approve(poolMaster.address, mulPrecision(100), {
      from: poolMasterOwner,
    });
  });

  describe('#Vote Tests', () => {
    it('should be able to vote', async function () {
      const currentEpoch = await kyberDAO.getCurrentEpochNumber();

      const {tx} = await poolMaster.vote(1, 1, {
        from: poolMasterOwner,
      });

      await expectEvent.inTransaction(tx, kyberDAO, 'Voted', {
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
});

function mulPrecision(value) {
  return precisionUnits.mul(new BN(value));
}
