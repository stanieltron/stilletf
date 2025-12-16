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

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }

    /**
     * @notice Donate ETH yield directly to the vault (no shares minted); ETH is auto-converted to stETH via submit.
     */
    function donateYieldWithETH() external payable {
        require(msg.value > 0, "Zero assets");
        IStETH(address(asset())).submit{value: msg.value}(address(0));
        // no shares minted → boosts totalAssets for existing share holders
    }

    /**
     * @notice Donate stETH yield directly to the vault (no shares minted).
     */
    function donateYield(uint256 assets) external {
        require(assets > 0, "Zero assets");
        IERC20(asset()).transferFrom(msg.sender, address(this), assets);
        // no shares minted → boosts totalAssets for existing share holders
    }

    receive() external payable {}
}
