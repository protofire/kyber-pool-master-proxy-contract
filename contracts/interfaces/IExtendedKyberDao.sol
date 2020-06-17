pragma solidity 0.6.6;

import "./IKyberDao.sol";


interface IExtendedKyberDao is IKyberDao {
    function kncToken() external view returns (address);

    function staking() external view returns (address);

    function feeHandler() external view returns (address);
}
