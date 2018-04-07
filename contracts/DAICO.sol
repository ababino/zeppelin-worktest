pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


contract DAICO is Crowdsale, Ownable {
    /*using Roles for Roles.Role;*/
    using SafeMath for uint256;

    uint256 public tap;
    uint256 public lastWithdrawn;

    /*iquorum is the ivnerse quorum. 3 is a 1/3, and so on.*/
    uint256 public iquorum;
    uint256 public quorum;
    uint256 public numberOfHolders;
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

    function DAICO
        (
          uint256 _lastWithdrawn,
          uint256 _rate,
          uint256 _tap,
          uint256 _iquorum,
          address _wallet,
          ERC20 _token
        )
        public
        Crowdsale(_rate, _wallet, _token)
        {
            tap = _tap;
            lastWithdrawn = _lastWithdrawn;
            iquorum = _iquorum;
            quorum = 0;
        }

        /**
        * @dev Add buyers to the holder list. If you want to allow holders to
        * change after the selling period you should implement addHolder and
        * removeHolder functions
        */
        function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
          isHolder[_beneficiary] = true;
          numberOfHolders++;
          if (numberOfHolders % iquorum == 0){
            quorum++;
          }
        }

        /**
        * @dev The forwardFunds function should not send any thing to the
        * owner. It should keep the eth to be delivered as the holders decide.
        */
        function _forwardFunds() internal {
        }

        /**
        * @dev Only owner can transfer founds to herself, and only as much as
        * it is allowed by the tap parameter.
        */
        function withdraw() public onlyOwner {
            require(block.timestamp > lastWithdrawn);
            uint256 allowed  = block.timestamp.sub(lastWithdrawn).mul(tap);
            uint256 amount = Math.min256(allowed, this.balance);
            owner.transfer(amount);
            lastWithdrawn = block.timestamp;
          }

        /**
        * @dev Any holder can propose to increase the tap.
        * @param proposedNewTap The new value of the tap variable. It must be grater than the current one.
        * @param timeToDabate The time since current block, in seconds, to vote.
        */
        function newRaiseTapProposal(
          uint256 proposedNewTap,
          uint256 timeToDabate
        )
          public
          returns (uint256 proposalID)
        {
          require(proposedNewTap > tap);
          require(isHolder[msg.sender]);

          proposalID = proposals.length++;
          RaiseTapProposal storage p = proposals[proposalID];
          p.author = msg.sender;
          p.proposedNewTap = proposedNewTap;
          p.votingDeadline = block.timestamp.add(timeToDabate);
          p.executed = false;
          p.numberOfVotes = 0;
          p.numberOfPositiveVotes = 0;
          RaiseTapProposalAdded(proposalID, msg.sender, proposedNewTap);
          return proposalID;
        }

        /**
        * @dev Any holder can vote.
        * @param proposalID The ID of the proposal to vote for or against of.
        * @param supportsProposal if true the holder supports the proposal, if false she does not.
        */
        function vote(
          uint256 proposalID,
          bool supportsProposal
        )
          public
          returns (uint256 voteID)
        {
          require(isHolder[msg.sender]);

          RaiseTapProposal storage p = proposals[proposalID];
          require(!p.voted[msg.sender]);
          require(p.votingDeadline < block.timestamp);

          p.voted[msg.sender] = true;
          p.numberOfVotes++;
          if (supportsProposal) {
            p.numberOfPositiveVotes++;
          }
          Voted(proposalID, msg.sender, supportsProposal);
          return p.numberOfVotes;
        }

      /**
      * @dev Any one can excecute a propasal. If the voting period has ended,
      * there are more votes in favor than aginst the proposal, and the number
      * of votes is greater than the quorum, then, the tap variable is updated
      * to the propsed new tap.
      * @param proposalID The ID of the proposal to execute.
      */
      function executeRaiseTapProposal(uint256 proposalID) private {
        RaiseTapProposal storage p = proposals[proposalID];
        require(p.votingDeadline > block.timestamp);
        require(!p.executed);
        p.executed = true;
        if (p.numberOfPositiveVotes.mul(2) > p.numberOfVotes.add(quorum)){
          withdraw();
          tap = p.proposedNewTap;
        }
      }
}
