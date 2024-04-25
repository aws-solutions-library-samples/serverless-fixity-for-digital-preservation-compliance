/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

/**
 * @class ChecksumError
 * @description Error code 1000
 */
class ChecksumError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1000;
    this.message = `${this.statusCode} - ${this.message || 'checksum error'}`;
    Error.captureStackTrace(this, ChecksumError);
  }
}

/**
 * @class NotImplError
 * @description Error code 1001
 */
class NotImplError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1001;
    this.message = `${this.statusCode} - ${this.message || 'not impl'}`;
    Error.captureStackTrace(this, NotImplError);
  }
}

/**
 * @class InvalidArgumentError
 * @description Error code 1002
 */
class InvalidArgumentError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1002;
    this.message = `${this.statusCode} - ${this.message || 'invalid argument'}`;
    Error.captureStackTrace(this, InvalidArgumentError);
  }
}

/**
 * @class ComputedChecksumExistError
 * @description Error code 1003
 */
class ComputedChecksumExistError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1003;
    this.message = `${this.statusCode} - ${this.message || 'MD5 already computed. compute() should not be called again.'}`;
    Error.captureStackTrace(this, ComputedChecksumExistError);
  }
}

/**
 * @class ChecksumValidationError
 * @description Error code 1004
 */
class ChecksumValidationError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1004;
    this.message = `${this.statusCode} - ${this.message || 'checksums do not match'}`;
    Error.captureStackTrace(this, ChecksumValidationError);
  }
}

/**
 * @class ConfigurationError
 * @description Error code 1005
 */
class ConfigurationError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1005;
    this.message = `${this.statusCode} - ${this.message || 'invalid configuration'}`;
    Error.captureStackTrace(this, ConfigurationError);
  }
}

/**
 * @class RuntimeError
 * @description Error code 1006
 */
class RuntimeError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1006;
    this.message = `${this.statusCode} - ${this.message || 'runtime error'}`;
    Error.captureStackTrace(this, RuntimeError);
  }
}

/**
 * @class MismatchETagError
 * @description Error code 1007
 */
class MismatchETagError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1007;
    this.message = `${this.statusCode} - ${this.message || 'mismatch ETag error'}`;
    Error.captureStackTrace(this, MismatchETagError);
  }
}

/**
 * @class MismatchFileSizeError
 * @description Error code 1008
 */
class MismatchFileSizeError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 1008;
    this.message = `${this.statusCode} - ${this.message || 'mismatch file size error'}`;
    Error.captureStackTrace(this, MismatchFileSizeError);
  }
}

/**
 * @class ForbiddenError
 * @description Error code 403
 */
class ForbiddenError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.code = this.name;
    this.statusCode = 403;
    this.message = `${this.statusCode} - ${this.message || 'Forbidden'}`;
    Error.captureStackTrace(this, ForbiddenError);
  }
}

module.exports = {
  ChecksumError,
  NotImplError,
  InvalidArgumentError,
  ComputedChecksumExistError,
  ChecksumValidationError,
  ConfigurationError,
  RuntimeError,
  MismatchETagError,
  MismatchFileSizeError,
  ForbiddenError,
};
