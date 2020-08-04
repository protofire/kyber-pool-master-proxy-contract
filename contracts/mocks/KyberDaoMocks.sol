pragma solidity 0.6.6;

contract KyberDaoHandleCurrentEpoch {
    uint256 internal curEpoch;

    address public kncToken;
    address public staking;

    constructor(
        address _knc,
        address _staking
    ) public {
        curEpoch = 0;
        kncToken = _knc;
        staking = _staking;
    }

    function getCurrentEpochNumber() public view returns (uint256) {
        return curEpoch;
    }

    function setCurrentEpochNumber(uint256 _curEpoch) public {
        curEpoch = _curEpoch;
    }
}

contract KyberDaoWithRewardPercentageSetter is KyberDaoHandleCurrentEpoch {
    mapping(address => mapping(uint256 => uint256)) public stakerRewardPercentage;

    constructor(
        address _knc,
        address _staking

    ) public KyberDaoHandleCurrentEpoch(_knc, _staking) {}

    function getPastEpochRewardPercentageInPrecision(address staker, uint256 epoch)
        public
        view
        returns (uint256)
    {
        if (epoch == getCurrentEpochNumber()) {
            return 0;
        }

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

contract KyberDaoVote is KyberDaoWithRewardPercentageSetter {
    event Voted(address indexed staker, uint indexed epoch, uint indexed campaignID, uint option);

    constructor(
        address _knc,
        address _staking
    ) public KyberDaoWithRewardPercentageSetter(_knc, _staking) {
    }

    function vote(uint256 campaignID, uint256 option) external {
        address staker = msg.sender;
        emit Voted(staker, curEpoch, campaignID, option);
    }
}
