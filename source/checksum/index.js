/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */
const {
  ChecksumError,
  ForbiddenError,
} = require('./lib/shared/errors');

/**
 * API Gateway
 */
exports.OnRequest = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const {
      ApiRequest,
    } = require('./lib/api/index');

    const instance = new ApiRequest(event, context);
    const response = await instance.request();
    console.log(`response = ${JSON.stringify(response, null, 2)}`);
    return response;
  } catch (e) {
    console.error(e);
    throw e;
  }
};


/**
 * Checksum Step Functions states
 */
exports.CheckRestoreStatus = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const {
      S3Restore,
    } = require('./lib/restore');

    const instance = new S3Restore(event);
    const response = await instance.checkStatus();
    console.log(`response = ${JSON.stringify(response, null, 2)}`);
    return response;
  } catch (e) {
    console.error(e);
    if (e.statusCode === 403) {
      throw new ForbiddenError(e);
    }
    if (!(e instanceof ChecksumError)) {
      throw new ChecksumError(e);
    }
    throw e;
  }
};

exports.ComputeChecksum = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const instance = (() => {
      if ((event.Algorithm || '').toLowerCase() === 'sha1') {
        const {
          SHA1Lib,
        } = require('./lib/algorithm/sha1');
        return new SHA1Lib(event);
      }
      if ((event.Algorithm || '').toLowerCase() === 'sha256') {
        const {
          SHA256Lib,
        } = require('./lib/algorithm/sha256');
        return new SHA256Lib(event);
      }
      const {
        MD5Lib,
      } = require('./lib/algorithm/md5');
      return new MD5Lib(event);
    })();

    const response = await instance.compute();
    console.log(`response = ${JSON.stringify(response, null, 2)}`);
    return response;
  } catch (e) {
    console.error(e);
    if (e.statusCode === 403) {
      throw new ForbiddenError(e);
    }
    if (!(e instanceof ChecksumError)) {
      throw new ChecksumError(e);
    }
    throw e;
  }
};

exports.FinalValidation = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const {
      ChecksumValidation,
    } = require('./lib/validation/index');

    const instance = new ChecksumValidation(event);
    const response = await instance.run();
    console.log(`response = ${JSON.stringify(response, null, 2)}`);
    return response;
  } catch (e) {
    console.error(e);
    if (e.statusCode === 403) {
      throw new ForbiddenError(e);
    }
    if (!(e instanceof ChecksumError)) {
      throw new ChecksumError(e);
    }
    throw e;
  }
};

exports.OnChecksumError = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const StateMachineEvent = require('./lib/state-machine-event');

    const errorHandler = new StateMachineEvent();
    return errorHandler.process(event);
  } catch (e) {
    console.error(e);
    throw e;
  }
};
