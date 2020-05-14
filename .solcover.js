module.exports = {
  providerOptions: {
      "default_balance_ether": '1000000',
      "total_accounts": 20
  },
  skipFiles: ['mocks/', 'interfaces/','test/', 'Migrations.sol'],
  istanbulReporter: ['html', 'lcov', 'json'],
}
