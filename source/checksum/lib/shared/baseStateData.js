/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

const {
  mxUtils,
} = require('./mxUtils');

const {
  InvalidArgumentError,
} = require('./errors');


const REQUIRED_PARAMS = [
  'Bucket',
  'Key',
  // 'FileSize',
  // 'State',
  // 'Status', /* STARTED, IN_PROGRESS, COMPLETED, FAILED */
  // 'Elapsed',
];

class X extends mxUtils(class {}) {}

class BaseStateData {
  constructor(state, params = {}) {
    /* sanity check */
    const missing = REQUIRED_PARAMS.filter(x => params[x] === undefined);
    if (missing.length) {
      throw new InvalidArgumentError(`missing ${missing.join(', ')}`);
    }
    if (!state) {
      throw new InvalidArgumentError('missing state parameter');
    }

    this.$original = Object.assign({}, params);
    this.$bucket = params.Bucket;
    this.$key = params.Key;
    this.$etag = params.ETag || undefined;
    this.$fileSize = Number.parseInt(params.FileSize || 0, 10);
    this.$state = state;
    this.$status = params.Status;
    if (this.$state !== params.State) {
      this.$status = 'STARTED';
    } else if (params.Status === 'STARTED') {
      this.$status = 'IN_PROGRESS';
    }
    this.$lastElapsed = Number.parseInt(params.Elapsed || 0, 10);
    this.$t0 = new Date();
    this.$t1 = undefined;
  }

  get original() {
    return this.$original;
  }

  get bucket() {
    return this.$bucket;
  }

  get key() {
    return this.$key;
  }

  get etag() {
    return this.$etag;
  }

  set etag(val) {
    this.$etag = val;
  }

  get fileSize() {
    return this.$fileSize;
  }

  set fileSize(val) {
    this.$fileSize = Number.parseInt(val, 10);
  }

  get state() {
    return this.$state;
  }

  set state(val) {
    this.$state = val;
  }

  get status() {
    return this.$status;
  }

  set status(val) {
    this.$status = val;
  }

  get t0() {
    return this.$t0;
  }

  set t0(val) {
    this.$t0 = val;
  }

  get t1() {
    return this.$t1;
  }

  set t1(val) {
    this.$t1 = val;
  }

  get lastElapsed() {
    return this.$lastElapsed;
  }

  responseData() {
    /* merge original payload */
    return X.neat(Object.assign({}, this.original, {
      Elapsed: this.lastElapsed + ((this.t1 || new Date()) - this.t0),
      Bucket: this.bucket,
      Key: this.key,
      ETag: this.etag,
      FileSize: this.fileSize,
      State: this.state,
      Status: this.status,
    }));
  }

  setElapsed() {
    this.t1 = new Date();
  }
}

module.exports = {
  BaseStateData,
};
