pragma solidity 0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./KyberDaoMocks.sol";

contract KyberFeeHandlerWithRewardPerEposhSetter {
    using SafeMath for uint256;

    KyberDaoVote public kyberDao;

    uint256 internal constant PRECISION = (10**18);
    mapping(uint256 => uint256) public rewardsPerEpoch;

    constructor(address _kyberDao) public {
        kyberDao = KyberDaoVote(_kyberDao);
    }

    function setRewardsPerEpoch(uint256 epoch, uint256 rewards) public {
        rewardsPerEpoch[epoch] = rewards;
    }
}

contract KyberFeeHandlerWithClaimStakerReward is KyberFeeHandlerWithRewardPerEposhSetter {
    event Log(string log, address staker, uint256 percentageInPrecision, uint256 epoch, uint256 amount);

    constructor(address _kyberDao) public KyberFeeHandlerWithRewardPerEposhSetter(_kyberDao) {}

    function claimStakerReward(
        address staker,
        uint256 epoch
    ) external returns (bool) {
        uint256 percentageInPrecision = kyberDao.getPastEpochRewardPercentageInPrecision(staker, epoch);
        uint256 amount = rewardsPerEpoch[epoch].mul(percentageInPrecision).div(PRECISION);

        emit Log('Fee handler', staker, percentageInPrecision, epoch, amount);

        (bool success, ) = staker.call{value: amount}("");
        require(success, "staker rewards transfer failed");

        return true;
    }

    receive() external payable {}
}
