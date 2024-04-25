/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const AWS = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

const REQUIRED_PROPERTIES = [
  'ServiceToken',
  'FunctionName',
  'EmailList',
  'TopicArn',
];

class SNS extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    const {
      ResourceProperties = {},
    } = event || {};
    /* sanity check */
    const missing = REQUIRED_PROPERTIES.filter(x =>
      ResourceProperties[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      TopicArn,
      EmailList,
    } = ResourceProperties;
    /* create unique email list */
    const list = EmailList.split(',').filter(x => x).map(x => x.trim());
    this.$emailList = Array.from(new Set(list));
    /* topic to subscribe */
    this.$topicArn = TopicArn;
  }

  get topicArn() {
    return this.$topicArn;
  }

  get emailList() {
    return this.$emailList;
  }

  /**
   * @function subscribe
   * @description subscribe a list of emails to SNS topic
   */
  async subscribe() {
    console.log(`EmailList = ${JSON.stringify(this.emailList, null, 2)}`);

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
    });

    const response = await Promise.all(this.emailList.map(email =>
      sns.subscribe({
        Protocol: 'email',
        TopicArn: this.topicArn,
        Endpoint: email,
      }).promise()));

    this.storeResponseData('Subscribed', response.length);
    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }

  /**
   * @function unsubscribe
   * @description not implememted (not needed)
   */
  async unsubscribe() {
    this.storeResponseData('Unsubscribed', 0);
    this.storeResponseData('Status', 'SKIPPED');
    return this.responseData;
  }
}

module.exports = {
  SNS,
};
