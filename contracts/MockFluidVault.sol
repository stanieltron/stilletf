// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Interfaces.sol";

/**
 * @title MockFluidVault
 * @notice Simple ERC4626 vault for testing on Sepolia, using stETH as the asset.
 *         Provides helpers to fund via ETH (wrapped to stETH) to simulate Fluid deposits.
 */
contract MockFluidVault is ERC4626, ERC20Permit {
    constructor(address stEth)
        ERC20("Mock Fluid Vault", "mFLUID")
        ERC20Permit("Mock Fluid Vault")
        ERC4626(IERC20(stEth))
    {}

    /**
     * @notice Donate ETH (or stETH) into the vault; ETH is auto-converted to stETH via submit.
     */
    function donateAssets() external payable returns (uint256 shares) {
        uint256 stAmount = msg.value;
        if (msg.value > 0) {
            stAmount = IStETH(address(asset())).submit{value: msg.value}(address(0));
        }
        require(stAmount > 0, "Zero assets");
        // If caller prefers to send stETH directly, allow standard transfer
        uint256 direct = IERC20(asset()).allowance(msg.sender, address(this));
        if (direct > 0) {
            IERC20(asset()).transferFrom(msg.sender, address(this), direct);
            stAmount += direct;
        }
        shares = previewDeposit(stAmount);
        _deposit(msg.sender, msg.sender, stAmount, shares);
    }

    receive() external payable {}
}
