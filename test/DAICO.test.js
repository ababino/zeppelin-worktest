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
    this.afterlastWithdrawn = this.lastWithdrawn + duration.weeks(1);
    this.owner = accounts[0];
    this.no_owner = accounts[1];
    this.purchaser = accounts[2];
    this.no_purchaser = accounts[3];
    this.owner_initial_balance = web3.eth.getBalance(this.owner);
    this.token = await SimpleToken.new();
    this.daico = await DAICO.new(this.lastWithdrawn, rate, iquorum, wallet, this.token.address);
    await this.token.transfer(this.daico.address, tokenSupply);

  });


  describe('during contribution mode', function () {

    it('tokens can be bought and buyers are holders', async function () {
      await this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value}).should.be.fulfilled;
      const isholder = await this.daico.isHolder(this.purchaser);
      assert.ok(isholder);
    })

    it('if you dont buy you are not a holder', async function() {
      const isholder = await this.daico.isHolder(this.no_purchaser);
      assert.ok(!isholder);
    });

    it('no one can withdraw', async function () {
      await this.daico.withdraw({from: this.owner}).should.be.rejectedWith(EVMRevert);
      assert.ok(this.owner_initial_balance >= web3.eth.getBalance(this.owner))
      await this.daico.withdraw({from: this.no_owner}).should.be.rejectedWith(EVMRevert);
      assert.ok(this.owner_initial_balance >= web3.eth.getBalance(this.owner))
    });

    it('no one can propose a new tap', async function() {
      await this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value});
      await this.daico.newRaiseTapProposal(tap, 60, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
      await this.daico.newRaiseTapProposal(tap, 60, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
      await this.daico.newRaiseTapProposal(tap, 60, {from: this.owner}).should.be.rejectedWith(EVMRevert);
    });

    it('initial value of tap is zero', async function(){
      const currentTap = await this.daico.tap();
      assert.ok(currentTap.eq(new BigNumber(0)));
    });

  });

  describe('after contribution mode', function(){

    beforeEach(async function () {
      this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value})
      await increaseTimeTo(this.afterlastWithdrawn);
    });

    it('owner can withdraw but tap is zero', async function () {
      await this.daico.withdraw({from: this.owner}).should.be.fulfilled;
      assert.ok(this.owner_initial_balance >= web3.eth.getBalance(this.owner))
    });

    it('no one can withdraw if she is not owner', async function () {
      await this.daico.withdraw({from: this.no_owner}).should.be.rejectedWith(EVMRevert);
    });

    it('if you did not buy tokens you are not a holder', async function() {
      const isholder = await this.daico.isHolder(this.no_purchaser);
      assert.ok(!isholder);
    });

    it('purchasers are considered holders', async function() {
      const isholder = await this.daico.isHolder(this.purchaser);
      assert.ok(isholder);
    });

    it('holder can propose a new tap', async function() {
      await this.daico.newRaiseTapProposal(tap, 3600, {from: this.purchaser}).should.be.fulfilled;
    });

    it('if you are not a holder you cant propose a new tap', async function() {
      await this.daico.newRaiseTapProposal(tap, 3600, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
    });


    describe('voting', function(){

      beforeEach(async function(){
        this.proposalID = await this.daico.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
        await this.daico.newRaiseTapProposal(100, 3600, {from: this.purchaser});
      });

      it('holder can vote a proposal before votingDeadline', async function() {
        await this.daico.vote(this.proposalID, true, {from: this.purchaser}).should.be.fulfilled;
        await this.daico.vote(this.proposalID, true, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
      });

      it('no one can vote a proposal after votingDeadline', async function() {
        await increaseTimeTo(latestTime() + duration.hours(1));
        await this.daico.vote(this.proposalID, true, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
      });

      describe('proposal execution', function(){

        beforeEach(async function(){
          this.initial_tap = await this.daico.tap();
          this.rejectedProposalID = await this.daico.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
          await this.daico.newRaiseTapProposal(200, 1800, {from: this.purchaser});
          this.proposalWithoutQuorumID = await this.daico.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
          await this.daico.newRaiseTapProposal(200, 1800, {from: this.purchaser});
          this.oldProposalWithLowTapID = await this.daico.newRaiseTapProposal.call(90, 7200, {from: this.purchaser});
          await this.daico.newRaiseTapProposal(90, 7200, {from: this.purchaser});
          await this.daico.vote(this.proposalID, true, {from: this.purchaser});
          await this.daico.vote(this.oldProposalWithLowTapID, true, {from: this.purchaser});
          await this.daico.vote(this.rejectedProposalID, false, {from: this.purchaser});
        });

        it('proposal cant be executed before deadline', async function() {
            await this.daico.executeRaiseTapProposal(this.proposalID).should.be.rejectedWith(EVMRevert);
        });

        it('passed propasal can be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          await this.daico.executeRaiseTapProposal(this.proposalID);
          const new_tap = await this.daico.tap();
          assert.ok(new_tap==100);
        });

        describe('after a proposal is passed', function(){

          beforeEach(async function(){
            await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
            await this.daico.executeRaiseTapProposal(this.proposalID);
            this.newTap = await this.daico.tap();
          });

          it('owner can withdraw time times new tap', async function(){
            const firstWithdraw = await this.daico.lastWithdrawn();
            await increaseTimeTo(latestTime() + duration.seconds(1000000));
            const initialBalance = web3.eth.getBalance(this.owner);
            const out = await this.daico.withdraw({from: this.owner});
            const secondWithdraw = await this.daico.lastWithdrawn();
            assert.ok(secondWithdraw.eq(new BigNumber(latestTime())));
            const expectedWithdraw = this.newTap.mul(secondWithdraw.minus(firstWithdraw))
            const gasUsed = new BigNumber(out.receipt.gasUsed);
            const tx = await web3.eth.getTransaction(out.tx);
            const gasPrice = new BigNumber(tx.gasPrice);
            const fee = gasUsed.mul(gasPrice);
            const finalBalance = web3.eth.getBalance(this.owner);
            const expectedFinalBalance = initialBalance.add(expectedWithdraw).minus(fee)
            assert.ok(finalBalance.eq(expectedFinalBalance))
          });


          it('propossal cant be executed more than one time', async function(){
            await this.daico.executeRaiseTapProposal(this.proposalID).should.be.rejectedWith(EVMRevert);
          });

          it('cant propse lower the tap', async function(){
            const lowTap = this.newTap - 1;
            await this.daico.newRaiseTapProposal(lowTap, 3600, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
          });

          it('old proposal with low tap cant be executed', async function(){
            await increaseTimeTo(latestTime() + duration.hours(2) + duration.seconds(1));
            await this.daico.executeRaiseTapProposal(this.oldProposalWithLowTapID).should.be.rejectedWith(EVMRevert);
            const currentTap = await this.daico.tap();
            assert.ok(currentTap.eq(this.newTap));
          });

          it('can propose a greater tap', async function(){
            const currentTap = await this.daico.tap();
            const greaterTap = this.newTap.add(new BigNumber(1));
            await this.daico.newRaiseTapProposal(greaterTap, 3600, {from: this.purchaser}).should.be.fulfilled;
          });

        });
        it('rejected propasal can not be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          await this.daico.executeRaiseTapProposal(this.rejectedProposalID);
          const new_tap = await this.daico.tap();
          assert.ok(new_tap==0);
        });

        it('propasal without quorum can not be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          await this.daico.executeRaiseTapProposal(this.proposalWithoutQuorumID);
          const new_tap = await this.daico.tap();
          assert.ok(new_tap==0);
        });

      });
    });
});

});
