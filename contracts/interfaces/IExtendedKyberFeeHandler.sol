pragma solidity 0.6.6;

import "smart-contracts/contracts/sol6//IKyberFeeHandler.sol";


interface IExtendedKyberFeeHandler is IKyberFeeHandler {
    function rewardsPerEpoch(uint256) external view returns (uint256);
}
