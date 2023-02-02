/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */
const AWS = require('aws-sdk');

const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME;
const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const SOLUTION_ID = process.env.ENV_SOLUTION_ID;

async function assumeVendorCredentials(role, externalId) {
  const params = {
    RoleArn: role,
    RoleSessionName: SOLUTION_ID,
  };
  if (externalId) {
    params.ExternalId = externalId;
  }

  const sts = new AWS.STS({
    apiVersion: '2011-06-15',
  });

  return sts.assumeRole(params)
    .promise()
    .then((res) =>
      new AWS.Credentials({
        accessKeyId: res.Credentials.AccessKeyId,
        secretAccessKey: res.Credentials.SecretAccessKey,
        sessionToken: res.Credentials.SessionToken,
      }))
    .catch((e) => {
      console.error(e);
      return undefined;
    });
}

class S3Utils {
  static async createAssumedRoleS3(
    vendorRole,
    vendorExternalId
  ) {
    let credentials;
    if (vendorRole) {
      /* assume role and set credentials */
      credentials = await assumeVendorCredentials(
        vendorRole,
        vendorExternalId
      );
    }

    /* default to lambda environment credentials */
    if (!credentials && LAMBDA_FUNCTION_NAME !== undefined) {
      credentials = new AWS.EnvironmentCredentials('AWS');
    }

    return new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
      customUserAgent: CUSTOM_USER_AGENT,
      credentials,
    });
  }
}

module.exports = S3Utils;
