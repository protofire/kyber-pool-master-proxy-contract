pragma solidity 0.6.6;

contract KyberStakingWithgetStakerDataForEpoch {
  struct StakerData {
      uint256 stake;
      uint256 delegatedStake;
      address representative;
  }

  mapping(uint256 => mapping(address => StakerData)) internal stakerPerEpochData;

  constructor() public {}

  function setStakerData(uint256 epoch, address staker, uint256 stake, uint256 delegatedStake, address representative) public {
      stakerPerEpochData[epoch][staker] = StakerData(stake, delegatedStake, representative);
  }

  function getStakerRawData(address staker, uint256 epoch)
        external
        view
        returns (
            uint256 _stake,
            uint256 _delegatedStake,
            address _representative
        )
    {
        StakerData memory stakerData = stakerPerEpochData[epoch][staker];
        _stake = stakerData.stake;
        _delegatedStake = stakerData.delegatedStake;
        _representative = stakerData.representative;
    }

  function getStakerData(address staker, uint256 epoch)
        external view
        returns (
            uint256 stake,
            uint256 delegatedStake,
            address representative
        )
    {
        StakerData memory stakerData = stakerPerEpochData[epoch][staker];
        stake = stakerData.stake;
        delegatedStake = stakerData.delegatedStake;
        representative = stakerData.representative;
    }


}
