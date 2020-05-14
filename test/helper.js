const {BN} = require('@openzeppelin/test-helpers');
const precisionUnits = new BN(10).pow(new BN(18));
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const MAX_DELEGATION_FEE = 10000;

module.exports = {
  precisionUnits,
  ZERO_ADDRESS,
  NO_ZERO_ADDRESS,
  MAX_DELEGATION_FEE,
};
