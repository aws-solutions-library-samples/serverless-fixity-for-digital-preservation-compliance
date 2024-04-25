/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

const S3Utils = require('../shared/s3Utils');

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
const CLASS_DEEP_ARCHIVE = 'DEEP_ARCHIVE';
const CLASS_GLACIER = 'GLACIER';

class S3Restore extends BaseStateData {
  constructor(params = {}) {
    super('CheckRestoreStatus', params);

    const Request = params.RestoreRequest || {};
    this.$restoreRequestDays = Number.parseInt(Request.Days || DEFAULT_RESTORE_DAYS, 10);
    this.$restoreRequestTier = Request.Tier || DEFAULT_RESTORE_TIER;

    this.$storageClass = undefined;
    this.$restoreStatus = undefined;
    this.$restoreExpiredAt = undefined;
    this.$vendorRole = params.VendorRole;
    this.$vendorExternalId = params.VendorExternalId;
    this.$s3 = undefined;
    this.$restoreStartAt = undefined;
    this.$waitInSeconds = params.WaitInSeconds || 0;
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

  get vendorRole() {
    return this.$vendorRole;
  }

  get vendorExternalId() {
    return this.$vendorExternalId;
  }

  get s3() {
    return this.$s3;
  }

  set s3(val) {
    this.$s3 = val;
  }

  get restoreStartAt() {
    return this.$restoreStartAt;
  }

  set restoreStartAt(val) {
    this.$restoreStartAt = new Date(val);
  }

  get waitInSeconds() {
    return this.$waitInSeconds;
  }

  set waitInSeconds(val) {
    this.$waitInSeconds = Number(val);
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
      RestoreStartAt: this.restoreStartAt,
      WaitInSeconds: this.waitInSeconds,
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

    const s3 = await this.getS3();
    return s3.restoreObject({
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

  estimateWaitTime() {
    let maxWait = 3600;
    let minWait = 3600;

    if (this.storageClass === CLASS_DEEP_ARCHIVE) {
      /* case 1.1: Deep Archive & Bulk: Typically within 48 hours */
      if (this.restoreRequestTier === 'Bulk') {
        maxWait = 24 * 60 * 60;
        minWait = 6 * 60 * 60;
      } else {
        /* case 1.2: Deep Archive & Standard: Typically within 12 hours */
        maxWait = 8 * 60 * 60;
        minWait = 2 * 60 * 60;
      }
    } else if (this.storageClass === CLASS_GLACIER) {
      /* case 2.1: Glacier & Expedited: Typically within 1-5 minutes when less than 250 MB */
      if (this.restoreRequestTier === 'Expedited') {
        maxWait = 5 * 60;
        minWait = 2 * 60;
      } else if (this.restoreRequestTier === 'Standard') {
      /* case 2.2: Glacier & Standard: Typically within 3-5 hours */
        maxWait = 4 * 60 * 60;
        minWait = 1 * 60 * 60;
      } else {
        /* case 2.3: Glacier & Bulk: Typically within 5-12 hours */
        maxWait = 8 * 60 * 60;
        minWait = 2 * 60 * 60;
      }
    }
    const sinceStart = Math.floor((Date.now() - new Date(this.restoreStartAt).getTime()) / 1000);
    const waitInSeconds = Math.max(minWait, (maxWait - sinceStart));
    return waitInSeconds;
  }

  async checkStatus() {
    const s3 = await this.getS3();
    const response = await s3.headObject({
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

    if (response.StorageClass !== CLASS_GLACIER && response.StorageClass !== CLASS_DEEP_ARCHIVE) {
      this.restoreStatus = 'COMPLETED';
    } else if (status[KEY_ONGOING_REQUEST] === 'false') {
      this.restoreStatus = 'COMPLETED';
    } else {
      /* start restore process */
      if (!response.Restore) {
        await this.restore();
      }
      if (!this.restoreStartAt) {
        this.restoreStartAt = new Date();
      }
      this.waitInSeconds = this.estimateWaitTime();
      this.restoreStatus = 'IN_PROGRESS';
    }
    return this.responseData();
  }

  async getS3() {
    if (this.s3) {
      return this.s3;
    }
    this.s3 = await S3Utils.createAssumedRoleS3(
      this.vendorRole,
      this.vendorExternalId
    );
    return this.s3;
  }
}

module.exports = {
  S3Restore,
};
