/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');

const {
  NotImplError,
  InvalidArgumentError,
  ConfigurationError,
} = require('../shared/errors');

const APIOP_FIXITY = process.env.ENV_APIOP_FIXITY;

const ALLOWED_METHODS = [
  'POST',
  'GET',
  'OPTIONS',
];

const ALLOWED_HEADERS = [
  'Authorization',
  'Host',
  'Content-Type',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token',
  'x-amz-content-sha256',
  'x-amz-user-agent',
];


class ApiRequest {
  constructor(event, context) {
    this.$event = event;
    /* sanity check */
    if (!process.env.ENV_STATE_MACHINE_NAME || !process.env.ENV_APIOP_FIXITY) {
      throw new ConfigurationError();
    }
    /* eslint-disable-next-line */
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    this.$allowOrigins = process.env.ENV_ALLOW_ORIGINS || undefined;
  }

  static get Constants() {
    return {
      Steps: {
        Arn: {
          Regex: /^arn:aws:states:[a-z\d-]+:\d{12}:execution:[a-zA-Z\d-_]+:[a-fA-F\d]{8}(-[a-fA-F\d]{4}){3}-[a-fA-F\d]{12}$/,
        },
      },
      S3: {
        Retrieval: {
          Tiers: [
            'Standard',
            'Bulk',
            'Expedited',
          ],
        },
      },
      Algorithms: [
        'md5',
        'sha1',
      ],
    };
  }

  get event() {
    return this.$event;
  }

  get accountId() {
    return this.$accountId;
  }

  get allowOrigins() {
    return this.$allowOrigins;
  }

  get requestMethod() {
    return this.event.httpMethod;
  }

  get requestHeaders() {
    return this.event.headers;
  }

  get requestQueryString() {
    return this.event.queryStringParameters;
  }

  get requestPathParameters() {
    return this.event.pathParameters;
  }

  get requestBody() {
    return this.event.body;
  }

