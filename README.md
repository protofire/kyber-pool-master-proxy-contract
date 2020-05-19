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

TODO

## Deployment

TODO

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
