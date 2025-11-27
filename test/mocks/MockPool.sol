// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockTokens.sol";

contract MockPool is IPool {
    IERC20 public immutable collateral;
    IERC20 public immutable debtAsset;

    uint256 public supplied;
    uint256 public borrowed;

    constructor(IERC20 _collateral, IERC20 _debt) {
        collateral = _collateral;
        debtAsset = _debt;
    }

    function supply(address asset, uint256 amount, address, uint16) external {
        require(asset == address(collateral), "bad asset");
        collateral.transferFrom(msg.sender, address(this), amount);
        supplied += amount;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == address(collateral), "bad asset");
        if (amount > supplied) amount = supplied;
        supplied -= amount;
        collateral.transfer(to, amount);
        return amount;
    }

    function borrow(address asset, uint256 amount, uint256, uint16, address) external {
        require(asset == address(debtAsset), "bad debt asset");
        uint256 bal = debtAsset.balanceOf(address(this));
        if (bal < amount) {
            // mint gap if mock token supports it
            try MockERC20(address(debtAsset)).mint(address(this), amount - bal) {} catch {}
        }
        borrowed += amount;
        debtAsset.transfer(msg.sender, amount);
    }

    function repay(address asset, uint256 amount, uint256, address) external returns (uint256) {
        require(asset == address(debtAsset), "bad repay asset");
        debtAsset.transferFrom(msg.sender, address(this), amount);
        uint256 paid = amount > borrowed ? borrowed : amount;
        borrowed -= paid;
        return paid;
    }

    function getUserAccountData(address) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256,
        uint256,
        uint256,
        uint256
    ) {
        return (supplied, borrowed, 0, 0, 0, supplied > 0 ? (supplied * 1e18) / (borrowed + 1) : 0);
    }
}
