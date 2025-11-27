// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "../contracts/StakingVault.sol";
import "../contracts/YieldStrategy-Aavevault.sol";
import "../contracts/MockFluidVault.sol";
import "../contracts/Interfaces.sol";
import "./mocks/MockTokens.sol";
import "./mocks/MockOracle.sol";
import "./mocks/MockPool.sol";
import "./mocks/MockRouter.sol";

contract StakingVaultTest is Test {
    StakingVault vault;
    YieldStrategy strategy;

    MockERC20 ua;
    MockERC20 usdc;
    MockWETH weth;
    MockStETH steth;
    MockOracle oracle;
    MockPool pool;
    MockFluidVault fluid;
    MockRouter router;

    address alice = address(0xA11CE);

    function setUp() public {
        ua = new MockERC20("Mock WBTC", "WBTC", 8);
        usdc = new MockERC20("Mock USDC", "USDC", 6);
        weth = new MockWETH();
        steth = new MockStETH();
        oracle = new MockOracle();
        pool = new MockPool(IERC20(address(ua)), IERC20(address(weth)));
        fluid = new MockFluidVault(address(steth));

        // Fund WETH contract with ETH to allow unwrapping
        weth.deposit{value: 200 ether}();
        // Ensure pool has WETH liquidity to lend
        weth.mint(address(pool), 100 ether);

        oracle.setPrice(address(ua), oracle.UNIT()); // simplify pricing for tests
        oracle.setPrice(address(weth), oracle.UNIT());
        oracle.setPrice(address(steth), oracle.UNIT());
        oracle.setPrice(address(usdc), oracle.UNIT()); // assume 1 USDC = $1

        router = new MockRouter();

        // Predict vault address (next deployment)
        address predictedVault = computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);

        strategy = new YieldStrategy(
            predictedVault,
            address(ua),
            address(weth),
            address(usdc),
            address(steth),
            address(pool),
            address(fluid),
            address(router),
            address(oracle)
        );

        vault = new StakingVault(
            address(ua),
            address(usdc),
            address(strategy),
            address(0xBEEF),
            "Vault", "VLT"
        );
        vault.setProfitShare(0);

        assertEq(strategy.vault(), address(vault), "strategy vault mismatch");

        ua.mint(alice, 1e8); // 1 WBTC
        vm.prank(alice);
        ua.approve(address(vault), type(uint256).max);
    }

    function testStakeAndHarvestFlow() public {
        vm.prank(alice);
        vault.stake(5e7); // 0.5 WBTC

        // Mock strategy harvest to avoid integration flakiness in tests
        usdc.mint(address(vault), 1e6);
        vm.mockCall(
            address(strategy),
            abi.encodeWithSelector(IYieldStrategy.harvestYield.selector),
            abi.encode(uint256(1e6))
        );

        // harvest should distribute rewards
        try vault.harvestYield() {
            // ok
        } catch (bytes memory err) {
            console2.log("harvest revert", string(err));
            logState();
            assertTrue(false, "harvest revert");
        }

        uint256 pending = vault.getPendingRewards(alice);
        assertGt(pending, 0, "no rewards accrued");
    }

    function logState() internal view {
        console2.log("Vault UA balance", ua.balanceOf(address(vault)));
        console2.log("Strategy UA balance", ua.balanceOf(address(strategy)));
        console2.log("Strategy WETH balance", weth.balanceOf(address(strategy)));
        console2.log("Strategy stETH balance", steth.balanceOf(address(strategy)));
        console2.log("Strategy USDC balance", usdc.balanceOf(address(strategy)));
        console2.log("Vault USDC balance", usdc.balanceOf(address(vault)));
        console2.log("Fluid shares held", fluid.balanceOf(address(strategy)));
        console2.log("Fluid totalAssets", fluid.totalAssets());
        console2.log("Pool supplied", pool.supplied());
        console2.log("Pool borrowed", pool.borrowed());
        console2.log("Strategy vault address", strategy.vault());
        console2.log("Actual vault address", address(vault));
    }

    function computeCreateAddress(address deployer, uint256 nonce) internal pure override returns (address) {
        bytes memory data;
        if (nonce == 0x00) data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(0x80));
        else if (nonce <= 0x7f) data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, uint8(nonce));
        else if (nonce <= 0xff) data = abi.encodePacked(bytes1(0xd7), bytes1(0x94), deployer, bytes1(0x81), uint8(nonce));
        else if (nonce <= 0xffff) data = abi.encodePacked(bytes1(0xd8), bytes1(0x94), deployer, bytes1(0x82), uint16(nonce));
        else if (nonce <= 0xffffff) data = abi.encodePacked(bytes1(0xd9), bytes1(0x94), deployer, bytes1(0x83), uint24(nonce));
        else data = abi.encodePacked(bytes1(0xda), bytes1(0x94), deployer, bytes1(0x84), uint32(nonce));
        return address(uint160(uint256(keccak256(data))));
    }
}
