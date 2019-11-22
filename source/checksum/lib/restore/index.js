/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
const AWS = require('aws-sdk');

const {
  MismatchETagError,
} = require('../shared/errors');

const {
  BaseStateData,
} = require('../shared/baseStateData');

const {
  mxUtils,
} = require('../shared/mxUtils');

class X extends mxUtils(class {}) {}

const DEFAULT_RESTORE_DAYS = 1;
const DEFAULT_RESTORE_TIER = 'Bulk';
const KEY_EXPIRY_DATE = 'expiry-date';
const KEY_ONGOING_REQUEST = 'ongoing-request';

class S3Restore extends BaseStateData {
  constructor(params = {}) {
    super('CheckRestoreStatus', params);

    const Request = params.RestoreRequest || {};
    this.$restoreRequestDays = Number.parseInt(Request.Days || DEFAULT_RESTORE_DAYS, 10);
    this.$restoreRequestTier = Request.Tier || DEFAULT_RESTORE_TIER;

    this.$storageClass = undefined;
    this.$restoreStatus = undefined;
    this.$restoreExpiredAt = undefined;

    this.$instance = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });
  }

  get restoreRequestDays() {
    return this.$restoreRequestDays;
  }

  get restoreRequestTier() {
    return this.$restoreRequestTier;
  }

  get storageClass() {
    return this.$storageClass;
  }

  set storageClass(val) {
    this.$storageClass = val;
  }

  get restoreStatus() {
    return this.$restoreStatus;
  }

  set restoreStatus(val) {
    this.$restoreStatus = val;
  }

  get restoreExpiredAt() {
    return this.$restoreExpiredAt;
  }

  set restoreExpiredAt(val) {
    this.$restoreExpiredAt = val;
  }

  get instance() {
    return this.$instance;
  }

  responseData() {
    const json = Object.assign({}, super.responseData(), {
      StorageClass: this.storageClass,
      RestoreStatus: this.restoreStatus,
      RestoreExpiredAt: this.restoreExpiredAt,
      RestoreRequest: {
        Days: this.restoreRequestDays,
        Tier: this.restoreRequestTier,
      },
    });
    return X.neat(json);
  }

  reverseLookup(s) {
    try {
      const token = s.substr(-1) === ',' ? s.slice(0, -1) : s;
      let idx = token.lastIndexOf('=');
      if (idx < 0) {
        throw new RangeError(`no more '=' token, ${token}`);
      }

      const value = token.substring(idx + 1).replace(/["']/g, '');
      let next = token.substring(0, idx);
      idx = next.lastIndexOf(' ');

      const key = next.substring(idx + 1);
      next = (idx < 0) ? undefined : token.substring(0, idx);

      return {
        key,
        value,
        next,
      };
    } catch (e) {
      return undefined;
    }
  }

  parseKeyValuePair(str) {
    const pair = {};
    let current = str;

    while (current) {
      const result = this.reverseLookup(current);
      if (result) {
        const {
          key,
          value,
          next,
        } = result;
        pair[key] = value;
        current = next;
      } else {
        current = undefined;
      }
    }
    return pair;
  }

  async restore() {
    console.log(`start restore process, s3://${this.bucket}/${this.key}`);

    /* 'DEEP_ARCHIVE' doesn't support 'Expedited', switch to 'Standard' */
    if (this.storageClass === 'DEEP_ARCHIVE' && this.restoreRequestTier === 'Expedited') {
      this.restoreRequestTier = 'Standard';
    }

    return this.instance.restoreObject({
      Bucket: this.bucket,
      Key: this.key,
      RestoreRequest: {
        Days: this.restoreRequestDays,
        GlacierJobParameters: {
          Tier: this.restoreRequestTier,
        },
      },
    }).promise();
  }

  async checkStatus() {
    const response = await this.instance.headObject({
      Bucket: this.bucket,
      Key: this.key,
    }).promise();

    this.etag = this.etag || response.ETag;

    if (this.etag !== response.ETag) {
      throw new MismatchETagError();
    }

    /* "Restore": "ongoing-request=\"true\"" */
    const status = this.parseKeyValuePair(response.Restore);

    this.storageClass = response.StorageClass;
    this.restoreExpiredAt = (status[KEY_EXPIRY_DATE])
      ? new Date(status[KEY_EXPIRY_DATE]).getTime()
      : undefined;

    if (response.StorageClass !== 'GLACIER' && response.StorageClass !== 'DEEP_ARCHIVE') {
      this.restoreStatus = 'COMPLETED';
    } else if (status[KEY_ONGOING_REQUEST] === 'false') {
      this.restoreStatus = 'COMPLETED';
    } else if (!response.Restore) {
      await this.restore();
      this.restoreStatus = 'IN_PROGRESS';
    } else {
      this.restoreStatus = 'IN_PROGRESS';
    }
    return this.responseData();
  }
}

module.exports = {
  S3Restore,
};
