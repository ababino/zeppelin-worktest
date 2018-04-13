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
      const owner = accounts[0];
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: owner}).should.be.fulfilled;
    });

    it('owner can not withdraw before last withdrawal', async function () {
      const owner = accounts[0];
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await this.daico.withdraw({from: owner}).should.be.rejectedWith(EVMRevert);
    });

    it('no one can withdraw if she is not owner', async function () {
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.withdraw({from: no_owner}).should.be.rejectedWith(EVMRevert);
    });

  });

  describe('proposals', function () {
    it('no purchaser no holder', async function() {
      const isholder = await this.daico.isHolder(accounts[2]);
      assert.ok(!isholder);
    });

    it('if you did not purchased a token you are not a holder', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value}).should.be.fulfilled;
      let isholder = await this.daico.isHolder(purchaser);
      assert.ok(isholder);
    });

    it('holder can propose a new tap in tap mode', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(tap * 2, 3600, {from: purchaser}).should.be.fulfilled;
    });

    it('if you are not a holder you cant propose a new tap', async function() {
      const noholder = accounts[4];
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(tap * 2, 3600, {from: noholder}).should.be.rejectedWith(EVMRevert);
    });

    it('holder can vote a proposal in time', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser}).should.be.fulfilled;
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;
    });

    it('no one can vote a proposal after votingDeadline', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await increaseTimeTo(latestTime() + duration.hours(1));
      await this.daico.vote(0, true, {from: purchaser}).should.be.rejectedWith(EVMRevert);
    });

    it('passed propasal can be executed', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      const old_tap = await this.daico.tap();
      assert.ok(old_tap.c[0]==0);
      await this.daico.executeRaiseTapProposal(0);
      const new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==100);
    });

    it('rejected propasal can not be executed', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await this.daico.vote(0, false, {from: purchaser}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      const old_tap = await this.daico.tap();
      assert.ok(old_tap.c[0]==0);
      await this.daico.executeRaiseTapProposal(0);
      const new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==0);
    });

    it('propasal without quorum can not be executed', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      const old_tap = await this.daico.tap();
      assert.ok(old_tap.c[0]==0);
      await this.daico.executeRaiseTapProposal(0);
      const new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==0);
    });

    it('you can not propose lower the tap', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      const proposalID = await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      await this.daico.executeRaiseTapProposal(0);
      const new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==100);
      await this.daico.newRaiseTapProposal(99, 3600, {from: purchaser}).should.be.rejectedWith(EVMRevert);
    });

    it('old propose can not be executed if it lowers the tap', async function() {
      const purchaser = accounts[4];
      await this.daico.buyTokens(purchaser, {from: purchaser, value: higher_value});
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(100, 3600, {from: purchaser});
      await this.daico.newRaiseTapProposal(90, 7200, {from: purchaser});
      await this.daico.vote(0, true, {from: purchaser}).should.be.fulfilled;;
      await this.daico.vote(1, true, {from: purchaser}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(2) + duration.seconds(1));
      await this.daico.executeRaiseTapProposal(0).should.be.fulfilled;
      await this.daico.executeRaiseTapProposal(1).should.be.rejectedWith(EVMRevert);
      const new_tap = await this.daico.tap();
      assert.ok(new_tap.c[0]==100);
    });
  });

  describe('tap', function () {

    it('owner cant withdraw before last withdrawal', async function () {
      const owner = accounts[0];
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await this.daico.withdraw({from: owner}).should.be.rejectedWith(EVMRevert);
    });

    it('initial tap is zero and owner can withdraw zero', async function () {
      const owner = accounts[0];
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      const initial_balance = web3.eth.getBalance(owner).c[0];
      await this.daico.withdraw({from: owner}).should.be.fulfilled;
      const final_balance = web3.eth.getBalance(owner).c[0];
      assert.ok(final_balance < initial_balance);
    });

    it('owner can withdraw as much as tap times time', async function () {
      const owner = accounts[0];
      const no_owner = accounts[3];
      await this.daico.buyTokens(no_owner, {from: no_owner, value: higher_value}).should.be.fulfilled;
      await increaseTimeTo(this.afterlastWithdrawn);
      await this.daico.newRaiseTapProposal(tap, 3600, {from: no_owner});
      await this.daico.vote(0, true, {from: no_owner}).should.be.fulfilled;;
      await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
      await this.daico.executeRaiseTapProposal(0).should.be.fulfilled;
      await increaseTimeTo(latestTime() + duration.seconds(1000000));
      const initial_balance = web3.eth.getBalance(owner).c[0];
      const out = await this.daico.withdraw({from: owner});
      const fee = out.receipt.gasUsed / 1000;
      const final_balance = web3.eth.getBalance(owner).c[0];
      assert.ok(final_balance - initial_balance - 100 + fee < 1);
    });

  });
});
