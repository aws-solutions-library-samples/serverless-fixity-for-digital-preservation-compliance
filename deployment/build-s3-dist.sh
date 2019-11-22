#!/bin/bash

# always include the shared configuration file
source ./common.sh

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./build-s3-dist.sh --bucket BUCKET_BASENAME [--solution SOLUTION] [--version VERSION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./build-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --solution SOLUTION         [optional] if not specified, use 'solution name' from package.json

  --version VERSION           [optional] if not specified, use 'version' field from package.json
"
  return 0
}


######################################################################
#
# BUCKET must be defined through commandline option
#
# --bucket BUCKET_BASENAME
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET="$2"
      shift # past key
      shift # past value
      ;;
      -s|--solution)
      SOLUTION="$2"
      shift # past key
      shift # past value
      ;;
      -v|--version)
      VERSION="$2"
      shift # past key
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

## configure global variables
DEPLOY_DIR="$PWD"
TEMPLATE_DIST_DIR="$DEPLOY_DIR/global-s3-assets"
BUILD_DIST_DIR="$DEPLOY_DIR/regional-s3-assets"
SOURCE_DIR="$DEPLOY_DIR/../source"
TMP_DIR=$(mktemp -d)

[ -z "$BUCKET" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(grep_package_version "$SOURCE_DIR/checksum/package.json")

[ -z "$VERSION" ] && \
  echo "error: can't find the versioning, please use --version parameter..." && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION=$(grep_package_name "$SOURCE_DIR/checksum/package.json")

[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1


## zip packages' names
## note:
##   customer-resources and media2cloud packages could have
##   different versioning as they have different package.json
PKG_CHECKSUM=$(grep_zip_name "$SOURCE_DIR/checksum/package.json")
PKG_CUSTOM_RESOURCES=$(grep_zip_name "$SOURCE_DIR/custom-resources/package.json")

## trap exit signal and make sure to remove the TMP_DIR
trap "rm -rf $TMP_DIR" EXIT

#
# @function clean_start
# @description
#   make sure to have a clean start
#
function clean_start() {
  echo "------------------------------------------------------------------------------"
  echo "[Init] Clean old dist, node_modules folders"
  echo "------------------------------------------------------------------------------"
  rm -rf "$TEMPLATE_DIST_DIR"
  runcmd mkdir -p "$TEMPLATE_DIST_DIR"

  rm -rf "$BUILD_DIST_DIR"
  runcmd mkdir -p "$BUILD_DIST_DIR"

  # in case build system is macosx, delete any .DS_Store file
  find "$DEPLOY_DIR" -name '.DS_Store' -type f -delete
  find "$SOURCE_DIR" -name '.DS_Store' -type f -delete
}

#
# @function install_dev_dependencies
# @description install dev dependencies globally
#
function install_dev_dependencies() {
  echo "------------------------------------------------------------------------------"
  echo "[Init] Install node package dependencies"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR"
  npm install -g \
    aws-sdk \
    aws-sdk-mock \
    browserify \
    chai \
    eslint \
    eslint-config-airbnb-base \
    eslint-plugin-import \
    mocha \
    nock \
    npm-run-all \
    sinon \
    sinon-chai \
    uglify-es
  popd
}

#
# @function build_cloudformation_templates
# @description
#   copy cloudformation templates
#   replace %PARAMS% variables with real names
#
function build_cloudformation_templates() {
  echo "------------------------------------------------------------------------------"
  echo "CloudFormation Templates"
  echo "------------------------------------------------------------------------------"
  runcmd cp -r ./serverless-fixity-for-digital-preservation-compliance*.yaml "$TEMPLATE_DIST_DIR/"

  pushd "$TEMPLATE_DIST_DIR"
  # solution name
  echo "Updating %SOLUTION% param in cloudformation templates..."
  sed -i'.bak' -e "s|%SOLUTION%|${SOLUTION}|g" *.yaml || exit 1
  # version
  echo "Updating %VERSION% param in cloudformation templates..."
  sed -i'.bak' -e "s|%VERSION%|${VERSION}|g" *.yaml || exit 1
  # deployment bucket name
  echo "Updating %BUCKET% param in cloudformation templates..."
  sed -i'.bak' -e "s|%BUCKET%|${BUCKET}|g" *.yaml || exit 1
  # key prefix name
  local keyprefix="${SOLUTION}/${VERSION}"
  echo "Updating %KEYPREFIX% param in cloudformation templates..."
  sed -i'.bak' -e "s|%KEYPREFIX%|${keyprefix}|g" *.yaml || exit 1
  # package name
  echo "Updating %PKG_CHECKSUM% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_CHECKSUM%|${PKG_CHECKSUM}|g" *.yaml || exit 1
  # custom resource name
  echo "Updating %PKG_CUSTOM_RESOURCES% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_CUSTOM_RESOURCES%|${PKG_CUSTOM_RESOURCES}|g" *.yaml || exit 1
  # remove .bak
  runcmd rm -v *.bak
  # Rename all *.yaml to *.template
  for f in *.yaml; do 
    mv -- "$f" "${f%.yaml}.template"
  done
  # copy templates to regional bucket as well
  cp -v *.template "$BUILD_DIST_DIR"
  popd
}

#
# @function build_serverless_checksum_package
# @description
#   build the main package and copy to deployment/dist folder
#
function build_serverless_checksum_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Serverless Checksum Lambda package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/checksum" || exit
  npm install
  npm run build
  npm run zip -- "$PKG_CHECKSUM" .
  cp -v "./dist/$PKG_CHECKSUM" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_custom_resources_package
# @description
#   build custom resources package and copy to deployment/dist folder
#
function build_custom_resources_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building custom resources Lambda package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/custom-resources" || exit
  npm install
  npm run build
  npm run zip -- "$PKG_CUSTOM_RESOURCES" .
  cp -v "./dist/$PKG_CUSTOM_RESOURCES" "$BUILD_DIST_DIR"
  popd
}

#
# @function on_complete
# @description
#   on complete, print out global variables
#
function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "S3 Packaging Complete. (${SOLUTION} ${VERSION})"
  echo "------------------------------------------------------------------------------"
  echo "** SOLUTION=${SOLUTION} **"
  echo "** VERSION=${VERSION} **"
  echo "** PKG_CUSTOM_RESOURCES=${PKG_CUSTOM_RESOURCES} **"
  echo "** PKG_CHECKSUM=${PKG_CHECKSUM} **"
}

#
# main routine goes here
#
clean_start
install_dev_dependencies
build_cloudformation_templates
build_serverless_checksum_package
build_custom_resources_package
on_complete
