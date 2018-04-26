pragma solidity ^0.4.19;

import './DaicoGovern.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


contract DaicoGovernOneVotePerShare is DaicoGovern {
    using SafeMath for uint256;

    mapping (address => uint256) public allocatedShares;

    /**
    * @dev Any holder can vote.
    * @param proposalID The ID of the proposal to vote for or against of.
    * @param supportsProposal if true the holder supports the proposal, if false she does not.
    * @param numberOfShares id the amount of tokens that the voter is willing to freeze until deadline.
    */
    function vote(
        uint256 proposalID,
        bool supportsProposal,
        uint256 numberOfShares
    )
        public
        returns (uint256 voteID)
    {
        require(isHolder[msg.sender]);

        RaiseTapProposal storage proposal = proposals[proposalID];
        require(!proposal.voted[msg.sender]);
        require(proposal.votingDeadline > block.timestamp);
        token.transferFrom(msg.sender, this, numberOfShares);

        proposal.voted[msg.sender] = true;
        proposal.numberOfVotes++;
        if (supportsProposal) {
            proposal.numberOfPositiveVotes = proposal.numberOfPositiveVotes.add(numberOfShares);
        } else {
            proposal.numberOfPositiveVotes = proposal.numberOfNegativeVotes.add(numberOfShares);
        }
        Voted(proposalID, msg.sender, supportsProposal);
        return proposal.numberOfVotes;
    }

    /**
    * @dev Any one can excecute a propasal. If the voting period has ended,
    * there are more votes in favor than aginst the proposal, and the number
    * of votes is greater than the quorum, then, the tap variable is updated
    * to the propsed new tap.
    * @param proposalID The ID of the proposal to execute.
    */
    function executeRaiseTapProposal(uint256 proposalID) public {
        RaiseTapProposal storage proposal = proposals[proposalID];
        require(proposal.votingDeadline < block.timestamp);
        require(!proposal.executed);
        require(proposal.proposedNewTap > tap);
        proposal.executed = true;
        if (proposal.numberOfPositiveVotes.mul(2) > proposal.numberOfVotes.add(quorum)){
            updateAmountAvailableToWithdraw();
            tap = proposal.proposedNewTap;
        }
    }

    /**
    * @dev before a withdrawal validateWithdrawal should be called.
    */
    function validateWithdrawal() public {
      require(block.timestamp > lastWithdrawn);
    }

    /**
    * @dev it computes the available amount to withdraw.
    */
    function updateAmountAvailableToWithdraw() public returns (uint256 amount){
      uint256 allowed  = block.timestamp.sub(lastWithdrawn).mul(tap);
      lastWithdrawn = block.timestamp;
      amountAvailableToWithdraw = amountAvailableToWithdraw.add(allowed);
      return amountAvailableToWithdraw;
    }

    /**
    * @dev after a withdrawal updateLastWithdrawal should be called.
    */
    function amountAvailableToWithdrawAfterWithdrawal(uint256 withdrawn) onlyOwner public {
        amountAvailableToWithdraw = amountAvailableToWithdraw.sub(withdrawn);
      }

    function addHolder(address holderAdress) onlyOwner public {
      isHolder[holderAdress] = true;
      numberOfHolders++;
      if (numberOfHolders % iquorum == 0){
          quorum++;
      }
    }
}
