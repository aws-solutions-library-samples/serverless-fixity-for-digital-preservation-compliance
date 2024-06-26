/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @function EmailSubscribe
 * @param {object} event
 * @param {object} context
 */
exports.EmailSubscribe = async (event, context) => {
  try {
    const {
      SNS,
    } = require('./sns');

    const instance = new SNS(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.unsubscribe()
      : await instance.subscribe();

    return responseData;
  } catch (e) {
    e.message = `EmailSubscribe: ${e.message}`;
    throw e;
  }
};
