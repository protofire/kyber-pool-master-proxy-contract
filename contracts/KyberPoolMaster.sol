pragma solidity 0.5.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/KyberDAO.sol";
import "./lib/KyberStaking.sol";
import "./lib/KyberFeeHandler.sol";


/**
 * @title Kayber PoolMaster contract
 * @author Protofire
 */
contract KyberPoolMaster is Ownable {
    using SafeMath for uint256;

    uint256 constant MINIMUM_EPOCH_NOTICE = 1;

    // Number of epochs after which a change on deledatioFee is will be applied
    uint256 public epochNotice;

    // Mapping of if staker has claimed reward for Epoch
    mapping(uint256 => mapping(address => bool)) public claimedDelegateReward;

    // Mapping of if poolMaster has claimed reward for an epoch for the pool
    mapping(uint256 => bool) public claimedPoolReward;

    // Fee charged by poolMasters to poolMembers for services
    // Denominated in 1e4 units
    // 100 = 1%
    uint256 public delegationFee;

    // Amount of rewards owed to poolMembers for an epoch
    mapping(uint256 => uint256) public memberRewards;

    IERC20 public kncToken;
    KyberDAO public kyberDAO;
    KyberStaking public kyberStaking;
    KyberFeeHandler public kyberFeeHandler;

    /*** Events ***/
    event CommitNewFees(uint256 deadline, uint256 fee_rate);
    event NewFees(uint256 fee_rate);
    event MemberClaimReward(address indexed poolMember, uint256 reward, uint256 indexed epoch);
    event MasterClaimReward(
        address poolMaster,
        uint256 reward,
        uint256 fees,
        uint256 epoch
    );

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

        kncToken = IERC20(_kncToken);
        kyberDAO = KyberDAO(_kyberDAO);
        kyberStaking = KyberStaking(_kyberStaking);
        kyberFeeHandler = KyberFeeHandler(_kyberFeeHandler);
        epochNotice = _epochNotice;
        delegationFee = _delegationFee;
    }

    function() external payable {
        // to get ether from KayberDAO
    }
}
