pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IExtendedKyberDAO.sol";
import "./interfaces/IExtendedKyberFeeHandler.sol";
import "./interfaces/IKyberStaking.sol";


/**
 * @title Kyber PoolMaster contract
 * @author Protofire
 * @dev Contract that allows pool masters to let pool members claim their designated rewards trustlessly and update fees
 *      with sufficient notice times while maintaining full trustlessness.
 */
contract KyberPoolMaster is Ownable {
    using SafeMath for uint256;

    uint256 internal constant MINIMUM_EPOCH_NOTICE = 1;
    uint256 internal constant MAX_DELEGATION_FEE = 10000;
    uint256 internal constant PRECISION = (10**18);

    // Number of epochs after which a change on delegationFee is will be applied
    uint256 public epochNotice;

    // Mapping of if staker has claimed reward for Epoch
    mapping(uint256 => mapping(address => bool)) public claimedDelegateReward;

    // Mapping of if poolMaster has claimed reward for an epoch for the pool
    mapping(uint256 => bool) public claimedPoolReward;

    // Amount of rewards owed to poolMembers for an epoch
    struct Reward {
        uint256 totalRewards;
        uint256 totalStaked;
    }
    mapping(uint256 => Reward) public memberRewards;

    // Fee charged by poolMasters to poolMembers for services
    // Denominated in 1e4 units
    // 100 = 1%
    struct DFeeData {
        uint256 fromEpoch;
        uint256 fee;
        bool applied;
    }

    DFeeData[] public delegationFees;

    IERC20 public kncToken;
    IExtendedKyberDAO public kyberDAO;
    IKyberStaking public kyberStaking;
    IExtendedKyberFeeHandler public kyberFeeHandler;

    /*** Events ***/
    event CommitNewFees(uint256 deadline, uint256 feeRate);
    event NewFees(uint256 fromEpoch, uint256 feeRate);
    event MemberClaimReward(
        uint256 indexed epoch,
        address indexed poolMember,
        uint256 reward
    );
    event MasterClaimReward(
        uint256 indexed epoch,
        address indexed poolMaster,
        uint256 totalRewards,
        uint256 feeApplied,
        uint256 feeAmount,
        uint256 poolMasterShare
    );

    /**
     * @notice Address deploying this contract should be able to receive ETH, owner can be changed using transferOwnership method
     * @param _kyberDAO KyberDAO contract address
     * @param _epochNotice Number of epochs after which a change on deledatioFee is will be applied
     * @param _delegationFee Fee charged by poolMasters to poolMembers for services - Denominated in 1e4 units - 100 = 1%
     */
    constructor(
        address _kyberDAO,
        uint256 _epochNotice,
        uint256 _delegationFee
    ) public {
        require(_kyberDAO != address(0), "ctor: kyberDAO is missing");
        require(
            _epochNotice >= MINIMUM_EPOCH_NOTICE,
            "ctor: Epoch Notice too low"
        );
        require(
            _delegationFee <= MAX_DELEGATION_FEE,
            "ctor: Delegation Fee greater than 100%"
        );

        kyberDAO = IExtendedKyberDAO(_kyberDAO);

        kncToken = IERC20(kyberDAO.kncToken());
        kyberStaking = IKyberStaking(kyberDAO.staking());
        kyberFeeHandler = IExtendedKyberFeeHandler(kyberDAO.feeHandler());

        epochNotice = _epochNotice;

        uint256 currEpoch = kyberDAO.getCurrentEpochNumber();

        delegationFees.push(DFeeData(currEpoch, _delegationFee, true));

        emit CommitNewFees(currEpoch, _delegationFee);
        emit NewFees(currEpoch, _delegationFee);
    }

    /**
     * @dev call to stake more KNC for poolMaster
     * @param amount amount of KNC to stake
     */
    function masterDeposit(uint256 amount) external onlyOwner {
        require(
            amount > 0,
            "masterDeposit: amount to deposit should be positive"
        );

        require(
            kncToken.transferFrom(msg.sender, address(this), amount),
            "masterDeposit: can not get token"
        );

        // approve
        kncToken.approve(address(kyberStaking), amount);

        // deposit in KyberStaking
        kyberStaking.deposit(amount);
    }

    /**
     * @dev call to withdraw KNC from staking
     * @param amount amount of KNC to withdraw
     */
    function masterWithdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "masterWithdraw: amount is 0");

        // withdraw from KyberStaking
        kyberStaking.withdraw(amount);

        // transfer KNC back to pool master
        require(
            kncToken.transfer(msg.sender, amount),
            "masterWithdraw: can not transfer knc to the pool master"
        );
    }

    /**
     * @dev  vote for an option of a campaign
     *       options are indexed from 1 to number of options
     * @param campaignID id of campaign to vote for
     * @param option id of options to vote for
     */
    function vote(uint256 campaignID, uint256 option) external onlyOwner {
        kyberDAO.vote(campaignID, option);
    }

    /**
     * @dev  set a new delegation fee to be applied in current epoch + epochNotice
     * @param _fee new fee
     */
    function commitNewFee(uint256 _fee) external onlyOwner {
        require(
            _fee <= MAX_DELEGATION_FEE,
            "commitNewFee: Delegation Fee greater than 100%"
        );

        uint256 curEpoch = kyberDAO.getCurrentEpochNumber();
        uint256 fromEpoch = curEpoch.add(epochNotice);

        DFeeData storage lastFee = delegationFees[delegationFees.length - 1];

        if (lastFee.fromEpoch > curEpoch) {
            lastFee.fromEpoch = fromEpoch;
            lastFee.fee = _fee;
        } else {
            if (!lastFee.applied) {
                applyFee(lastFee);
            }

            delegationFees.push(DFeeData(fromEpoch, _fee, false));
        }
        emit CommitNewFees(fromEpoch.sub(1), _fee);
    }

    /**
     * @dev Applies the pending new fee
     */
    function applyPendingFee() public {
        DFeeData storage lastFee = delegationFees[delegationFees.length - 1];
        uint256 curEpoch = kyberDAO.getCurrentEpochNumber();

        if (lastFee.fromEpoch <= curEpoch && !lastFee.applied) {
            applyFee(lastFee);
        }
    }

    /**
     * @dev Applies a pending fee
     * @param fee to be applied
     */
    function applyFee(DFeeData storage fee) internal {
        fee.applied = true;
        emit NewFees(fee.fromEpoch, fee.fee);
    }

    /**
     * @dev Gets the id of the delegation fee corresponding to the given epoch
     * @param epoch for which epoch is querying delegation fee
     */
    function getEpochDFeeDataId(uint256 epoch)
        internal
        view
        returns (uint256 dFeeDataId)
    {
        for (
            dFeeDataId = delegationFees.length - 1;
            dFeeDataId > 0;
            dFeeDataId--
        ) {
            DFeeData memory dFeeData = delegationFees[dFeeDataId];
            if (dFeeData.fromEpoch <= epoch) {
                break;
            }
        }
    }

    /**
     * @dev Gets the the delegation fee data corresponding to the given epoch
     * @param epoch for which epoch is querying delegation fee
     */
    function getEpochDFeeData(uint256 epoch)
        public
        view
        returns (
            uint256 fromEpoch,
            uint256 fee,
            bool applied
        )
    {
        DFeeData memory epochDFee = delegationFees[getEpochDFeeDataId(epoch)];
        fromEpoch = epochDFee.fromEpoch;
        fee = epochDFee.fee;
        applied = epochDFee.applied;
    }

    /**
     * @dev Gets the the delegation fee data corresponding to the current epoch
     */
    function delegationFee()
        public
        view
        returns (
            uint256 fromEpoch,
            uint256 fee,
            bool applied
        )
    {
        uint256 curEpoch = kyberDAO.getCurrentEpochNumber();
        return getEpochDFeeData(curEpoch);
    }

    /**
     * @dev  Queries the amount of unclaimed rewards for the pool
     *       return 0 if PoolMaster has calledRewardMaster
     *       return 0 if staker's reward percentage in precision for the epoch is 0
     *       return 0 if total reward for the epoch is 0
     * @param epoch for which epoch is querying unclaimed reward
     */
    function getUnclaimedRewards(uint256 epoch) public view returns (uint256) {
        if (claimedPoolReward[epoch]) {
            return 0;
        }

        uint256 perInPrecision = kyberDAO.getStakerRewardPercentageInPrecision(
            address(this),
            epoch
        );
        if (perInPrecision == 0) {
            return 0;
        }

        uint256 rewardsPerEpoch = kyberFeeHandler.rewardsPerEpoch(epoch);
        if (rewardsPerEpoch == 0) {
            return 0;
        }

        uint256 unclaimed = rewardsPerEpoch.mul(perInPrecision).div(PRECISION);

        return unclaimed;
    }

    /**
     * @dev  Claims rewards and distribute fees and its share to poolMaster
     * @param epoch for which rewards are being claimed
     */
    function claimRewardsMaster(uint256 epoch) public {
        require(!claimedPoolReward[epoch], "cRMaster: rewards already claimed");

        uint256 unclaimed = getUnclaimedRewards(epoch);

        require(unclaimed > 0, "cRMaster: no rewards to claim");

        uint256 initialBalance = address(this).balance;

        kyberDAO.claimReward(address(this), epoch);

        uint256 totalRewards = address(this).balance.sub(initialBalance);

        (uint256 stake, uint256 delegatedStake, ) = kyberStaking
            .getStakerDataForPastEpoch(address(this), epoch);

        DFeeData storage epochDFee = delegationFees[getEpochDFeeDataId(epoch)];

        uint256 totalFee = totalRewards.mul(epochDFee.fee).div(
            MAX_DELEGATION_FEE
        );
        uint256 rewardsAfterFee = totalRewards.sub(totalFee);

        uint256 poolMembersShare = calculateRewardsShare(
            delegatedStake,
            stake.add(delegatedStake),
            rewardsAfterFee
        );
        uint256 poolMasterShare = totalRewards.sub(poolMembersShare); // fee + poolMaster stake share

        claimedPoolReward[epoch] = true;
        memberRewards[epoch] = Reward(poolMembersShare, delegatedStake);

        // distribute poolMasterRewards to poolMaster
        address payable poolMaster = payable(owner());
        require(
            poolMaster.send(poolMasterShare),
            "cRMaste: poolMaster share transfer failed"
        );

        if (!epochDFee.applied) {
            applyFee(epochDFee);
        }

        emit MasterClaimReward(
            epoch,
            poolMaster,
            totalRewards,
            epochDFee.fee,
            totalFee,
            poolMasterShare.sub(totalFee)
        );
    }

    /**
     * @dev  Queries the amount of unclaimed rewards for the pool member
     *       return 0 if PoolMaster has not called claimRewardMaster
     *       return 0 if PoolMember has previously claimed reward for the epoch
     *       return 0 if PoolMember has not stake for the epoch
     *       return 0 if PoolMember has not delegated it stake to this contract for the epoch
     * @param poolMember address of pool member
     * @param epoch for which epoch the member is querying unclaimed reward
     */
    function getUnclaimedRewardsMember(address poolMember, uint256 epoch)
        public
        view
        returns (uint256)
    {
        if (!claimedPoolReward[epoch]) {
            return 0;
        }

        if (claimedDelegateReward[epoch][poolMember]) {
            return 0;
        }

        (uint256 stake, , address delegatedAddr) = kyberStaking
            .getStakerDataForPastEpoch(poolMember, epoch);

        if (stake == 0) {
            return 0;
        }

        if (delegatedAddr != address(this)) {
            return 0;
        }

        Reward memory rewardForEpoch = memberRewards[epoch];

        return
            calculateRewardsShare(
                stake,
                rewardForEpoch.totalStaked,
                rewardForEpoch.totalRewards
            );
    }

    /**
     * @dev Claims rewards for poolMember that has not claimed for an epoch previously
     *      and the poolMaster has claimed rewards for the pool.
     *      This contract will keep locked remainings from rounding at a wei level.
     * @param epoch for which rewards are being claimed
     */
    function claimRewardMember(uint256 epoch) public {
        require(
            claimedPoolReward[epoch],
            "cRMember: poolMaster has not claimed yet"
        );

        address poolMember = msg.sender;

        require(
            !claimedDelegateReward[epoch][poolMember],
            "cRMember: rewards already claimed"
        );

        uint256 poolMemberShare = getUnclaimedRewardsMember(poolMember, epoch);

        require(poolMemberShare > 0, "cRMember: no rewards to claim");

        claimedDelegateReward[epoch][poolMember] = true;

        // distribute poolMember rewards share
        require(
            payable(poolMember).send(poolMemberShare),
            "cRMember: poolMember share transfer failed"
        );

        emit MemberClaimReward(epoch, poolMember, poolMemberShare);
    }

    // Utils

    /**
     * @dev Calculates rewards share based on the stake over the total stake
     */
    function calculateRewardsShare(
        uint256 stake,
        uint256 totalStake,
        uint256 rewards
    ) internal pure returns (uint256) {
        return stake.mul(rewards).div(totalStake);
    }

    /**
     * @dev Queries the number of elements in delegationFees
     */
    function delegationFeesLength() public view returns (uint256) {
        return delegationFees.length;
    }

    /**
     * @dev Transfers the total amount of a given ERC20 deposited in this contracto a given address
     * @param _token ERC20 token address
     * @param _to address of the receiver
     */
    function claimErc20Tokens(address _token, address _to) external onlyOwner {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        SafeERC20.safeTransfer(token, _to, balance);
    }

    /**
     * @dev Enables the contract to receive ETH
     */
    receive() external payable {
        require(
            msg.sender == address(kyberFeeHandler),
            "only accept ETH from Kyber"
        );
    }
}
