pragma solidity 0.6.6;

import "./KyberFeeHandlerMocks.sol";

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

contract KyberDAOWithRewardPercentageSetter is KyberDAOHandleCurrentEpoch {
    mapping(address => mapping(uint256 => uint256)) public stakerRewardPercentage;

    constructor() public KyberDAOHandleCurrentEpoch() {}

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
    KyberFeeHandlerWithClaimStakerReward public feeHandler;

    constructor(address payable _kyberFeeHandler) public KyberDAOWithRewardPercentageSetter() {
        feeHandler = KyberFeeHandlerWithClaimStakerReward(_kyberFeeHandler);
    }

    function claimReward(address staker, uint256 epoch) external {
        uint256 perInPrecision = getStakerRewardPercentageInPrecision(staker, epoch);

        require(
            feeHandler.claimStakerReward(staker, perInPrecision, epoch),
            "claimReward: feeHandle failed to claim"
        );
    }
}
