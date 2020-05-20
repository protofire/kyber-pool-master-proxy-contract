pragma solidity 0.6.6;

import "./IKyberFeeHandler.sol";


interface IExtendedKyberFeeHandler is IKyberFeeHandler {
    function rewardsPerEpoch(uint256) external view returns (uint256);
}
