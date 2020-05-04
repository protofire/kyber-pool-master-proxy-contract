pragma solidity 0.6.6;

import "../KyberPoolMaster.sol";


contract KyberPoolMasterWithClaimedPoolRewardSetter is KyberPoolMaster {
    constructor(
        address _kncToken,
        address _kyberDAO,
        address _kyberStaking,
        address _kyberFeeHandler,
        uint256 _epochNotice,
        uint256 _delegationFee
    )
        public
        KyberPoolMaster(
            _kncToken,
            _kyberDAO,
            _kyberStaking,
            _kyberFeeHandler,
            _epochNotice,
            _delegationFee
        )
    {}

    function setClaimedPoolReward(uint256 epoch) public {
        claimedPoolReward[epoch] = true;
    }
}
