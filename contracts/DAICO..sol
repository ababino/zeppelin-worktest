import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract DAICO is Ownable {
    using SafeMath for uint256;
    uint256 public tap;

    function DAICO() public {
        tap = 0;
    }

    function changeTap(uint256 newTap) onlyOwner {
      require(tap<newTap);
      tap = newTap;
    }
}
