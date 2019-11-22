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

  async initLib() {
    this.bytesRead = 0;
    this.t0 = new Date();

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });

    const {
      ContentLength,
      ETag,
    } = await s3.headObject({
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
