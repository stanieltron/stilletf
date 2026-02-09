// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "forge-std/StdJson.sol";
import "../contracts/StakingVault.sol";
import "../contracts/YieldStrategy-Aavevault.sol";
import "../contracts/MockFluidVault.sol";
import "../test/mocks/MockTokens.sol";
import "../test/mocks/MockOracle.sol";
import "../test/mocks/MockPool.sol";
import "../test/mocks/MockRouter.sol";

/**
 * @dev End-to-end deployment on Sepolia with local mocks:
 * - Deploys mock WBTC, USDC, WETH, stETH
 * - Deploys mock Aave pool, oracle, Uniswap router, and MockFluidVault
 * - Wires strategy + vault; mints starter balances for the deployer
 *
 * Run:
 * forge script script/DeployStakingVault.s.sol:DeployStakingVault --rpc-url $SEPOLIA_RPC_URL --broadcast
 * Required env: PRIVATE_KEY (deployer)
 */
contract DeployStakingVault is Script {
    // Persist artifacts to reduce stack usage and aid debugging
    address public deployer;
    MockWETH public weth;
    MockERC20 public wbtc;
    MockERC20 public usdc;
    MockStETH public stEth;
    MockWstETH public wstEth;
    MockOracle public oracle;
    MockRouter public router;
    MockPool public pool;
    MockFluidVault public fluid;
    YieldStrategy public strategy;
    StakingVault public vault;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // --- Core mocks ---
        weth = new MockWETH();
        wbtc = new MockERC20("Mock WBTC", "WBTC", 8);
        usdc = new MockERC20("Mock USDC", "USDC", 6);
        stEth = new MockStETH();
        wstEth = new MockWstETH(address(stEth));
        oracle = new MockOracle();
        router = new MockRouter(address(oracle));
        pool = new MockPool(IERC20(address(wbtc)), IERC20(address(weth)), IAaveOracle(address(oracle)));

        // Seed liquidity with a small ETH footprint (keeps Sepolia spend low)
        weth.deposit{value: 1.00 ether}(); // funds unwrapping capacity
        weth.mint(address(pool), 1 ether); // lendable WETH liquidity
        wbtc.mint(deployer, 100e8); // 10 WBTC to the deployer for testing

        uint256 unit = oracle.UNIT(); // 1e8
        oracle.setPrice(address(wbtc), 60_000 * unit); // $60k per WBTC
        oracle.setPrice(address(usdc), 1 * unit);      // $1 per USDC
        oracle.setPrice(address(weth), 3_000 * unit);  // $3k per WETH
        oracle.setPrice(address(stEth), 3_000 * unit); // $3k per stETH
        oracle.setPrice(address(wstEth), 3_000 * unit); // $3k per wstETH

        // --- Fluid mock vault + strategy + staking vault ---
        uint256 startingNonce = vm.getNonce(deployer);
        address predictedVault = vm.computeCreateAddress(deployer, startingNonce + 2);

        fluid = new MockFluidVault(address(stEth));

        strategy = new YieldStrategy(
            predictedVault,
            address(wbtc),
            address(weth),
            address(usdc),
            address(stEth),
            address(pool),
            address(fluid),
            address(router),
            address(oracle),
            address(wstEth)
        );

        vault = new StakingVault(
            address(wbtc),
            address(usdc),
            address(strategy),
            "STILL WBTC Staking Vault (Sepolia Mock)",
            "stWBTC"
        );

        vm.stopBroadcast();

        console2.log("Deployer", deployer);
        console2.log("Mock WBTC", address(wbtc));
        console2.log("Mock USDC", address(usdc));
        console2.log("Mock WETH", address(weth));
        console2.log("Mock stETH", address(stEth));
        console2.log("Mock Oracle", address(oracle));
        console2.log("Mock Aave Pool", address(pool));
        console2.log("Mock Uniswap Router", address(router));
        console2.log("MockFluidVault", address(fluid));
        console2.log("YieldStrategy", address(strategy));
        console2.log("StakingVault", address(vault));
        console2.log("Deployer WBTC balance", wbtc.balanceOf(deployer));

        _persistAddresses();
    }

    function _persistAddresses() internal {
        string memory label = "addresses";
        string memory json = vm.serializeAddress(label, "deployer", deployer);
        json = vm.serializeAddress(label, "wbtc", address(wbtc));
        json = vm.serializeAddress(label, "usdc", address(usdc));
        json = vm.serializeAddress(label, "weth", address(weth));
        json = vm.serializeAddress(label, "stEth", address(stEth));
        json = vm.serializeAddress(label, "wstEth", address(wstEth));
        json = vm.serializeAddress(label, "oracle", address(oracle));
        json = vm.serializeAddress(label, "pool", address(pool));
        json = vm.serializeAddress(label, "router", address(router));
        json = vm.serializeAddress(label, "fluid", address(fluid));
        json = vm.serializeAddress(label, "strategy", address(strategy));
        json = vm.serializeAddress(label, "vault", address(vault));

        string memory dir = "cache/deployments";
        vm.createDir(dir, true);
        string memory outfile = string.concat(dir, "/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, outfile);
        console2.log("Saved addresses to", outfile);
    }
}
