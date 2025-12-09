// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "forge-std/StdJson.sol";

import "../contracts/StakingVault.sol";
import "../contracts/YieldStrategy-Aavevault.sol";
import "../contracts/MockFluidVault.sol";

using stdJson for string;

struct ExternalAddresses {
    address wbtc;
    address usdc;
    address weth;
    address steth;
    address aavePool;
    address aaveOracle;
    address uniRouter;
}

/**
 * @dev Deployment script for a local mainnet fork.
 * - Expects the node to run against mainnet state (e.g. anvil --fork-url $MAINNET_RPC_URL).
 * - Wires the strategy/vault to production mainnet addresses; uses local MockFluidVault.
 *
 * Usage example:
 *   anvil --fork-url $MAINNET_RPC_URL --fork-block-number 19600000 --chain-id 1
 *   forge script script/DeployStakingVaultMainnetFork.s.sol:DeployStakingVaultMainnetFork \\
 *     --rpc-url http://127.0.0.1:8545 --broadcast --slow
 *
 * Required env:
 *   - PRIVATE_KEY: deployer key prefunded on the local fork
 */
contract DeployStakingVaultMainnetFork is Script {
    // ===== Deploy artifacts =====
    YieldStrategy public strategy;
    StakingVault public vault;
    MockFluidVault public fluid;

    function run() external {
        ExternalAddresses memory cfg = _loadConfig();
        bool skipCodeChecks = _skipExternalCodeChecks();
        _verifyExternalContracts(cfg, skipCodeChecks);

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Deploy strategy first, passing the predicted vault address
        uint256 nextNonce = vm.getNonce(deployer);
        address predictedVault = vm.computeCreateAddress(deployer, nextNonce + 1);

        vm.startBroadcast(deployerKey);

        fluid = new MockFluidVault(cfg.steth);

        strategy = new YieldStrategy(
            predictedVault,
            cfg.wbtc,
            cfg.weth,
            cfg.usdc,
            cfg.steth,
            cfg.aavePool,
            address(fluid),
            cfg.uniRouter,
            cfg.aaveOracle
        );

        vault = new StakingVault(
            cfg.wbtc,
            cfg.usdc,
            address(strategy),
            "STILL WBTC Staking Vault (Mainnet Fork)",
            "stWBTC"
        );

        vm.stopBroadcast();

        console2.log("Deployer", deployer);
        console2.log("YieldStrategy", address(strategy));
        console2.log("StakingVault", address(vault));
        console2.log("External WBTC", cfg.wbtc);
        console2.log("External USDC", cfg.usdc);
        console2.log("External WETH", cfg.weth);
        console2.log("External stETH", cfg.steth);
        console2.log("Aave Pool", cfg.aavePool);
        console2.log("Aave Oracle", cfg.aaveOracle);
        console2.log("Mock Fluid Vault", address(fluid));
        console2.log("Uniswap V3 Router", cfg.uniRouter);
        if (skipCodeChecks) {
            console2.log("Warning: external code checks skipped (ALLOW_MISSING_POOL_CODE=true)");
        }

        _persistAddresses(deployer, cfg);
    }

    function _persistAddresses(address deployer, ExternalAddresses memory cfg) internal {
        string memory label = "addresses";
        string memory json = vm.serializeString(label, "network", "mainnet-fork");
        json = vm.serializeAddress(label, "deployer", deployer);
        json = vm.serializeAddress(label, "wbtc", cfg.wbtc);
        json = vm.serializeAddress(label, "usdc", cfg.usdc);
        json = vm.serializeAddress(label, "weth", cfg.weth);
        json = vm.serializeAddress(label, "stEth", cfg.steth);
        json = vm.serializeAddress(label, "pool", cfg.aavePool);
        json = vm.serializeAddress(label, "oracle", cfg.aaveOracle);
        json = vm.serializeAddress(label, "router", cfg.uniRouter);
        json = vm.serializeAddress(label, "fluid", address(fluid));
        json = vm.serializeAddress(label, "strategy", address(strategy));
        json = vm.serializeAddress(label, "vault", address(vault));

        string memory dir = "cache/deployments";
        vm.createDir(dir, true);
        string memory outfile = string.concat(dir, "/", vm.toString(block.chainid), "-fork.json");
        vm.writeJson(json, outfile);
        console2.log("Saved addresses to", outfile);
    }

    // Sanity checks to avoid accidentally running against a fresh chain without the real dependencies
    function _verifyExternalContracts(ExternalAddresses memory cfg, bool skipCodeChecks) internal view {
        require(cfg.wbtc.code.length > 0, "WBTC missing code");
        require(cfg.usdc.code.length > 0, "USDC missing code");
        require(cfg.weth.code.length > 0, "WETH missing code");
        require(cfg.steth.code.length > 0, "stETH missing code");
        if (!skipCodeChecks) {
            require(cfg.aavePool.code.length > 0, "Aave pool missing code");
            require(cfg.aaveOracle.code.length > 0, "Aave oracle missing code");
            require(cfg.uniRouter.code.length > 0, "Uniswap router missing code");
        }
    }

    function _loadConfig() internal view returns (ExternalAddresses memory cfg) {
        string memory path = _configPath();
        string memory raw = vm.readFile(path);
        cfg.wbtc = raw.readAddress(".wbtc");
        cfg.usdc = raw.readAddress(".usdc");
        cfg.weth = raw.readAddress(".weth");
        cfg.steth = raw.readAddress(".steth");
        cfg.aavePool = raw.readAddress(".aavePool");
        cfg.aaveOracle = raw.readAddress(".aaveOracle");
        cfg.uniRouter = raw.readAddress(".uniRouter");
        return cfg;
    }

    // Allow bypassing external code checks via ALLOW_MISSING_POOL_CODE=true for RPCs missing historical state
    function _skipExternalCodeChecks() internal view returns (bool) {
        try vm.envBool("ALLOW_MISSING_POOL_CODE") returns (bool val) {
            return val;
        } catch {
            return false;
        }
    }

    function _configPath() internal view returns (string memory) {
        try vm.envString("LOCAL_FORK_CONFIG") returns (string memory path) {
            return path;
        } catch {
            return "config/local-fork.json";
        }
    }
}
