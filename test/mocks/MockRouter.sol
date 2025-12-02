// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";
import "./MockTokens.sol";

contract MockRouter is ISwapRouter {
    uint256 public lastAmountIn;
    address public lastTokenIn;
    address public lastTokenOut;

    function _decimals(address token, uint8 defaultDec) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return defaultDec;
        }
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        lastAmountIn = params.amountIn;
        lastTokenIn = params.tokenIn;
        lastTokenOut = params.tokenOut;

        uint8 inDec = _decimals(params.tokenIn, 18);
        uint8 outDec = _decimals(params.tokenOut, 18);

        // 1:1 by value with decimal normalization
        amountOut = params.amountIn;
        if (outDec > inDec) {
            amountOut = params.amountIn * (10 ** (outDec - inDec));
        } else if (inDec > outDec) {
            amountOut = params.amountIn / (10 ** (inDec - outDec));
        }

        // Pull tokenIn from caller to simulate spend
        try MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn) {
            // burned/kept in router; not remitted back
        } catch {
            // For non-mock tokens, ignore failures in test context
        }

        // Mint tokenOut to recipient if it's our mock ERC20
        try MockERC20(params.tokenOut).mint(params.recipient, amountOut) {} catch {}

        return amountOut;
    }
}
