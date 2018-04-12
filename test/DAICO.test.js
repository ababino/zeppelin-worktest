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
    this.daico = await DAICO.new(this.lastWithdrawn, rate, iquorum, wallet, this.token.address);
    await this.token.transfer(this.daico.address, tokenSupply);
  });


  describe('withdrawal permissions and timing', function () {


    it('owner can withdraw after last withdrawal', async function () {
      let owner = accounts[0];
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: owner}).should.be.fulfilled;
    });

    it('owner can not withdraw before last withdrawal', async function () {
      let owner = accounts[0];
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await this.daico.withdraw({from: owner}).should.be.rejectedWith(EVMRevert);
    });

    it('no one can withdraw if she is not owner', async function () {
      let no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: no_owner}).should.be.rejectedWith(EVMRevert);
    });

    // for tap
    // it('owner can withdraw after last withdrawal', async function () {
    //   let owner = accounts[0];
    //   let no_owner = accounts[3];
    //   await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
    //   await increaseTimeTo(this.afterlastWithdrawn);
    //   const initial_balance = web3.eth.getBalance(owner).c[0];
    //   await this.daico.withdraw({from: owner}).should.be.fulfilled;
    //   const final_balance = web3.eth.getBalance(owner).c[0];
    //   assert.ok(final_balance > initial_balance);
    // });
    //
    // it('owner can t withdraw more than tap times time', async function () {
    //   let owner = accounts[0];
    //   let no_owner = accounts[3];
    //   await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
    //   await increaseTimeTo(this.afterlastWithdrawn);
    //   const initial_balance = web3.eth.getBalance(owner).c[0];
    //   const timestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    //   await this.daico.withdraw({from: owner});
    //   const final_balance = web3.eth.getBalance(owner).c[0];
    //   assert.ok(final_balance - initial_balance <= tap * (timestamp - this.lastWithdrawn))
    // });
  });

  describe('proposals', function () {
    it('no purchaser no holder', async function() {
      let purchaser = accounts[5];
      let isholder = await this.daico.isHolder(purchaser);
      assert.ok(!isholder);
    });

    it('if you did not purchased a token you are not a holder', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value}).should.be.fulfilled;
      let isholder = await this.daico.isHolder(purchaser);
      assert.ok(isholder);
    });

    it('holder can propose a new tap in tap mode', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(tap * 2, 3600, {from: purchaser}).should.be.fulfilled;
    });

    it('if you are not a holder you cant propose a new tap', async function() {
      let noholder = accounts[4];
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(tap * 2, 3600, {from: noholder}).should.be.rejectedWith(EVMRevert);
    });

    it('holder can vote a proposal in time', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser}).should.be.fulfilled;
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;
    });

    it('no one can vote a proposal after votingDeadline', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await increaseTimeTo(latestTime() + duration.hours(1));
      await this.daico.vote(0, true, {from: purchaser}).should.be.rejectedWith(EVMRevert);
    });

    it('passed propasal can be executed', async function() {
      let purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      let old_tap = await this.daico.tap();
      assert.ok(old_tap.c[0]==0);
      await this.daico.executeRaiseTapProposal(0);
      let new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==100);
    });

    // it('you can not propose lower the tap', async function() {
    //   let purchaser = accounts[4];
    //   await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
    //   await increaseTimeTo(this.afterlastWithdrawn);
    //   await this.daico.newRaiseTapProposal(100, 60, {from: purchaser});
    //   await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;
    //   await increaseTimeTo(this.afterlastWithdrawn + 60);
    //   await this.daico.executeRaiseTapProposal(0, {from: purchaser}).should.be.fulfilled;
    //   await this.daico.newRaiseTapProposal(90, 3600, {from: purchaser}).should.be.rejectedWith(EVMRevert);
    // });
    //

  });

});
