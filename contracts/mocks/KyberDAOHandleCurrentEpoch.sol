pragma solidity 0.6.6;


contract KyberDAOHandleCurrentEpoch {
    uint256 internal curEpoch;

    constructor() public {
        curEpoch = 0;
    }

    function getCurrentEpochNumber() public view returns (uint256) {
        return curEpoch;
    }

    function setCurrentEpochNumber(uint256 _curEpoch) public {
        curEpoch = _curEpoch;
    }
}
