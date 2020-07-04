pragma solidity 0.6.6;

import "../KyberPoolMaster.sol";


contract KyberPoolMasterWithSetters is KyberPoolMaster {
    constructor(
        address _kyberDao,
        uint256 _epochNotice,
        uint256 _delegationFee,
        address[] memory _kyberFeeHandlers,
        IERC20[] memory _rewardTokens
    )
        public
        payable
        KyberPoolMaster(
            _kyberDao,
            _epochNotice,
            _delegationFee,
            _kyberFeeHandlers,
            _rewardTokens
        )
    {}

    function setClaimedPoolReward(uint256 _epoch, address _feeHandler) public {
        claimedPoolReward[_epoch][_feeHandler] = true;
    }

    function setClaimedDelegateReward(uint256 _epoch, address _member, address _feeHandler) public {
        claimedDelegateReward[_epoch][_member][_feeHandler] = true;
    }

    function setMemberRewards(uint256 _epoch, address _feeHandler, uint256 _totalRewards, uint256 _totalStaked) public {
        memberRewards[_epoch][_feeHandler] = Reward(_totalRewards, _totalStaked);
    }
}
