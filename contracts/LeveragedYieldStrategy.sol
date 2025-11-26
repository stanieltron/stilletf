// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Aave V3 Interfaces
interface IPool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;
    
    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external returns (uint256);
    
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

// Aave Oracle Interface
interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
    function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory);
}

// Fluid Lending Protocol Interface
interface IFluidLending {
    function stake(address token, uint256 amount) external returns (uint256 shares);
    function unstake(address token, uint256 shares) external returns (uint256 amount);
    function claimRewards(address user) external returns (uint256 rewards);
    function balanceOf(address token, address user) external view returns (uint256);
    function getPendingRewards(address user) external view returns (uint256);
}

// Uniswap V3 Swap Router Interface
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

// Rewards Interface
interface IRewardsController {
    function claimAllRewards(address[] calldata assets, address to)
        external
        returns (address[] memory rewardsList, uint256[] memory claimedAmounts);
}

/**
 * @title LeveragedYieldStrategy
 * @notice Strategy that uses UA as collateral to borrow wstETH and stake in Fluid
 * @dev Implements automated rebalancing and yield harvesting from Fluid lending
 */
contract LeveragedYieldStrategy is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Immutables ============
    address public immutable vault;
    IERC20 public immutable UA; // Underlying asset (e.g., WETH) used as collateral
    IERC20 public immutable borrowedAsset; // Asset to borrow (e.g., wstETH)
    IERC20 public immutable USDC; // Yield token for rewards
    IPool public immutable aavePool; // Aave V3 Pool
    IFluidLending public immutable fluidLending; // Fluid lending protocol
    ISwapRouter public immutable swapRouter; // For swapping rewards to USDC
    IAaveOracle public immutable aaveOracle; // Aave's price aaveOracle
    IRewardsController public immutable rewardsController;

    // ============ Position State ============
    uint256 public totalCollateral; // Total UA deposited as collateral in Aave
    uint256 public totalBorrowed; // Total borrowed asset amount
    uint256 public totalStakedInFluid; // Total amount staked in Fluid
    uint256 public totalDebt; // Total debt in USD terms

    // ============ Leverage Parameters ============
    uint256 public constant OPTIMAL_LTV = 7500; // 75% optimal borrowing ratio
    uint256 public constant REBALANCE_THRESHOLD = 500; // 5% deviation triggers rebalance (500 basis points)

    // ============ Swap Parameters ============
    uint24 public constant POOL_FEE = 3000; // 0.3% Uniswap pool fee
    uint256 public constant SLIPPAGE_BPS = 100; // 1% slippage tolerance
    
    // ============ Yield Tracking ============
    uint256 public lastHarvestBlock;
    address[] public rewardAssets; // Assets for reward claiming

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
        address _aavePool,
        address _fluidLending,
        address _swapRouter,
        address _aaveOracle,
        address _rewardsController
    ) {
        require(_vault != address(0), "Invalid vault address");
        require(_UA != address(0), "Invalid UA address");
        require(_borrowedAsset != address(0), "Invalid borrowed asset");
        require(_USDC != address(0), "Invalid USDC address");
        require(_aavePool != address(0), "Invalid Aave pool");
        require(_fluidLending != address(0), "Invalid Fluid lending");
        require(_swapRouter != address(0), "Invalid swap router");
        require(_aaveOracle != address(0), "Invalid aaveOracle");

        vault = _vault;
        UA = IERC20(_UA);
        borrowedAsset = IERC20(_borrowedAsset);
        USDC = IERC20(_USDC);
        aavePool = IPool(_aavePool);
        fluidLending = IFluidLending(_fluidLending);
        swapRouter = ISwapRouter(_swapRouter);
        aaveOracle = IAaveOracle(_aaveOracle);
        rewardsController = IRewardsController(_rewardsController);
        
        // Initialize reward assets array
        rewardAssets.push(_UA);
        rewardAssets.push(_borrowedAsset);
        rewardAssets.push(_USDC);
        
        lastHarvestBlock = block.number;
    }

    // ============ Core Strategy Functions ============

    /**
     * @notice Deposit UA as collateral, borrow wstETH, stake in Fluid
     * @param amountUA Amount of underlying asset to deposit
     */
    function deposit(uint256 amountUA) external onlyVault nonReentrant {
        // 1. Supply UA as collateral to Aave V3
        UA.safeApprove(address(aavePool), amountUA);
        aavePool.supply(address(UA), amountUA, address(this), 0);
        totalCollateral += amountUA;
        
        // 2. Calculate how much to borrow based on OPTIMAL_LTV
        uint256 collateralValueUSD = aaveOracle.getAssetPrice(address(UA)) * amountUA / 1e18;
        uint256 targetBorrowValueUSD = (collateralValueUSD * OPTIMAL_LTV) / 10000;
        
        // 3. Calculate amount of borrowedAsset (e.g., wstETH) to borrow
        uint256 borrowedAssetPrice = aaveOracle.getAssetPrice(address(borrowedAsset));
        uint256 amountToBorrow = (targetBorrowValueUSD * 1e18) / borrowedAssetPrice;
        
        // 4. Borrow the asset from Aave (variable rate = 2)
        if (amountToBorrow > 0) {
            aavePool.borrow(address(borrowedAsset), amountToBorrow, 2, 0, address(this));
            totalBorrowed += amountToBorrow;
            
            // 5. Stake borrowed asset in Fluid lending
            borrowedAsset.safeApprove(address(fluidLending), amountToBorrow);
            uint256 stakedAmount = fluidLending.stake(address(borrowedAsset), amountToBorrow);
            totalStakedInFluid += stakedAmount;
            
            emit BorrowedAndStaked(amountToBorrow, stakedAmount);
        }
        
        // 6. Update debt tracking
        _updateDebtTracking();
        
        emit Deposited(amountUA);
    }

    /**
     * @notice Withdraw UA by unwinding position from Fluid and Aave
     * @param amountUA Amount of underlying asset to withdraw
     * @param to Address to send withdrawn UA
     */
    function withdraw(uint256 amountUA, address to) external onlyVault nonReentrant {
        // Calculate proportional unwinding needed
        uint256 shareToWithdraw = (amountUA * 1e18) / totalCollateral;
        
        // 1. Calculate amount to unstake from Fluid
        uint256 amountToUnstake = (totalStakedInFluid * shareToWithdraw) / 1e18;
        
        // 2. Unstake from Fluid
        if (amountToUnstake > 0) {
            uint256 unstakedAmount = fluidLending.unstake(address(borrowedAsset), amountToUnstake);
            totalStakedInFluid -= amountToUnstake;
            
            // 3. Repay debt to Aave
            borrowedAsset.safeApprove(address(aavePool), unstakedAmount);
            uint256 repaidAmount = aavePool.repay(address(borrowedAsset), unstakedAmount, 2, address(this));
            totalBorrowed = totalBorrowed > repaidAmount ? totalBorrowed - repaidAmount : 0;
            
            emit UnstakedAndRepaid(unstakedAmount, repaidAmount);
        }
        
        // 4. Withdraw collateral from Aave
        aavePool.withdraw(address(UA), amountUA, to);
        totalCollateral -= amountUA;
        
        // 5. Update debt tracking
        _updateDebtTracking();
        
        emit Withdrawn(amountUA, to);
    }

    /**
     * @notice Rebalance position to maintain optimal leverage
     * @dev Permissionless - anyone can call when LTV deviates by 5%
     */
    function rebalance() external nonReentrant {
        require(needsRebalance(), "NO_REBALANCE_NEEDED");
        
        uint256 currentLTV = getCurrentLTV();
        
        if (currentLTV > OPTIMAL_LTV + REBALANCE_THRESHOLD) {
            // LTV too high (above 80%) - reduce borrowing
            _reduceBorrowing();
        } else if (currentLTV < OPTIMAL_LTV - REBALANCE_THRESHOLD) {
            // LTV too low (below 70%) - increase borrowing
            _increaseBorrowing();
        }
        
        emit Rebalanced(totalCollateral, totalDebt, getCurrentLTV());
    }

    /**
     * @notice Harvest yield from Fluid and Aave rewards
     * @dev Public function - callable by vault or anyone
     * @return amountUSDC Amount of USDC harvested
     */
    function harvestYield() external nonReentrant returns (uint256 amountUSDC) {
        // 1. Claim rewards from Fluid lending
        uint256 fluidRewards = fluidLending.claimRewards(address(this));
        if (fluidRewards > 0) {
            // Assuming Fluid rewards are in a token that needs to be swapped to USDC
            amountUSDC += _swapToUSDC(address(borrowedAsset), fluidRewards);
        }
        
        // 2. Claim rewards from Aave (if any)
        if (address(rewardsController) != address(0)) {
            (address[] memory rewardsList, uint256[] memory amounts) = 
                rewardsController.claimAllRewards(rewardAssets, address(this));
            
            for (uint256 i = 0; i < rewardsList.length; i++) {
                if (amounts[i] > 0) {
                    if (rewardsList[i] == address(USDC)) {
                        amountUSDC += amounts[i];
                    } else {
                        amountUSDC += _swapToUSDC(rewardsList[i], amounts[i]);
                    }
                }
            }
        }
        
        // 3. Transfer harvested USDC to vault
        if (amountUSDC > 0) {
            USDC.safeTransfer(vault, amountUSDC);
            emit YieldHarvested(amountUSDC);
        }
        
        lastHarvestBlock = block.number;
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
        if (totalCollateral == 0) return 0;
        
        uint256 collateralValueUSD = aaveOracle.getAssetPrice(address(UA)) * totalCollateral / 1e18;
        if (collateralValueUSD == 0) return 0;
        
        return (totalDebt * 10000) / collateralValueUSD;
    }

    /**
     * @notice Get total assets under management (net of debt)
     * @return Net UA value under management
     */
    function totalAssets() external view returns (uint256) {
        // Net value = Collateral - Debt (in UA terms)
        uint256 collateralValue = totalCollateral;
        
        // Calculate debt in UA terms
        uint256 uaPrice = aaveOracle.getAssetPrice(address(UA));
        if (uaPrice == 0) return collateralValue;
        
        uint256 debtInUA = (totalDebt * 1e18) / uaPrice;
        
        // Add value from Fluid staking (if any yield accumulated)
        uint256 fluidValue = fluidLending.balanceOf(address(borrowedAsset), address(this));
        if (fluidValue > totalBorrowed) {
            uint256 profit = fluidValue - totalBorrowed;
            uint256 profitInUA = (profit * aaveOracle.getAssetPrice(address(borrowedAsset))) / uaPrice;
            collateralValue += profitInUA;
        }
        
        if (collateralValue > debtInUA) {
            return collateralValue - debtInUA;
        }
        return 0; // Underwater position
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
        return fluidLending.balanceOf(address(borrowedAsset), address(this));
    }

    // ============ Internal Functions ============

    /**
     * @notice Reduce borrowing to decrease LTV back to optimal
     */
    function _reduceBorrowing() internal {
        // Calculate target debt based on OPTIMAL_LTV
        uint256 collateralValueUSD = aaveOracle.getAssetPrice(address(UA)) * totalCollateral / 1e18;
        uint256 targetDebtUSD = (collateralValueUSD * OPTIMAL_LTV) / 10000;
        
        if (totalDebt > targetDebtUSD) {
            uint256 excessDebtUSD = totalDebt - targetDebtUSD;
            
            // Calculate how much borrowed asset to repay
            uint256 borrowedAssetPrice = aaveOracle.getAssetPrice(address(borrowedAsset));
            uint256 amountToRepay = (excessDebtUSD * 1e18) / borrowedAssetPrice;
            
            // Unstake from Fluid
            if (amountToRepay > 0 && totalStakedInFluid > 0) {
                uint256 toUnstake = amountToRepay > totalStakedInFluid ? totalStakedInFluid : amountToRepay;
                uint256 unstaked = fluidLending.unstake(address(borrowedAsset), toUnstake);
                totalStakedInFluid -= toUnstake;
                
                // Repay to Aave
                borrowedAsset.safeApprove(address(aavePool), unstaked);
                aavePool.repay(address(borrowedAsset), unstaked, 2, address(this));
                totalBorrowed -= unstaked;
            }
        }
        
        _updateDebtTracking();
    }

    /**
     * @notice Increase borrowing to reach optimal LTV
     */
    function _increaseBorrowing() internal {
        // Calculate target debt based on OPTIMAL_LTV
        uint256 collateralValueUSD = aaveOracle.getAssetPrice(address(UA)) * totalCollateral / 1e18;
        uint256 targetDebtUSD = (collateralValueUSD * OPTIMAL_LTV) / 10000;
        
        if (targetDebtUSD > totalDebt) {
            uint256 additionalDebtUSD = targetDebtUSD - totalDebt;
            
            // Calculate how much to borrow
            uint256 borrowedAssetPrice = aaveOracle.getAssetPrice(address(borrowedAsset));
            uint256 amountToBorrow = (additionalDebtUSD * 1e18) / borrowedAssetPrice;
            
            // Borrow from Aave
            if (amountToBorrow > 0) {
                aavePool.borrow(address(borrowedAsset), amountToBorrow, 2, 0, address(this));
                totalBorrowed += amountToBorrow;
                
                // Stake in Fluid
                borrowedAsset.safeApprove(address(fluidLending), amountToBorrow);
                uint256 staked = fluidLending.stake(address(borrowedAsset), amountToBorrow);
                totalStakedInFluid += staked;
            }
        }
        
        _updateDebtTracking();
    }

    /**
     * @notice Update debt tracking from lending protocol
     */
    function _updateDebtTracking() internal {
        (, uint256 totalDebtBase, , , , ) = aavePool.getUserAccountData(address(this));
        totalDebt = totalDebtBase; // Already in USD terms
    }

    /**
     * @notice Swap any token to USDC
     * @param token Address of token to swap
     * @param amount Amount to swap
     * @return Amount of USDC received
     */
    function _swapToUSDC(address token, uint256 amount) internal returns (uint256) {
        if (token == address(USDC)) return amount;
        if (amount == 0) return 0;
        
        IERC20(token).safeApprove(address(swapRouter), amount);
        
        // Use Aave oracle for minimum output calculation
        uint256 tokenPrice = aaveOracle.getAssetPrice(token);
        uint256 expectedValueUSD = (amount * tokenPrice) / 1e18;
        uint256 minAmountOut = (expectedValueUSD * (10000 - SLIPPAGE_BPS)) / 10000;
        
        try swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: address(USDC),
                fee: POOL_FEE,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            // If direct swap fails, return 0 (could implement fallback swap path)
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
            uint256 unstaked = fluidLending.unstake(address(borrowedAsset), totalStakedInFluid);
            totalStakedInFluid = 0;
            
            // Repay as much debt as possible
            borrowedAsset.safeApprove(address(aavePool), unstaked);
            aavePool.repay(address(borrowedAsset), unstaked, 2, address(this));
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
}
