pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './DaicoGovernInterface.sol';


contract DAICO is Crowdsale {
    using SafeMath for uint256;

    DaicoGovernInterface public daicoGovern;

    function DAICO
    (
        uint256 daicoGovernAddress,
        uint256 _rate,
        address _wallet,
        ERC20 _token
    )
    public
    Crowdsale(_rate, _wallet, _token)
    {
      daicoGovern = DaicoGovernInterface(daicoGovernAddress);
    }

    /**
    * @dev Only owner can transfer founds to herself, and only as much as
    * it is allowed by the tap parameter.
    */
    function withdraw() public {
        require(msg.sender == wallet);
        daicoGovern.validateWithdrawal();
        uint256 amount = daicoGovern.updateAmountAvailableToWithdraw();
        amount = Math.min256(amount, this.balance);
        wallet.transfer(amount);
        daicoGovern.amountAvailableToWithdrawAfterWithdrawal(amount);
    }

    /**
    * @dev Add buyers to the holder list. If you want to allow holders to
    * change after the selling period you should implement addHolder and
    * removeHolder functions
    */
    function _updatePurchasingState(
        address _beneficiary,
        uint256 _weiAmount
    )
        internal
    {
        daicoGovern.addHolder(_beneficiary);
    }

    /**
    * @dev The forwardFunds function should not send any thing to the
    * owner. It should keep the eth to be delivered as the holders decide.
    */
    function _forwardFunds() internal {
    }

}
