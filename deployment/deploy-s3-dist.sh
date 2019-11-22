#!/bin/bash

# include shared configuration file
source ./common.sh

TEMPLATE_DIST_DIR="global-s3-assets"
BUID_DIST_DIR="regional-s3-assets"

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script helps you to deploy CloudFormation templates to the bucket(s).
It should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./deploy-s3-dist.sh --bucket BUCKET_BASENAME [--solution SOLUTION] [--version VERSION] [--region REGION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./deploy-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --solution SOLUTION         [optional] if not specified, use 'solution name' from package.json

  --version VERSION           [optional] if not specified, use 'version' field from package.json

  --region REGION             [optional] a single region to deploy. If not specified, it deploys to all
                              supported regions. (This assumes all regional buckets already exist.)
"
  return 0
}

######################################################################
#
# optional flags
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET="$2"
      shift # past argument
      shift # past value
      ;;
      -s|--solution)
      SOLUTION="$2"
      shift # past key
      shift # past value
      ;;
      -v|--version)
      VERSION="$2"
      shift # past argument
      shift # past value
      ;;
      -r|--region)
      SINGLE_REGION="$2"
      shift # past argument
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

[ -z "$BUCKET" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(grep_package_version "../source/checksum/package.json")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION=$(grep_package_name "../source/checksum/package.json")

[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

#
# @function copy_to_bucket
# @description copy solution to regional bucket
#
function copy_to_bucket() {
  local source=$1
  local bucket=$2
  local region=$3
  echo "uploading package to ${bucket}..."
  aws s3 cp $source s3://${bucket}/${SOLUTION}/${VERSION}/ --recursive --acl public-read --region ${region}
}

if [ x"$SINGLE_REGION" != "x" ]; then
  # deploy to a single region
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-${SINGLE_REGION}' bucket in ${SINGLE_REGION} region"
  copy_to_bucket ${TEMPLATE_DIST_DIR} "${BUCKET}-${SINGLE_REGION}" "${SINGLE_REGION}"
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}-${SINGLE_REGION}" "${SINGLE_REGION}"
else
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-[region]' buckets: ${REGIONS[*]} regions"
  # special case, deploy to main bucket (without region suffix)
  copy_to_bucket ${TEMPLATE_DIST_DIR} "${BUCKET}" "us-east-1"
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}" "us-east-1"

  # now, deploy to regional based buckets
  for region in ${REGIONS[@]}; do
    copy_to_bucket ${TEMPLATE_DIST_DIR} "${BUCKET}-${region}" "${region}"
    copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}-${region}" "${region}"
  done
fi
