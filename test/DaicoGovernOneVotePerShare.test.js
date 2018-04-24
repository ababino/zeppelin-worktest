import ether from 'zeppelin-solidity/test/helpers/ether';
import { advanceBlock } from 'zeppelin-solidity/test/helpers/advanceToBlock';
import { increaseTimeTo, duration } from 'zeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';
import EVMRevert from 'zeppelin-solidity/test/helpers/EVMRevert';
const assertRevert = require('zeppelin-solidity/test/helpers/assertRevert')

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const DaicoGovernOneVotePerShare = artifacts.require('DaicoGovernOneVotePerShare');
const SimpleToken = artifacts.require('SimpleToken');

contract('DaicoGovernOneVotePerShare', function (accounts) {
  const rate = new BigNumber(1);
  const tap = 10000000000;
  const iquorum = 3;
  const value = ether(1);
  const higher_value = ether(3);
  const tokenSupply = new BigNumber('1e22');

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.lastWithdrawn = latestTime() + duration.weeks(1);
    this.afterlastWithdrawn = this.lastWithdrawn + duration.weeks(1);
    this.owner = accounts[0];
    this.no_owner = accounts[1];
    this.purchaser = accounts[2];
    this.no_purchaser = accounts[3];
    this.owner_initial_balance = web3.eth.getBalance(this.owner);
    const block = web3.eth.getBlock("latest");
    console.log("gasLimit: " + block.gasLimit);
    this.token = await SimpleToken.new();
    let receipt = await web3.eth.getTransactionReceipt(this.token.transactionHash);
    console.log(receipt.gasUsed)
    this.daicoGovernOneVotePerShare = await DaicoGovernOneVotePerShare.new(this.lastWithdrawn, iquorum, this.token.address);
    receipt = await web3.eth.getTransactionReceipt(this.daicoGovernOneVotePerShare.transactionHash);
    console.log(receipt.gasUsed)

  });

  describe('yyyy' , function(){

    it('xxxx', async function() {
      let pepe = await this.token.balanceOf(this.owner)
      console.log(pepe)
      pepe = this.token.balanceOf(this.no_owner)
      console.log(pepe)
    })

  })

});
