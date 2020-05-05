pragma solidity 0.6.6;

import "smart-contracts/contracts/sol6/IKyberDAO.sol";


interface IExtendedKyberDAO is IKyberDAO {
    function getCurrentEpochNumber() external view returns (uint256);
}
