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
const PATH = require('path');

const {
  mxUtils,
} = require('../shared/mxUtils');

const {
  BaseStateData,
} = require('../shared/baseStateData');

const {
  InvalidArgumentError,
} = require('../shared/errors');

const {
  MySNS,
} = require('../sns');

const {
  Metrics,
} = require('../metrics');

const TAG_LASTMODIFIED_SUFFIX = '-last-modified';
const TAG_COMPUTED_CHKSUM_PREFIX = 'computed-';

const REQUIRED_PARAMS = [
  'Computed',
  // 'Expected',
];

class X extends mxUtils(class {}) {}

class ChecksumValidation extends BaseStateData {
  constructor(params = {}) {
    super('ChecksumValidation', params);
    /* sanity check */
    const missing = REQUIRED_PARAMS.filter(x => params[x] === undefined);
    if (missing.length) {
      throw new InvalidArgumentError(`missing ${missing.join(', ')}`);
    }
    this.$computed = params.Computed;
    this.$algorithm = params.Algorithm || undefined;
    this.$expected = params.Expected || undefined;
    this.$storeChecksumOnTagging = params.StoreChecksumOnTagging
      || (params.StoreChecksumOnTagging === undefined);
    this.$comparedWith = this.$expected ? 'api' : 'none';
    this.$comparedResult = 'SKIPPED';
    this.$snsTopicArn = process.env.ENV_SNS_TOPIC_ARN || undefined;
    this.$tagUpdated = false;
  }

  get computed() {
    return this.$computed;
  }

  get algorithm() {
    return this.$algorithm;
  }

  get storeChecksumOnTagging() {
    return this.$storeChecksumOnTagging;
  }

  get expected() {
    return this.$expected;
  }

  set expected(val) {
    this.$expected = val;
  }

  get comparedWith() {
    return this.$comparedWith;
  }

  set comparedWith(val) {
    this.$comparedWith = val;
  }

  get comparedResult() {
    return this.$comparedResult;
  }

  set comparedResult(val) {
    this.$comparedResult = val;
  }

  get snsTopicArn() {
    return this.$snsTopicArn;
  }

  get tagUpdated() {
    return this.$tagUpdated;
  }

  set tagUpdated(val) {
    this.$tagUpdated = !!val;
  }

  responseData() {
    const json = Object.assign({}, super.responseData(), {
      Algorithm: this.algorithm,
      Computed: this.computed,
      Expected: this.expected,
      ComparedWith: this.comparedWith,
      ComparedResult: this.comparedResult,
      StoreChecksumOnTagging: this.storeChecksumOnTagging,
      TagUpdated: this.tagUpdated,
    });
    return X.neat(json);
  }

