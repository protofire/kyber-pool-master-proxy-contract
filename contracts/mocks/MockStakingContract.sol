
// File: contracts/sol6/IERC20.sol

pragma solidity 0.6.6;


interface IERC20 {
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    function approve(address _spender, uint256 _value) external returns (bool success);

    function transfer(address _to, uint256 _value) external returns (bool success);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool success);

    function allowance(address _owner, address _spender) external view returns (uint256 remaining);

    function balanceOf(address _owner) external view returns (uint256 balance);

    function decimals() external view returns (uint8 digits);

    function totalSupply() external view returns (uint256 supply);
}


// to support backward compatible contract name -- so function signature remains same
abstract contract ERC20 is IERC20 {

}

// File: contracts/sol6/utils/zeppelin/ReentrancyGuard.sol

pragma solidity 0.6.6;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
contract ReentrancyGuard {
    bool private _notEntered;

    constructor () internal {
        // Storing an initial non-zero value makes deployment a bit more
        // expensive, but in exchange the refund on every call to nonReentrant
        // will be lower in amount. Since refunds are capped to a percetange of
        // the total transaction's gas, it is best to keep them low in cases
        // like this one, to increase the likelihood of the full refund coming
        // into effect.
        _notEntered = true;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_notEntered, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _notEntered = false;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _notEntered = true;
    }
}

// File: contracts/sol6/Dao/IEpochUtils.sol

pragma solidity 0.6.6;

interface IEpochUtils {
    function epochPeriodInSeconds() external view returns (uint256);

    function firstEpochStartTimestamp() external view returns (uint256);
}

// File: contracts/sol6/Dao/IKyberStaking.sol

pragma solidity 0.6.6;



interface IKyberStaking is IEpochUtils {
    event Delegated(
        address indexed staker,
        address indexed delegatedAddress,
        uint256 indexed epoch,
        bool isDelegated
    );
    event Deposited(uint256 curEpoch, address indexed staker, uint256 amount);
    event Withdraw(uint256 indexed curEpoch, address indexed staker, uint256 amount);

    function initAndReturnStakerDataForCurrentEpoch(address staker)
        external
        returns (
            uint256 _stake,
            uint256 _delegatedStake,
            address _delegatedAddress
        );

    function deposit(uint256 amount) external;

    function delegate(address dAddr) external;

    function withdraw(uint256 amount) external;

    function getStakerDataForPastEpoch(address staker, uint256 epoch)
        external
        view
        returns (
            uint256 _stake,
            uint256 _delegatedStake,
            address _delegatedAddress
        );
}

// File: contracts/sol6/IKyberDAO.sol

pragma solidity 0.6.6;



interface IKyberDAO is IEpochUtils {
    event Voted(address indexed staker, uint indexed epoch, uint indexed campaignID, uint option);
    event RewardClaimed(address indexed staker, uint256 indexed epoch, uint256 percentInPrecision);

    function claimReward(address staker, uint256 epoch) external;

    function getLatestNetworkFeeDataWithCache()
        external
        returns (uint256 feeInBps, uint256 expiryTimestamp);

    function getLatestBRRDataWithCache()
        external
        returns (
            uint256 burnInBps,
            uint256 rewardInBps,
            uint256 rebateInBps,
            uint256 epoch,
            uint256 expiryTimestamp
        );

    function handleWithdrawal(address staker, uint256 penaltyAmount) external;

    function vote(uint256 campaignID, uint256 option) external;

    function getLatestNetworkFeeData()
        external
        view
        returns (uint256 feeInBps, uint256 expiryTimestamp);

    function shouldBurnRewardForEpoch(uint256 epoch) external view returns (bool);
}

// File: contracts/sol6/utils/zeppelin/SafeMath.sol

pragma solidity 0.6.6;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

// File: contracts/sol6/Dao/EpochUtils.sol

pragma solidity 0.6.6;



