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
const SPARK = require('spark-md5');

const {
  ComputedChecksumExistError,
  RuntimeError,
  MismatchFileSizeError,
} = require('../shared/errors');

const {
  BaseLib,
} = require('./base');

/**
 * @class MD5Lib
 * @description MD5 checksum implementation
 */
class MD5Lib extends BaseLib {
  constructor(params = {}) {
    super('MD5Lib', params);
    if (params.Algorithm && params.Algorithm !== 'md5') {
      throw new RuntimeError(`Algorithm is set to ${params.Algorithm} but loading MD5Lib`);
    }
    this.algorithm = 'md5';
  }

  /**
   * @override BaseLib compute()
   */
  async compute() {
    /* shouldn't be here */
    if (this.computed) {
      throw new ComputedChecksumExistError();
    }

    await this.initLib();

    const responseData = await new Promise((resolve, reject) => {
      const spark = new SPARK.ArrayBuffer();
      if (this.intermediateHash) {
        spark.setState(this.intermediateHash);
      }

      const [start, end] = this.calculateByteRange();

      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        signatureVersion: 'v4',
      });

      const stream = s3.getObject({
        Bucket: this.bucket,
        Key: this.key,
        Range: `bytes=${start}-${end}`,
        IfMatch: this.etag,
      }).createReadStream();

      stream.on('error', e =>
        reject(e));

      stream.on('data', async (data) => {
        this.bytesRead += data.length;
        spark.append(data);
      });

      stream.on('end', async () => {
        this.t1 = new Date();
        const byteProcessed = this.byteStart + this.bytesRead;
        if (byteProcessed > this.fileSize) {
          reject(new MismatchFileSizeError(`byte processed (${byteProcessed}) larger than the actual file size (${this.fileSize})`));
          return;
        }
        if (byteProcessed === this.fileSize) {
          this.computed = spark.end();
          /* signal base class to record the end time */
          this.setElapsed();
          this.status = 'COMPLETED';
        } else {
          this.intermediateHash = spark.getState();
        }
        resolve(this.responseData());
      });
    });

    return responseData;
  }
}

module.exports = {
  MD5Lib,
};
