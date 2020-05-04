pragma solidity 0.6.6;


contract KyberFeeHandlerWithRewardPerEposhSetter {
    mapping(uint256 => uint256) public rewardsPerEpoch;

    constructor() public {}

    function setRewardsPerEpoch(uint256 epoch, uint256 rewards) public {
        rewardsPerEpoch[epoch] = rewards;
    }
}
