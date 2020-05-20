## APIs
The APIs in this section require users to send transactions. Examples are provided using the great [eth-cli](https://github.com/protofire/eth-cli)

##### Setup KyberPoolMaster contract in eth-cli
```bash
eth abi:add KyberPoolMaster PATH_TO_KYBER_POOL_MASTER_CONTRACT_ABI.json
```

## Pool Master only

### Deposit

Pool Master deposits KNC into staking contract through KyberPoolMaster contract.

---
function **`masterDeposit`**(uint256 amount) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `amount` | uint256 | KNC twei to be deposited |
---

#### Example
Deposit 1 KNC

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'masterDeposit(1000000000000000000)' --pk=USER_WALLET_ADDRESS_PK
```

### Withdraw
Pool Master can withdraw KNC (in token wei) from the staking contract at any point in time.

---
function **`masterWithdraw`**(uint256 amount) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `amount` | uint256 | KNC twei to be withdrawn |
---

#### Example
Withdraw 1 KNC

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'masterDeposit(1000000000000000000)' --pk=USER_WALLET_ADDRESS_PK
```

### Vote

Pool Master vote for an option of a campaign.

---
function **`vote`**(uint256 campaignID, uint256 option) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `campaignID` | uint256 | d of campaign to vote for |
| `option` | uint256 | id of options to vote for |
---

#### Example
Vote for option 1 in campaign 2

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'vote(2, 1)' --pk=USER_WALLET_ADDRESS_PK
```

### Transfer Ownership

Some methods are only allowed for contracts owner a.k.a. Pool master. So the ownership can be transferred

---
function **`transeferOwnership`**(uint256 campaignID, uint256 option) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `campaignID` | uint256 | id of campaign to vote for |
| `option` | uint256 | id of options to vote for |
---

#### Example
Set NEW_OWNER_ADDRESS as the new Pool master

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'transeferOwnership(NEW_OWNER_ADDRESS)' --pk=USER_WALLET_ADDRESS_PK
```

### Withdrawing locked ERC20 tokens
To prevent locking misdeposited ERC20 token in KyberPoolMaster contract forever, this function sends the complete amount of the given ERC20 deposited in the contract to a given address.

---
function **`claimErc20Tokens`**(address _token, address _to) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_token` | address | ERC20 token address to claim |
| `_to` | address | address to send the ERC20 token |
---

#### Example
Send SOME_ERC20_ADDRESS to SOME_ADDRESS

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimErc20Tokens(SOME_ERC20_ADDRESS, SOME_ADDRESS)' --pk=USER_WALLET_ADDRESS_PK
```

#### Committing a new Delegation Fee
Pool Master commits a new delegation fee to be applied from `currentEpoch + epochNotive`.

---
function **`commitNewFee`**(uint256 _fee) external **onlyOwner**
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `_fee` | address | new fee denominated in 1e4 units where 100 means 1% |


#### Example
Commit a new fee of 10%.

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'commitNewFee(1000)' --pk=USER_WALLET_ADDRESS_PK
```

## Publicly accessible methods

#### Applying pending delegation fee
Applies the pending new fee. Only one pending fee can be pending at any time.

TODO - how this works

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
| `fromEpoch` | uint256 | epoch where the fee starts |
| `fee` | uint256 | fee denominated in 1e4 units where 100 means 1% |
| `applied` | bool | is the fee applied |


#### Example
Obtain delegation fee data for epoch 5

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getEpochDFeeData(5)'
```

#### delegationFee
Gets the delegation fee data corresponding to the current epoch

---
function **`delegationFee`**() public view returns (uint256 epoch) public view returns (uint256 fromEpoch, uint256 fee, bool applied)
| Returns | Type | Description |
| ---------- |:-------:|:-------------------:|
| `fromEpoch` | uint256 | epoch where the fee starts |
| `fee` | uint256 | fee denominated in 1e4 units where 100 means 1% |
| `applied` | bool | is the fee applied |

#### Example

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'delegationFee()'
```

#### delegationFeesLength
Queries the number of delegation fees created since the contract was deployed.

---
function **`delegationFeesLength`**() public view returns (uint256)


#### claimRewardsMaster
Claims rewards and distribute fees and its share to poolMaster for a given past epoch.

---
function **`claimRewardsMaster`**(uint256 epoch) public
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | for which rewards are being claimed |

#### Example

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'applyPendingFee()' --pk=USER_WALLET_ADDRESS_PK
```

#### getUnclaimedRewardsMember
Queries the amount of unclaimed rewards for the pool member
Return 0 when:
- PoolMaster has not called claimRewardMaster
- PoolMember has previously claimed reward for the epoch
- PoolMember has not stake for the epoch
- PoolMember has not delegated it stake to this contract for the epoch

---
function **`getUnclaimedRewardsMember`**public view returns (uint256)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | for which epoch the memmber is querying unclaimed reward |

#### Example
Pool Member queries its unclaimed reward for epoch 5

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'getUnclaimedRewardsMember(5)' --pk=USER_WALLET_ADDRESS_PK
```

#### claimRewardMember
Claims rewards for poolMember that has not claimed for an epoch previously and the poolMaster has claimed rewards for the pool.

---
function **`claimRewardsMaster`**(uint256 epoch) public
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | for which rewards are being claimed |

#### Example
Pool Members claims its unclaimed reward for epoch 5

```bash
eth contract:send --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimRewardsMaster(5)' --pk=USER_WALLET_ADDRESS_PK
```

## Publicly accessible state variables
### epochNotice
Number of epochs after which a change on deledatioFee is will be applied

#### Example
Obtain epochNotice

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'epochNotice()'
```

### claimedDelegateReward
Mapping of if staker has claimed reward for Epoch

#### Example
Check if STAKER_ADDRESS as claimed reward for epoch 5

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimedDelegateReward(STAKER_ADDRESS, 5)'
```

#### claimedPoolReward
Mapping of if poolMaster has claimed reward for an epoch for the pool

#### Example
Check if pool has claimed rewards for epoch 4

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'claimedPoolReward(4)'
```

#### memberRewards
Amount of rewards owed to poolMembers for an epoch

#### Example
Check poolMembers rewards for epoch 4

```bash
eth contract:call --NETWORK KyberPoolMaster@KYBER_POOL_MASTER_CONTRACT_ADDRESS 'memberRewards(4)'
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
| `feeRate` | uint256 |  fee rate |


#### MemberClaimReward
Emitted whenever a pool member claims its reward

event **`MemberClaimReward`**(uint256 indexed epoch, address indexed poolMember, uint256 reward)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | epoch being claimed |
| `poolMember` | uint256 |  pool member address |
| `reward` | uint256 | reward transferred |

#### MasterClaimReward
Emitted whenever `claimRewardsMaster` is called successfully

event **`MasterClaimReward`**(uint256 indexed epoch, address indexed poolMaster, uint256 totalRewards, uint256 feeApplied, uint256 feeAmount, uint256 poolMasterShare)
| Parameter | Type | Description |
| ---------- |:-------:|:-------------------:|
| `epoch` | uint256 | epoch being claimed |
| `poolMaster` | uint256 |  pool master address |
| `totalRewards` | uint256 | total rewards obteined by the pool |
| `feeApplied` | uint256 | fee applied to the claim |
| `feeAmount` | uint256 | fee amount charged |
| `poolMasterShare` | uint256 | pool master share |
