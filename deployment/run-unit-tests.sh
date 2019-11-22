#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"


#
# @function clean_start
# @description clean up dist, node_modules
#
function clean_start() {
  echo "------------------------------------------------------------------------------"
  echo "[Init] Clean old dist and node_modules folders"
  echo "------------------------------------------------------------------------------"
  for folder in checksum custom-resources; do
    echo "find $source_dir/${folder} -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
    find $source_dir/${folder} -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null

    echo "find $source_dir/${folder} -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
    find $source_dir/${folder} -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null

    echo "find ../ -type f -name 'package-lock.json' -delete"
    find $source_dir/${folder} -type f -name 'package-lock.json' -delete
  done
}

#
# @function install_dev_dependencies
# @description install dev dependencies globally
#
function install_dev_dependencies() {
  echo "------------------------------------------------------------------------------"
  echo "Install node dev dependencies"
  echo "------------------------------------------------------------------------------"
  npm install -g \
    aws-sdk \
    aws-sdk-mock \
    chai \
    eslint \
    eslint-config-airbnb-base \
    eslint-plugin-import \
    mocha \
    nock \
    npm-run-all \
    sinon \
    sinon-chai
}

function unit_test_custom_resources() {
  echo "------------------------------------------------------------------------------"
  echo "[Test] Custom Resources lambda"
  echo "------------------------------------------------------------------------------"
  pushd $source_dir/custom-resources
  npm install
  npm test
  popd
}

function unit_test_checksum() {
  echo "------------------------------------------------------------------------------"
  echo "[Test] Checksum lambda"
  echo "------------------------------------------------------------------------------"
  pushd $source_dir/checksum
  npm install
  npm test
  popd
}

clean_start
install_dev_dependencies
unit_test_custom_resources
unit_test_checksum
