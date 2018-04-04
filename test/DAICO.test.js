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

const DAICO = artifacts.require('DAICO');
const SimpleToken = artifacts.require('SimpleToken');

contract('DAICO', function (accounts) {
  const rate = new BigNumber(1);
  const tap = 10000000000;
  const iquorum = 3;
  const wallet = accounts[1];
  const value = ether(1);
  const higher_value = ether(3);
  const tokenSupply = new BigNumber('1e22');

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.lastWithdrawn = latestTime() + duration.weeks(1);
    this.afterlastWithdrawn = this.lastWithdrawn + duration.weeks(1)
    this.token = await SimpleToken.new();
    this.daico = await DAICO.new(this.lastWithdrawn, rate, tap, iquorum, wallet, this.token.address);
    await this.token.transfer(this.daico.address, tokenSupply);
  });


  describe('withdraw', function () {


    it('owner can not withdraw before last withdrawal', async function () {
      let owner = accounts[0];
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: owner}).should.be.fulfilled;
    });

    it('no one can withdraw if she is not owner', async function () {
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: no_owner}).should.be.rejectedWith(EVMRevert);
    });

    it('owner can withdraw after last withdrawal', async function () {
      let owner = accounts[0];
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      const initial_balance = web3.eth.getBalance(owner).c[0];
      await this.daico.withdraw({from: owner}).should.be.fulfilled;
      const final_balance = web3.eth.getBalance(owner).c[0];
      assert.ok(final_balance > initial_balance);
    });

    it('owner can t withdraw more than tap times time', async function () {
      let owner = accounts[0];
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      const initial_balance = web3.eth.getBalance(owner).c[0];
      const timestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
      await this.daico.withdraw({from: owner});
      const final_balance = web3.eth.getBalance(owner).c[0];
      assert.ok(final_balance - initial_balance <= tap * (timestamp - this.lastWithdrawn))
    });
  });

  describe('voting as expected', function () {
    it('no purchaser no holder', async function() {
      let purchaser = accounts[5];
      let isholder = await this.daico.isHolder(purchaser);
      assert.ok(!isholder);
    });

    it('purchaser is holder', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value}).should.be.fulfilled;
      let isholder = await this.daico.isHolder(purchaser);
      assert.ok(isholder);
    });

  });

});
