// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "../contracts/YieldStrategy-Aavevault.sol";
import "../contracts/MockFluidVault.sol";
import "../contracts/Interfaces.sol";
import "./mocks/MockTokens.sol";
import "./mocks/MockOracle.sol";
import "./mocks/MockPool.sol";
import "./mocks/MockRouter.sol";

contract YieldStrategyTest is Test {
    YieldStrategy strategy;
    MockERC20 ua;
    MockERC20 usdc;
    MockWETH weth;
    MockStETH steth;
    MockWstETH wsteth;
    MockOracle oracle;
    MockPool pool;
    MockFluidVault fluid;
    MockRouter router;

    address vault = address(this);

    function setUp() public {
        ua = new MockERC20("Mock WBTC", "WBTC", 8);
        usdc = new MockERC20("Mock USDC", "USDC", 6);
        weth = new MockWETH();
        steth = new MockStETH();
        wsteth = new MockWstETH(address(steth));
        oracle = new MockOracle();
        pool = new MockPool(IERC20(address(ua)), IERC20(address(weth)), IAaveOracle(address(oracle)));
        fluid = new MockFluidVault(address(steth));
        router = new MockRouter(address(oracle));

        // fund WETH contract with ETH and pool with WETH liquidity
        weth.deposit{value: 200 ether}();
        weth.mint(address(pool), 100 ether);

        oracle.setPrice(address(ua), oracle.UNIT());
        oracle.setPrice(address(weth), oracle.UNIT());
        oracle.setPrice(address(steth), oracle.UNIT());
        oracle.setPrice(address(wsteth), oracle.UNIT());
        oracle.setPrice(address(usdc), oracle.UNIT());

        strategy = new YieldStrategy(
            vault,
            address(ua),
            address(weth),
            address(usdc),
            address(steth),
            address(pool),
            address(fluid),
            address(router),
            address(oracle),
            address(wsteth)
        );

        ua.mint(vault, 1e8); // 1 WBTC
    }

    function testDepositBorrowsAndStakes() public {
        // fund strategy with UA as vault would do
        ua.transfer(address(strategy), 5e7);
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(5e7); // 0.5 WBTC

        // Expect pool collateral and debt updated
        (, uint256 debt,, , ,) = pool.getUserAccountData(address(this));
        assertGt(debt, 0, "no debt recorded");

        // Expect Fluid shares minted
        uint256 shares = fluid.balanceOf(address(strategy));
        assertGt(shares, 0, "no fluid shares");
    }

    function testDepositReflectsSuppliedAndNetAssets() public {
        uint256 depositAmount = 5e7; // 0.5 WBTC
        ua.transfer(address(strategy), depositAmount);
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(depositAmount);

        // Supplied collateral should match deposit
        (uint256 collateralBase, uint256 debtBase,, , ,) = pool.getUserAccountData(address(this));
        assertGt(collateralBase, 0, "collateral not recorded");
        assertEq(pool.supplied(), depositAmount, "pool supplied mismatch");

        // Net assets should roughly equal deposited UA (no profit yet)
        uint256 totalAssets = strategy.totalAssets();
        // Allow a tiny tolerance for rounding (0.000001 WBTC = 1e2 units with 8 decimals)
        assertApproxEqAbs(totalAssets, depositAmount, 1e2, "net assets not close to deposit");
        assertGt(debtBase, 0, "debt not recorded");
    }

    function testHarvestCalculatesProfit() public {
        ua.transfer(address(strategy), 5e7);
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(5e7);

        // donate real yield (ETH -> stETH) to fluid vault
        vm.deal(address(this), 2 ether);
        fluid.donateYieldWithETH{value: 2 ether}();

        uint256 usdcBefore = usdc.balanceOf(vault);
        uint256 harvested;
        try strategy.harvestYield() returns (uint256 amt) {
            harvested = amt;
        } catch (bytes memory err) {
            console2.log("strategy harvest revert", string(err));
            logState();
            assertTrue(false, "harvest revert");
        }
        uint256 usdcAfter = usdc.balanceOf(vault);

        assertGt(harvested, 0, "no harvest");
        assertGt(usdcAfter, usdcBefore, "no usdc gained");
    }

    function testHarvestKeepsBufferAndOnlyTakesYield() public {
        ua.transfer(address(strategy), 5e7);
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(5e7);

        // Record pre-donation state
        uint256 sharesBefore = fluid.balanceOf(address(strategy));
        uint256 assetsBefore = fluid.totalAssets();

        // donate yield (ETH -> stETH) to fluid vault
        vm.deal(address(this), 2 ether);
        fluid.donateYieldWithETH{value: 2 ether}();
        uint256 assetsAfterDonation = fluid.totalAssets();
        uint256 donatedYield = assetsAfterDonation - assetsBefore;
        assertGt(donatedYield, 0, "no yield donated");

        uint256 usdcBefore = usdc.balanceOf(vault);
        uint256 harvested = strategy.harvestYield();
        uint256 usdcAfter = usdc.balanceOf(vault);

        uint256 sharesAfter = fluid.balanceOf(address(strategy));

        assertGt(harvested, 0, "nothing harvested");
        assertGt(usdcAfter, usdcBefore, "no usdc harvested");
        assertGt(sharesAfter, 0, "all shares redeemed unexpectedly");
        assertLt(sharesAfter, sharesBefore, "shares did not decrease");
    }

    function testHarvestDoesNotDrainPrincipal() public {
        // Deposit and borrow to create debt
        ua.transfer(address(strategy), 1e8); // 1 WBTC
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(1e8);

        uint256 sharesBefore = fluid.balanceOf(address(strategy));
        assertGt(sharesBefore, 0, "no fluid shares before harvest");

        // Donate yield
        vm.deal(address(this), 1 ether);
        fluid.donateYieldWithETH{value: 1 ether}();

        // Harvest should only redeem profit, not principal
        strategy.harvestYield();

        uint256 sharesAfter = fluid.balanceOf(address(strategy));
        assertGt(sharesAfter, 0, "principal drained");
        assertLt(sharesAfter, sharesBefore, "shares did not decrease after harvest");
    }

    function logState() internal view {
        console2.log("Strategy UA balance", ua.balanceOf(address(strategy)));
        console2.log("Strategy WETH balance", weth.balanceOf(address(strategy)));
        console2.log("Strategy stETH balance", steth.balanceOf(address(strategy)));
        console2.log("Strategy USDC balance", usdc.balanceOf(address(strategy)));
        console2.log("Vault USDC balance", usdc.balanceOf(vault));
        console2.log("Fluid shares held", fluid.balanceOf(address(strategy)));
        console2.log("Fluid totalAssets", fluid.totalAssets());
        console2.log("Pool supplied", pool.supplied());
        console2.log("Pool borrowed", pool.borrowed());
    }
}
