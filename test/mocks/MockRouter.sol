// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./MockTokens.sol";

contract MockRouter is ISwapRouter {
    uint256 public lastAmountIn;
    address public lastTokenIn;
    address public lastTokenOut;
    IAaveOracle public oracle;

    constructor(address _oracle) {
        oracle = IAaveOracle(_oracle);
    }

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

        if (params.tokenIn == params.tokenOut) {
            amountOut = params.amountIn;
        } else {
            // Price-aware conversion using oracle values (base currency)
            uint256 priceIn = oracle.getAssetPrice(params.tokenIn);
            uint256 priceOut = oracle.getAssetPrice(params.tokenOut);
            uint256 base = oracle.BASE_CURRENCY_UNIT();
            require(priceIn > 0 && priceOut > 0 && base > 0, "oracle price missing");

            // Compute base currency value: amountIn (token decimals) * priceIn / 10^inDec
            uint256 valueBase = (params.amountIn * priceIn) / (10 ** inDec);
            // Convert base currency value to tokenOut units: valueBase * 10^outDec / priceOut
            amountOut = (valueBase * (10 ** outDec)) / priceOut;
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

    function exactInput(ExactInputParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        // Path format: tokenIn (20) + fee (3) + tokenMid (20) + fee (3) + tokenOut (20)
        require(params.path.length >= 20 + 3 + 20 + 3 + 20, "path too short");
        address tokenIn = _readAddress(params.path, 0);
        address tokenOut = _readAddress(params.path, params.path.length - 20);

        lastAmountIn = params.amountIn;
        lastTokenIn = tokenIn;
        lastTokenOut = tokenOut;

        uint8 inDec = _decimals(tokenIn, 18);
        uint8 outDec = _decimals(tokenOut, 18);

        if (tokenIn == tokenOut) {
            amountOut = params.amountIn;
        } else {
            uint256 priceIn = oracle.getAssetPrice(tokenIn);
            uint256 priceOut = oracle.getAssetPrice(tokenOut);
            uint256 base = oracle.BASE_CURRENCY_UNIT();
            require(priceIn > 0 && priceOut > 0 && base > 0, "oracle price missing");

            uint256 valueBase = (params.amountIn * priceIn) / (10 ** inDec);
            amountOut = (valueBase * (10 ** outDec)) / priceOut;
        }

        require(amountOut >= params.amountOutMinimum, "amountOut too low");

        try MockERC20(tokenIn).transferFrom(msg.sender, address(this), params.amountIn) {
            // burned/kept in router; not remitted back
        } catch {
            // For non-mock tokens, ignore failures in test context
        }

        try MockERC20(tokenOut).mint(params.recipient, amountOut) {} catch {}

        return amountOut;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountIn)
    {
        lastAmountIn = params.amountInMaximum;
        lastTokenIn = params.tokenIn;
        lastTokenOut = params.tokenOut;

        uint8 inDec = _decimals(params.tokenIn, 18);
        uint8 outDec = _decimals(params.tokenOut, 18);

        if (params.tokenIn == params.tokenOut) {
            amountIn = params.amountOut;
        } else {
            uint256 priceIn = oracle.getAssetPrice(params.tokenIn);
            uint256 priceOut = oracle.getAssetPrice(params.tokenOut);
            uint256 base = oracle.BASE_CURRENCY_UNIT();
            require(priceIn > 0 && priceOut > 0 && base > 0, "oracle price missing");

            uint256 valueBase = (params.amountOut * priceOut) / (10 ** outDec);
            amountIn = (valueBase * (10 ** inDec)) / priceIn;
        }

        require(amountIn <= params.amountInMaximum, "amountIn too high");

        // Pull tokenIn from caller to simulate spend
        try MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn) {
            // burned/kept in router; not remitted back
        } catch {
            // For non-mock tokens, ignore failures in test context
        }

        // Mint tokenOut to recipient if it's our mock ERC20
        try MockERC20(params.tokenOut).mint(params.recipient, params.amountOut) {} catch {}

        return amountIn;
    }

    function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
        require(data.length >= offset + 20, "address out of bounds");
        assembly {
            addr := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }
}
