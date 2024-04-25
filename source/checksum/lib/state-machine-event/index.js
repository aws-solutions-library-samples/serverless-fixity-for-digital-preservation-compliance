/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */
const AWS = require('aws-sdk');
const {
  MySNS,
} = require('../sns');

const FAILED_STATUSES = [
  'Failed',
  'Aborted',
  'TimeOut',
];
const ERR_STATE_MACHINE = 'StateMachineError';

class StateMachineEvent {
  async getExecutionError(requestId, arn) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    let response;
    do {
      response = await step.getExecutionHistory({
        executionArn: arn,
        maxResults: 20,
        reverseOrder: true,
        nextToken: (response || {}).nextToken,
      }).promise()
        .catch(() =>
          undefined);

      const executions = ((response || {}).events || [])
        .filter((x) =>
          FAILED_STATUSES.findIndex((x0) =>
            x.type.indexOf(x0) >= 0) >= 0);

      const message = this.parseExecutionError(executions);
      if (message) {
        return message;
      }
    } while ((response || {}).nextToken);

    return `${ERR_STATE_MACHINE} (${requestId})`;
  }

  parseExecutionError(executions = []) {
    let message;
    while (executions.length) {
      const task = executions.shift();
      if ((task.lambdaFunctionFailedEventDetails || {}).cause) {
        return task.lambdaFunctionFailedEventDetails.cause;
      }
      if ((task.lambdaFunctionTimedOutEventDetails || {}).cause) {
        return task.lambdaFunctionTimedOutEventDetails.cause;
      }
      if ((task.executionFailedEventDetails || {}).cause) {
        return task.executionFailedEventDetails.cause;
      }
      if ((task.taskTimedOutEventDetails || {}).cause) {
        return task.taskTimedOutEventDetails.cause;
      }
      if ((task.executionAbortedEventDetails || {}).cause) {
        return task.executionAbortedEventDetails.cause;
      }
    }
    return message;
  }

  async process(event) {
    const requestId = ((event || {}).detail || {}).name;
    let message;
    try {
      const arn = event.detail.executionArn;
      message = await this.getExecutionError(requestId, arn);

      const parsed = JSON.parse(message);
      message = parsed.errorMessage || event.detail.Status || ERR_STATE_MACHINE;
    } catch (e) {
      message = `${ERR_STATE_MACHINE} (${requestId})`;
    }

    const sns = new MySNS();
    const subject = 'ERROR: checksum state machine failed';
    const sent = await sns.send(subject, message);

    console.log(subject, message, sent);
    return sent;
  }
}

module.exports = StateMachineEvent;
