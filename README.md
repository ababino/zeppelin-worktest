# DAICO

The aim of this repo is to write a DAICO contract as explained by Vitalik Buterin in this [post]( https://slack-redir.net/link?url=https%3A%2F%2Fethresear.ch%2Ft%2Fexplanation-of-daicos%2F465).

Steps to test:

```bash
git clone https://github.com/ababino/zeppelin-worktest
npm install
truffle test
```

TODO

* Make `withdraw` not onlyOwner.
* `withdaw` should send found to the owner, not `msg.sender`
* `executeRaiseTapProposal` should call `withdraw` before changing the `tap`.
