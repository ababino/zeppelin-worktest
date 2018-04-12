# DAICO

The aim of this repo is to write a DAICO contract as explained by Vitalik Buterin in this [post](https://ethresear.ch/t/explanation-of-daicos/465).

Steps to test:

```bash
git clone https://github.com/ababino/zeppelin-worktest
npm install
npm test
```

TODO

* Make `withdraw` not onlyOwner. maybe

 OBS

 * Holder can not vote or propose new taps before tap mode is enable. That would allow the initial holder to raise the tap without the consent of the future holders.
