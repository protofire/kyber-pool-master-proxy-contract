pragma solidity 0.6.6;

import "smart-contracts/contracts/sol6/IKyberDAO.sol";


interface IExtendedKyberDAO is IKyberDAO {
    function getCurrentEpochNumber() external view returns (uint256);

    function getStakerRewardPercentageInPrecision(address staker, uint256 epoch)
        external
        view
        returns (uint256);

    function kncToken() external view returns (address);

    function staking() external view returns (address);

    function feeHandler() external view returns (address);
}
