// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }
}

contract MockWETH is MockERC20 {
    constructor() MockERC20("Mock WETH", "WETH", 18) {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }
}

contract MockStETH is MockERC20 {
    constructor() MockERC20("Mock stETH", "stETH", 18) {}

    function submit(address) external payable returns (uint256) {
        _mint(msg.sender, msg.value);
        return msg.value;
    }

    receive() external payable {}
}
