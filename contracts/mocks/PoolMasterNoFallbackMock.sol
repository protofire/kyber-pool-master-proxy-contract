pragma solidity 0.6.6;

import '../KyberPoolMaster.sol';

contract PoolMasterNoFallbackMock {
    KyberPoolMaster internal poolMaster;

    constructor(address payable _poolMaster) public payable {
        poolMaster = KyberPoolMaster(_poolMaster);
    }

    function transferPoolMasterOwnership(address owner) public {
        poolMaster.transferOwnership(owner);
    }
}
