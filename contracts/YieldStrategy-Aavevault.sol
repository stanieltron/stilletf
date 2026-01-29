// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces.sol";

/**
 * @title YieldStrategy
 * @notice Strategy that uses UA as collateral to borrow wstETH and stake in Fluid
 * @dev Implements automated rebalancing and yield harvesting from Fluid lending
 */
contract YieldStrategy is ReentrancyGuard, Ownable, IYieldStrategy {
    using SafeERC20 for IERC20;

    // ============ Immutables ============
    address public immutable vault;
    IERC20 public immutable UA; // Underlying asset (e.g., WBTC) used as collateral
    IERC20 public immutable borrowedAsset; // Asset to borrow (WETH)
    IERC20 public immutable stETH; // Asset deposited into Fluid vault
    address public immutable wstETH; // stETH wrapper used for oracle pricing
    IERC20 public immutable USDC; // Yield token for rewards
    uint8 public immutable uaDecimals;
    uint8 public immutable borrowedDecimals;
    uint8 public immutable stEthDecimals;
    IPool public immutable aavePool; // Aave V3 Pool
    IFluidLending public immutable fluidLending; // Fluid lending protocol
    ISwapRouter public immutable swapRouter; // For swapping rewards to USDC
    IAaveOracle public immutable aaveOracle; // Aave's price aaveOracle

    // ============ Position State ============
    uint256 public totalCollateral; // Total UA deposited as collateral in Aave (derived)
    uint256 public totalBorrowed; // Total borrowed asset amount (derived)
    uint256 public totalStakedInFluid; // Total amount staked in Fluid (derived)
    uint256 public totalDebt; // Total debt in base currency

    // ============ Leverage Parameters ============
    uint256 public constant OPTIMAL_LTV = 5000; // 50% optimal borrowing ratio
    uint256 public constant REBALANCE_THRESHOLD = 500; // 5% deviation triggers rebalance (500 basis points)
    uint256 public constant HARVEST_BUFFER_BPS = 500; // 5% of profit retained to cover interest
    uint256 public constant MAX_BPS = 10000;

    // ============ Swap Parameters ============
    uint24 public constant POOL_FEE = 3000; // 0.3% Uniswap pool fee
    uint256 public constant SLIPPAGE_BPS = 100; // 1% slippage tolerance
    
    // ============ Yield Tracking ============
    uint256 public lastHarvestBlock;
    uint256 public immutable baseCurrencyUnit; // oracle base currency unit (e.g., 1e8)

    // ============ Events ============
    event Deposited(uint256 amountUA);
    event Withdrawn(uint256 amountUA, address to);
    event YieldHarvested(uint256 amountUSDC);
    event Rebalanced(uint256 collateral, uint256 debt, uint256 ltv);
    event BorrowedAndStaked(uint256 amountBorrowed, uint256 amountStaked);
    event UnstakedAndRepaid(uint256 amountUnstaked, uint256 amountRepaid);

    // ============ Modifiers ============
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }

    // ============ Constructor ============
    constructor(
        address _vault,
        address _UA,
        address _borrowedAsset,
        address _USDC,
        address _stETH,
        address _aavePool,
        address _fluidLending,
        address _swapRouter,
        address _aaveOracle,
        address _wstETH
    ) Ownable(msg.sender) {
        require(_vault != address(0), "Invalid vault address");
        require(_UA != address(0), "Invalid UA address");
        require(_borrowedAsset != address(0), "Invalid borrowed asset");
        require(_stETH != address(0), "Invalid stETH address");
        require(_wstETH != address(0), "Invalid wstETH address");
        // borrowed asset must be WETH-compatible to unwrap
        require(_borrowedAsset.code.length > 0, "Borrowed asset not a contract");
        require(_USDC != address(0), "Invalid USDC address");
        require(_aavePool != address(0), "Invalid Aave pool");
        require(_fluidLending != address(0), "Invalid Fluid lending");
        require(_swapRouter != address(0), "Invalid swap router");
        require(_aaveOracle != address(0), "Invalid aaveOracle");

        vault = _vault;
        UA = IERC20(_UA);
        borrowedAsset = IERC20(_borrowedAsset); // fixed borrowed asset (e.g., WETH) set at deploy time
        stETH = IERC20(_stETH);
        wstETH = _wstETH;
        USDC = IERC20(_USDC);
        uaDecimals = IERC20Metadata(_UA).decimals();
        borrowedDecimals = IERC20Metadata(_borrowedAsset).decimals();
        stEthDecimals = IERC20Metadata(_stETH).decimals();
        aavePool = IPool(_aavePool);
        fluidLending = IFluidLending(_fluidLending);
        swapRouter = ISwapRouter(_swapRouter);
        aaveOracle = IAaveOracle(_aaveOracle);
        baseCurrencyUnit = IAaveOracle(_aaveOracle).BASE_CURRENCY_UNIT();
        require(baseCurrencyUnit > 0, "Invalid base unit");
        
        // Initialize reward assets array
        lastHarvestBlock = block.number;
        _syncAccounting();
    }

    // ============ Core Strategy Functions ============

    /**
     * @notice Deposit UA as collateral, borrow wstETH, stake in Fluid
     * @param amountUA Amount of underlying asset to deposit
     */
    function deposit(uint256 amountUA) external onlyVault nonReentrant {
        // 1. Supply UA as collateral to Aave V3
        require(UA.approve(address(aavePool), 0), "UA approve reset failed");
        require(UA.approve(address(aavePool), amountUA), "UA approve failed");
        aavePool.supply(address(UA), amountUA, address(this), 0);
        totalCollateral += amountUA;
        
        // 2. Calculate how much to borrow based on OPTIMAL_LTV
        uint256 uaPrice = aaveOracle.getAssetPrice(address(UA));
        require(uaPrice > 0, "UA price zero");
        uint256 collateralValueBase = (amountUA * uaPrice) / (10 ** uaDecimals);
        uint256 targetBorrowValueBase = (collateralValueBase * OPTIMAL_LTV) / 10000;

        // Cap by available borrows with a safety buffer
        (, , uint256 availableBorrowsBase, , , ) = aavePool.getUserAccountData(address(this));
        if (availableBorrowsBase == 0) return;
        if (targetBorrowValueBase > availableBorrowsBase) {
            targetBorrowValueBase = availableBorrowsBase;
        }
        
        // 3. Calculate amount of borrowedAsset (e.g., wstETH) to borrow
        uint256 borrowedAssetPrice = aaveOracle.getAssetPrice(address(borrowedAsset));
        require(borrowedAssetPrice > 0, "Borrow price zero");
        uint256 amountToBorrow = (targetBorrowValueBase * (10 ** borrowedDecimals)) / borrowedAssetPrice;
        
        // 4. Borrow the asset from Aave (variable rate = 2)
        if (amountToBorrow > 0) {
            aavePool.borrow(address(borrowedAsset), amountToBorrow, 2, 0, address(this));
            totalBorrowed += amountToBorrow;
            
            // unwrap WETH to ETH
            IWETH(address(borrowedAsset)).withdraw(amountToBorrow);
            // wrap ETH to stETH
            uint256 stEthReceived = IStETH(address(stETH)).submit{value: amountToBorrow}(address(0));

            // 5. Deposit stETH into ERC4626 vault
            require(stETH.approve(address(fluidLending), 0), "stETH approve reset failed");
            require(stETH.approve(address(fluidLending), stEthReceived), "stETH approve failed");
            uint256 mintedShares = fluidLending.deposit(stEthReceived, address(this));
            totalStakedInFluid += mintedShares;
            
            emit BorrowedAndStaked(amountToBorrow, mintedShares);
        }
        
        // 6. Update debt tracking
        _syncAccounting();
        
        emit Deposited(amountUA);
    }

    /**
     * @notice Withdraw UA by unwinding position from Fluid and Aave
     * @param amountUA Amount of underlying asset to withdraw
     * @param to Address to send withdrawn UA
     */
    function withdraw(uint256 amountUA, address to) external onlyVault nonReentrant {
        _syncAccounting();
        require(totalCollateral > 0, "NO_COLLATERAL");
        // Calculate proportional unwinding needed
        uint256 shareToWithdraw = (amountUA * 1e18) / totalCollateral;
        
        // 1. Calculate amount to unstake from Fluid
        uint256 amountToUnstake = (totalStakedInFluid * shareToWithdraw) / 1e18;
        
        // 2. Unstake from Fluid
        if (amountToUnstake > 0) {
            uint256 unstakedAmount = fluidLending.redeem(amountToUnstake, address(this), address(this));
            totalStakedInFluid -= amountToUnstake;
            
            // 3. Convert stETH to WETH for repayment
            uint256 wethAmount = _swapToToken(address(stETH), address(borrowedAsset), unstakedAmount);
            
            // 4. Repay debt to Aave
            require(borrowedAsset.approve(address(aavePool), 0), "Repay approve reset failed");
            require(borrowedAsset.approve(address(aavePool), wethAmount), "Repay approve failed");
            uint256 repaidAmount = aavePool.repay(address(borrowedAsset), wethAmount, 2, address(this));
            totalBorrowed = totalBorrowed > repaidAmount ? totalBorrowed - repaidAmount : 0;
            
            emit UnstakedAndRepaid(unstakedAmount, repaidAmount);
        }
        
        // 4. Withdraw collateral from Aave
        aavePool.withdraw(address(UA), amountUA, to);
        totalCollateral -= amountUA;
        
        // 5. Update debt tracking
        _syncAccounting();
        
        emit Withdrawn(amountUA, to);
    }

    /**
     * @notice Rebalance position to maintain optimal leverage
     * @dev Permissionless - anyone can call when LTV deviates by 5%
     */
    function rebalance() external nonReentrant {
        _syncAccounting();
        require(needsRebalance(), "NO_REBALANCE_NEEDED");
        
        uint256 currentLTV = getCurrentLTV();
        
        if (currentLTV > OPTIMAL_LTV + REBALANCE_THRESHOLD) {
            // LTV too high (above 80%) - reduce borrowing
            _reduceBorrowing();
        } else if (currentLTV < OPTIMAL_LTV - REBALANCE_THRESHOLD) {
            // LTV too low (below 70%) - increase borrowing
            _increaseBorrowing();
        }
        
        _syncAccounting();
        emit Rebalanced(totalCollateral, totalDebt, getCurrentLTV());
    }

    /**
     * @notice Harvest yield from Fluid and Aave rewards
     * @dev Public function - callable by vault or anyone
     * @return amountUSDC Amount of USDC harvested
     */
    function harvestYield() external nonReentrant returns (uint256 amountUSDC) {
        // Use fresh debt data to avoid draining principal when tracking is stale
        ( , uint256 debtBase) = _getAccountData();

        _syncAccounting();
        uint256 shares = fluidLending.balanceOf(address(this));
        if (shares == 0) return 0;

        uint256 assetsInVault = fluidLending.convertToAssets(shares); // stETH units
        uint256 stEthPrice = _stEthPrice();
        uint256 debtPrice = _safePrice(address(borrowedAsset));
        if (stEthPrice == 0 || debtPrice == 0) return 0;

        // Compute profit in base terms
        uint256 stakedBase = (assetsInVault * stEthPrice) / (10 ** stEthDecimals);
        if (stakedBase <= debtBase) return 0;

        uint256 profitBase = stakedBase - debtBase;
        uint256 harvestBase = (profitBase * (MAX_BPS - HARVEST_BUFFER_BPS)) / MAX_BPS;
        if (harvestBase == 0) return 0;

        uint256 harvestAssets = (harvestBase * (10 ** stEthDecimals)) / stEthPrice;
        if (harvestAssets == 0) return 0;

        uint256 sharesToRedeem = fluidLending.convertToShares(harvestAssets);
        if (sharesToRedeem == 0) return 0;
        if (sharesToRedeem > shares) sharesToRedeem = shares;

        uint256 redeemedAssets = fluidLending.redeem(sharesToRedeem, address(this), address(this));
        totalStakedInFluid = shares - sharesToRedeem;

        // Swap profit (stETH) to USDC
        amountUSDC = _swapToUSDC(address(stETH), redeemedAssets);

        if (amountUSDC > 0) {
            USDC.safeTransfer(vault, amountUSDC);
            emit YieldHarvested(amountUSDC);
        }

        lastHarvestBlock = block.number;
        _syncAccounting();
        return amountUSDC;
    }

    // ============ View Functions ============

    /**
     * @notice Check if rebalancing is needed
     * @return True if LTV deviates more than 5% from optimal
     */
    function needsRebalance() public view returns (bool) {
        uint256 currentLTV = getCurrentLTV();
        
        // Need rebalance if LTV is outside the 5% threshold range (70% - 80%)
        if (currentLTV > OPTIMAL_LTV + REBALANCE_THRESHOLD) return true; // Above 80%
        if (currentLTV < OPTIMAL_LTV - REBALANCE_THRESHOLD) return true; // Below 70%
        
        return false;
    }

    /**
     * @notice Get current loan-to-value ratio
     * @return Current LTV in basis points
     */
    function getCurrentLTV() public view returns (uint256) {
        (uint256 collateralBase, uint256 debtBase) = _getAccountData();
        if (collateralBase == 0) return 0;
        return (debtBase * 10000) / collateralBase;
    }

    /**
     * @notice Get total assets under management (net of debt)
     * @return Net UA value under management
     */
    function totalAssets() external view returns (uint256) {
        // Net value = Collateral - Debt (in UA terms)
        uint256 uaPrice = _safePrice(address(UA));
        if (uaPrice == 0) return 0;

        (uint256 collateralBase, uint256 debtBase) = _getAccountData();
        uint256 stEthPrice = _stEthPrice();
        uint256 stakedBase = 0;
        if (stEthPrice > 0) {
            uint256 stakedAssets = fluidLending.convertToAssets(fluidLending.balanceOf(address(this)));
            stakedBase = (stakedAssets * stEthPrice) / (10 ** stEthDecimals);
        }

        uint256 equityBase = collateralBase + stakedBase;
        if (debtBase > equityBase) return 0;
        equityBase -= debtBase;

        return (equityBase * (10 ** uaDecimals)) / uaPrice;
    }

    /**
     * @notice Get current health factor from lending protocol
     * @return Health factor (scaled to 1e18)
     */
    function getHealthFactor() external view returns (uint256) {
        (, , , , , uint256 healthFactor) = aavePool.getUserAccountData(address(this));
        return healthFactor;
    }

    /**
     * @notice Get amount staked in Fluid
     * @return Amount of borrowed asset staked in Fluid
     */
    function getFluidStakedAmount() external view returns (uint256) {
        return fluidLending.balanceOf(address(this));
    }

    // ============ Internal Functions ============

    /**
     * @notice Reduce borrowing to decrease LTV back to optimal
     */
    function _reduceBorrowing() internal {
        (uint256 collateralBase, ) = _getAccountData();
        uint256 targetDebtBase = (collateralBase * OPTIMAL_LTV) / 10000;
        
        if (totalDebt > targetDebtBase) {
            uint256 excessDebtBase = totalDebt - targetDebtBase;
            
            uint256 borrowedAssetPrice = _safePrice(address(borrowedAsset));
            uint256 stEthPrice = _stEthPrice();
            if (borrowedAssetPrice == 0 || stEthPrice == 0) return;
            uint256 amountToRepay = (excessDebtBase * (10 ** borrowedDecimals)) / borrowedAssetPrice;
            
            // Unstake from Fluid
            if (amountToRepay > 0 && totalStakedInFluid > 0) {
                uint256 stEthNeeded = (amountToRepay * stEthPrice) / borrowedAssetPrice;
                uint256 sharesToRedeem = fluidLending.convertToShares(stEthNeeded);
                if (sharesToRedeem > totalStakedInFluid) sharesToRedeem = totalStakedInFluid;
                uint256 stEthUnstaked = fluidLending.redeem(sharesToRedeem, address(this), address(this));
                totalStakedInFluid -= sharesToRedeem;
                
                // Swap stETH to WETH then repay to Aave
                uint256 wethReceived = _swapToToken(address(stETH), address(borrowedAsset), stEthUnstaked);
                require(borrowedAsset.approve(address(aavePool), 0), "Rebalance repay reset failed");
                require(borrowedAsset.approve(address(aavePool), wethReceived), "Rebalance repay approve failed");
                aavePool.repay(address(borrowedAsset), wethReceived, 2, address(this));
                totalBorrowed = totalBorrowed > wethReceived ? totalBorrowed - wethReceived : 0;
            }
        }
        
        _syncAccounting();
    }

    /**
     * @notice Increase borrowing to reach optimal LTV
     */
    function _increaseBorrowing() internal {
        (uint256 collateralBase, ) = _getAccountData();
        uint256 targetDebtBase = (collateralBase * OPTIMAL_LTV) / 10000;
        
        if (targetDebtBase > totalDebt) {
            uint256 additionalDebtBase = targetDebtBase - totalDebt;

            (, , uint256 availableBorrowsBase, , , ) = aavePool.getUserAccountData(address(this));
            if (availableBorrowsBase <= totalDebt) return;
            if (availableBorrowsBase <= totalDebt) return;
            uint256 maxAdditional = availableBorrowsBase - totalDebt;
            if (additionalDebtBase > maxAdditional) {
                additionalDebtBase = maxAdditional;
            }
            
            uint256 borrowedAssetPrice = _safePrice(address(borrowedAsset));
            if (borrowedAssetPrice == 0) return;
            uint256 amountToBorrow = (additionalDebtBase * (10 ** borrowedDecimals)) / borrowedAssetPrice;
            
            // Borrow from Aave
            if (amountToBorrow > 0) {
                aavePool.borrow(address(borrowedAsset), amountToBorrow, 2, 0, address(this));
                totalBorrowed += amountToBorrow;
                
                // Stake in Fluid (convert WETH -> stETH -> deposit)
                IWETH(address(borrowedAsset)).withdraw(amountToBorrow);
                uint256 stEthReceived = IStETH(address(stETH)).submit{value: amountToBorrow}(address(0));
                require(stETH.approve(address(fluidLending), 0), "Stake approve reset failed");
                require(stETH.approve(address(fluidLending), stEthReceived), "Stake approve failed");
                uint256 staked = fluidLending.deposit(stEthReceived, address(this));
                totalStakedInFluid += staked;
            }
        }
        
        _syncAccounting();
    }

    /**
     * @notice Update debt tracking from lending protocol
     */
    function _updateDebtTracking() internal {
        _syncAccounting();
    }

    /**
     * @notice Swap any token to USDC
     */
    function _swapToUSDC(address token, uint256 amount) internal returns (uint256) {
        return _swapToToken(token, address(USDC), amount);
    }

    /**
     * @notice Swap tokenIn to tokenOut using Uniswap V3 with oracle-based slippage guard
     */
    function _swapToToken(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256) {
        if (tokenIn == tokenOut) return amountIn;
        if (amountIn == 0) return 0;

        require(IERC20(tokenIn).approve(address(swapRouter), 0), "Swap approve reset failed");
        require(IERC20(tokenIn).approve(address(swapRouter), amountIn), "Swap approve failed");

        uint256 priceIn = tokenIn == address(stETH) ? _stEthPrice() : _safePrice(tokenIn);
        uint256 priceOut = tokenOut == address(stETH) ? _stEthPrice() : _safePrice(tokenOut);
        if (priceIn == 0 || priceOut == 0) return 0;

        uint8 outDecimals = IERC20Metadata(tokenOut).decimals();
        uint256 valueBase = (amountIn * priceIn) / baseCurrencyUnit;
        uint256 expectedOut = (valueBase * (10 ** outDecimals)) / priceOut;
        uint256 minAmountOut = (expectedOut * (10000 - SLIPPAGE_BPS)) / 10000;

        try swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: POOL_FEE,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Emergency function to unwind position
     * @dev Only callable by owner in emergency situations
     */
    function emergencyUnwind() external onlyOwner {
        // Unstake everything from Fluid
        if (totalStakedInFluid > 0) {
            uint256 unstaked = fluidLending.redeem(totalStakedInFluid, address(this), address(this));
            totalStakedInFluid = 0;
            
            // Swap stETH to WETH and repay as much debt as possible
            uint256 wethReceived = _swapToToken(address(stETH), address(borrowedAsset), unstaked);
            require(borrowedAsset.approve(address(aavePool), 0), "Emergency repay reset failed");
            require(borrowedAsset.approve(address(aavePool), wethReceived), "Emergency repay approve failed");
            aavePool.repay(address(borrowedAsset), wethReceived, 2, address(this));
            totalBorrowed = 0;
        }
        
        _updateDebtTracking();
    }

    /**
     * @notice Emergency withdrawal function (owner only)
     * @dev Only for emergency recovery scenarios
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============ Internal Helpers ============

    function _getAccountData() internal view returns (uint256 collateralBase, uint256 debtBase) {
        (collateralBase, debtBase, , , , ) = aavePool.getUserAccountData(address(this));
    }

    function _syncAccounting() internal {
        (uint256 collateralBase, uint256 debtBase) = _getAccountData();
        uint256 uaPrice = _safePrice(address(UA));
        uint256 borrowedPrice = _safePrice(address(borrowedAsset));

        // Only overwrite tracked debt/collateral when we have non-zero signals from the pool + oracle.
        if (debtBase > 0) {
            totalDebt = debtBase;
            if (borrowedPrice > 0) {
                totalBorrowed = (debtBase * (10 ** borrowedDecimals)) / borrowedPrice;
            }
        }

        if (collateralBase > 0 && uaPrice > 0) {
            totalCollateral = (collateralBase * (10 ** uaDecimals)) / uaPrice;
        }

        totalStakedInFluid = fluidLending.balanceOf(address(this));
    }

    function _safePrice(address asset) internal view returns (uint256) {
        try aaveOracle.getAssetPrice(asset) returns (uint256 price) {
            return price;
        } catch {
            return 0;
        }
    }

    function _stEthPrice() internal view returns (uint256) {
        uint256 price = _safePrice(address(stETH));
        if (price != 0) return price;

        uint256 wstPrice = _safePrice(wstETH);
        if (wstPrice == 0) return 0;

        // Convert wstETH price to stETH price using stEthPerToken rate
        try IWstETH(wstETH).stEthPerToken() returns (uint256 rate) {
            if (rate == 0) return 0;
            return (wstPrice * 1e18) / rate;
        } catch {
            return wstPrice;
        }
    }

    /**
     * @notice Unwrap borrowed WETH to native ETH and send to recipient
     * @dev Only owner; useful for off-chain operations that require native ETH
     */
    function unwrapBorrowedToEth(uint256 amount, address to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        uint256 bal = IERC20(address(borrowedAsset)).balanceOf(address(this));
        require(amount > 0 && bal >= amount, "Insufficient WETH");
        IWETH(address(borrowedAsset)).withdraw(amount);
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {}
}
