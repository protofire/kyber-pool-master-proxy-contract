pragma solidity 0.6.6;

import "../KyberPoolMaster.sol";


contract KyberPoolMasterWithClaimOnlyNewFee is KyberPoolMaster {
    constructor(
        address _kncToken,
        address _kyberDAO,
        address _kyberStaking,
        address _kyberFeeHandler,
        uint256 _epochNotice,
        uint256 _delegationFee
    )
        public
        KyberPoolMaster(
            _kncToken,
            _kyberDAO,
            _kyberStaking,
            _kyberFeeHandler,
            _epochNotice,
            _delegationFee
        )
    {}

    function claimRewardsMaster(uint256 epoch) public {
        uint256 curEpoch = kyberDAO.getCurrentEpochNumber();
        require(epoch < curEpoch, "claimRewardsMaster: only for past epochs");

        DFeeData storage epochDFeeData = delegationFees[getEpochDFeeDataId(
            epoch
        )];
        if (epochDFeeData.applied == false) {
            epochDFeeData.applied = true;
            emit NewFees(epochDFeeData.fromEpoch, epochDFeeData.fee);
        }

        // TODO - continue
    }
}
