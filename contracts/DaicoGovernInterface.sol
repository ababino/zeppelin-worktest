pragma solidity ^0.4.19;


contract DaicoGovernInterface {

    function validateWithdrawal() public {}
    function updateAmountAvailableToWithdraw() public returns (uint256 amount){}
    function amountAvailableToWithdrawAfterWithdrawal(uint256 withdrawn) public {}
    function addHolder(address holderAdress) public {}
}
