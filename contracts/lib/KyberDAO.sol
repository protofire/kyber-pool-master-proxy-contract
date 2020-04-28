pragma solidity 0.5.15;

contract KyberDAO  {
    function claimReward(address staker, uint256 epoch) external;

    function getStakerRewardPercentageInPrecision(address staker, uint256 epoch)
        public
        view
        returns (uint256);

    function vote(uint256 campaignID, uint256 option) external;
}
