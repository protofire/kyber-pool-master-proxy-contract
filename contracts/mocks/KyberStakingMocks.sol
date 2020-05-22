pragma solidity 0.6.6;

contract KyberStakingWithgetStakerDataForPastEpoch {
  struct StakerData {
      uint256 stake;
      uint256 delegatedStake;
      address delegatedAddress;
  }

  mapping(uint256 => mapping(address => StakerData)) internal stakerPerEpochData;

  constructor() public {}

  function setStakerData(uint256 epoch, address staker, uint256 stake, uint256 delegatedStake, address delegatedAddress) public {
      stakerPerEpochData[epoch][staker] = StakerData(stake, delegatedStake, delegatedAddress);
  }

  function getStakerDataForPastEpoch(address staker, uint256 epoch)
        external
        view
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

  function getStake(address staker, uint256 epoch)
        external
        view
        returns (
            uint256 _stake
        )
    {
        StakerData memory stakerData = stakerPerEpochData[epoch][staker];
        _stake = stakerData.stake;
    }

  function getDelegatedAddress(address staker, uint256 epoch)
        external
        view
        returns (
            address _delegatedAddress
        )
    {
        StakerData memory stakerData = stakerPerEpochData[epoch][staker];
        _delegatedAddress = stakerData.delegatedAddress;
    }
}
