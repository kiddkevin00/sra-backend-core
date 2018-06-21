const stateContext = Symbol('process-state-context');

class ProcessState {

  constructor(options, { containerId, requestCount }) {
    this[stateContext] = {
      context: { containerId, requestCount },
      ...options,
    };
  }

  get context() {
    return this[stateContext].context;
  }

  get _id() {
    return this[stateContext]._id;
  }

  get email() {
    return this[stateContext].email;
  }

  get password() {
    return this[stateContext].password;
  }

  get newPassword() {
    return this[stateContext].newPassword;
  }

  get fullName() {
    return this[stateContext].fullName;
  }

  static create(options, context) {
    return new ProcessState(options, context);
  }

}

module.exports = exports = ProcessState;
