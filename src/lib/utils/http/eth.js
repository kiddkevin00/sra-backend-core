const HttpClient = require('./HttpClient');
const queryString = require('query-string');


const httpClient = HttpClient.createInstance({ baseURL: 'https://api.etherscan.io' });

exports.fetchAddressBalance = (address) => {
  const qs = queryString.stringify({
    address,
    module: 'account',
    action: 'balance',
    tag: 'latest',
  });

  return httpClient.get(`/api/?${qs}`);
};

exports.fetchAddressTransactions = (address) => {
  const qs = queryString.stringify({
    address,
    module: 'account',
    action: 'txlist',
    startblock: '0',
    sort: 'asc',
  });

  return httpClient.get(`/api/?${qs}`);
};
