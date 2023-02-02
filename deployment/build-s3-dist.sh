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

  --version VERSION           [optional] if not specified, use 'version' field from source/.version
"
  return 0
}


######################################################################
#
# BUCKET_NAME must be defined through commandline option
#
# --bucket BUCKET_BASENAME
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET_NAME="$2"
      shift # past key
      shift # past value
      ;;
      -s|--solution)
      SOLUTION_NAME="$2"
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

[ -z "$BUCKET_NAME" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(cat "$SOURCE_DIR/.version")

[ -z "$VERSION" ] && \
  echo "error: can't find the versioning, please use --version parameter..." && \
  usage && \
  exit 1

[ -z "$SOLUTION_NAME" ] && \
  SOLUTION_NAME="serverless-fixity-for-digital-preservation-compliance"

[ -z "$SOLUTION_NAME" ] && \
  echo "error: SOLUTION_NAME variable is not defined" && \
  usage && \
  exit 1

# Lambda layers
LAYER_RESUMABLE_HASH=

# Lambda packages
PKG_CHECKSUM=
PKG_CUSTOM_RESOURCES=

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
    chai \
    eslint \
    eslint-config-airbnb-base \
    eslint-plugin-import \
    browserify \
    terser \
    mocha \
    nock \
    npm-run-all \
    sinon \
    sinon-chai
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
  echo "Updating %%SOLUTION_NAME%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%SOLUTION_NAME%%|${SOLUTION_NAME}|g" *.yaml || exit 1
  # solution id
  echo "Updating %%SOLUTION_ID%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%SOLUTION_ID%%|${SOLUTION_ID}|g" *.yaml || exit 1
  # version
  echo "Updating %%VERSION%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%VERSION%%|${VERSION}|g" *.yaml || exit 1
  # deployment bucket name
  echo "Updating %%BUCKET_NAME%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%BUCKET_NAME%%|${BUCKET_NAME}|g" *.yaml || exit 1
  # key prefix name
  local keyprefix="${SOLUTION_NAME}/${VERSION}"
  echo "Updating %%KEYPREFIX%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%KEYPREFIX%%|${keyprefix}|g" *.yaml || exit 1
  # lambda layer
  echo "Updating %%LAYER_RESUMABLE_HASH%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_RESUMABLE_HASH%%|${LAYER_RESUMABLE_HASH}|g" *.yaml || exit 1
  # package name
  echo "Updating %%PKG_CHECKSUM%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_CHECKSUM%%|${PKG_CHECKSUM}|g" *.yaml || exit 1
  # custom resource name
  echo "Updating %%PKG_CUSTOM_RESOURCES%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_CUSTOM_RESOURCES%%|${PKG_CUSTOM_RESOURCES}|g" *.yaml || exit 1
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
  local name="checksum"
  PKG_CHECKSUM="${name}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${name}" || exit
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
  local name="custom-resources"
  PKG_CUSTOM_RESOURCES="${name}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${name}"
  npm install
  npm run build
  npm run zip -- "$PKG_CUSTOM_RESOURCES" .
  cp -v "./dist/$PKG_CUSTOM_RESOURCES" "$BUILD_DIST_DIR"
  popd
}

#
# Resumable-Hash lambda layer
#
function build_resumable_hash_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building aws-sdk and aws-xray-sdk layer package"
  echo "------------------------------------------------------------------------------"
  local workflow="layers"
  local name="resumable-hash"
  local package="${workflow}-${name}"
  LAYER_RESUMABLE_HASH="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${workflow}/${name}"

  mkdir ./dist
  # build a docker image that builds the resumable-hash library and package to resumable-hash-lambda-layer.zip
  docker build -t ${name} .

  # create a container so we can copy the zip package to local host
  local id=$(docker create ${name})
  docker cp ${id}:/var/task/package.zip ./dist/${LAYER_RESUMABLE_HASH}

  # remove container
  docker rm -v $id

  # remove image
  docker rmi ${name}

  mv -v "./dist/${LAYER_RESUMABLE_HASH}" "$BUILD_DIST_DIR"

  popd
}

#
# @function on_complete
# @description
#   on complete, print out global variables
#
function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "S3 Packaging Complete. (${SOLUTION_NAME} ${VERSION})"
  echo "------------------------------------------------------------------------------"
  echo "** SOLUTION_NAME=${SOLUTION_NAME} **"
  echo "** VERSION=${VERSION} **"
  echo ""
  echo "== Lambda Layer(s) =="
  echo "** LAYER_RESUMABLE_HASH=${LAYER_RESUMABLE_HASH} **"
  echo ""
  echo "== Lambda Package(s) =="
  echo "** PKG_CUSTOM_RESOURCES=${PKG_CUSTOM_RESOURCES} **"
  echo "** PKG_CHECKSUM=${PKG_CHECKSUM} **"
}

#
# main routine goes here
#
clean_start
install_dev_dependencies
build_resumable_hash_layer
build_serverless_checksum_package
build_custom_resources_package
build_cloudformation_templates
on_complete
