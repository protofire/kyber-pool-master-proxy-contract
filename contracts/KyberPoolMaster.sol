pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IExtendedKyberDAO.sol";

import "smart-contracts/contracts/sol6/Dao/IKyberStaking.sol";
import "smart-contracts/contracts/sol6//IKyberFeeHandler.sol";


/**
 * @title Kayber PoolMaster contract
 * @author Protofire
 */
contract KyberPoolMaster is Ownable {
    using SafeMath for uint256;

    uint256 internal constant MINIMUM_EPOCH_NOTICE = 1;
    uint256 internal constant MAX_DELEGATION_FEE = 10000;

    // Number of epochs after which a change on deledatioFee is will be applied
    uint256 public epochNotice;

    // Mapping of if staker has claimed reward for Epoch
    mapping(uint256 => mapping(address => bool)) public claimedDelegateReward;

    // Mapping of if poolMaster has claimed reward for an epoch for the pool
    mapping(uint256 => bool) public claimedPoolReward;

    // Fee charged by poolMasters to poolMembers for services
    // Denominated in 1e4 units
    // 100 = 1%
    struct DFeeData {
        uint256 fromEpoch;
        uint256 fee;
        bool applied;
    }

    DFeeData[] public delegationFees;

    // Amount of rewards owed to poolMembers for an epoch
    mapping(uint256 => uint256) public memberRewards;

    IERC20 public kncToken;
    IExtendedKyberDAO public kyberDAO;
    IKyberStaking public kyberStaking;
    IKyberFeeHandler public kyberFeeHandler;

    /*** Events ***/
    event CommitNewFees(uint256 deadline, uint256 feeRate);
    event NewFees(uint256 feeRate);
    event MemberClaimReward(
        address indexed poolMember,
        uint256 reward,
        uint256 indexed epoch
    );
    event MasterClaimReward(
        address indexed poolMaster,
        uint256 reward,
        uint256 fees,
        uint256 indexed epoch
    );

    /**
     * @param _kncToken KNC Token address
     * @param _kyberDAO KyberDAO contract address
     * @param _kyberStaking KyberStaking contract address
     * @param _kyberFeeHandler KyberFeeHandler contract address
     * @param _epochNotice Number of epochs after which a change on deledatioFee is will be applied
     * @param _delegationFee Fee charged by poolMasters to poolMembers for services - Denominated in 1e4 units - 100 = 1%
     */
    constructor(
        address _kncToken,
        address _kyberDAO,
        address _kyberStaking,
        address _kyberFeeHandler,
        uint256 _epochNotice,
        uint256 _delegationFee
    ) public {
        require(_kncToken != address(0), "ctor: kncToken is missing");
        require(_kyberDAO != address(0), "ctor: kyberDAO is missing");
        require(_kyberStaking != address(0), "ctor: kyberStaking is missing");
        require(
            _kyberFeeHandler != address(0),
            "ctor: kyberFeeHandler is missing"
        );
        require(
            _epochNotice >= MINIMUM_EPOCH_NOTICE,
            "ctor: Epoch Notice too low"
        );
        require(
            _delegationFee <= MAX_DELEGATION_FEE,
            "ctor: Delegation Fee greater than 100%"
        );

        kncToken = IERC20(_kncToken);
        kyberDAO = IExtendedKyberDAO(_kyberDAO);
        kyberStaking = IKyberStaking(_kyberStaking);
        kyberFeeHandler = IKyberFeeHandler(_kyberFeeHandler);
        epochNotice = _epochNotice;
        delegationFees.push(DFeeData(0, _delegationFee, true));
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

    // TODO - validate business logic
    function commitNewFee(uint256 _fee) external onlyOwner {
        require(
            _fee <= MAX_DELEGATION_FEE,
            "commitNewFee: Delegation Fee greater than 100%"
        );

        uint256 curEpoch = kyberDAO.getCurrentEpochNumber();

        // epoch, fee, aplied
        DFeeData storage lastFee = delegationFees[delegationFees.length - 1];

        if (lastFee.fromEpoch > curEpoch) {
            // is pending
            lastFee.fromEpoch = curEpoch.add(epochNotice);
            lastFee.fee = _fee;
        } else {
            if (lastFee.applied == false) {
                lastFee.applied = true;
                emit NewFees(lastFee.fee);
            }
            delegationFees.push(
                DFeeData(curEpoch.add(epochNotice), _fee, false)
            );
        }
        emit CommitNewFees(curEpoch.add(epochNotice).sub(1), _fee);
    }

    function getEpochDFeeDataId(uint256 epoch)
        public
        returns (uint256 dFeeDataId)
    {
        if (epoch == 0) {
            dFeeDataId = 0;
        } else {
            for (uint256 i = delegationFees.length - 1; i > 0; i--) {
                DFeeData memory dFeeData = delegationFees[i];
                if (dFeeData.fromEpoch <= epoch) {
                    dFeeDataId = i;
                    break;
                }
            }
        }
    }

    receive() external payable {}
}
