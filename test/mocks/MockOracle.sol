// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/Interfaces.sol";

contract MockOracle is IAaveOracle {
    uint256 public constant UNIT = 1e8;
    mapping(address => uint256) public prices;

    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
    }

    function getAssetPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory out) {
        out = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            out[i] = prices[assets[i]];
        }
    }

    function BASE_CURRENCY_UNIT() external pure returns (uint256) {
        return UNIT;
    }
}
