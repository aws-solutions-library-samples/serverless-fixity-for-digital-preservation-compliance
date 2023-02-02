/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */
const S3Utils = require('../shared/s3Utils');

const {
  mxUtils,
} = require('../shared/mxUtils');

const {
  BaseStateData,
} = require('../shared/baseStateData');

const {
  NotImplError,
  MismatchETagError,
  MismatchFileSizeError,
} = require('../shared/errors');

/* 20GB default chunk size */
const DEFAULT_CHUNKSIZE = 2 * 10 * 1024 * 1024 * 1024;

class X extends mxUtils(class {}) {}

class BaseLib extends BaseStateData {
  constructor(libName, params = {}) {
    super(libName, params);
    this.$algorithm = params.Algorithm || undefined;
    this.$byteStart = Number.parseInt(params.NextByteStart || 0, 10);
    this.$chunkSize = Number.parseInt(params.ChunkSize || DEFAULT_CHUNKSIZE, 10);
    this.$intermediateHash = params.IntermediateHash || undefined;
    this.$computed = params.Computed || undefined;
    this.$expected = params.Expected || undefined;
    this.$bytesRead = 0;
    this.$vendorRole = params.VendorRole;
    this.$vendorExternalId = params.VendorExternalId;
    this.$s3 = undefined;
  }

  get algorithm() {
    return this.$algorithm;
  }

  set algorithm(val) {
    this.$algorithm = val;
  }

  get byteStart() {
    return this.$byteStart;
  }

  set byteStart(val) {
    this.$byteStart = Number.parseInt(val, 10);
  }

  get chunkSize() {
    return this.$chunkSize;
  }

  set chunkSize(val) {
    this.$chunkSize = Number.parseInt(val, 10);
  }

  get bytesRead() {
    return this.$bytesRead;
  }

  set bytesRead(val) {
    this.$bytesRead = Number.parseInt(val, 10);
  }

  get intermediateHash() {
    return this.$intermediateHash;
  }

  set intermediateHash(val) {
    this.$intermediateHash = val;
  }

  get computed() {
    return this.$computed;
  }

  set computed(val) {
    this.$computed = val;
  }

  get expected() {
    return this.$expected;
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

  async initLib() {
    this.bytesRead = 0;
    this.t0 = new Date();

    this.s3 = await S3Utils.createAssumedRoleS3(
      this.vendorRole,
      this.vendorExternalId
    );

    const {
      ContentLength,
      ETag,
    } = await this.s3.headObject({
      Bucket: this.bucket,
      Key: this.key,
    }).promise();

    const contentLength = Number.parseInt(ContentLength, 10);
    this.fileSize = this.fileSize || contentLength;
    if (this.fileSize !== contentLength) {
      throw new MismatchFileSizeError();
    }

    this.etag = this.etag || ETag;
    if (this.etag !== ETag) {
      throw new MismatchETagError();
    }
  }

  responseData() {
    const json = Object.assign({}, super.responseData(), {
      Algorithm: this.algorithm,
      ChunkSize: this.chunkSize,
      BytesRead: this.bytesRead,
      NextByteStart: this.byteStart + this.bytesRead,
      IntermediateHash: this.intermediateHash,
      Computed: this.computed,
      Expected: this.expected,
    });
    return X.neat(json);
  }

  calculateByteRange() {
    return [
      this.byteStart,
      (this.byteStart + this.chunkSize) - 1,
    ];
  }

  /* eslint-disable class-methods-use-this */
  async compute() {
    throw new NotImplError('superclass must override compute()');
  }
  /* eslint-enable class-methods-use-this */
}

module.exports = {
  BaseLib,
};
