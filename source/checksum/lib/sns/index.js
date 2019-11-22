/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');

const {
  InvalidArgumentError,
} = require('../shared/errors');

class MySNS {
  constructor() {
    if (!process.env.ENV_SNS_TOPIC_ARN) {
      throw new InvalidArgumentError('invalid ENV_SNS_TOPIC_ARN');
    }
    this.$snsTopicArn = process.env.ENV_SNS_TOPIC_ARN;
  }

  get snsTopicArn() {
    return this.$snsTopicArn;
  }

  async send(subject, message) {
    try {
      const Subject = (subject.length > 100)
        ? `${subject.slice(0, 97)}...`
        : subject;

      const Message = typeof message === 'string'
        ? message
        : JSON.stringify(message, null, 2);

      const params = {
        Subject,
        Message,
        TopicArn: this.snsTopicArn,
      };

      const sns = new AWS.SNS({
        apiVersion: '2010-03-31',
      });

      await sns.publish(params).promise();
      return true;
    } catch (e) {
      /* not send */
      return false;
    }
  }
}

module.exports = {
  MySNS,
};
