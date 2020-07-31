pragma solidity 0.6.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IExtendedKyberDao.sol";
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
    IERC20 internal constant ETH_TOKEN_ADDRESS = IERC20(
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
    );

    // Number of epochs after which a change on delegationFee will be applied
    uint256 public immutable epochNotice;

    // Mapping of if staker has claimed reward for Epoch in a feeHandler
    // epoch -> member -> feeHandler -> true | false
    mapping(uint256 => mapping(address => mapping(address => bool)))
        public claimedDelegateReward;

    struct Claim {
        bool claimedByPool;
        uint256 totalRewards;
        uint256 totalStaked;
    }
    //epoch -> feeHandler -> Claim
    mapping(uint256 => mapping(address => Claim)) public epochFeeHandlerClaims;

    // Fee charged by poolMasters to poolMembers for services
    // Denominated in 1e4 units
    // 100 = 1%
    struct DFeeData {
        uint256 fromEpoch;
        uint256 fee;
        bool applied;
    }

    DFeeData[] public delegationFees;

    IERC20 public immutable kncToken;
    IExtendedKyberDao public immutable kyberDao;
    IKyberStaking public immutable kyberStaking;

    address[] public feeHandlersList;
    mapping(address => IERC20) public rewardTokenByFeeHandler;

    uint256 public immutable firstEpoch;

    mapping(address => bool) public successfulClaimByFeeHandler;

    struct RewardInfo {
        IExtendedKyberFeeHandler kyberFeeHandler;
        IERC20 rewardToken;
        uint256 totalRewards;
        uint256 totalFee;
        uint256 rewardsAfterFee;
        uint256 poolMembersShare;
        uint256 poolMasterShare;
    }

    /*** Events ***/
    event CommitNewFees(uint256 deadline, uint256 feeRate);
    event NewFees(uint256 fromEpoch, uint256 feeRate);

    event MemberClaimReward(
        uint256 indexed epoch,
        address indexed poolMember,
        address indexed feeHandler,
        IERC20 rewardToken,
        uint256 reward
    );

    event MasterClaimReward(
        uint256 indexed epoch,
        address indexed feeHandler,
        address indexed poolMaster,
        IERC20 rewardToken,
        uint256 totalRewards,
        uint256 feeApplied,
        uint256 feeAmount,
        uint256 poolMasterShare
    );

    event AddFeeHandler(address indexed feeHandler, IERC20 indexed rewardToken);

    event RemoveFeeHandler(address indexed feeHandler);

    /**
     * @notice Address deploying this contract should be able to receive ETH, owner can be changed using transferOwnership method
     * @param _kyberDao KyberDao contract address
     * @param _epochNotice Number of epochs after which a change on deledatioFee is will be applied
     * @param _delegationFee Fee charged by poolMasters to poolMembers for services - Denominated in 1e4 units - 100 = 1%
     * @param _kyberFeeHandlers Array of FeeHandlers
     * @param _rewardTokens Array of ERC20 tokens used by FeeHandlers to pay reward. Use zero address if FeeHandler pays ETH
     */
    constructor(
        address _kyberDao,
        uint256 _epochNotice,
        uint256 _delegationFee,
        address[] memory _kyberFeeHandlers,
        IERC20[] memory _rewardTokens
    ) public {
        require(_kyberDao != address(0), "ctor: kyberDao is missing");
        require(
            _epochNotice >= MINIMUM_EPOCH_NOTICE,
            "ctor: Epoch Notice too low"
        );
        require(
            _delegationFee <= MAX_DELEGATION_FEE,
            "ctor: Delegation Fee greater than 100%"
        );
        require(
            _kyberFeeHandlers.length > 0,
            "ctor: at least one _kyberFeeHandlers required"
        );
        require(
            _kyberFeeHandlers.length == _rewardTokens.length,
            "ctor: _kyberFeeHandlers and _rewardTokens uneven"
        );

        IExtendedKyberDao _kyberDaoContract = IExtendedKyberDao(_kyberDao);
        kyberDao = _kyberDaoContract;

        kncToken = IERC20(_kyberDaoContract.kncToken());
        kyberStaking = IKyberStaking(_kyberDaoContract.staking());

        epochNotice = _epochNotice;

        uint256 _firstEpoch = _kyberDaoContract.getCurrentEpochNumber();
        firstEpoch = _firstEpoch;

        delegationFees.push(DFeeData(_firstEpoch, _delegationFee, true));

        for (uint256 i = 0; i < _kyberFeeHandlers.length; i++) {
            require(
                _kyberFeeHandlers[i] != address(0),
                "ctor: feeHandler is missing"
            );
            require(
                rewardTokenByFeeHandler[_kyberFeeHandlers[i]] ==
                    IERC20(address(0)),
                "ctor: repeated feeHandler"
            );

            feeHandlersList.push(_kyberFeeHandlers[i]);
            rewardTokenByFeeHandler[_kyberFeeHandlers[i]] = _rewardTokens[i];

            emit AddFeeHandler(
                _kyberFeeHandlers[i],
                rewardTokenByFeeHandler[_kyberFeeHandlers[i]]
            );
        }

        emit CommitNewFees(_firstEpoch, _delegationFee);
        emit NewFees(_firstEpoch, _delegationFee);
    }

    /**
     * @dev adds a new FeeHandler
     * @param _feeHandler FeeHandler address
     * @param _rewardToken Rewards Token address
     */
    function addFeeHandler(address _feeHandler, IERC20 _rewardToken)
        external
        onlyOwner
    {
        require(
            _feeHandler != address(0),
            "addFeeHandler: _feeHandler is missing"
        );
        require(
            rewardTokenByFeeHandler[_feeHandler] == IERC20(address(0)),
            "addFeeHandler: already added"
        );

        feeHandlersList.push(_feeHandler);
        rewardTokenByFeeHandler[_feeHandler] = _rewardToken;

        emit AddFeeHandler(_feeHandler, rewardTokenByFeeHandler[_feeHandler]);
    }

    /**
     * @dev removes a FeeHandler
     * @param _feeHandler FeeHandler address
     */
    function removeFeeHandler(address _feeHandler) external onlyOwner {
        require(
            rewardTokenByFeeHandler[_feeHandler] != IERC20(address(0)),
            "removeFeeHandler: not added"
        );
        require(
            !successfulClaimByFeeHandler[_feeHandler],
            "removeFeeHandler: can not remove FeeHandler successfully claimed"
        );

        if (feeHandlersList[feeHandlersList.length - 1] != _feeHandler) {
            for (uint256 i = 0; i < feeHandlersList.length; i++) {
                if (feeHandlersList[i] == _feeHandler) {
                    feeHandlersList[i] = feeHandlersList[feeHandlersList
                        .length - 1];
                    break;
                }
            }
        }

        feeHandlersList.pop();
        delete rewardTokenByFeeHandler[_feeHandler];

        emit RemoveFeeHandler(_feeHandler);
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
        kyberDao.vote(campaignID, option);
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

        uint256 curEpoch = kyberDao.getCurrentEpochNumber();
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
        uint256 curEpoch = kyberDao.getCurrentEpochNumber();

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
     * @param _epoch for which epoch is querying delegation fee
     * @param _from delegationFees starting index
     */
    function getEpochDFeeDataId(uint256 _epoch, uint256 _from)
        internal
        view
        returns (uint256)
    {
        if (delegationFees[_from].fromEpoch > _epoch) {
            return _from;
        }

        uint256 left = _from;
        uint256 right = delegationFees.length;

        while (left < right) {
            uint256 m = (left + right).div(2);
            if (delegationFees[m].fromEpoch > _epoch) {
                right = m;
            } else {
                left = m + 1;
            }
        }

        return right - 1;
    }

    /**
     * @dev Gets the the delegation fee data corresponding to the given epoch
     * @param epoch for which epoch is querying delegation fee
     */
    function getEpochDFeeData(uint256 epoch)
        public
        view
        returns (DFeeData memory epochDFee)
    {
        epochDFee = delegationFees[getEpochDFeeDataId(epoch, 0)];
    }

    /**
     * @dev Gets the the delegation fee data corresponding to the current epoch
     */
    function delegationFee() public view returns (DFeeData memory) {
        uint256 curEpoch = kyberDao.getCurrentEpochNumber();
        return getEpochDFeeData(curEpoch);
    }

    /**
     * @dev  Queries the amount of unclaimed rewards for the pool in a given epoch and feeHandler
     *       return 0 if PoolMaster has calledRewardMaster
     *       return 0 if staker's reward percentage in precision for the epoch is 0
     *       return 0 if total reward for the epoch is 0
     * @param _epoch for which epoch is querying unclaimed reward
     * @param _feeHandler FeeHandler address
     */
    function getUnclaimedRewards(
        uint256 _epoch,
        IExtendedKyberFeeHandler _feeHandler
    ) public view returns (uint256) {
        if (epochFeeHandlerClaims[_epoch][address(_feeHandler)].claimedByPool) {
            return 0;
        }

        uint256 perInPrecision = kyberDao
            .getPastEpochRewardPercentageInPrecision(address(this), _epoch);
        if (perInPrecision == 0) {
            return 0;
        }

        uint256 rewardsPerEpoch = _feeHandler.rewardsPerEpoch(_epoch);
        if (rewardsPerEpoch == 0) {
            return 0;
        }

        return rewardsPerEpoch.mul(perInPrecision).div(PRECISION);
    }

    /**
     * @dev  Queries the epochs with at least one feeHandler paying rewards, for the pool
     */
    function getAllEpochWithUnclaimedRewards()
        external
        view
        returns (uint256[] memory)
    {
        uint256 currentEpoch = kyberDao.getCurrentEpochNumber();
        uint256 maxEpochNumber = currentEpoch.sub(firstEpoch).add(1);
        uint256[] memory epochsWithRewards = new uint256[](maxEpochNumber);
        uint256 epochCounter = 0;
        for (uint256 epoch = firstEpoch; epoch <= currentEpoch; epoch++) {
            for (uint256 i = 0; i < feeHandlersList.length; i++) {
                uint256 unclaimed = getUnclaimedRewards(
                    epoch,
                    IExtendedKyberFeeHandler(feeHandlersList[i])
                );

                if (unclaimed > 0) {
                    epochsWithRewards[epochCounter] = epoch;
                    epochCounter++;
                    // stop querying feeHandlers on the first with rewards for the epoch
                    break;
                }
            }
        }

        uint256[] memory result = new uint256[](epochCounter);
        for (uint256 i = 0; i < epochCounter; i++) {
            result[i] = epochsWithRewards[i];
        }

        return result;
    }

    /**
     * @dev  Claims rewards for a given group of epochs in all feeHandlers, distribute fees and its share to poolMaster
     * @param _epochGroup An array of epochs for which rewards are being claimed. Asc order and uniqueness is required.
     */
    function claimRewardsMaster(uint256[] memory _epochGroup) public {
        claimRewardsMaster(_epochGroup, feeHandlersList);
    }

    /**
     * @dev  Claims rewards for a given group of epochs in all feeHandlers, distribute fees and its share to poolMaster
     * @param _epochGroup An array of epochs for which rewards are being claimed. Asc order and uniqueness is required.
     * @param _feeHandlerGroup An array of FeeHandlers for which rewards are being claimed.
     */
    function claimRewardsMaster(
        uint256[] memory _epochGroup,
        address[] memory _feeHandlerGroup
    ) public {
        require(_epochGroup.length > 0, "cRMaste: _epochGroup required");
        require(
            isOrderedSet(_epochGroup),
            "cRMaste: order and uniqueness required"
        );
        require(
            _feeHandlerGroup.length > 0,
            "cRMaste: _feeHandlerGroup required"
        );

        IERC20[] memory tokensWithRewards = new IERC20[](
            _feeHandlerGroup.length
        );
        uint256 tokensWithRewardsLength = 0;
        uint256[] memory accruedByToken = new uint256[](
            _feeHandlerGroup.length
        );

        uint256 feeId = 0;

        for (uint256 j = 0; j < _epochGroup.length; j++) {
            uint256 _epoch = _epochGroup[j];
            feeId = getEpochDFeeDataId(_epoch, feeId);
            DFeeData storage epochDFee = delegationFees[feeId];

            if (!epochDFee.applied) {
                applyFee(epochDFee);
            }

            (uint256 stake, uint256 delegatedStake, ) = kyberStaking
                .getStakerRawData(address(this), _epoch);

            for (uint256 i = 0; i < _feeHandlerGroup.length; i++) {
                RewardInfo memory rewardInfo = _claimRewardsFromKyber(
                    _epoch,
                    _feeHandlerGroup[i],
                    epochDFee,
                    stake,
                    delegatedStake
                );

                if (rewardInfo.totalRewards == 0) {
                    continue;
                }

                int256 tokenI = findIndex(
                    tokensWithRewards,
                    rewardInfo.rewardToken
                );
                if (tokenI < 0) {
                    tokensWithRewards[tokensWithRewardsLength] = rewardInfo
                        .rewardToken;
                    accruedByToken[tokensWithRewardsLength] = rewardInfo
                        .poolMasterShare;
                    tokensWithRewardsLength++;
                } else {
                    accruedByToken[uint256(tokenI)] = accruedByToken[uint256(
                        tokenI
                    )]
                        .add(rewardInfo.poolMasterShare);
                }

                if (!successfulClaimByFeeHandler[_feeHandlerGroup[i]]) {
                    successfulClaimByFeeHandler[_feeHandlerGroup[i]] = true;
                }
            }
        }

        address poolMaster = owner();
        for (uint256 k = 0; k < tokensWithRewardsLength; k++) {
            _sendTokens(
                tokensWithRewards[k],
                poolMaster,
                accruedByToken[k],
                "cRMaste: poolMaster share transfer failed"
            );
        }
    }

    function _claimRewardsFromKyber(
        uint256 _epoch,
        address _feeHandlerAddress,
        DFeeData memory epochDFee,
        uint256 stake,
        uint256 delegatedStake
    ) internal returns (RewardInfo memory rewardInfo) {
        rewardInfo.kyberFeeHandler = IExtendedKyberFeeHandler(
            _feeHandlerAddress
        );
        uint256 unclaimed = getUnclaimedRewards(
            _epoch,
            rewardInfo.kyberFeeHandler
        );

        if (unclaimed > 0) {
            rewardInfo
                .rewardToken = rewardTokenByFeeHandler[_feeHandlerAddress];

            rewardInfo.kyberFeeHandler.claimStakerReward(address(this), _epoch);

            rewardInfo.totalRewards = unclaimed;

            rewardInfo.totalFee = rewardInfo
                .totalRewards
                .mul(epochDFee.fee)
                .div(MAX_DELEGATION_FEE);
            rewardInfo.rewardsAfterFee = rewardInfo.totalRewards.sub(
                rewardInfo.totalFee
            );

            rewardInfo.poolMembersShare = calculateRewardsShare(
                delegatedStake,
                stake.add(delegatedStake),
                rewardInfo.rewardsAfterFee
            );
            rewardInfo.poolMasterShare = rewardInfo.totalRewards.sub(
                rewardInfo.poolMembersShare
            ); // fee + poolMaster stake share

            epochFeeHandlerClaims[_epoch][_feeHandlerAddress] = Claim(
                true,
                rewardInfo.poolMembersShare,
                delegatedStake
            );

            emit MasterClaimReward(
                _epoch,
                _feeHandlerAddress,
                payable(owner()),
                rewardInfo.rewardToken,
                rewardInfo.totalRewards,
                epochDFee.fee,
                rewardInfo.totalFee,
                rewardInfo.poolMasterShare.sub(rewardInfo.totalFee)
            );
        }
    }

    /**
     * @dev  Helper method to transfer tokens
     * @param _token address of the token
     * @param _receiver account that will receive the transfer
     * @param _value the amount of tokens to transfer
     * @param _errorMsg error msg in case transfer of native tokens fails
     */
    function _sendTokens(
        IERC20 _token,
        address _receiver,
        uint256 _value,
        string memory _errorMsg
    ) internal {
        if (_token == ETH_TOKEN_ADDRESS) {
            (bool success, ) = _receiver.call{value: _value}("");
            require(success, _errorMsg);
        } else {
            SafeERC20.safeTransfer(_token, _receiver, _value);
        }
    }

    /**
     * @dev  Queries the amount of unclaimed rewards for the pool member in a given epoch and feeHandler
     *       return 0 if PoolMaster has not called claimRewardMaster
     *       return 0 if PoolMember has previously claimed reward for the epoch
     *       return 0 if PoolMember has not stake for the epoch
     *       return 0 if PoolMember has not delegated it stake to this contract for the epoch
     * @param _poolMember address of pool member
     * @param _epoch for which epoch the member is querying unclaimed reward
     * @param _feeHandler FeeHandler address
     */
    function getUnclaimedRewardsMember(
        address _poolMember,
        uint256 _epoch,
        address _feeHandler
    ) public view returns (uint256) {
        if (
            !epochFeeHandlerClaims[_epoch][address(_feeHandler)].claimedByPool
        ) {
            return 0;
        }

        if (claimedDelegateReward[_epoch][_poolMember][_feeHandler]) {
            return 0;
        }

        (uint256 stake, , address representative) = kyberStaking.getStakerData(
            _poolMember,
            _epoch
        );

        if (stake == 0) {
            return 0;
        }

        if (representative != address(this)) {
            return 0;
        }


            Claim memory rewardForEpoch
         = epochFeeHandlerClaims[_epoch][_feeHandler];

        return
            calculateRewardsShare(
                stake,
                rewardForEpoch.totalStaked,
                rewardForEpoch.totalRewards
            );
    }

    /**
     * @dev  Queries the epochs with at least one feeHandler paying rewards, for a the poolMember
     * @param _poolMember address of pool member
     */
    function getAllEpochWithUnclaimedRewardsMember(address _poolMember)
        external
        view
        returns (uint256[] memory)
    {
        uint256 currentEpoch = kyberDao.getCurrentEpochNumber();
        return
            _getAllEpochWithUnclaimedRewardsMember(
                _poolMember,
                firstEpoch,
                currentEpoch
            );
    }

    /**
     * @dev Queries the epochs with at least one feeHandler paying rewards, for a the poolMember
     * @param _poolMember address of pool member
     * @param _fromEpoch initial epoch parameter
     * @param _toEpoch end epoch parameter
     */
    function getAllEpochWithUnclaimedRewardsMember(
        address _poolMember,
        uint256 _fromEpoch,
        uint256 _toEpoch
    ) external view returns (uint256[] memory) {
        return
            _getAllEpochWithUnclaimedRewardsMember(
                _poolMember,
                _fromEpoch,
                _toEpoch
            );
    }

    /**
     * @dev Queries the epochs with at least one feeHandler paying rewards, for a the poolMember
     * @param _poolMember address of pool member
     * @param _fromEpoch initial epoch parameter
     * @param _toEpoch end epoch parameter
     */
    function _getAllEpochWithUnclaimedRewardsMember(
        address _poolMember,
        uint256 _fromEpoch,
        uint256 _toEpoch
    ) internal view returns (uint256[] memory) {
        uint256 maxEpochNumber = _toEpoch.sub(_fromEpoch).add(1);
        uint256[] memory epochsWithRewards = new uint256[](maxEpochNumber);
        uint256 epochCounter = 0;
        for (uint256 epoch = _fromEpoch; epoch <= _toEpoch; epoch++) {
            for (uint256 i = 0; i < feeHandlersList.length; i++) {
                uint256 unclaimed = getUnclaimedRewardsMember(
                    _poolMember,
                    epoch,
                    feeHandlersList[i]
                );

                if (unclaimed > 0) {
                    epochsWithRewards[epochCounter] = epoch;
                    epochCounter++;
                    // stop querying feeHandlers on the first with rewards for the epoch
                    break;
                }
            }
        }

        uint256[] memory result = new uint256[](epochCounter);
        for (uint256 i = 0; i < epochCounter; i++) {
            result[i] = epochsWithRewards[i];
        }

        return result;
    }

    /**
     * @dev PoolMember claims rewards for a given group of epochs in all feeHandlers.
     *      It will transfer rewards where epoch->feeHandler has been claimed by the pool and not yet by the member.
     *      This contract will keep locked remainings from rounding at a wei level.
     * @param _epochGroup An array of epochs for which rewards are being claimed
     */
    function claimRewardsMember(uint256[] memory _epochGroup) public {
        _claimRewardsMember(_epochGroup, msg.sender);
    }

    /**
     * @dev Someone claims rewards for a PoolMember in a given group of epochs in all feeHandlers.
     *      It will transfer rewards where epoch->feeHandler has been claimed by the pool and not yet by the member.
     *      This contract will keep locked remainings from rounding at a wei level.
     * @param _epochGroup An array of epochs for which rewards are being claimed
     * @param _poolMember PoolMember address to claim rewards for
     */
    function claimRewardsMember(
        uint256[] memory _epochGroup,
        address _poolMember
    ) public {
        _claimRewardsMember(_epochGroup, _poolMember);
    }

    function _claimRewardsMember(
        uint256[] memory _epochGroup,
        address _poolMember
    ) internal {
        IERC20[] memory tokensWithRewards = new IERC20[](
            feeHandlersList.length
        );
        uint256 tokensWithRewardsLength = 0;
        uint256[] memory accruedByToken = new uint256[](feeHandlersList.length);

        for (uint256 j = 0; j < _epochGroup.length; j++) {
            uint256 _epoch = _epochGroup[j];

            for (uint256 i = 0; i < feeHandlersList.length; i++) {
                uint256 poolMemberShare = getUnclaimedRewardsMember(
                    _poolMember,
                    _epoch,
                    feeHandlersList[i]
                );


                    IERC20 rewardToken
                 = rewardTokenByFeeHandler[feeHandlersList[i]];

                if (poolMemberShare == 0) {
                    continue;
                }

                int256 tokenI = findIndex(tokensWithRewards, rewardToken);
                if (tokenI < 0) {
                    tokensWithRewards[tokensWithRewardsLength] = rewardToken;
                    accruedByToken[tokensWithRewardsLength] = poolMemberShare;
                    tokensWithRewardsLength++;
                } else {
                    accruedByToken[uint256(tokenI)] = accruedByToken[uint256(
                        tokenI
                    )]
                        .add(poolMemberShare);
                }
                claimedDelegateReward[_epoch][_poolMember][feeHandlersList[i]] = true;

                emit MemberClaimReward(
                    _epoch,
                    _poolMember,
                    feeHandlersList[i],
                    rewardToken,
                    poolMemberShare
                );
            }
        }

        // distribute _poolMember rewards share
        for (uint256 k = 0; k < tokensWithRewardsLength; k++) {
            _sendTokens(
                tokensWithRewards[k],
                _poolMember,
                accruedByToken[k],
                "cRMember: poolMember share transfer failed"
            );
        }
    }

    // Utils

    /**
     * @dev Returns the index of `_token` if `_tokens` contains it or -1
     */
    function findIndex(IERC20[] memory _tokens, IERC20 _token)
        internal
        pure
        returns (int256)
    {
        int256 index = -1;
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == _token) {
                index = int256(i);
                break;
            }
        }

        return index;
    }

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
     * @dev Queries the number of elements in feeHandlersList
     */
    function feeHandlersListLength() public view returns (uint256) {
        return feeHandlersList.length;
    }

    /**
     * @dev Checks if elements in array are ordered and unique
     */
    function isOrderedSet(uint256[] memory numbers)
        internal
        pure
        returns (bool)
    {
        bool isOrdered = true;

        if (numbers.length > 1) {
            for (uint256 i = 0; i < numbers.length - 1; i++) {
                // strict inequality ensures both ordering and uniqueness
                if (numbers[i] >= numbers[i + 1]) {
                    isOrdered = false;
                    break;
                }
            }
        }

        return isOrdered;
    }

    /**
     * @dev Enables the contract to receive ETH
     */
    receive() external payable {
        require(
            rewardTokenByFeeHandler[msg.sender] == ETH_TOKEN_ADDRESS,
            "only accept ETH from a KyberFeeHandler"
        );
    }
}