contract EpochUtils is IEpochUtils {
    using SafeMath for uint256;

    uint256 public override epochPeriodInSeconds;
    uint256 public override firstEpochStartTimestamp;

    function getCurrentEpochNumber() public view returns (uint256) {
        return getEpochNumber(now);
    }

    function getEpochNumber(uint256 timestamp) public view returns (uint256) {
        if (timestamp < firstEpochStartTimestamp || epochPeriodInSeconds == 0) {
            return 0;
        }
        // ((timestamp - firstEpochStartTimestamp) / epochPeriodInSeconds) + 1;
        return ((timestamp.sub(firstEpochStartTimestamp)).div(epochPeriodInSeconds)).add(1);
    }
}

// File: contracts/sol6/Dao/KyberStaking.sol

pragma solidity 0.6.6;







/**
 * @notice   This contract is using SafeMath for uint, which is inherited from EpochUtils
 *           Some events are moved to interface, easier for public uses
 */
contract KyberStaking is IKyberStaking, EpochUtils, ReentrancyGuard {
    struct StakerData {
        uint256 stake;
        uint256 delegatedStake;
        address delegatedAddress;
    }

    IERC20 public kncToken;
    IKyberDAO public daoContract;
    address public daoContractSetter;

    // staker data per epoch
    mapping(uint256 => mapping(address => StakerData)) internal stakerPerEpochData;
    // latest data of a staker, including stake, delegated stake, delegated address
    mapping(address => StakerData) internal stakerLatestData;
    // true/false: if we have inited data at an epoch for a staker
    mapping(uint256 => mapping(address => bool)) internal hasInited;

    event DAOAddressSet(address _daoAddress);
    event DAOContractSetterRemoved();
    // event is fired if something is wrong with withdrawal
    // even though the withdrawal is still successful
    event WithdrawDataUpdateFailed(uint256 curEpoch, address staker, uint256 amount);

    constructor(
        address _kncToken,
        uint256 _epochPeriod,
        uint256 _startTimestamp,
        address _daoContractSetter
    ) public {
        require(_epochPeriod > 0, "ctor: epoch period is 0");
        require(_startTimestamp >= now, "ctor: start in the past");
        require(_kncToken != address(0), "ctor: kncToken 0");
        require(_daoContractSetter != address(0), "ctor: daoContractSetter 0");

        epochPeriodInSeconds = _epochPeriod;
        firstEpochStartTimestamp = _startTimestamp;
        kncToken = IERC20(_kncToken);
        daoContractSetter = _daoContractSetter;
    }

    modifier onlyDAOContractSetter() {
        require(msg.sender == daoContractSetter, "only daoContractSetter");
        _;
    }

    /**
     * @dev update DAO address and set daoSetter to zero address, can only call once
     * @param _daoAddress address of new DAO
     */
    function updateDAOAddressAndRemoveSetter(address _daoAddress) external onlyDAOContractSetter {
        require(_daoAddress != address(0), "updateDAO: daoAddress 0");

        daoContract = IKyberDAO(_daoAddress);
        // verify the same epoch period + start timestamp
        require(
            daoContract.epochPeriodInSeconds() == epochPeriodInSeconds,
            "updateDAO: different epoch period"
        );
        require(
            daoContract.firstEpochStartTimestamp() == firstEpochStartTimestamp,
            "updateDAO: different start timestamp"
        );

        emit DAOAddressSet(_daoAddress);

        // reset dao contract setter
        daoContractSetter = address(0);
        emit DAOContractSetterRemoved();
    }

    // prettier-ignore
    /**
     * @dev calls to set delegation for msg.sender, will take effect from the next epoch
     * @param dAddr address to delegate to
     */
    function delegate(address dAddr) external override {
        require(dAddr != address(0), "delegate: delegated address 0");
        address staker = msg.sender;
        uint256 curEpoch = getCurrentEpochNumber();

        initDataIfNeeded(staker, curEpoch);

        address curDAddr = stakerPerEpochData[curEpoch + 1][staker].delegatedAddress;
        // nothing changes here
        if (dAddr == curDAddr) {
            return;
        }

        uint256 updatedStake = stakerPerEpochData[curEpoch + 1][staker].stake;

        // reduce delegatedStake for curDAddr if needed
        if (curDAddr != staker) {
            initDataIfNeeded(curDAddr, curEpoch);
            // by right, delegatedStake should be greater than updatedStake
            assert(stakerPerEpochData[curEpoch + 1][curDAddr].delegatedStake >= updatedStake);
            assert(stakerLatestData[curDAddr].delegatedStake >= updatedStake);

            stakerPerEpochData[curEpoch + 1][curDAddr].delegatedStake =
                stakerPerEpochData[curEpoch + 1][curDAddr].delegatedStake.sub(updatedStake);
            stakerLatestData[curDAddr].delegatedStake =
                stakerLatestData[curDAddr].delegatedStake.sub(updatedStake);

            emit Delegated(staker, curDAddr, curEpoch, false);
        }

        stakerLatestData[staker].delegatedAddress = dAddr;
        stakerPerEpochData[curEpoch + 1][staker].delegatedAddress = dAddr;

        // ignore if staker is delegating back to himself
        if (dAddr != staker) {
            initDataIfNeeded(dAddr, curEpoch);
            stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake =
                stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake.add(updatedStake);
            stakerLatestData[dAddr].delegatedStake =
                stakerLatestData[dAddr].delegatedStake.add(updatedStake);
        }

        emit Delegated(staker, dAddr, curEpoch, true);
    }

    // prettier-ignore
    /**
     * @dev call to stake more KNC for msg.sender
     * @param amount amount of KNC to stake
     */
    function deposit(uint256 amount) external override {
        require(amount > 0, "deposit: amount is 0");

        uint256 curEpoch = getCurrentEpochNumber();
        address staker = msg.sender;

        // collect KNC token from staker
        require(
            kncToken.transferFrom(staker, address(this), amount),
            "deposit: can not get token"
        );

        initDataIfNeeded(staker, curEpoch);

        stakerPerEpochData[curEpoch + 1][staker].stake =
            stakerPerEpochData[curEpoch + 1][staker].stake.add(amount);
        stakerLatestData[staker].stake =
            stakerLatestData[staker].stake.add(amount);

        // increase delegated stake for address that staker has delegated to (if it is not staker)
        address dAddr = stakerPerEpochData[curEpoch + 1][staker].delegatedAddress;
        if (dAddr != staker) {
            initDataIfNeeded(dAddr, curEpoch);
            stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake =
                stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake.add(amount);
            stakerLatestData[dAddr].delegatedStake =
                stakerLatestData[dAddr].delegatedStake.add(amount);
        }

        emit Deposited(curEpoch, staker, amount);
    }

    /**
     * @dev call to withdraw KNC from staking, it could affect reward when calling DAO handleWithdrawal
     * @param amount amount of KNC to withdraw
     */
    function withdraw(uint256 amount) external override nonReentrant {
        require(amount > 0, "withdraw: amount is 0");

        uint256 curEpoch = getCurrentEpochNumber();
        address staker = msg.sender;

        require(
            stakerLatestData[staker].stake >= amount,
            "withdraw: latest amount staked < withdrawal amount"
        );

        (bool success, ) = address(this).call(
            abi.encodeWithSignature(
                "handleWithdrawal(address,uint256,uint256)",
                staker,
                amount,
                curEpoch
            )
        );
        if (!success) {
            // Note: should catch this event to check if something went wrong
            emit WithdrawDataUpdateFailed(curEpoch, staker, amount);
        }

        stakerLatestData[staker].stake = stakerLatestData[staker].stake.sub(amount);

        // transfer KNC back to staker
        require(kncToken.transfer(staker, amount), "withdraw: can not transfer knc");
        emit Withdraw(curEpoch, staker, amount);
    }

    /**
     * @dev init data if needed, then return staker's data for current epoch
     * @dev for safe, only allow calling this func from DAO address
     * @param staker - staker's address to init and get data for
     */
    function initAndReturnStakerDataForCurrentEpoch(address staker)
        external
        override
        returns (
            uint256 _stake,
            uint256 _delegatedStake,
            address _delegatedAddress
        )
    {
        require(
            msg.sender == address(daoContract),
            "initAndReturnData: only daoContract"
        );

        uint256 curEpoch = getCurrentEpochNumber();
        initDataIfNeeded(staker, curEpoch);

        StakerData memory stakerData = stakerPerEpochData[curEpoch][staker];
        _stake = stakerData.stake;
        _delegatedStake = stakerData.delegatedStake;
        _delegatedAddress = stakerData.delegatedAddress;
    }

    /**
     * @dev  in DAO contract, if staker wants to claim reward for past epoch,
     *       we must know the staker's data for that epoch
     *       if the data has not been inited, it means staker hasn't done any action -> no reward
     */
    function getStakerDataForPastEpoch(address staker, uint256 epoch)
        external
        view
        override
        returns (
            uint256 _stake,
            uint256 _delegatedStake,
            address _delegatedAddress
        )
    {
        StakerData memory stakerData = stakerPerEpochData[epoch][staker];
        _stake = stakerData.stake;
        _delegatedStake = stakerData.delegatedStake;
        _delegatedAddress = stakerData.delegatedAddress;
    }

    /**
     * @notice don't call on-chain, possibly high gas consumption
     * @dev allow to get data up to current epoch + 1
     */
    function getStake(address staker, uint256 epoch) external view returns (uint256) {
        uint256 curEpoch = getCurrentEpochNumber();
        if (epoch > curEpoch + 1) {
            return 0;
        }
        uint256 i = epoch;
        while (true) {
            if (hasInited[i][staker]) {
                return stakerPerEpochData[i][staker].stake;
            }
            if (i == 0) {
                break;
            }
            i--;
        }
        return 0;
    }

    /**
     * @notice don't call on-chain, possibly high gas consumption
     * @dev allow to get data up to current epoch + 1
     */
    function getDelegatedStake(address staker, uint256 epoch) external view returns (uint256) {
        uint256 curEpoch = getCurrentEpochNumber();
        if (epoch > curEpoch + 1) {
            return 0;
        }
        uint256 i = epoch;
        while (true) {
            if (hasInited[i][staker]) {
                return stakerPerEpochData[i][staker].delegatedStake;
            }
            if (i == 0) {
                break;
            }
            i--;
        }
        return 0;
    }

    /**
     * @notice don't call on-chain, possibly high gas consumption
     * @dev allow to get data up to current epoch + 1
     */
    function getDelegatedAddress(address staker, uint256 epoch) external view returns (address) {
        uint256 curEpoch = getCurrentEpochNumber();
        if (epoch > curEpoch + 1) {
            return address(0);
        }
        uint256 i = epoch;
        while (true) {
            if (hasInited[i][staker]) {
                return stakerPerEpochData[i][staker].delegatedAddress;
            }
            if (i == 0) {
                break;
            }
            i--;
        }
        // not delegated to anyone, default to yourself
        return staker;
    }

    function getLatestDelegatedAddress(address staker) external view returns (address) {
        return
            stakerLatestData[staker].delegatedAddress == address(0)
                ? staker
                : stakerLatestData[staker].delegatedAddress;
    }

    function getLatestDelegatedStake(address staker) external view returns (uint256) {
        return stakerLatestData[staker].delegatedStake;
    }

    function getLatestStakeBalance(address staker) external view returns (uint256) {
        return stakerLatestData[staker].stake;
    }

    // prettier-ignore
    /**
    * @dev  separate logics from withdraw, so staker can withdraw as long as amount <= staker's deposit amount
            calling this function from withdraw function, ignore reverting
    * @param staker staker that is withdrawing
    * @param amount amount to withdraw
    * @param curEpoch current epoch
    */
    function handleWithdrawal(
        address staker,
        uint256 amount,
        uint256 curEpoch
    ) public {
        require(msg.sender == address(this), "only staking contract");
        initDataIfNeeded(staker, curEpoch);
        // Note: update latest stake will be done after this function
        // update staker's data for next epoch
        stakerPerEpochData[curEpoch + 1][staker].stake =
            stakerPerEpochData[curEpoch + 1][staker].stake.sub(amount);

        address dAddr = stakerPerEpochData[curEpoch][staker].delegatedAddress;
        uint256 curStake = stakerPerEpochData[curEpoch][staker].stake;
        uint256 lStakeBal = stakerLatestData[staker].stake.sub(amount);
        uint256 newStake = curStake.min(lStakeBal);
        uint256 reduceAmount = curStake.sub(newStake); // newStake is always <= curStake

        if (reduceAmount > 0) {
            if (dAddr != staker) {
                initDataIfNeeded(dAddr, curEpoch);
                // staker has delegated to dAddr, withdraw will affect dAddr's delegated stakes
                stakerPerEpochData[curEpoch][dAddr].delegatedStake =
                    stakerPerEpochData[curEpoch][dAddr].delegatedStake.sub(reduceAmount);
            }
            stakerPerEpochData[curEpoch][staker].stake = newStake;
            // call DAO to reduce reward, if staker has delegated, then pass his delegated address
            if (address(daoContract) != address(0)) {
                // don't revert if DAO revert so data will be updated correctly
                (bool success, ) = address(daoContract).call(
                    abi.encodeWithSignature(
                        "handleWithdrawal(address,uint256)",
                        dAddr,
                        reduceAmount
                    )
                );
                if (!success) {
                    emit WithdrawDataUpdateFailed(curEpoch, staker, amount);
                }
            }
        }
        dAddr = stakerPerEpochData[curEpoch + 1][staker].delegatedAddress;
        if (dAddr != staker) {
            initDataIfNeeded(dAddr, curEpoch);
            stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake =
                stakerPerEpochData[curEpoch + 1][dAddr].delegatedStake.sub(amount);
            stakerLatestData[dAddr].delegatedStake =
                stakerLatestData[dAddr].delegatedStake.sub(amount);
        }
    }

    /**
     * @dev init data if it has not been inited yet
     * @param staker staker's address to init
     * @param epoch should be current epoch
     */
    function initDataIfNeeded(address staker, uint256 epoch) internal {
        address ldAddress = stakerLatestData[staker].delegatedAddress;
        if (ldAddress == address(0)) {
            // not delegate to anyone, consider as delegate to yourself
            stakerLatestData[staker].delegatedAddress = staker;
            ldAddress = staker;
        }

        uint256 ldStake = stakerLatestData[staker].delegatedStake;
        uint256 lStakeBal = stakerLatestData[staker].stake;

        if (!hasInited[epoch][staker]) {
            hasInited[epoch][staker] = true;
            StakerData storage stakerData = stakerPerEpochData[epoch][staker];
            stakerData.delegatedAddress = ldAddress;
            stakerData.delegatedStake = ldStake;
            stakerData.stake = lStakeBal;
        }

        // whenever stakers deposit/withdraw/delegate, the current and next epoch data need to be updated
        // as the result, we will also init data for staker at the next epoch
        if (!hasInited[epoch + 1][staker]) {
            hasInited[epoch + 1][staker] = true;
            StakerData storage nextEpochStakerData = stakerPerEpochData[epoch + 1][staker];
            nextEpochStakerData.delegatedAddress = ldAddress;
            nextEpochStakerData.delegatedStake = ldStake;
            nextEpochStakerData.stake = lStakeBal;
        }
    }
}

// File: contracts/sol6/Dao/mock/MockStakingContract.sol

pragma solidity 0.6.6;



contract MockStakingContract is KyberStaking {
    constructor(
        address _kncToken,
        uint256 _epochPeriod,
        uint256 _startBlock,
        address _admin
    ) public KyberStaking(_kncToken, _epochPeriod, _startBlock, _admin) {}

    function setDAOAddressWithoutCheck(address dao) public {
        daoContract = IKyberDAO(dao);
    }

    function getHasInitedValue(address staker, uint256 epoch) public view returns (bool) {
        return hasInited[epoch][staker];
    }

    function getStakesValue(address staker, uint256 epoch) public view returns (uint256) {
        return stakerPerEpochData[epoch][staker].stake;
    }

    function getDelegatedStakesValue(address staker, uint256 epoch) public view returns (uint256) {
        return stakerPerEpochData[epoch][staker].delegatedStake;
    }

    function getDelegatedAddressValue(address staker, uint256 epoch)
        public
        view
        returns (address)
    {
        return stakerPerEpochData[epoch][staker].delegatedAddress;
    }
}
