pragma solidity 0.6.6;

import "./KyberDAOHandleCurrentEpoch.sol";


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
