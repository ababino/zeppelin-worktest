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
const DaicoGovern = artifacts.require('DaicoGovern');
const SimpleToken = artifacts.require('SimpleToken');

contract('DAICO', function (accounts) {
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
    this.token = await SimpleToken.new();
    // this.daicoGovern = await DaicoGovern.new(this.lastWithdrawn, iquorum);
    this.daico = await DAICO.new(rate, this.owner, this.token.address, this.lastWithdrawn, iquorum);
    this.daicoGovern = DaicoGovern.at(await this.daico.daicoGovernAddress())
    await this.token.transfer(this.daico.address, tokenSupply);

  });


  describe('during contribution mode', function () {

    it('tokens can be bought and buyers are holders', async function () {
      await this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value}).should.be.fulfilled;
      const isholder = await this.daicoGovern.isHolder(this.purchaser);
      assert.ok(isholder);
      // await this.daicoGovern.addHolder(this.no_purchaser, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
      // await this.daicoGovern.addHolder(this.no_purchaser, {from: this.owner}).should.be.rejectedWith(EVMRevert);

    })

    it('if you dont buy you are not a holder', async function() {
      const isholder = await this.daicoGovern.isHolder(this.no_purchaser);
      assert.ok(!isholder);
    });

    it('no one can withdraw', async function () {
      await this.daico.withdraw({from: this.owner}).should.be.rejectedWith(EVMRevert);
      this.owner_initial_balance.should.be.bignumber.at.least(web3.eth.getBalance(this.owner))
      await this.daico.withdraw({from: this.no_owner}).should.be.rejectedWith(EVMRevert);
      this.owner_initial_balance.should.be.bignumber.at.least(web3.eth.getBalance(this.owner))
    });

    it('no one can propose a new tap', async function() {
      await this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value});
      await this.daicoGovern.newRaiseTapProposal(tap, 60, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
      await this.daicoGovern.newRaiseTapProposal(tap, 60, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
      await this.daicoGovern.newRaiseTapProposal(tap, 60, {from: this.owner}).should.be.rejectedWith(EVMRevert);
    });

    it('initial value of tap is zero', async function(){
      const currentTap = await this.daicoGovern.tap();
      expect(currentTap).to.be.zero;
    });

  });

  describe('after contribution mode', function(){

    beforeEach(async function () {
      this.daico.buyTokens(this.purchaser, {from: this.purchaser, value: higher_value})
      await increaseTimeTo(this.afterlastWithdrawn);
    });

    it('owner can withdraw but tap is zero', async function () {
      await this.daico.withdraw({from: this.owner}).should.be.fulfilled;
      this.owner_initial_balance.should.be.bignumber.at.least(web3.eth.getBalance(this.owner))
    });

    it('no one can withdraw if she is not owner', async function () {
      await this.daico.withdraw({from: this.no_owner}).should.be.rejectedWith(EVMRevert);
    });

    it('if you did not buy tokens you are not a holder', async function() {
      const isholder = await this.daicoGovern.isHolder(this.no_purchaser);
      assert.ok(!isholder);
    });

    it('purchasers are considered holders', async function() {
      const isholder = await this.daicoGovern.isHolder(this.purchaser);
      assert.ok(isholder);
    });

    it('holder can propose a new tap', async function() {
      await this.daicoGovern.newRaiseTapProposal(tap, 3600, {from: this.purchaser}).should.be.fulfilled;
    });

    it('if you are not a holder you cant propose a new tap', async function() {
      await this.daicoGovern.newRaiseTapProposal(tap, 3600, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
    });


    describe('voting', function(){

      beforeEach(async function(){
        this.proposalID = await this.daicoGovern.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
        await this.daicoGovern.newRaiseTapProposal(100, 3600, {from: this.purchaser});
      });

      it('holder can vote a proposal before votingDeadline', async function() {
        let proposal = await this.daicoGovern.proposals.call(this.proposalID)
        const initalNumberOfVotes = proposal[4];
        const initalNumberOfPositiveVotes = proposal[5];
        expect(initalNumberOfVotes).to.be.zero;
        expect(initalNumberOfPositiveVotes).to.be.zero;
        await this.daicoGovern.vote(this.proposalID, true, {from: this.purchaser}).should.be.fulfilled;
        await this.daicoGovern.vote(this.proposalID, true, {from: this.no_purchaser}).should.be.rejectedWith(EVMRevert);
        proposal = await this.daicoGovern.proposals.call(this.proposalID)
        const finalNumberOfVotes = proposal[4];
        const finalNumberOfPositiveVotes = proposal[5];
        finalNumberOfVotes.should.be.bignumber.equal(1);
        finalNumberOfPositiveVotes.should.be.bignumber.equal(1);
      });

      it('no one can vote a proposal after votingDeadline', async function() {
        await increaseTimeTo(latestTime() + duration.hours(1));
        await this.daicoGovern.vote(this.proposalID, true, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
      });

      describe('proposal execution', function(){

        beforeEach(async function(){
          this.initial_tap = await this.daicoGovern.tap();
          this.rejectedProposalID = await this.daicoGovern.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
          await this.daicoGovern.newRaiseTapProposal(200, 1800, {from: this.purchaser});
          this.proposalWithoutQuorumID = await this.daicoGovern.newRaiseTapProposal.call(100, 3600, {from: this.purchaser});
          await this.daicoGovern.newRaiseTapProposal(200, 1800, {from: this.purchaser});
          this.oldProposalWithLowTapID = await this.daicoGovern.newRaiseTapProposal.call(90, 7200, {from: this.purchaser});
          await this.daicoGovern.newRaiseTapProposal(90, 7200, {from: this.purchaser});
          await this.daicoGovern.vote(this.proposalID, true, {from: this.purchaser});
          await this.daicoGovern.vote(this.oldProposalWithLowTapID, true, {from: this.purchaser});
          await this.daicoGovern.vote(this.rejectedProposalID, false, {from: this.purchaser});
        });

        it('proposal cant be executed before deadline', async function() {
            await this.daicoGovern.executeRaiseTapProposal(this.proposalID).should.be.rejectedWith(EVMRevert);
        });

        it('passed propasal can be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          let proposals = await this.daicoGovern.proposals.call(this.proposalID);
          let executed = proposals[3]
          assert.ok(!executed)
          const initialAmountAvailableToWithdraw = await this.daicoGovern.amountAvailableToWithdraw();
          await this.daicoGovern.executeRaiseTapProposal(this.proposalID);
          const finalAmountAvailableToWithdraw = await this.daicoGovern.amountAvailableToWithdraw();
          const newTap = await this.daicoGovern.tap();
          newTap.should.be.bignumber.equal(100)
          proposals = await this.daicoGovern.proposals.call(this.proposalID);
          executed = proposals[3]
          assert.ok(executed)
          const lastWithdrawn = await this.daicoGovern.lastWithdrawn();
          lastWithdrawn.should.be.bignumber.equal(latestTime())
        });

        describe('after a proposal is passed', function(){

          beforeEach(async function(){
            await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
            await this.daicoGovern.executeRaiseTapProposal(this.proposalID);
            this.newTap = await this.daicoGovern.tap();
          });

          it('owner can withdraw time times new tap', async function(){

            const firstWithdraw = await this.daicoGovern.lastWithdrawn();

            await increaseTimeTo(latestTime() + duration.seconds(1000000));

            const initialBalance = web3.eth.getBalance(this.owner);
            const out = await this.daico.withdraw({from: this.owner});
            const secondWithdraw = await this.daicoGovern.lastWithdrawn();
            secondWithdraw.should.be.bignumber.equal(latestTime())
            const expectedWithdraw = this.newTap.mul(secondWithdraw.minus(firstWithdraw))
            const gasUsed = new BigNumber(out.receipt.gasUsed);
            const tx = await web3.eth.getTransaction(out.tx);
            const gasPrice = new BigNumber(tx.gasPrice);
            const fee = gasUsed.mul(gasPrice);
            const finalBalance = web3.eth.getBalance(this.owner);
            const expectedFinalBalance = initialBalance.add(expectedWithdraw).minus(fee)
            finalBalance.should.be.bignumber.equal(expectedFinalBalance)
          });


          it('propossal cant be executed more than one time', async function(){
            await this.daicoGovern.executeRaiseTapProposal(this.proposalID).should.be.rejectedWith(EVMRevert);
          });

          it('cant propse lower the tap', async function(){
            const lowTap = this.newTap.minus(new BigNumber(1));
            await this.daicoGovern.newRaiseTapProposal(lowTap, 3600, {from: this.purchaser}).should.be.rejectedWith(EVMRevert);
          });

          it('old proposal with low tap cant be executed', async function(){
            await increaseTimeTo(latestTime() + duration.hours(2) + duration.seconds(1));
            await this.daicoGovern.executeRaiseTapProposal(this.oldProposalWithLowTapID).should.be.rejectedWith(EVMRevert);
            const currentTap = await this.daicoGovern.tap();
            currentTap.should.be.bignumber.equal(this.newTap)
          });

          it('can propose a greater tap', async function(){
            const currentTap = await this.daicoGovern.tap();
            const greaterTap = this.newTap.add(new BigNumber(1));
            await this.daicoGovern.newRaiseTapProposal(greaterTap, 3600, {from: this.purchaser}).should.be.fulfilled;
          });

        });
        it('rejected propasal can not be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          await this.daicoGovern.executeRaiseTapProposal(this.rejectedProposalID);
          const newTap = await this.daicoGovern.tap();
          newTap.should.be.zero
        });

        it('propasal without quorum can not be executed', async function() {
          await increaseTimeTo(latestTime() + duration.hours(1) + duration.seconds(1));
          await this.daicoGovern.executeRaiseTapProposal(this.proposalWithoutQuorumID);
          const newTap = await this.daicoGovern.tap();
          newTap.should.be.zero
        });

      });
    });
});

});
