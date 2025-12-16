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
    address bob = address(0xB0B);
    address carol = address(0xCAFE);

    function setUp() public {
        ua = new MockERC20("Mock WBTC", "WBTC", 8);
        usdc = new MockERC20("Mock USDC", "USDC", 6);
        weth = new MockWETH();
        steth = new MockStETH();
        oracle = new MockOracle();
        pool = new MockPool(IERC20(address(ua)), IERC20(address(weth)), IAaveOracle(address(oracle)));
        fluid = new MockFluidVault(address(steth));

        // Fund WETH contract with ETH to allow unwrapping
        weth.deposit{value: 200 ether}();
        // Ensure pool has WETH liquidity to lend
        weth.mint(address(pool), 100 ether);

        oracle.setPrice(address(ua), oracle.UNIT()); // simplify pricing for tests
        oracle.setPrice(address(weth), oracle.UNIT());
        oracle.setPrice(address(steth), oracle.UNIT());
        oracle.setPrice(address(usdc), oracle.UNIT()); // assume 1 USDC = $1

        router = new MockRouter(address(oracle));

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
            "Vault", "VLT"
        );

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

    function testDirectRewardShowsInPendingAndClaim() public {
        vm.prank(alice);
        vault.stake(5e7); // 0.5 WBTC

        // Simulate strategy sending USDC directly to vault
        usdc.mint(address(vault), 2e6);

        uint256 pendingView = vault.getPendingRewards(alice);
        assertGt(pendingView, 0, "pending view not reflecting direct USDC");

        vm.prank(alice);
        uint256 claimed = vault.claim();
        assertEq(claimed, pendingView, "claimed amount mismatch");
        assertEq(usdc.balanceOf(alice), claimed, "user did not receive USDC");
    }

    function testDepositThenWithdrawExactAmount() public {
        uint256 depositAmount = 5e7; // 0.5 WBTC with 8 decimals

        vm.startPrank(alice);
        uint256 mintedShares = vault.stake(depositAmount);
        assertEq(mintedShares, depositAmount, "shares should match deposit");
        assertEq(vault.balanceOf(alice), depositAmount, "vault balance mismatch");

        uint256 beforeWallet = ua.balanceOf(alice);
        uint256 withdrawn = vault.unstake(mintedShares);
        vm.stopPrank();

        assertEq(withdrawn, depositAmount, "withdrawn amount mismatch");
        assertEq(ua.balanceOf(alice), beforeWallet + depositAmount, "wallet did not receive UA back");
        assertEq(vault.balanceOf(alice), 0, "shares not burned");
    }

    function testFullCycleTwiceWithYieldHarvest() public {
        uint256 depositAmount = 5e7; // 0.5 WBTC
        uint256 aliceUaStart = ua.balanceOf(alice);
        uint256 aliceUsdcStart = usdc.balanceOf(alice);

        _runFullVaultCycle(depositAmount, 1 ether);
        uint256 aliceUsdcAfterFirst = usdc.balanceOf(alice);
        assertEq(ua.balanceOf(alice), aliceUaStart, "UA balance should return after first cycle");
        assertGt(aliceUsdcAfterFirst, aliceUsdcStart, "USDC did not increase after first cycle");

        _runFullVaultCycle(depositAmount, 2 ether);
        assertEq(vault.balanceOf(alice), 0, "shares should be zero after second cycle");
        assertEq(ua.balanceOf(alice), aliceUaStart, "UA balance should return after second cycle");
        assertGt(usdc.balanceOf(alice), aliceUsdcAfterFirst, "USDC did not increase after second cycle");
    }

    function _runFullVaultCycle(uint256 depositAmount, uint256 donationEth) internal {
        vm.startPrank(alice);
        uint256 shares = vault.stake(depositAmount);
        vm.stopPrank();
        assertEq(shares, depositAmount, "shares should match UA deposit");

        vm.deal(address(this), donationEth);
        fluid.donateYieldWithETH{value: donationEth}();

        uint256 harvested = vault.harvestYield();
        assertGt(harvested, 0, "harvest should pull yield");

        uint256 pending = vault.getPendingRewards(alice);
        assertGt(pending, 0, "pending rewards should increase after harvest");

        vm.prank(alice);
        uint256 claimed = vault.claim();
        assertEq(claimed, pending, "claimed rewards mismatch");

        vm.prank(alice);
        uint256 withdrawn = vault.unstake(shares);
        assertEq(withdrawn, depositAmount, "UA withdraw mismatch");
    }

    function testMultiAccountDepositHarvestAndWithdrawAll() public {
        address[3] memory users = [alice, bob, carol];
        uint256 depositAmount = 2e7; // 0.2 WBTC each

        // Fund and approve users (alice already funded/approved in setUp)
        for (uint256 i = 1; i < users.length; i++) {
            ua.mint(users[i], 1e8);
            vm.prank(users[i]);
            ua.approve(address(vault), type(uint256).max);
        }

        // Stake from all users
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            uint256 shares = vault.stake(depositAmount);
            assertEq(shares, depositAmount, "share mismatch");
        }

        // Donate yield and harvest
        vm.deal(address(this), 1 ether);
        fluid.donateYieldWithETH{value: 1 ether}();
        uint256 harvested = vault.harvestYield();
        assertGt(harvested, 0, "no yield harvested");

        // Each user should see roughly equal pending rewards
        uint256[] memory pending = new uint256[](users.length);
        uint256 pendingSum;
        for (uint256 i = 0; i < users.length; i++) {
            pending[i] = vault.getPendingRewards(users[i]);
            pendingSum += pending[i];
            assertGt(pending[i], 0, "pending zero");
        }
        assertApproxEqAbs(pending[0], pending[1], 3, "pending mismatch user1/user2");
        assertApproxEqAbs(pending[1], pending[2], 3, "pending mismatch user2/user3");
        assertApproxEqAbs(pendingSum, harvested, 6, "pending sum mismatch harvested");

        // Claim and verify balances increase
        uint256[] memory beforeUsdc = new uint256[](users.length);
        for (uint256 i = 0; i < users.length; i++) {
            beforeUsdc[i] = usdc.balanceOf(users[i]);
            vm.prank(users[i]);
            uint256 claimed = vault.claim();
            assertApproxEqAbs(claimed, pending[i], 3, "claimed mismatch");
            assertEq(usdc.balanceOf(users[i]), beforeUsdc[i] + claimed, "USDC not received");
        }

        // Withdraw all UA
        for (uint256 i = 0; i < users.length; i++) {
            uint256 beforeUa = ua.balanceOf(users[i]);
            uint256 shares = vault.balanceOf(users[i]);
            vm.prank(users[i]);
            uint256 withdrawn = vault.unstake(shares);
            assertEq(withdrawn, depositAmount, "UA withdraw mismatch");
            assertEq(ua.balanceOf(users[i]), beforeUa + depositAmount, "UA not received");
            assertEq(vault.balanceOf(users[i]), 0, "shares not burned for user");
        }
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
