[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage Status](https://coveralls.io/repos/github/protofire/kyber-pool-master-proxy-contract/badge.svg)](https://coveralls.io/github/protofire/kyber-pool-master-proxy-contract)
![CI](https://github.com/protofire/kyber-pool-master-proxy-contract/workflows/CI/badge.svg)

# Kyber PoolMaster proxy contract
Contract that allows pool masters to let pool members claim their designated rewards trustlessly and update fees with sufficient notice times while maintaining full trustlessness.

For pool operators who prefer a trustless mechanism for reward distribution, they can choose to deploy this smart contract, that will store the rewards in the proxy contract and allow their pool members to claim the rewards directly from the proxy contract.

#### Motivation
The current KyberDAO delegation model allows for non-custodial delegation of KNC, but requires pool masters to have a mechanism for storing, tracking and distributing the rewards for members.

#### Functionality
- Store the rewards trustlessly in the smart contract
- Allow the users to claim their rewards from the smart contracts
- Track the rewards that have been claimed by the users

#### How it works
- If you deploy this smart contract, KNC holders can delegate their KNC voting power to the contract where you act as pool operator.
- You can vote on behalf of pool members, but you will have no control over their KNC or ETH rewards.
- After you vote, the subsequent ETH rewards are stored trustlessly in the smart contract and pool members can claim it themselves anytime.
- Rewards can be tracked on-chain.

### About Delegation Fee

#### Commit new fee
This sets a new delegation fee to be applied in a future epoch, lengthening the notice given to Pool members on any fee changes on the PoolMaster Contract to `epochNotice` epochs.
The fee change notice is a public state variable `epochNotice` that can be configured on init, so that poolMasters have more flexibility.

- Only 1 pending fee at any given time
- If at the moment of committing a new fee there is a delegation fee pending to be applied:
  - The pending fee still not able to applied, due to deadline not reached, the new fee will replace the pending one as the new pending, renewing its deadline as well
  - The pending fee can be applied then mark as `applied` and add the new one as pending. Emit NewFees event
- Emit CommitedNewFee event

#### Apply Fee
This is used for noticing that a new fee has been applied.

- Only mark a fee as applied if current epoch is greater or equal to `fromEpoch`
- Mark a fee as applied when a new one is committed an the pending one can be applied
- Mark a fee as applied when claiming reward for an epoch which needs to use the pending fee

## Deployment

1. Create a `.env` file using [.env.example](.env.example) and set:
- `INFURA_PROJECT_ID` your Infura project id
- `DEPLOYMENT_ACCOUNT_PK` your deploying address private key
- `GAS_PRICE` gas price to be used, denominated in wei
- `KYBER_DAO_ADDRESS` KyberDAO address
  - Roptsten: `0x806f978fec453161d11c390c76edb78ff3a010be`
  - Mainnet: `TBD`
- `EPOCH_NOTICE` Delegation fee change notice. Integer parameter, for example EPOCH_NOTICE=2, then on the epoch #10 if you change the delegation fee (commitNewFee), that new fee starts on epoch #12
- `INITIAL_DELEGATION_FEE` Initial delegation fee, denominated in 1e4 units - 100 = 1%

2. Install dependencies
```bash
$ npm install
```

3. Run deployment script, where NETWORK is `ropsten` or `mainnet`
```bash
$ npm run deploy:NETWORK
```

## APIs
[PoolMaster contract APIs](docs/contract-apis.md)

### Resources
- [Staking, Voting Examples](https://github.com/KyberNetwork/developer-portal/blob/stakingSection/staking-voting-examples.md)
- [Delegating Overview And Example](https://github.com/KyberNetwork/developer-portal/blob/stakingSection/delegating-example.md)
- [Kyber Team as DAO Maintainer](https://github.com/KyberNetwork/developer-portal/blob/stakingSection/kyber-team-maintainer.md)
- [Staking and Delegating APIs](https://github.com/KyberNetwork/developer-portal/blob/stakingSection/staking-api.md)
- [KyberDAO FAQs](https://github.com/KyberNetwork/developer-portal/blob/stakingSection/faqs.md)

## Develop

#### Install Dependencies
```bash
npm install
```

#### Test
```bash
npm test
```

#### Run coverage tests
```bash
npm run coverage
```

#### Flatten
Fattened contracts can be used to verify the contract code in a block explorer like BlockScout or Etherscan.
The following command will prepare flattened version of the contract:

```bash
npm run flatten
```
The flattened contracts can be found in the `flats` directory.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
