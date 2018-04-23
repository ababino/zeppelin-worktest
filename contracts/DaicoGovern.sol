pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


contract DaicoGovern is Ownable {
    using SafeMath for uint256;

    uint256 public tap;
    uint256 public lastWithdrawn;
    uint256 public amountAvailableToWithdraw;

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

    function DaicoGovern (uint256 _lastWithdrawn, uint256 _iquorum) public {
        tap = 0;
        lastWithdrawn = _lastWithdrawn;
        iquorum = _iquorum;
        quorum = 0;
        amountAvailableToWithdraw = 0;
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
        require(block.timestamp >= lastWithdrawn);

        proposalID = proposals.length++;
        RaiseTapProposal storage proposal = proposals[proposalID];
        proposal.author = msg.sender;
        proposal.proposedNewTap = proposedNewTap;
        proposal.votingDeadline = block.timestamp.add(timeToDabate);
        proposal.executed = false;
        proposal.numberOfVotes = 0;
        proposal.numberOfPositiveVotes = 0;
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

        RaiseTapProposal storage proposal = proposals[proposalID];
        require(!proposal.voted[msg.sender]);
        require(proposal.votingDeadline > block.timestamp);

        proposal.voted[msg.sender] = true;
        proposal.numberOfVotes++;
        if (supportsProposal) {
            proposal.numberOfPositiveVotes++;
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
    function amountAvailableToWithdrawAfterWithdrawal(uint256 withdrawn) onlyOwner {
        amountAvailableToWithdraw = amountAvailableToWithdraw.sub(withdrawn);
      }

    function addHolder(address holderAdress) onlyOwner {
      isHolder[holderAdress] = true;
      numberOfHolders++;
      if (numberOfHolders % iquorum == 0){
          quorum++;
      }
    }
}
