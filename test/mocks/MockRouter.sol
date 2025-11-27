// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";
import "./MockTokens.sol";

contract MockRouter is ISwapRouter {
    uint256 public lastAmountIn;
    address public lastTokenIn;
    address public lastTokenOut;

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        lastAmountIn = params.amountIn;
        lastTokenIn = params.tokenIn;
        lastTokenOut = params.tokenOut;

        amountOut = params.amountIn; // 1:1 mock rate

        // Mint tokenOut to recipient if it's our mock ERC20
        try MockERC20(params.tokenOut).mint(params.recipient, amountOut) {} catch {}

        return amountOut;
    }
}
