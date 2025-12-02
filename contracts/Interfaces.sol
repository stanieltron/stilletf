// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal WETH interface for wrapping/unwrapping to native ETH
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
}

// Minimal stETH interface (Lido)
interface IStETH {
    function submit(address referral) external payable returns (uint256);
}

// Aave V3 Pool interface (subset)
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256);
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
}

// Aave Oracle interface (subset)
interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
    function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory);
    function BASE_CURRENCY_UNIT() external view returns (uint256);
}

// Fluid ERC-4626 Vault Interface
interface IFluidLending {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function balanceOf(address owner) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
}

// Uniswap V3 Swap Router Interface (subset)
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

// Strategy interface expected by the vault
interface IYieldStrategy {
    function deposit(uint256 amountUA) external;
    function withdraw(uint256 amountUA, address to) external;
    function harvestYield() external returns (uint256 amountUSDC);
    function rebalance() external;
    function needsRebalance() external view returns (bool);
    function totalAssets() external view returns (uint256);
}
