const axios = require('axios');


class HttpClient {

  static createInstance(instanceConfig) {
    const axiosInstance = axios.create(instanceConfig);

    return axiosInstance;
  }

}

module.exports = exports = HttpClient;
