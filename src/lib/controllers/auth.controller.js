const DatabaseService = require('../services/database.service');
const ProcessSate = require('../process-state/');
const EmailSender = require('../utils/email-sender');
const Validator = require('../utils/precondition-validator');
const StandardErrorWrapper = require('../utils/standard-error-wrapper');
const StandardResponseWrapper = require('../utils/standard-response-wrapper');
const constants = require('../constants/');
const packageJson = require('../../../package.json');
const jwt = require('jsonwebtoken');
const couponCode = require('coupon-code');
const mongojs = require('mongojs');
const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');


const jwtSecret = constants.CREDENTIAL.JWT.SECRET;
const jwtIssuer = constants.CREDENTIAL.JWT.ISSUER;
const jwtAudience = constants.CREDENTIAL.JWT.AUDIENCE;
const jwtExpiresIn = constants.CREDENTIAL.JWT.EXPIRES_IN;
const jwtNotBefore = constants.CREDENTIAL.JWT.NOT_BEFORE;
const containerId = process.env.HOSTNAME;
let requestCount = 0;

class AuthController {

  static subscribe(req, res) {
    requestCount += 1;

    let state;

    return Promise
      .try(() => {
        const email = req.body.email && req.body.email.trim();

        Validator.shouldNotBeEmpty(email, constants.AUTH.ERROR_NAMES.EMAIL_FIELD_IS_EMPTY);

        const options = {
          email: email.toLowerCase(),
        };
        const context = { containerId, requestCount };

        state = ProcessSate.create(options, context);

        const majorVersion = packageJson.version.slice(0, packageJson.version.indexOf('.'));
        const subscribeStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.UPSERT,
            data: [
              { email: state.email },
              {
                type: 'unpaid',
                email: state.email,
                isUnsubscribed: false,
                version: majorVersion,
                systemData: {
                  dateCreated: new Date(),
                  createdBy: 'N/A',
                  dateLastModified: null,
                  lastModifiedBy: 'N/A',
                },
              },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.SUBSCRIBER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, subscribeStrategy);
      })
      .then((result) => {
        const response = {
          success: true,
          detail: result,
        };
        const standardResponse = new StandardResponseWrapper([response],
          constants.SYSTEM.RESPONSE_NAMES.SUBSCRIBE);

        return res.status(constants.SYSTEM.HTTP_STATUS_CODES.CREATED)
          .json(standardResponse.format);
      })
      .catch((_err) => {
        const err = new StandardErrorWrapper(_err);
        const resStatusCode = err.getNthError(0).code < 1000 ?
          err.getNthError(0).code : constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        err.append({
          code: constants.SYSTEM.ERROR_CODES.INTERNAL_SERVER_ERROR,
          name: constants.SYSTEM.ERROR_NAMES.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: constants.SYSTEM.ERROR_MSG.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
        });

        const response = new StandardResponseWrapper([
          {
            success: false,
            status: err.getNthError(0).name,
            detail: err.format({
              containerId: state && state.context.containerId,
              requestCount: state && state.context.requestCount,
            }),
          },
        ], constants.SYSTEM.RESPONSE_NAMES.SUBSCRIBE);

        return res.status(resStatusCode)
          .json(response.format);
      });
  }

