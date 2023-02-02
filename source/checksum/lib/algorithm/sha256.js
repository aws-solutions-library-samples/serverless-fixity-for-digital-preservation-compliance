/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */
const {
  Hash,
  HashType,
} = require('resumable-hash');

const {
  ComputedChecksumExistError,
  RuntimeError,
  MismatchFileSizeError,
} = require('../shared/errors');

const {
  BaseLib,
} = require('./base');

/**
 * @class SHA256Lib
 * @description SHA1 checksum implementation
 */
class SHA256Lib extends BaseLib {
  constructor(params = {}) {
    super('SHA256Lib', params);
    if ((params.Algorithm || '').toLowerCase() !== 'sha256') {
      throw new RuntimeError(`Algorithm is set to ${params.Algorithm} but loading SHA256Lib`);
    }
    this.algorithm = 'sha256';
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
      let initState;
      if (this.intermediateHash) {
        initState = Buffer.from(this.intermediateHash, 'hex');
      }
      let resumeableHash = new Hash(HashType.Sha256, initState);

      const [start, end] = this.calculateByteRange();
      const range = (this.byteStart === 0 && this.fileSize === 0)
        ? undefined
        : `bytes=${start}-${end}`;

      const stream = this.s3.getObject({
        Bucket: this.bucket,
        Key: this.key,
        Range: range,
        IfMatch: this.etag,
      }).createReadStream();

      stream.on('data', (chunk) => {
        console.log('stream.data', chunk.byteLength);
        this.bytesRead += chunk.byteLength;
        resumeableHash = resumeableHash.updateSync(chunk);
      });

      stream.on('end', async () => {
        this.t1 = new Date();
        const byteProcessed = this.byteStart + this.bytesRead;
        if (byteProcessed > this.fileSize) {
          reject(new MismatchFileSizeError(`byte processed (${byteProcessed}) larger than the actual file size (${this.fileSize})`));
          return;
        }

        if (byteProcessed === this.fileSize) {
          this.computed = resumeableHash.digestSync().toString('hex');
          /* signal base class to record the end time */
          this.setElapsed();
          this.status = 'COMPLETED';
        } else {
          this.intermediateHash = resumeableHash.serialize().toString('hex');
        }
        resolve(this.responseData());
      });

      stream.on('error', (e) => {
        console.log('stream.error', e);
        reject(e);
      });
    });
    return responseData;
  }
}

module.exports = {
  SHA256Lib,
};
