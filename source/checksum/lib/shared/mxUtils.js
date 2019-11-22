/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @author aws-mediaent-solutions
 */

const mxUtils = Base => class extends Base {
  /**
   * @static
   * @function neat - empty properties that are undefined or null
   * @param {object} o - object
   */
  static neat(o) {
    const json = Object.assign({}, o);
    Object.keys(json).forEach((x) => {
      if (json[x] === undefined || json[x] === null) {
        delete json[x];
      }
    });
    return Object.keys(json).length === 0 ? undefined : json;
  }
};

module.exports = {
  mxUtils,
};
