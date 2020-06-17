pragma solidity 0.6.6;

import "../KyberPoolMaster.sol";


contract KyberPoolMasterWithSetters is KyberPoolMaster {
    constructor(
        address _kyberDao,
        address _kyberFeeHandler,
        uint256 _epochNotice,
        uint256 _delegationFee
    )
        public
        payable
        KyberPoolMaster(
            _kyberDao,
            _kyberFeeHandler,
            _epochNotice,
            _delegationFee
        )
    {}

    function setClaimedPoolReward(uint256 epoch) public {
        claimedPoolReward[epoch] = true;
    }

    function setClaimedDelegateReward(uint256 epoch, address member) public {
        claimedDelegateReward[epoch][member] = true;
    }

    function setMemberRewards(uint256 epoch, uint256 totalRewards, uint256 totalStaked) public {
        memberRewards[epoch] = Reward(totalRewards, totalStaked);
    }
}
