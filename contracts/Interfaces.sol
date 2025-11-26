
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPool
 * @notice Aave V3 Pool interface - correct interface from Aave V3 protocol
 */
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256);
    function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external;
    function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external;
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
    function getReserveData(address asset) external view returns (
        uint256 configuration,
        uint128 liquidityIndex,
        uint128 currentLiquidityRate,
        uint128 variableBorrowIndex,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        uint40 lastUpdateTimestamp,
        uint16 id,
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress,
        address interestRateStrategyAddress,
        uint128 accruedToTreasury,
        uint128 unbacked,
        uint128 isolationModeTotalDebt
    );
}

/**
 * @title IAaveOracle
 * @notice Aave V3 Oracle interface for price feeds
 */
interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
    function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory);
    function getSourceOfAsset(address asset) external view returns (address);
    function getFallbackOracle() external view returns (address);
    function setAssetSources(address[] calldata assets, address[] calldata sources) external;
    function setFallbackOracle(address fallbackOracle) external;
    function BASE_CURRENCY() external view returns (address);
    function BASE_CURRENCY_UNIT() external view returns (uint256);
}

/**
 * @title IRewardsController
 * @notice Aave V3 Rewards Controller for incentive distribution
 */
interface IRewardsController {
    function claimAllRewards(address[] calldata assets, address to)
        external
        returns (address[] memory rewardsList, uint256[] memory claimedAmounts);

    function claimAllRewardsToSelf(address[] calldata assets)
        external
        returns (address[] memory rewardsList, uint256[] memory claimedAmounts);

    function claimAllRewardsOnBehalf(address[] calldata assets, address user, address to)
        external
        returns (address[] memory rewardsList, uint256[] memory claimedAmounts);

    function claimRewards(address[] calldata assets, uint256 amount, address to, address reward)
        external
        returns (uint256);

    function claimRewardsOnBehalf(address[] calldata assets, uint256 amount, address user, address to, address reward)
        external
        returns (uint256);

    function claimRewardsToSelf(address[] calldata assets, uint256 amount, address reward)
        external
        returns (uint256);

    function getAllUserRewards(address[] calldata assets, address user)
        external
        view
        returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts);

    function getUserRewards(address[] calldata assets, address user, address reward)
        external
        view
        returns (uint256);
}

/**
 * @title IFluidLending
 * @notice Fluid Lending Protocol interface for liquid staking and yield generation
 */
interface IFluidLending {
    function stake(address token, uint256 amount) external returns (uint256 shares);
    function unstake(address token, uint256 shares) external returns (uint256 amount);
    function withdraw(address token, uint256 amount, address to) external returns (uint256 shares);
    function claimRewards(address user) external returns (uint256 rewards);
    function claimRewardsTo(address user, address to) external returns (uint256 rewards);
    function getPendingRewards(address user) external view returns (uint256);
    function balanceOf(address token, address user) external view returns (uint256);
    function totalSupply(address token) external view returns (uint256);
    function totalBorrowed(address token) external view returns (uint256);
    function getExchangeRate(address token) external view returns (uint256);
    function convertToShares(address token, uint256 amount) external view returns (uint256);
    function convertToAssets(address token, uint256 shares) external view returns (uint256);
    function getSupplyRate(address token) external view returns (uint256);
    function getBorrowRate(address token) external view returns (uint256);
    function getUtilizationRate(address token) external view returns (uint256);
}

/**
 * @title IChainlinkAggregator
 * @notice Chainlink price feed interface
 */
interface IChainlinkAggregator {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function getRoundData(uint80 _roundId)
        external
        view
        returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title IWETH
 * @notice Wrapped ETH interface
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title IWstETH
 * @notice Wrapped staked ETH (Lido) interface
 */
interface IWstETH {
    function wrap(uint256 _stETHAmount) external returns (uint256);
    function unwrap(uint256 _wstETHAmount) external returns (uint256);
    function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256);
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
    function stEthPerToken() external view returns (uint256);
    function tokensPerStEth() external view returns (uint256);
}

/**
 * @title ISwapRouter
 * @notice Uniswap V3 Swap Router interface
 */
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

/**
 * @title IUniswapV3Factory
 * @notice Uniswap V3 Factory interface for pool queries
 */
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}
