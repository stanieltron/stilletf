#!/usr/bin/env bash
set -euo pipefail

# Launch a local mainnet fork, fund the deployer, and run the forge script in one go.
# Anvil is started and left running so you can keep using the fork after deploy.
# Env vars:
#   MAINNET_RPC_URL (required)   - source RPC for forking
#   PRIVATE_KEY (required)       - deployer private key for forge broadcast
#   PRIVATE_KEY_ADDRESS (opt)    - address to fund; derived from PRIVATE_KEY if omitted
#   LOCAL_FORK_CONFIG (opt)      - path to JSON with external addresses (default: config/local-fork.json)
#   ALLOW_MISSING_POOL_CODE (opt)- set true to skip external code checks when RPC lacks bytecode
#   FORK_BLOCK (opt)             - mainnet block number to fork (default: 19600000)
#   CHAIN_ID (opt)               - fork chain id (default: 1)
#   ANVIL_PORT (opt)             - RPC port (default: 8545)
#   ANVIL_LOG (opt)              - log file for anvil (default: /tmp/anvil-mainnet-fork.log)

MAINNET_RPC_URL=${MAINNET_RPC_URL:-}
PRIVATE_KEY=${PRIVATE_KEY:-}
PRIVATE_KEY_ADDRESS=${PRIVATE_KEY_ADDRESS:-}
FORK_BLOCK=${FORK_BLOCK:-19600000}
CHAIN_ID=${CHAIN_ID:-1}
ANVIL_PORT=${ANVIL_PORT:-8545}
ANVIL_LOG=${ANVIL_LOG:-/tmp/anvil-mainnet-fork.log}
RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
LOCAL_FORK_CONFIG=${LOCAL_FORK_CONFIG:-config/local-fork.json}

if [[ -z "$MAINNET_RPC_URL" ]]; then
  echo "MAINNET_RPC_URL is required" >&2
  exit 1
fi

if [[ -z "$PRIVATE_KEY" ]]; then
  echo "PRIVATE_KEY is required" >&2
  exit 1
fi

if [[ -z "$PRIVATE_KEY_ADDRESS" ]]; then
  PRIVATE_KEY_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
fi

echo "Starting anvil fork on port ${ANVIL_PORT} (chainId=${CHAIN_ID}, block=${FORK_BLOCK})..."
anvil --fork-url "$MAINNET_RPC_URL" \
  --fork-block-number "$FORK_BLOCK" \
  --chain-id "$CHAIN_ID" \
  --port "$ANVIL_PORT" \
  --block-time 1 \
  --code-size-limit 50000 \
  2> >(tee "$ANVIL_LOG") > >(tee -a "$ANVIL_LOG") &

ANVIL_PID=$!
echo "Anvil PID: ${ANVIL_PID} (logs mirrored to ${ANVIL_LOG})"

echo "Waiting for anvil to be ready..."
until cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; do
  sleep 0.5
done

echo "Funding ${PRIVATE_KEY_ADDRESS} with 1000 ETH on the fork..."
cast rpc --rpc-url "$RPC_URL" anvil_setBalance "$PRIVATE_KEY_ADDRESS" "$(cast to-hex "$(cast to-wei 1000 ether)")"

echo "Deploying contracts with forge script..."
LOCAL_FORK_CONFIG="$LOCAL_FORK_CONFIG" \
ALLOW_MISSING_POOL_CODE="${ALLOW_MISSING_POOL_CODE:-}" \
PRIVATE_KEY="$PRIVATE_KEY" \
forge script script/DeployStakingVaultMainnetFork.s.sol:DeployStakingVaultMainnetFork \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow

echo "Deployment finished. Anvil is still running (PID ${ANVIL_PID}). Press Ctrl+C here to stop it when you're done."
