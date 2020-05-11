#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit
node_modules/.bin/truffle version
# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

if [ "$SOLIDITY_COVERAGE" = true ]; then
  ganache_port=8555
else
  ganache_port=8545
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  if [ "$SOLIDITY_COVERAGE" != true ]; then
    node_modules/.bin/ganache-cli --gasLimit -a 20 -e 1000000 > /dev/null &
  fi

  ganache_pid=$!
}

if [ "$SOLIDITY_COVERAGE" != true ]; then
    if ganache_running; then
      echo "Using existing ganache instance"
    else
      echo "Starting our own ganache instance"
      start_ganache
    fi
fi

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node --max-old-space-size=4096 node_modules/.bin/truffle test; istanbul report lcov

  if [ "$CONTINUOUS_INTEGRATION" = true ]; then
    cat coverage/lcov.info | node_modules/.bin/coveralls
  fi
else
  node_modules/.bin/truffle test ./scripts/stress/claim-master.js --network ganache  "$@"
fi
