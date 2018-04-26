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

contract('DAICO', function ([owner, noOwner]) {

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.daico = await DAICO.new();
  });

  it('only owner can change tap', async function(){
    const ownerNewTap = new BigNumber(10)
    this.daico.changeTap(ownerNewTap).should.be.fulfilled
    let daicoNewTap = await this.daico.tap()
    ownerNewTap.should.be.bignumber.equal(daicoNewTap)
    const noOwnerNewTap = new BigNumber(15)
    this.daico.changeTap(noOwnerNewTap, {from: noOwner}).should.be.rejectedWith(EVMRevert)
    daicoNewTap = await this.daico.tap()
    ownerNewTap.should.be.bignumber.equal(daicoNewTap)
  })
})