  static signup(req, res) {
    requestCount += 1;

    let state;

    return Promise
      .try(() => {
        const fullName = req.body.fullName && req.body.fullName.trim();
        const email = req.body.email && req.body.email.trim();
        const password = req.body.password && req.body.password.trim();

        Validator.shouldNotBeEmpty(fullName, constants.AUTH.ERROR_NAMES.FULL_NAME_FIELD_IS_EMPTY);
        Validator.shouldNotBeEmpty(email, constants.AUTH.ERROR_NAMES.EMAIL_FIELD_IS_EMPTY);
        Validator.shouldNotBeEmpty(password, constants.AUTH.ERROR_NAMES.PASSWORD_FIELD_IS_EMPTY);

        const options = {
          fullName: fullName.trim(),
          email: email.trim() && email.trim().toLowerCase(),
          password: password.trim(),
        };
        const context = { containerId, requestCount };

        state = ProcessSate.create(options, context);

        const signupCheckStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.SELECT,
            data: [
              { email: state.email },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, signupCheckStrategy);
      })
      .then((result) => {
        if (!Array.isArray(result) || result.length !== 0) {
          const err = new StandardErrorWrapper([
            {
              code: constants.SYSTEM.ERROR_CODES.BAD_REQUEST,
              name: constants.AUTH.ERROR_NAMES.EMAIL_ALREADY_SIGNUP,
              source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
              message: constants.AUTH.ERROR_MSG.EMAIL_ALREADY_SIGNUP,
            },
          ]);

          throw err;
        }

        const majorVersion = packageJson.version.slice(0, packageJson.version.indexOf('.'));
        const signupStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.INSERT,
            data: [
              {
                email: state.email,
                passwordHash: state.password, // [TODO] Should store hashed password instead.
                fullName: state.fullName,
                isSuspended: false,
                version: majorVersion,
                systemData: {
                  dateCreated: new Date(),
                  createdBy: 'N/A',
                  dateLastModified: null,
                  lastModifiedBy: 'N/A',
                },
              },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, signupStrategy);
      })
      .then((result) => {
        const user = { ...result };
        const emailSender = new EmailSender('Gmail', 'srataiwan@gmail.com');
        const from = '"Society Risk Analysis Team" <srataiwan@gmail.com>';
        const to = state.email;
        const subject = 'Welcome to Society Risk Analysis';

        // [TODO] Update content.
        const html = fs.readFileSync(path.resolve(__dirname, '../views/welcome-email.html'),
          'utf8');

        emailSender.sendMail(from, to, subject, html)
          .then((info) => {
            // [TODO] Replace with logger module.
            console.log('Welcome email message ID - %s sent: %s', info.messageId, info.response || 'N/A');
          })
          .catch((err) => {
            // [TODO] Replace with logger module.
            console.log('Something went wrong while sending welcome email...', err);
          });

        delete user.passwordHash;
        delete user.isSuspended;
        delete user.version;
        delete user.systemData;

        const jwtPayload = {
          ...user,
          sub: `${user.email}:${user._id}`,
        };
        const jwtToken = jwt.sign(jwtPayload, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
          expiresIn: jwtExpiresIn,
          notBefore: jwtNotBefore,
        });

        res.cookie(constants.CREDENTIAL.JWT.COOKIE_NAME, jwtToken, {
          httpOnly: constants.CREDENTIAL.JWT.COOKIE_HTTP_ONLY,
          secure: constants.CREDENTIAL.JWT.COOKIE_SECURE,
          path: constants.CREDENTIAL.JWT.COOKIE_PATH,
          maxAge: constants.CREDENTIAL.JWT.COOKIE_MAX_AGE,
          signed: constants.CREDENTIAL.JWT.COOKIE_SIGNED,
        });

        const response = {
          success: true,
          detail: user,
        };
        const standardResponse = new StandardResponseWrapper([response],
          constants.SYSTEM.RESPONSE_NAMES.SIGN_UP);

        return res.status(constants.SYSTEM.HTTP_STATUS_CODES.CREATED)
          .json(standardResponse.format);
      })
      .catch((_err) => {
        const err = new StandardErrorWrapper(_err);
        const resStatusCode = err.getNthError(0).code < 1000 ?
          err.getNthError(0).code : constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        err.append({
          code: constants.SYSTEM.ERROR_CODES.INTERNAL_SERVER_ERROR,
          name: constants.SYSTEM.ERROR_NAMES.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: constants.SYSTEM.ERROR_MSG.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
        });

        const response = new StandardResponseWrapper([
          {
            success: false,
            status: err.getNthError(0).name,
            detail: err.format({
              containerId: state && state.context.containerId,
              requestCount: state && state.context.requestCount,
            }),
          },
        ], constants.SYSTEM.RESPONSE_NAMES.SIGN_UP);

        return res.status(resStatusCode)
          .json(response.format);
      });
  }

  static login(req, res) {
    requestCount += 1;

    let state;

    return Promise
      .try(() => {
        const email = req.body.email && req.body.email.trim();
        const password = req.body.password && req.body.password.trim();

        Validator.shouldNotBeEmpty(email, constants.AUTH.ERROR_NAMES.EMAIL_FIELD_IS_EMPTY);
        Validator.shouldNotBeEmpty(password, constants.AUTH.ERROR_NAMES.PASSWORD_FIELD_IS_EMPTY);

        const options = {
          email: email.trim() && email.trim().toLowerCase(),
          password: password.trim(),
        };
        const context = { containerId, requestCount };

        state = ProcessSate.create(options, context);

        const loginStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.SELECT,
            data: [
              {
                email: state.email,
                passwordHash: state.password, // [TODO] Should only verify hashed password.
                isSuspended: false,
              },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, loginStrategy)
      })
      .then((result) => {
        if (!Array.isArray(result) || (result.length !== 1)) {
          const err = new StandardErrorWrapper([
            {
              code: constants.SYSTEM.ERROR_CODES.UNAUTHENTICATED,
              name: constants.AUTH.ERROR_NAMES.LOGIN_INFO_INCORRECT,
              source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
              message: constants.AUTH.ERROR_MSG.LOGIN_INFO_INCORRECT,
            },
          ]);

          throw err;
        }

        const user = { ...result[0] };

        delete user.passwordHash;
        delete user.isSuspended;
        delete user.version;
        delete user.systemData;

        const response = {
          success: true,
          detail: user,
        };

        const jwtPayload = Object.assign({}, user, {
          sub: `${user.email}:${user._id}`,
        });
        const jwtToken = jwt.sign(jwtPayload, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
          expiresIn: jwtExpiresIn,
          notBefore: jwtNotBefore,
        });

        res.cookie(constants.CREDENTIAL.JWT.COOKIE_NAME, jwtToken, {
          httpOnly: constants.CREDENTIAL.JWT.COOKIE_HTTP_ONLY,
          secure: constants.CREDENTIAL.JWT.COOKIE_SECURE,
          path: constants.CREDENTIAL.JWT.COOKIE_PATH,
          maxAge: constants.CREDENTIAL.JWT.COOKIE_MAX_AGE,
          signed: constants.CREDENTIAL.JWT.COOKIE_SIGNED,
        });

        const standardResponse = new StandardResponseWrapper([response],
          constants.SYSTEM.RESPONSE_NAMES.LOGIN);

        return res.status(constants.SYSTEM.HTTP_STATUS_CODES.OK)
          .json(standardResponse.format);
      })
      .catch((_err) => {
        const err = new StandardErrorWrapper(_err);
        const resStatusCode = err.getNthError(0).code < 1000 ?
          err.getNthError(0).code : constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        err.append({
          code: constants.SYSTEM.ERROR_CODES.INTERNAL_SERVER_ERROR,
          name: constants.SYSTEM.ERROR_NAMES.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: constants.SYSTEM.ERROR_MSG.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
        });

        const response = new StandardResponseWrapper([
          {
            success: false,
            status: err.getNthError(0).name,
            detail: err.format({
              containerId: state && state.context.containerId,
              requestCount: state && state.context.requestCount,
            }),
          },
        ], constants.SYSTEM.RESPONSE_NAMES.LOGIN);

        return res.status(resStatusCode)
          .json(response.format);
      });
  }

  static logout(req, res) {
    requestCount += 1;

    res.clearCookie(constants.CREDENTIAL.JWT.COOKIE_NAME, {
      path: constants.CREDENTIAL.JWT.COOKIE_PATH,
    });

    const response = new StandardResponseWrapper([{ success: true }],
      constants.SYSTEM.RESPONSE_NAMES.LOGOUT);

    return res.status(constants.SYSTEM.HTTP_STATUS_CODES.OK)
      .json(response.format);
  }

  static forgotPassword(req, res) {
    requestCount += 1;

    let state;
    let newPassword;

    return Promise
      .try(() => {
        const email = req.body.email && req.body.email.trim();

        Validator.shouldNotBeEmpty(email, constants.AUTH.ERROR_NAMES.EMAIL_FIELD_IS_EMPTY);

        const options = {
          email: email.toLowerCase(),
        };
        const context = { containerId, requestCount };

        state = ProcessSate.create(options, context);

        const forgotPasswordStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.SELECT,
            data: [
              { email: state.email },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, forgotPasswordStrategy);
      })
      .then((result) => {
        if (!Array.isArray(result) || (result.length !== 1)) {
          const err = new StandardErrorWrapper([
            {
              code: constants.SYSTEM.ERROR_CODES.BAD_REQUEST,
              name: constants.AUTH.ERROR_NAMES.USER_EMAIL_NOT_FOUND,
              source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
              message: constants.AUTH.ERROR_MSG.USER_EMAIL_NOT_FOUND,
            },
          ]);

          throw err;
        }

        newPassword = couponCode.generate({
          parts: 1,
          partLen: 8,
        });

        const emailSender = new EmailSender('Gmail', '2012tsra@gmail.com');
        const from = '"Society Risk Analysis Team" <2012tsra@gmail.com>';
        const to = state.email;
        const subject = 'How to reset your Society Risk Analysis account\'s Password';
        const html = `
          <div>
              <p>Dear ${result[0].fullName},</p>
              <h4>Here is your new password ${newPassword}</h4>
              <p>Please follow the instructions below to change back to your preferred password.</p>
              <ol>
                  <li>
                    Visit https://society-risk-analysis.herokuapp.com/register/login
                  </li>
                  <li>
                    Enter the new password that you received in this email above and log in.
                  </li>
                  <li>
                    Under Account tab in Profile section, change your password to what you would
                    like your new password to be.
                  </li>
              </ol>
              <br />
              <p>Thank you,</p>
              <p>Society Risk Analysis Support</p>
           </div>
        `;

        return emailSender.sendMail(from, to, subject, html);
      })
      .then((info) => {
        // [TODO] Replace with logger module.
        console.log('Forgot-password email message ID - %s sent: %s', info.messageId, info.response);

        const updatePasswordStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.UPDATE,
            data: [
              { email: state.email },
              { passwordHash: newPassword },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, updatePasswordStrategy);
      })
      .then((result) => {
        const response = new StandardResponseWrapper([{ success: true, detail: result }],
          constants.SYSTEM.RESPONSE_NAMES.FORGOT_PASSWORD);

        return res.status(constants.SYSTEM.HTTP_STATUS_CODES.OK)
          .json(response.format);
      })
      .catch((_err) => {
        const err = new StandardErrorWrapper(_err);
        const resStatusCode = err.getNthError(0).code < 1000 ?
          err.getNthError(0).code : constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        err.append({
          code: constants.SYSTEM.ERROR_CODES.INTERNAL_SERVER_ERROR,
          name: constants.SYSTEM.ERROR_NAMES.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: constants.SYSTEM.ERROR_MSG.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
        });

        const response = new StandardResponseWrapper([
          {
            success: false,
            status: err.getNthError(0).name,
            detail: err.format({
              containerId: state && state.context.containerId,
              requestCount: state && state.context.requestCount,
            }),
          },
        ], constants.SYSTEM.RESPONSE_NAMES.FORGOT_PASSWORD);

        return res.status(resStatusCode)
          .json(response.format);
      });
  }

  static getToken(req, res) {
    requestCount += 1;

    // [TODO] HTTP request's query string should not be case sensitive for both key and value.
    try {
      const jwtPayload = {
        ...req.query,
        sub: `${req.query.email}:${req.query._id}`,
      };
      const jwtToken = jwt.sign(jwtPayload, jwtSecret, {
        issuer: jwtIssuer,
        audience: jwtAudience,
        expiresIn: jwtExpiresIn,
        notBefore: jwtNotBefore,
      });

      res.cookie(constants.CREDENTIAL.JWT.COOKIE_NAME, jwtToken, {
        httpOnly: constants.CREDENTIAL.JWT.COOKIE_HTTP_ONLY,
        secure: constants.CREDENTIAL.JWT.COOKIE_SECURE,
        path: constants.CREDENTIAL.JWT.COOKIE_PATH,
        maxAge: constants.CREDENTIAL.JWT.COOKIE_MAX_AGE,
        signed: constants.CREDENTIAL.JWT.COOKIE_SIGNED,
      });

      return res.redirect(constants.SYSTEM.HTTP_STATUS_CODES.PERMANENT_REDIRECT,
        `${req.query.callback_url}`);
    } catch (_err) {
      const err = new StandardErrorWrapper([
        {
          code: constants.SYSTEM.ERROR_CODES.UNAUTHENTICATED,
          name: (_err && _err.name) || constants.AUTH.ERROR_NAMES.JWT_GENERATION_ERROR,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: (_err && _err.message) || constants.AUTH.ERROR_MSG.JWT_GENERATION_ERROR,
          detail: _err,
        },
      ]);

      const response = new StandardResponseWrapper([
        {
          success: false,
          status: err.getNthError(0).name,
          detail: err.format(),
        },
      ], constants.SYSTEM.RESPONSE_NAMES.GET_TOKEN);

      return res.status(constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
        .json(response.format);
    }
  }

  static getUserInfo(req, res) {
    requestCount += 1;

    let state;

    return Promise
      .try(() => {
        const options = { _id: req.user._id };
        const context = { containerId, requestCount };

        state = ProcessSate.create(options, context);

        const getUserInfoStrategy = {
          storeType: constants.STORE.TYPES.MONGO_DB,
          operation: {
            type: constants.STORE.OPERATIONS.SELECT,
            data: [
              { _id: mongojs.ObjectId(state._id) },
            ],
          },
          tableName: constants.STORE.TABLE_NAMES.USER,
        };

        return AuthController._handleRequest(state, res, DatabaseService, getUserInfoStrategy)
      })
      .then((result) => {
        const user = Array.isArray(result) ? { ...result[0] } : {};

        delete user.passwordHash;
        delete user.isSuspended;
        delete user.version;
        delete user.systemData;

        const jwtToken = jwt.sign(user, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
          expiresIn: jwtExpiresIn,
          notBefore: jwtNotBefore,
        });

        res.cookie(constants.CREDENTIAL.JWT.COOKIE_NAME, jwtToken, {
          httpOnly: constants.CREDENTIAL.JWT.COOKIE_HTTP_ONLY,
          secure: constants.CREDENTIAL.JWT.COOKIE_SECURE,
          path: constants.CREDENTIAL.JWT.COOKIE_PATH,
          maxAge: constants.CREDENTIAL.JWT.COOKIE_MAX_AGE,
          signed: constants.CREDENTIAL.JWT.COOKIE_SIGNED,
        });

        const response = new StandardResponseWrapper([{
          success: true,
          detail: user,
        }], constants.SYSTEM.RESPONSE_NAMES.AUTH_CHECK);

        return res.status(constants.SYSTEM.HTTP_STATUS_CODES.OK)
          .json(response.format);
      })
      .catch((_err) => {
        const err = new StandardErrorWrapper(_err);
        const resStatusCode = err.getNthError(0).code < 1000 ?
          err.getNthError(0).code : constants.SYSTEM.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        err.append({
          code: constants.SYSTEM.ERROR_CODES.INTERNAL_SERVER_ERROR,
          name: constants.SYSTEM.ERROR_NAMES.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
          source: constants.SYSTEM.COMMON.CURRENT_SOURCE,
          message: constants.SYSTEM.ERROR_MSG.CAUGHT_ERROR_IN_AUTH_CONTROLLER,
        });

        const response = new StandardResponseWrapper([
          {
            success: false,
            status: err.getNthError(0).name,
            detail: err.format({
              containerId: state && state.context.containerId,
              requestCount: state && state.context.requestCount,
            }),
          },
        ], constants.SYSTEM.RESPONSE_NAMES.AUTH_CHECK);

        return res.status(resStatusCode)
          .json(response.format);
      });
  }

  static _handleRequest(state, res, Svc, strategy) {
    return Promise.try(() => Svc.execute(strategy));
  }

}

module.exports = exports = AuthController;
