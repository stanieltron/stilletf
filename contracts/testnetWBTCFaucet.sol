// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TestnetWBTCFaucet
 * @notice Self-serve faucet for testnet WBTC with per-wallet cooldown.
 * @dev Faucet contract holds WBTC. Claiming wallet pays gas and receives payout.
 */
contract TestnetWBTCFaucet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable wbtc;
    uint256 public immutable dripAmount;
    uint256 public immutable cooldownSeconds;

    mapping(address => uint256) public nextClaimAt;

    event Claimed(
        address indexed recipient,
        uint256 amount,
        uint256 nextEligibleTimestamp
    );
    event Recovered(address indexed to, uint256 amount);

    constructor(
        address wbtcAddress,
        uint256 amountPerClaim,
        uint256 cooldownSec
    ) Ownable(msg.sender) {
        require(wbtcAddress != address(0), "INVALID_WBTC");
        require(amountPerClaim > 0, "INVALID_AMOUNT");
        require(cooldownSec > 0, "INVALID_COOLDOWN");

        wbtc = IERC20(wbtcAddress);
        dripAmount = amountPerClaim;
        cooldownSeconds = cooldownSec;
    }

    function canClaim(address recipient) public view returns (bool) {
        return recipient != address(0) && block.timestamp >= nextClaimAt[recipient];
    }

    /**
     * @notice Sends drip amount to msg.sender if msg.sender is not on cooldown.
     * @dev Claiming wallet pays gas.
     */
    function claim() external nonReentrant returns (uint256) {
        address recipient = msg.sender;
        require(canClaim(recipient), "COOLDOWN_ACTIVE");
        require(wbtc.balanceOf(address(this)) >= dripAmount, "FAUCET_EMPTY");

        uint256 nextAt = block.timestamp + cooldownSeconds;
        nextClaimAt[recipient] = nextAt;

        wbtc.safeTransfer(recipient, dripAmount);
        emit Claimed(recipient, dripAmount, nextAt);
        return dripAmount;
    }

    /**
     * @notice Allows owner to recover tokens from faucet contract.
     */
    function recover(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "INVALID_AMOUNT");
        wbtc.safeTransfer(to, amount);
        emit Recovered(to, amount);
    }
}
