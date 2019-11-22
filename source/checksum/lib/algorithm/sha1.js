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
const RUSHA = require('rusha');

const {
  ComputedChecksumExistError,
  RuntimeError,
  MismatchFileSizeError,
} = require('../shared/errors');

const {
  BaseLib,
} = require('./base');

const DEFAULT_HEAPSIZE = 128 * 1024; // 16 * 1024;

/**
 * @class SHA1Lib
 * @description SHA1 checksum implementation
 */
class SHA1Lib extends BaseLib {
  constructor(params = {}) {
    super('SHA1Lib', params);
    if ((params.Algorithm || '').toLowerCase() !== 'sha1') {
      throw new RuntimeError(`Algorithm is set to ${params.Algorithm} but loading SHA1Lib`);
    }
    this.algorithm = 'sha1';
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
      const rusha = new RUSHA(DEFAULT_HEAPSIZE);
      rusha.resetState();

      if (this.intermediateHash) {
        const buf = Buffer.from(this.intermediateHash.heap, 'base64');
        const state = {
          offset: this.intermediateHash.offset,
          /* convert Base64 Buffer back to ArrayBuffer */
          heap: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        };
        rusha.setState(state);
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
        rusha.append(data);
      });

      stream.on('end', async () => {
        this.t1 = new Date();
        const byteProcessed = this.byteStart + this.bytesRead;
        if (byteProcessed > this.fileSize) {
          reject(new MismatchFileSizeError(`byte processed (${byteProcessed}) larger than the actual file size (${this.fileSize})`));
          return;
        }

        if (byteProcessed === this.fileSize) {
          this.computed = rusha.end();
          /* signal base class to record the end time */
          this.setElapsed();
          this.status = 'COMPLETED';
        } else {
          const state = rusha.getState();
          this.intermediateHash = {
            offset: state.offset,
            /* convert ArrayBuffer to Base64 Buffer string */
            heap: Buffer.from(state.heap).toString('base64'),
          };
        }
        resolve(this.responseData());
      });
    });
    return responseData;
  }
}

module.exports = {
  SHA1Lib,
};
