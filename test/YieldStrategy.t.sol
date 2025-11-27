// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
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
        oracle = new MockOracle();
        pool = new MockPool(IERC20(address(ua)), IERC20(address(weth)));
        fluid = new MockFluidVault(address(steth));
        router = new MockRouter();

        // fund WETH contract with ETH and pool with WETH liquidity
        weth.deposit{value: 200 ether}();
        weth.mint(address(pool), 100 ether);

        oracle.setPrice(address(ua), 30000 * oracle.UNIT());
        oracle.setPrice(address(weth), 2000 * oracle.UNIT());
        oracle.setPrice(address(steth), 2000 * oracle.UNIT());
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
            address(oracle)
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

    function testHarvestCalculatesProfit() public {
        ua.transfer(address(strategy), 5e7);
        ua.approve(address(strategy), type(uint256).max);
        strategy.deposit(5e7);

        uint256 harvested = strategy.harvestYield();
        // mock router returns amountIn; with no profit harvested can be zero but should not revert
        assertEq(harvested, 0, "unexpected harvest");
    }
}
