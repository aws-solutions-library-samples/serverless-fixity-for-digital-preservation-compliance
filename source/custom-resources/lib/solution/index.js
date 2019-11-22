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
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-extraneous-dependencies */
const CRYPTO = require('crypto');

const {
  Metrics,
} = require('./metrics');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function CreateSolutionUuid
 * @param {object} event
 * @param {object} context
 */
exports.CreateSolutionUuid = async (event, context) => {
  const x0 = new X0(event, context);
  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const matched = CRYPTO.randomBytes(16).toString('hex').match(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/);
    matched.shift();

    x0.storeResponseData('Uuid', matched.join('-').toLowerCase());
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateSolutionUuid: ${e.message}`;
    throw e;
  }
};

/**
 * @function SendConfig
 * @description send template configuration to Solution Builder team
 */
exports.SendConfig = async (event, context) => {
  const x0 = new X0(event, context);
  try {
    const Props = event.ResourceProperties || {};

    const key = (x0.isRequestType('Delete')) ? 'Deleted' : 'Launch';
    const data = {
      Version: Props.Version,
      Metrics: Props.AnonymousUsage,
      [key]: (new Date()).toISOString().replace('T', ' ').replace('Z', ''),
    };

    const env = {
      Solution: Props.SolutionId,
      UUID: Props.MetricsUuid,
    };

    await Metrics.sendAnonymousData(data, env);

    x0.storeResponseData('Status', 'SUCCESS');
  } catch (e) {
    console.log(`SendConfig: ${e.message}`);
    x0.storeResponseData('Status', 'SKIPPED');
    x0.storeResponseData('Reason', e.message);
  }

  return x0.responseData;
};
