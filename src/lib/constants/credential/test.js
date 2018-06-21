exports.JWT = {
  SECRET: 'test-jwt-secret',
  ISSUER: 'sra-backend-core.herokuapp.com',
  AUDIENCE: 'society-risk-analysis.herokuapp.com',
  EXPIRES_IN: '365 days',
  NOT_BEFORE: 0,

  COOKIE_NAME: 'jwt',
  COOKIE_HTTP_ONLY: true,
  COOKIE_SECURE: false,
  COOKIE_PATH: '/api',
  COOKIE_SIGNED: false,
};
