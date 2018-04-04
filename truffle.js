module.exports = {
    // networks: {
    //     development: {
    //         host: "localhost",
    //         port: 8545,
    //         network_id: "*" // Match any network id
    //     }
    // }
};
require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill');
