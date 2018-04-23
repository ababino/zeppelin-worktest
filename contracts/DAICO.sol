pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/examples/SimpleToken.sol';
import './DaicoGovern.sol';


contract DAICO is Crowdsale {
    using SafeMath for uint256;

    DaicoGovern public daicoGovern;
    address public daicoGovernAddress;
    uint256 public lastWithdrawn;

    /*iquorum is the ivnerse quorum. 3 is a 1/3, and so on.*/
    uint256 public iquorum;
    uint256 public quorum;
    RaiseTapProposal[] public proposals;

    /**
    * @dev The owner of the contract should implement how the memebers are
    * added. Probably, some background check to verify its identity will be
    * needed. Also, a delay could be needed to avoid double voting.
    */
    mapping (address => bool) public isHolder;

    event RaiseTapProposalAdded(uint256 proposalID, address author, uint256 amount);
    event Voted(uint256 proposalID, address voter, bool supports);

    struct RaiseTapProposal {
        address author;
        uint256 proposedNewTap;
        uint256 votingDeadline;
        bool executed;
        uint256 numberOfVotes;
        uint256 numberOfPositiveVotes;
        mapping (address => bool) voted;
    }

    function DAICO(uint256 _rate, address _wallet, ERC20 _token, uint256 _lastWithdrawn, uint256 _iquorum) Crowdsale(_rate, _wallet, _token) public {
      daicoGovern = new DaicoGovern(_lastWithdrawn, _iquorum);
      daicoGovernAddress = address(daicoGovern);
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
