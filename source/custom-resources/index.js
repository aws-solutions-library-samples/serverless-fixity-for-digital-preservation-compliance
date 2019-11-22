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

const {
  CloudFormationResponse,
} = require('./lib/shared/cfResponse');

/**
 * @function Run
 * @description entrypoint to delegate to service's specific functions.
 * @param {object} event
 * @param {object} context
 */
exports.Run = async (event, context) => {
  console.log(`\nconst event = ${JSON.stringify(event, null, 2)};\nconst context = ${JSON.stringify(context, null, 2)}`);
  const cfResponse = new CloudFormationResponse(event, context);
  let response;
  try {
    const {
      FunctionName,
    } = (event || {}).ResourceProperties || {};

    let handler;
    switch (FunctionName) {
      /* SNS */
      case 'EmailSubscribe':
        handler = require('./lib/sns/index').EmailSubscribe;
        break;
      /* Solution */
      case 'CreateSolutionUuid':
        handler = require('./lib/solution/index').CreateSolutionUuid;
        break;
      case 'SendConfig':
        handler = require('./lib/solution/index').SendConfig;
        break;
      /* other services go here */
      default:
        break;
    }

    if (!handler) {
      throw Error(`${FunctionName} not implemented`);
    }

    response = await handler(event, context);
    console.log(`response = ${JSON.stringify(response, null, 2)}`);

    response = await cfResponse.send(response);
    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);
    return response;
  }
};
