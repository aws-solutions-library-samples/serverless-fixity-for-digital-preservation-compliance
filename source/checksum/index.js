/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */

const {
  ChecksumError,
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
    throw (e instanceof ChecksumError) ? e : new ChecksumError(e);
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
    throw (e instanceof ChecksumError) ? e : new ChecksumError(e);
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
    throw (e instanceof ChecksumError) ? e : new ChecksumError(e);
  }
};

exports.OnChecksumError = async (event, context) => {
  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}\ncontext = ${JSON.stringify(context, null, 2)}`);
    const {
      MySNS,
    } = require('./lib/sns/index');

    let message;
    try {
      message = JSON.parse(event.Cause).errorMessage;
    } catch (e) {
      message = event;
    }

    const instance = new MySNS();
    const subject = 'ERROR: checksum state machine failed';
    const sent = await instance.send(subject, message);
    console.log(`${subject} ${sent ? 'SENT' : 'NOT_SENT'}`);
    return sent;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
