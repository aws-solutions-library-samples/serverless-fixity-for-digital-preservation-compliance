/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
    this.message = `1000 - ${this.message || 'checksum error'}`;
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
    this.message = `1001 - ${this.message || 'not impl'}`;
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
    this.message = `1002 - ${this.message || 'invalid argument'}`;
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
    this.message = `1003 - ${this.message || 'MD5 already computed. compute() should not be called again.'}`;
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
    this.message = `1004 - ${this.message || 'checksums do not match'}`;
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
    this.message = `1005 - ${this.message || 'invalid configuration'}`;
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
    this.message = `1006 - ${this.message || 'runtime error'}`;
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
    this.message = `1007 - ${this.message || 'mismatch ETag error'}`;
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
    this.message = `1008 - ${this.message || 'mismatch file size error'}`;
    Error.captureStackTrace(this, MismatchFileSizeError);
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
};
