// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";

contract MockRouter is ISwapRouter {
    uint256 public lastAmountIn;

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        lastAmountIn = params.amountIn;
        // no real swap; simply return amountIn as output for testing
        return params.amountIn;
    }
}