  async getTags() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });

    const params = {
      Bucket: this.bucket,
      Key: this.key,
    };
    const { TagSet } = await s3.getObjectTagging(params).promise();
    return TagSet;
  }

  getChecksumTagName() {
    return `${TAG_COMPUTED_CHKSUM_PREFIX}${this.algorithm}`;
  }

  getLastModifiedTagName() {
    return `${TAG_COMPUTED_CHKSUM_PREFIX}${this.algorithm}${TAG_LASTMODIFIED_SUFFIX}`;
  }

  async createTags() {
    const tagChksum = this.getChecksumTagName();
    const tagModified = this.getLastModifiedTagName();

    const params = {
      Bucket: this.bucket,
      Key: this.key,
    };

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });

    const response = await s3.getObjectTagging(params).promise();

    /* remove existing checksum and modified tags */
    [
      tagChksum,
      tagModified,
    ].forEach((tag) => {
      const idx = response.TagSet.findIndex(x => x.Key === tag);
      if (idx >= 0) {
        response.TagSet.splice(idx, 1);
      }
    });

    /* only update tags if there is still space to do so */
    if (response.TagSet.length <= 8) {
      params.Tagging = {
        TagSet: response.TagSet.concat([
          { Key: tagChksum, Value: this.computed },
          { Key: tagModified, Value: (new Date()).getTime().toString() },
        ]),
      };
      await s3.putObjectTagging(params).promise();
      this.tagUpdated = true;
    }
  }

  async sendMessage() {
    if (!this.snsTopicArn) {
      return false;
    }

    const {
      base,
    } = PATH.parse(this.key);

    const subject = `${(this.algorithm || 'Checksum').toUpperCase()} status on ${base}`;

    const sns = new MySNS();
    return sns.send(subject, this.responseData());
  }

  /**
   * @function bestGuessChecksum
   * @description best effort to extract MD5 or SHA1 checksum
   */
  async bestGuessChecksum() {
    return this.algorithm === 'sha1' ? this.bestGuessSHA1() : this.bestGuessMD5();
  }

  /**
   * @function bestGuessMD5
   * @description best effort to extract MD5 from
   *   - x-amz-meta-md5 metadata field
   *   - x-computed-md5 tag
   *   - ETag (only if SSE is not KMS and only if it is not multipart upload)
   */
  async bestGuessMD5() {
    /* try tag first */
    const chksum = this.tags.find(x => x.Key === this.getChecksumTagName());
    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{32})$/)) {
      this.comparedWith = 'object-tagging';
      return chksum.Value;
    }

    const params = {
      Bucket: this.bucket,
      Key: this.key,
    };
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });

    const {
      ETag,
      ServerSideEncryption,
      Metadata = {},
    } = await s3.headObject(params).promise();

    /* try x-amz-meta-md5 metadata */
    if (Metadata.md5) {
      this.comparedWith = 'object-metadata';
      return Metadata.md5;
    }

    /* Last resort */
    /* use ETag if and only if it is NOT multipart-upload and SSE is either disabled or AES256 */
    if ((!ServerSideEncryption || ServerSideEncryption.toLowerCase() === 'aes256') && ETag) {
      /* the regex screens any multipart upload ETag */
      const matched = ETag.match(/^"([0-9a-fA-F]{32})"$/);
      if (matched) {
        this.comparedWith = 'object-etag';
        return matched[1];
      }
    }
    return undefined;
  }

  /**
   * @function bestGuessSHA1
   * @description best effort to extract SHA1 from
   *   - x-amz-meta-sha1 metadata field
   *   - x-computed-sha1 tag
   */
  async bestGuessSHA1() {
    /* try tag first */
    const chksum = this.tags.find(x => x.Key === this.getChecksumTagName());
    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{40})$/)) {
      this.comparedWith = 'object-tagging';
      return chksum.Value;
    }

    const params = {
      Bucket: this.bucket,
      Key: this.key,
    };
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });

    const {
      Metadata = {},
    } = await s3.headObject(params).promise();

    /* try x-amz-meta-sha1 metadata */
    if (Metadata.sha1) {
      this.comparedWith = 'object-metadata';
      return Metadata.sha1;
    }

    return undefined;
  }

  /**
   * @async
   * @function sendMetrics
   * @description send anonymous data to help us to improve the solution
   */
  async sendMetrics() {
    const missing = [
      'ENV_SOLUTION_ID',
      'ENV_METRICS_UUID',
      'ENV_ANONYMOUS_USAGE',
    ].filter(x => process.env[x] === undefined);

    if (missing.length > 0 || process.env.ENV_ANONYMOUS_USAGE.toLowerCase() !== 'yes') {
      return false;
    }

    await Metrics.sendAnonymousData({
      Algorithm: this.algorithm,
      ComparedResult: this.comparedResult,
      FileSize: this.fileSize,
      Elapsed: this.lastElapsed + ((this.t1 || new Date()) - this.t0),
    }).catch(e => console.error(e)); // eslint-disable-line

    return true;
  }

  async run() {
    this.tags = await this.getTags();
    const refChecksum = this.expected || await this.bestGuessChecksum();
    if (refChecksum) {
      this.comparedResult = refChecksum.toLowerCase() === this.computed.toLowerCase() ? 'MATCHED' : 'NOTMATCHED';
    }
    /* save checksum to object tags if specified and only if the result is MATCHED or SKIPPED */
    if (this.storeChecksumOnTagging && this.comparedResult !== 'NOTMATCHED') {
      await this.createTags();
    }
    /* signal base class to record the end time */
    this.setElapsed();
    this.status = 'COMPLETED';

    /* send sns notification and metrics */
    /* send metrics */
    await Promise.all([
      this.sendMessage(),
      this.sendMetrics(),
    ]);

    return this.responseData();
  }
}

module.exports = {
  ChecksumValidation,
};
