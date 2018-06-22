exports.ERROR_NAMES = {
  JWT_INVALID: 'JWT_INVALID',
  JWT_NOT_AUTHORIZED: 'JWT_NOT_AUTHORIZED',
  JWT_GENERATION_ERROR: 'JWT_GENERATION_ERROR',
  EMAIL_ALREADY_SIGNUP: 'EMAIL_ALREADY_SIGNUP',
  LOGIN_INFO_INCORRECT: 'LOGIN_INFO_INCORRECT',
  USER_EMAIL_NOT_FOUND: 'USER_EMAIL_NOT_FOUND',
  FULL_NAME_FIELD_IS_EMPTY: 'FULL_NAME_FIELD_IS_EMPTY',
  EMAIL_FIELD_IS_EMPTY: 'EMAIL_FIELD_IS_EMPTY',
  PASSWORD_FIELD_IS_EMPTY: 'PASSWORD_FIELD_IS_EMPTY',
};

exports.ERROR_MSG = {
  JWT_INVALID: 'The provided JWT is invalid.',
  JWT_NOT_AUTHORIZED: 'The provided JWT identity is not authorized to access the resource.',
  JWT_GENERATION_ERROR: 'Something went wrong while generating JWT token.',
  EMAIL_ALREADY_SIGNUP: 'The provided email is already signed up.',
  LOGIN_INFO_INCORRECT: 'The provided login information is incorrect.',
  USER_EMAIL_NOT_FOUND: 'The provided email is not found in database.',
};

exports.CORS = {
  WHITELIST: [
    'https://society-risk-analysis.herokuapp.com',
    'http://0.0.0.0:8088',
    'http://127.0.0.1:8088',
    'http://localhost:8088',
  ],
};

