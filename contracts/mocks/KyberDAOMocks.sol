pragma solidity 0.6.6;

import "./KyberFeeHandlerMocks.sol";

contract KyberDAOHandleCurrentEpoch {
    uint256 internal curEpoch;

    address public kncToken;
    address public staking;
    address public feeHandler;

    constructor(
        address _knc,
        address _staking,
        address _feeHandler
    ) public {
        curEpoch = 0;
        kncToken = _knc;
        staking = _staking;
        feeHandler = _feeHandler;
    }

    function getCurrentEpochNumber() public view returns (uint256) {
        return curEpoch;
    }

    function setCurrentEpochNumber(uint256 _curEpoch) public {
        curEpoch = _curEpoch;
    }
}

contract KyberDAOWithRewardPercentageSetter is KyberDAOHandleCurrentEpoch {
    mapping(address => mapping(uint256 => uint256)) public stakerRewardPercentage;

    constructor(
        address _knc,
        address _staking,
        address _feeHandler
    ) public KyberDAOHandleCurrentEpoch(_knc, _staking, _feeHandler) {}

    function getStakerRewardPercentageInPrecision(address staker, uint256 epoch)
        public
        view
        returns (uint256)
    {
        return stakerRewardPercentage[staker][epoch];
    }

    function setStakerRewardPercentage(
        address staker,
        uint256 epoch,
        uint256 percentage
    ) public {
        stakerRewardPercentage[staker][epoch] = percentage;
    }
}

contract KyberDAOClaimReward is KyberDAOWithRewardPercentageSetter {
    KyberFeeHandlerWithClaimStakerReward public feeHandlerWithClaimStakerReward;

    constructor(
        address _knc,
        address _staking,
        address payable _feeHandler
    ) public KyberDAOWithRewardPercentageSetter(_knc, _staking, _feeHandler) {
        feeHandlerWithClaimStakerReward = KyberFeeHandlerWithClaimStakerReward(_feeHandler);
    }

    function claimReward(address staker, uint256 epoch) external {
        uint256 perInPrecision = getStakerRewardPercentageInPrecision(staker, epoch);

        require(
            feeHandlerWithClaimStakerReward.claimStakerReward(staker, perInPrecision, epoch),
            "claimReward: feeHandle failed to claim"
        );
    }
}