  /**
   * @function getCORS
   * @description return CORS based on origin in request headers
   */
  getCORS() {
    const {
      Origin = null, origin = null, 'X-Forwarded-For': XFF = '*',
    } = this.requestHeaders || {};

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
      'Access-Control-Allow-Origin': this.allowOrigins || Origin || origin || XFF,
      // 'Access-Control-Allow-Credentials': 'true',
    };
  }

  /**
   * @static
   * @function isValidBucket
   * @description
   * * must be at least 3 and no more than 63 characters long
   * * must not contain uppercase characters or underscores
   * * must start with a lowercase letter or number
   * * must be a series of one or more labels. Adjacent labels are separated by a single period (.)
   * * must not be formatted as an IP address
   * @param {*} val - bucket name
   * @returns {boolearn}
   */
  static isValidBucket(val = '') {
    return !(
      (val.length < 3 || val.length > 63)
      || /[^a-z0-9-.]/.test(val)
      || /^[^a-z0-9]/.test(val)
      || /\.{2,}/.test(val)
      || /^\d+.\d+.\d+.\d+$/.test(val)
    );
  }

  /**
   * @static
   * @function isValidKey
   * @description key could pretty much be any character and form...
   * @param {string} val
   */
  /* eslint-disable-next-line */
  static isValidKey(val = '') {
    return true;
  }

  /**
   * @function onOPTIONS
   * @description handle preflight request, simply return CORS
   */
  async onOPTIONS() {
    const {
      operation,
    } = this.requestPathParameters || {};

    if (operation.toLowerCase() !== APIOP_FIXITY) {
      throw new InvalidArgumentError('invalid path parameter');
    }
    return {
      statusCode: 200,
      headers: this.getCORS(),
    };
  }

  /**
   * @function onGET
   * @description get state machine current status, ie.,
   * GET /{stage}/{operation}?executionArn=arn:aws:states:<region>:<account>:execution:<name>:<id>
   * GET /{stage}/{operation}?executionArn=<execution-id>
   */
  async onGET() {
    const {
      operation,
    } = this.requestPathParameters || {};

    if (operation.toLowerCase() !== APIOP_FIXITY) {
      throw new InvalidArgumentError('invalid path parameter');
    }

    let {
      executionArn,
    } = this.requestQueryString || {};

    if (!executionArn) {
      throw new InvalidArgumentError('missing querystring');
    }
    executionArn = decodeURIComponent(executionArn);

    /* allow shorthand arn */
    if (executionArn.indexOf('arn:aws:states:') < 0) {
      executionArn = `arn:aws:states:${process.env.AWS_REGION}:${this.accountId}:execution:${process.env.ENV_STATE_MACHINE_NAME}:${executionArn}`;
    }

    /* validate input */
    if (!ApiRequest.Constants.Steps.Arn.Regex.test(executionArn)) {
      console.error(`invalid arn: ${executionArn}`);
      throw new InvalidArgumentError('invalid querystring');
    }

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.describeExecution({
      executionArn,
    }).promise();

    const responseData = {
      statusCode: 200,
      headers: this.getCORS(),
      body: JSON.stringify(response),
    };
    process.env.ENV_QUIET || console.log(`onGET.responseData = ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /**
   * @function onPOST
   * @description start serverless checksum state machine
   * ie.,
   * POST /{stage}/{operation}
   * Body:
   * {
   *   Bucket: "BUCKET_NAME", (mandatory)
   *   Key: "OBJECT_KEY", (mandatory)
   *   Algorithm: "md5", (optional)
   *   Expected: "REFERENCE_MD5_OR_SHA1_TO_COMPARE_WITH", (optional)
   *   ChunkSize: 1073741824, (optional, unit in byte)
   *   StoreChecksumOnTagging: true | false (optional)
   * }
   */
  async onPOST() {
    const {
      operation,
    } = this.requestPathParameters || {};

    if (operation.toLowerCase() !== APIOP_FIXITY) {
      throw new InvalidArgumentError('invalid path parameter');
    }

    const input = JSON.parse(this.requestBody);
    /* sanity check */
    const missing = [
      'Bucket',
      'Key',
      // 'Algorithm',
      // 'Expected',
      // 'ChunkSize',
      // 'StoreChecksumOnTagging',
      // 'RestoreRequest',
    ].filter(x => input[x] === undefined);
    if (missing.length) {
      throw new InvalidArgumentError(`missing ${missing.join(', ')}`);
    }

    if (!ApiRequest.isValidBucket(input.Bucket)) {
      throw new InvalidArgumentError('Invalid Bucket name');
    }

    if (!ApiRequest.isValidKey(input.Key)) {
      throw new InvalidArgumentError('Invalid Key name');
    }

    /* validate Algorithm */
    input.Algorithm = (input.Algorithm || 'md5').toLowerCase();
    if (ApiRequest.Constants.Algorithms.indexOf(input.Algorithm) < 0) {
      throw new InvalidArgumentError('invalid Algorithms parameter');
    }

    /* validate Expected */
    if (input.Expected) {
      switch (input.Algorithm) {
        /* SHA-1 expects 20 bytes (40 hex characters) */
        case 'sha1':
          if (!input.Expected.match(/^[a-fA-F0-9]{40}$/)) {
            throw new InvalidArgumentError('invalid Expected parameter');
          }
          break;
        /* MD5 expects 16 bytes (32 hex characters) */
        case 'md5':
          if (!input.Expected.match(/^[a-fA-F0-9]{32}$/)) {
            throw new InvalidArgumentError('invalid Expected parameter');
          }
          break;
        /* unsupported algorithm */
        default:
          throw new InvalidArgumentError('invalid Algorithm parameter');
      }
    }

    if (input.ChunkSize && !Number.parseInt(input.ChunkSize, 10)) {
      throw new InvalidArgumentError('invalid ChunkSize parameter');
    }

    /* validate RestoreRequest */
    if (input.RestoreRequest) {
      if (typeof input.RestoreRequest !== 'object' || Array.isArray(input.RestoreRequest)) {
        throw new InvalidArgumentError('invalid RestoreRequest parameter');
      }
      if (input.RestoreRequest.Days && !Number.parseInt(input.RestoreRequest.Days, 10)) {
        throw new InvalidArgumentError('invalid RestoreRequest parameter');
      }
      if (input.RestoreRequest.Tier
        && ApiRequest.Constants.S3.Retrieval.Tiers.indexOf(input.RestoreRequest.Tier) < 0) {
        throw new InvalidArgumentError('invalid RestoreRequest parameter');
      }
    }

    /* default to always store checksum result to tagging */
    input.StoreChecksumOnTagging = input.StoreChecksumOnTagging === undefined;

    /* arn:aws:states:eu-west-1:x:stateMachine:StateMachineName */
    const stateMachineArn = `arn:aws:states:${process.env.AWS_REGION}:${this.accountId}:stateMachine:${process.env.ENV_STATE_MACHINE_NAME}`;

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    process.env.ENV_QUIET || console.log(`startExecution.input = ${JSON.stringify(input, null, 2)}`);

    const response = await step.startExecution({
      stateMachineArn,
      input: JSON.stringify(input),
    }).promise();

    const responseData = {
      statusCode: 200,
      headers: this.getCORS(),
      body: JSON.stringify(response),
    };
    process.env.ENV_QUIET || console.log(`onPOST.responseData: ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /**
   * @function onError
   * @description return 400 if error
   * @param {Error} e
   */
  async onError(e) {
    const responseData = {
      statusCode: 400,
      headers: this.getCORS(),
      body: JSON.stringify({
        Error: e.message,
      }),
    };
    process.env.ENV_QUIET || console.log(`onError.responseData = ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /**
   * @function request
   * @description support OPTIONS, GET, POST methods
   */
  async request() {
    try {
      let responseData = null;
      switch (this.requestMethod) {
        case 'OPTIONS':
          responseData = await this.onOPTIONS();
          break;
        case 'GET':
          responseData = await this.onGET();
          break;
        case 'POST':
          responseData = await this.onPOST();
          break;
        default:
          throw new NotImplError(`${this.requestMethod} not impl`);
      }
      return responseData;
    } catch (e) {
      const responseError = await this.onError(e);
      return responseError;
    }
  }
}

module.exports = {
  ApiRequest,
};
