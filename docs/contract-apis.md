## APIs
In this section, the APIs require users to perform transactions. Examples are provided using the great [eth-cli](https://github.com/protofire/eth-cli)

##### Setting up KyberPoolMaster contract in eth-cli
```bash
eth abi:add KyberPoolMaster PATH_TO_KYBER_POOL_MASTER_CONTRACT_ABI.json
```

## Pool Master only

### Deposit

Pool Master deposits KNC into a staking contract through the KyberPoolMaster contract.

---
function **`masterDeposit`**(uint256 amount) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `amount` | uint256 | KNC wei to be deposited |
---

#### Example
Deposit 1 KNC

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'masterDeposit(1000000000000000000)' --pk=USER_WALLET_ADDRESS_PK
```

### Withdraw
Pool Master can withdraw KNC (in token Wei) from the staking contract at any time.

---
function **`masterWithdraw`**(uint256 amount) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `amount` | uint256 | KNC (in Wei) to be withdrawn |
---

#### Example
Withdraw 1 KNC

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'masterDeposit(1000000000000000000)' --pk=USER_WALLET_ADDRESS_PK
```

### Vote

Pool Master votes for an option of a campaign.

---
function **`vote`**(uint256 campaignID, uint256 option) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `campaignID` | uint256 | id of campaign to vote for |
| `option` | uint256 | id of options to vote for |
---

#### Example
Vote for option 1 in campaign 2

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'vote(2, 1)' --pk=USER_WALLET_ADDRESS_PK
```

### Transfer Ownership

Some methods are only allowed for contracts owner a.k.a. Pool master. So, the ownership can be transferred

---
function **`transeferOwnership`**(uint256 campaignID, uint256 option) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `campaignID` | uint256 | id of campaign to vote for |
| `option` | uint256 | id of options to vote for |
---

#### Example
Set NEW_OWNER_ADDRESS as a new Pool master

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'transeferOwnership(NEW_OWNER_ADDRESS)' --pk=USER_WALLET_ADDRESS_PK
```

#### Committing a new Delegation Fee
Pool Master commits a new delegation fee to be applied from `currentEpoch + epochNotive`.

---
function **`commitNewFee`**(uint256 _fee) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_fee` | address | a new fee denominated in 1e4 units, where 100 means 1% |


#### Example
Commit a new fee of 10%.

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'commitNewFee(1000)' --pk=USER_WALLET_ADDRESS_PK
```

#### Add a FeeHandler
Pool Master adds a new FeeHandler contract, to which a reward token is associated, to be able to claim rewards from.

---
function **`addFeeHandler`**(address _feeHandler, IERC20 _rewardToken) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_feeHandler` | address | the address of the new FeeHandler |
| `_rewardToken` | IERC20 | the address of a ERC20 token or `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` if reward is in ETH |

#### Example
Add FEE_HANDLER_ADDRESS with DAI as reward token.

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'addFeeHandler(FEE_HANDLER_ADDRESS, `0x6B175474E89094C44Da98b954EedeAC495271d0F`)' --pk=USER_WALLET_ADDRESS_PK
```

#### Remove a FeeHandler
In case FeeHandler was added by mistake, the contract provides the ability to remove it as well. To be able to remove FeeHandler, there shouldn’t be any claim rewards paid by the contract so far.

---
function **`removeFeeHandler`**(address _feeHandler) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_feeHandler` | address | the address of the new FeeHandler |

#### Example
Remove FEE_HANDLER_ADDRESS.

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'removeFeeHandler(FEE_HANDLER_ADDRESS)' --pk=USER_WALLET_ADDRESS_PK
```

## Publicly accessible methods

#### Applying pending delegation fee
Applies a new pending fee. There can be only one pending fee at a time.

One can mark that a new is committed if the following occurs:

- If the current epoch is greater or equal to `fromEpoch`.
- A new fee is committed and a pending one can be applied.
- When a reward in an epoch is claimed, a pending fee needs to be used.

---
function **`applyPendingFee`**() public


#### Example

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'applyPendingFee()' --pk=USER_WALLET_ADDRESS_PK
```

#### getEpochDFeeData
Gets the delegation fee data corresponding to the given epoch.

---
function **`getEpochDFeeData`**(uint256 epoch) public view returns (uint256 fromEpoch, uint256 fee, bool applied)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | for which epoch is querying delegation fee |

| Returns | Type | Description |
| ---------- |:-------:|:-------------------:|
| `fromEpoch` | uint256 | an epoch where the fee starts |
| `fee` | uint256 | a fee denominated in 1e4 units where 100 means 1% |
| `applied` | bool | a fee applied |


#### Example
Obtain delegation fee data for epoch 5

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getEpochDFeeData(5)'
```

#### delegationFee
Gets the delegation fee data corresponding to the current epoch.

---
function **`delegationFee`**() public view returns (uint256 epoch) public view returns (uint256 fromEpoch, uint256 fee, bool applied)
| Returns | Type | Description |
| ---------- |:-------:|:-------------------:|
| `fromEpoch` | uint256 | an epoch where the fee starts |
| `fee` | uint256 | a fee denominated in 1e4 units where 100 means 1% |
| `applied` | bool | a fee applied |

#### Example

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'delegationFee()'
```

#### delegationFeesLength
Queries the number of delegation fees created since a contract was deployed.

---
function **`delegationFeesLength`**() public view returns (uint256)

#### feeHandlersListLength
Queries the number of FeeHandlers added.

---
function **`feeHandlersListLength`**() public view returns (uint256)

#### getUnclaimedRewards
Queries the amount of unclaimed rewards for the pool in a given epoch and FeeHandler contracts.

Return 0 when:
- A pool master has called the RewardMaster function
- Staker's reward percentage in precision for the epoch is 0
- Total reward for the epoch is 0

---
function **`getUnclaimedRewards`**(uint256 _epoch, IExtendedKyberFeeHandler _feeHandler) public view returns (uint256)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | for which epoch is querying unclaimed reward |
| `_feeHandler` | address | the address of the FeeHandler |

#### Example
Query some pool unclaimed rewards for epoch 5 for FEE_HANDLER_ADDRESS

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getUnclaimedRewards(SOME_POOL_MEMBER_ADDRESS, 5, FEE_HANDLER_ADDRESS)'
```

#### getAllEpochWithUnclaimedRewards
Queries the epochs with at least one FeeHandler to pay rewards for the pool.

---
function **`getAllEpochWithUnclaimedRewards`**() external view returns (uint256[] memory)

#### Example
Query all epochs where a pool has some rewards pending to be claimed in at least one FeeHandler.

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getAllEpochWithUnclaimedRewards()'
```

#### claimRewardsMaster
Claims rewards for a given group of epochs in all FeeHandlers, distribute fees and its share to a pool master.

**This function needs to be executed, so that  a member can claim its share.**

---
function **`claimRewardsMaster`**(uint256[] memory _epochGroup) public
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_epochGroup` | uint256[] | a group of epochs from which rewards are being claimed, ordered ascending and with no duplicate elements  |

#### Example
Someone claims pool unclaimed reward for epoch 5, 6 and 7

#### Example

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimRewardsMaster([5,6,7])' --pk=USER_WALLET_ADDRESS_PK
```

#### getUnclaimedRewardsMember
Queries the amount of unclaimed rewards for the pool member in a given epoch and a FeeHandler.

Return 0 when:
- PoolMaster has not called the claimRewardMaster
- PoolMember has previously claimed a reward for the epoch
- PoolMember has not stake for the epoch
- PoolMember has not delegated it stake to this contract for the epoch

---
function **`getUnclaimedRewardsMember`**(address poolMember, uint256 epoch) public view returns (uint256)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `poolMember` | address | address of pool member |
| `epoch` | uint256 | for which epoch the memmber is querying unclaimed reward |
| `_feeHandler` | address | the address of the new FeeHandler |

#### Example
Query pool member’s unclaimed rewards from FEE_HANDLER_ADDRESS in epoch 5.

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getUnclaimedRewardsMember(SOME_POOL_MEMBER_ADDRESS, 5, FEE_HANDLER_ADDRESS)'
```

#### getAllEpochWithUnclaimedRewardsMember
Queries epochs with at least one FeeHandler to pay  rewards for a Pool Member.

---
function **`getAllEpochWithUnclaimedRewardsMember`**(address _poolMember) external view returns (uint256[] memory)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_poolMember` | address | address of pool member |

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getAllEpochWithUnclaimedRewardsMember(SOME_POOL_MEMBER_ADDRESS)'
```

#### claimRewardsMember
PoolMember claims rewards for a given group of epochs in all FeeHandlers. It will transfer rewards where an epoch or a FeeHandler has been claimed by a pool and not by a member yet. This contract will keep locked remainings from rounding at a Wei level.

**In order for a member to call successfully this function for a specific epoch, the claimRewardsMaster function needs to be executed before for the same epoch.**

---
function **`claimRewardsMember`**(uint256[] memory _epochGroup) public
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_epochGroup` | uint256 | gropup of epochs from which rewards are being claimed |

#### Example
Pool Members claims its unclaimed reward for epoch 5, 6 and 7

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimRewardsMember([5,6,7])' --pk=USER_WALLET_ADDRESS_PK
```

#### claimRewardsMember
Someone claims rewards for a poolMember in a given group of epochs in all feeHandlers.
It will transfer rewards where epoch->feeHandler has been claimed by the pool and not yet by the member.
This contract will keep locked remainings from rounding at a wei level.

**In order for a member to call succesfully this function for a specific epoch, claimRewardsMaster needs to be executed before for the same epoch.**

---
function **`claimRewardsMember`**(uint256[] memory _epochGroup, address _poolMember) public
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_epochGroup` | uint256 | gropup of epochs from which rewards are being claimed |
| `_poolMember` | address | Optional PoolMember address to claim rewards for |

#### Example
USER claims rewards for POOL_MEMBER in epoch 5, 6 and 7

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimRewardsMember([5,6,7], POOL_MEMBER_ADDRESS)' --pk=USER_WALLET_ADDRESS_PK
```

## Publicly accessible state variables
### epochNotice
A number of epochs after which a change on a deledatioFee will be applied

#### Example
Obtain epochNotice

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'epochNotice()'
```

### claimedDelegateReward
Mapping of if staker has claimed reward for Epoch and a FeeHandler

#### Example
Check if STAKER_ADDRESS as claimed reward for epoch 5 and FEE_HANDLER_ADDRESS

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimedDelegateReward(STAKER_ADDRESS, 5, FEE_HANDLER_ADDRESS)'
```

#### epochFeeHandlerClaims
Mapping of if poolMaster has claimed reward for and amount of rewards owed to poolMembers for an epoch and FeeHandler

#### Example
Check if pool has claimed rewards for epoch 4 and FEE_HANDLER_ADDRESS

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'epochFeeHandlerClaims(4, FEE_HANDLER_ADDRESS)'
```

#### feeHandlersList
An array of addresses added as FeeHandlers

#### rewardTokenByFeeHandle
Mapping reward tokens asociated to feeHandler

#### Example
Check which token is asociated to FEE_HANDLER_ADDRESS

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'rewardTokenByFeeHandle(FEE_HANDLER_ADDRESS)'
```

#### successfulClaimByFeeHandler
Indicates if a claim for a given FeeHandler has already been performed

#### Example
Check a claim has already performed from FEE_HANDLER_ADDRESS

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'successfulClaimByFeeHandler(FEE_HANDLER_ADDRESS)'
```

### Events
#### CommitNewFees
Emitted during contract deployment and whenever `commitNewFee` is called.

event **`CommitNewFees`**(uint256 deadline, uint256 feeRate);
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `deadline` | uint256 | last epoch before the fee gets applied |
| `feeRate` | uint256 |  fee rate |

#### NewFees
Emitted during contract deployment and whenever the pending fee is applied.

event **`NewFees`**(uint256 fromEpoch, uint256 feeRate);
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `fromEpoch` | uint256 | from which epoch the fee is applied |
| `feeRate` | uint256 |  a fee rate |


#### MemberClaimReward
Emitted whenever a pool member claims its reward

event **`MemberClaimReward`**(uint256 indexed epoch, address indexed poolMember, address indexed feeHandler, IERC20 rewardToken, uint256 reward)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | an epoch being claimed |
| `poolMember` | uint256 |  Pool Member's address |
| `feeHandler` | address |  feeHandler's address |
| `rewardToken` | IERC20 |  a reward token |
| `reward` | uint256 | reward transferred |

#### MasterClaimReward
Emitted whenever `claimRewardsMaster` is called successfully

event **`MasterClaimReward`**(uint256 indexed epoch, address indexed poolMaster, address indexed feeHandler, IERC20 rewardToken, uint256 totalRewards, uint256 feeApplied, uint256 feeAmount, uint256 poolMasterShare)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | an epoch being claimed |
| `poolMaster` | uint256 |  Pool Master's address |
| `feeHandler` | address |  feeHandler's address |
| `rewardToken` | IERC20 |  a reward token |
| `totalRewards` | uint256 | total rewards obteined by the pool |
| `feeApplied` | uint256 | a fee applied to the claim |
| `feeAmount` | uint256 | a fee amount charged |
| `poolMasterShare` | uint256 | Pool Master's share |

#### AddFeeHandler
Emmited whenever `addFeeHandler` is called successfully

event **`AddFeeHandler`**(address indexed feeHandler, IERC20 indexed rewardToken)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `feeHandler` | address |  feeHandler's address |
| `rewardToken` | IERC20 |  reward token |

#### RemoveFeeHandler
Emmited whenever `addFeeHandler` is called successfully

event **`RemoveFeeHandler`**(address indexed feeHandler)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `feeHandler` | address |  feeHandler's address |
