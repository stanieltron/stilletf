// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ILeveragedYieldStrategy {
    function deposit(uint256 amountUA) external;
    function withdraw(uint256 amountUA, address to) external;
    function harvestYield() external returns (uint256 amountUSDC);
    function rebalance() external;
    function needsRebalance() external view returns (bool);
    function totalAssets() external view returns (uint256);
}

interface IBTCStaking {
    function notifyRewardAmount(uint256 amount) external;
}

/**
 * @title StakingVault
 * @notice Custom staking vault for underlying assets with USDC reward distribution
 * @dev Implements transferable ERC-20 shares and leveraged yield generation
 */
contract StakingVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Immutables ============
    IERC20 public immutable UA; // Underlying asset (e.g., WETH)
    IERC20 public immutable USDC; // Reward token
    ILeveragedYieldStrategy public immutable strategy;
    address public immutable btcStakingContract;

    // ============ ERC-20 Share Token State ============
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string public name;
    string public symbol;
    uint8 public decimals;

    // ============ Reward Accounting ============
    uint256 public accRewardPerShare; // Accumulated USDC rewards per share (scaled by ACC_PRECISION)
    uint256 public constant ACC_PRECISION = 1e12;
    mapping(address => uint256) public rewardDebt; // User's reward debt for proper accounting
    mapping(address => uint256) public pendingRewards; // Claimable USDC per user

    // ============ Configuration ============
    uint256 public btcStakerProfitBps = 2000; // 20% default profit share for BTC stakers
    uint256 public constant MAX_BPS = 10000;

    // ============ Events ============
    event Staked(address indexed user, uint256 amountUA, uint256 sharesIssued);
    event Unstaked(address indexed user, uint256 sharesRedeemed, uint256 amountUA);
    event RewardClaimed(address indexed user, uint256 amountUSDC);
    event YieldHarvested(uint256 amountUSDC, uint256 indexed timestamp);
    event RebalanceTriggered(uint256 timestamp);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ProfitShareUpdated(uint256 newBps);

    // ============ Modifiers ============
    modifier updateRewards(address account) {
        _updateRewards(account);
        _;
    }

    // ============ Constructor ============
    constructor(
        address _UA,
        address _USDC,
        address _strategy,
        address _btcStakingContract,
        string memory _name,
        string memory _symbol
    ) {
        require(_UA != address(0), "Invalid UA address");
        require(_USDC != address(0), "Invalid USDC address");
        require(_strategy != address(0), "Invalid strategy address");
        require(_btcStakingContract != address(0), "Invalid BTC staking address");

        UA = IERC20(_UA);
        USDC = IERC20(_USDC);
        strategy = ILeveragedYieldStrategy(_strategy);
        btcStakingContract = _btcStakingContract;
        
        name = _name;
        symbol = _symbol;
        decimals = IERC20Metadata(_UA).decimals();
    }

    // ============ Core Staking Functions ============

    /**
     * @notice Stake underlying assets and receive vault shares
     * @param amountUA Amount of underlying asset to stake
     * @return shares Amount of vault shares issued
     */
    function stake(uint256 amountUA) external nonReentrant returns (uint256 shares) {
        // 1. _updateRewards(msg.sender);
        _updateRewards(msg.sender);
        
        // 2. require(amountUA > 0, "ZERO_AMOUNT");
        require(amountUA > 0, "ZERO_AMOUNT");
        
        // 3. UA.transferFrom(msg.sender, address(this), amountUA);
        UA.safeTransferFrom(msg.sender, address(this), amountUA);
        
        // 4. Calculate shares based on current exchange rate
        // 5. uint256 totalUA = totalAssets();
        uint256 totalUA = totalAssets();
        
        // 6. if (_totalSupply == 0 || totalUA == 0) {
        //    shares = amountUA; // 1:1 for first staker
        //    } else {
        //    shares = (amountUA * _totalSupply) / totalUA;
        //    }
        if (_totalSupply == 0 || totalUA == 0) {
            shares = amountUA; // 1:1 for first staker
        } else {
            shares = (amountUA * _totalSupply) / totalUA;
        }
        
        // 7. _mint(msg.sender, shares);
        _mint(msg.sender, shares);
        
        // 8. // Deploy capital to strategy
        // 9. UA.transfer(address(strategy), amountUA);
        UA.safeTransfer(address(strategy), amountUA);
        
        // 10. strategy.deposit(amountUA);
        strategy.deposit(amountUA);
        
        // 11. emit Staked(msg.sender, amountUA, shares);
        emit Staked(msg.sender, amountUA, shares);
        
        return shares;
    }

    /**
     * @notice Burn shares and receive underlying assets back
     * @param shares Amount of vault shares to burn
     * @return amountUA Amount of underlying asset returned
     */
    function unstake(uint256 shares) external nonReentrant returns (uint256 amountUA) {
        // 1. _updateRewards(msg.sender);
        _updateRewards(msg.sender);
        
        // 2. require(shares > 0 && shares <= _balances[msg.sender], "INVALID_SHARES");
        require(shares > 0 && shares <= _balances[msg.sender], "INVALID_SHARES");
        
        // 3. uint256 totalUA = totalAssets();
        uint256 totalUA = totalAssets();
        
        // 4. amountUA = (shares * totalUA) / _totalSupply;
        amountUA = (shares * totalUA) / _totalSupply;
        
        // 5. _burn(msg.sender, shares);
        _burn(msg.sender, shares);
        
        // 6. // Get UA from strategy
        // 7. uint256 vaultBalance = UA.balanceOf(address(this));
        uint256 vaultBalance = UA.balanceOf(address(this));
        
        // 8. if (vaultBalance < amountUA) {
        //    strategy.withdraw(amountUA - vaultBalance, address(this));
        //    }
        if (vaultBalance < amountUA) {
            strategy.withdraw(amountUA - vaultBalance, address(this));
        }
        
        // 9. UA.transfer(msg.sender, amountUA);
        UA.safeTransfer(msg.sender, amountUA);
        
        // 10. emit Unstaked(msg.sender, shares, amountUA);
        emit Unstaked(msg.sender, shares, amountUA);
        
        return amountUA;
    }

    /**
     * @notice Claim accumulated USDC rewards
     * @return amountUSDC Amount of USDC claimed
     */
    function claim() external nonReentrant returns (uint256 amountUSDC) {
        // Logic includes updateRewards modifier effect
        _updateRewards(msg.sender);
        
        // 1. amountUSDC = pendingRewards[msg.sender];
        amountUSDC = pendingRewards[msg.sender];
        
        // 2. if (amountUSDC > 0) {
        //    pendingRewards[msg.sender] = 0;
        //    USDC.transfer(msg.sender, amountUSDC);
        //    emit RewardClaimed(msg.sender, amountUSDC);
        //    }
        if (amountUSDC > 0) {
            pendingRewards[msg.sender] = 0;
            USDC.safeTransfer(msg.sender, amountUSDC);
            emit RewardClaimed(msg.sender, amountUSDC);
        }
        
        // 3. return amountUSDC;
        return amountUSDC;
    }

    /**
     * @notice Harvest USDC yield from strategy and distribute rewards
     * @dev Permissionless - anyone can call
     * @return amountUSDC Total amount of USDC harvested
     */
    function harvestYield() external nonReentrant returns (uint256 amountUSDC) {
        // 1. amountUSDC = strategy.harvestYield();
        amountUSDC = strategy.harvestYield();
        
        // 2. if (amountUSDC > 0 && _totalSupply > 0) {
        if (amountUSDC > 0 && _totalSupply > 0) {
            // Reserve portion for BTC stakers
            uint256 btcStakerPortion = (amountUSDC * btcStakerProfitBps) / 10000;
            uint256 vaultRewards = amountUSDC - btcStakerPortion;
            
            // Update reward index for vault stakers
            accRewardPerShare += (vaultRewards * ACC_PRECISION) / _totalSupply;
            
            // Queue BTC staker distribution
            if (btcStakerPortion > 0) {
                USDC.safeTransfer(btcStakingContract, btcStakerPortion);
                IBTCStaking(btcStakingContract).notifyRewardAmount(btcStakerPortion);
            }
            
            emit YieldHarvested(amountUSDC, block.timestamp);
        }
        
        // 3. return amountUSDC;
        return amountUSDC;
    }

    /**
     * @notice Trigger strategy rebalancing to maintain safe leverage
     * @dev Permissionless function - anyone can call when needed
     */
    function rebalance() external nonReentrant {
        // Check if rebalance is needed
        require(strategy.needsRebalance(), "NO_REBALANCE_NEEDED");
        
        // Execute rebalance
        strategy.rebalance();
        
        // Emit event
        emit RebalanceTriggered(block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @notice Get total underlying assets managed by vault
     * @return Total UA value (in vault + strategy)
     */
    function totalAssets() public view returns (uint256) {
        return strategy.totalAssets() + UA.balanceOf(address(this));
    }

    /**
     * @notice Get current price per share in underlying asset
     * @return Price per share (scaled to 1e18)
     */
    function sharePrice() external view returns (uint256) {
        uint256 scale = 10 ** decimals;
        if (_totalSupply == 0) return scale;
        return (totalAssets() * scale) / _totalSupply;
    }

    /**
     * @notice Get pending rewards for an account
     * @param account Address to check
     * @return Pending USDC rewards
     */
    function getPendingRewards(address account) external view returns (uint256) {
        uint256 pending = (_balances[account] * accRewardPerShare) / ACC_PRECISION - rewardDebt[account];
        return pendingRewards[account] + pending;
    }

    // ============ ERC-20 Functions ============

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "Transfer exceeds allowance");
        
        _transfer(from, to, amount);
        
        if (currentAllowance != type(uint256).max) {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        
        return true;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the profit share for BTC stakers
     * @param newBps New basis points (0-10000)
     */
    function setProfitShare(uint256 newBps) external onlyOwner {
        require(newBps <= MAX_BPS, "Invalid bps");
        btcStakerProfitBps = newBps;
        emit ProfitShareUpdated(newBps);
    }

    // ============ Internal Functions ============

    /**
     * @notice Update reward accounting for an account  
     * @param account Address to update rewards for
     */
    function _updateRewards(address account) internal {
        // 1. if (account != address(0)) {
        if (account != address(0)) {
            // uint256 pending = (_balances[account] * accRewardPerShare) / ACC_PRECISION - rewardDebt[account];
            uint256 pending = (_balances[account] * accRewardPerShare) / ACC_PRECISION - rewardDebt[account];
            // if (pending > 0) {
            if (pending > 0) {
                // pendingRewards[account] += pending;
                pendingRewards[account] += pending;
            // }
            }
            // rewardDebt[account] = (_balances[account] * accRewardPerShare) / ACC_PRECISION;
            rewardDebt[account] = (_balances[account] * accRewardPerShare) / ACC_PRECISION;
        // }
        }
    }

    /**
     * @notice Hook called before any token transfer
     * @param from Source address
     * @param to Destination address
     */
    function _beforeTokenTransfer(address from, address to) internal {
        if (from != address(0)) _updateRewards(from);
        if (to != address(0)) _updateRewards(to);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        
        _beforeTokenTransfer(from, to);
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "Transfer exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        
        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "Mint to zero address");
        
        _beforeTokenTransfer(address(0), account);
        
        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "Burn from zero address");
        
        _beforeTokenTransfer(account, address(0));
        
        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "Burn exceeds balance");
        
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
        }
        
        emit Transfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
