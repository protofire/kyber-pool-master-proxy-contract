pragma solidity 0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
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

    mapping(address => mapping (uint256 => bool)) public hasClaimedReward;

    constructor(address _kyberDao) public KyberFeeHandlerWithRewardPerEposhSetter(_kyberDao) {}

    function claimStakerReward(
        address staker,
        uint256 epoch
    ) external returns(uint256 amountWei) {
        if (hasClaimedReward[staker][epoch]) {
            // staker has already claimed reward for the epoch
            return 0;
        }

        uint256 percentageInPrecision = kyberDao.getPastEpochRewardPercentageInPrecision(staker, epoch);
        amountWei = rewardsPerEpoch[epoch].mul(percentageInPrecision).div(PRECISION);

        emit Log('Fee handler', staker, percentageInPrecision, epoch, amountWei);

        (bool success, ) = staker.call{value: amountWei}("");
        require(success, "staker rewards transfer failed");

        hasClaimedReward[staker][epoch] = true;
    }

    receive() external payable {}
}

contract KyberFeeHandlerWithClaimStakerRewardERC20 is KyberFeeHandlerWithRewardPerEposhSetter {
    event Log(string log, address staker, uint256 percentageInPrecision, uint256 epoch, uint256 amount);
    mapping(address => mapping (uint256 => bool)) public hasClaimedReward;
    IERC20 rewardToken;

    constructor(address _kyberDao, IERC20 _rewardToken) public KyberFeeHandlerWithRewardPerEposhSetter(_kyberDao) {
        rewardToken = _rewardToken;
    }

    function claimStakerReward(
        address staker,
        uint256 epoch
    ) external returns(uint256 amountWei) {
        if (hasClaimedReward[staker][epoch]) {
            // staker has already claimed reward for the epoch
            return 0;
        }

        uint256 percentageInPrecision = kyberDao.getPastEpochRewardPercentageInPrecision(staker, epoch);
        amountWei = rewardsPerEpoch[epoch].mul(percentageInPrecision).div(PRECISION);

        emit Log('Fee handler', staker, percentageInPrecision, epoch, amountWei);

        SafeERC20.safeTransfer(rewardToken, staker, amountWei);

        hasClaimedReward[staker][epoch] = true;
    }

    receive() external payable {}
}
