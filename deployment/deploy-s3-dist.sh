#!/bin/bash

# include shared configuration file
source ./common.sh
ACCOUNTID=
SOURCE_DIR="../source"
TEMPLATE_DIST_DIR="global-s3-assets"
BUID_DIST_DIR="regional-s3-assets"
MAIN_TEMPLATE="serverless-fixity-for-digital-preservation-compliance.template"

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
bash ./deploy-s3-dist.sh --bucket BUCKET_BASENAME [--solution SOLUTION] [--version VERSION] [--region REGION] [--acl ACL_SETTING]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./deploy-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --solution SOLUTION         [optional] if not specified, use 'solution name' from package.json

  --version VERSION           [optional] if not specified, use 'version' field from source/.version

  --region REGION             [optional] a single region to deploy. If not specified, it deploys to all
                              supported regions. (This assumes all regional buckets already exist.)

  --acl ACL_SETTING           [optional] if not specified, it deploys with 'bucket-owner-full-control' access
                              control setting. You could specify 'public-read' if you plan to share the solution
                              with other AWS accounts. Note that it requires your bucket to be configured to permit
                              'public-read' acl settings

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
      BUCKET_NAME="$2"
      shift # past argument
      shift # past value
      ;;
      -s|--solution)
      SOLUTION_NAME="$2"
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
      -a|--acl)
      ACL_SETTING="$2"
      shift # past argument
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

[ -z "$BUCKET_NAME" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(cat "$SOURCE_DIR/.version")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

[ -z "$SOLUTION_NAME" ] && \
  SOLUTION_NAME="serverless-fixity-for-digital-preservation-compliance"

[ -z "$SOLUTION_NAME" ] && \
  echo "error: SOLUTION_NAME variable is not defined" && \
  usage && \
  exit 1

[ -z "$ACL_SETTING" ] && \
  ACL_SETTING="bucket-owner-full-control"

ACCOUNTID=$(aws sts get-caller-identity | jq .Account | tr -d \")
[ -z "$ACCOUNTID" ] && \
  echo "error: fail to get AWS Account ID" && \
  exit 1

#
# @function copy_to_bucket
# @description copy solution to regional bucket
#
function copy_to_bucket() {
  local bucket=$1
  # full packages deployed to versioned folder
  local fullPackages=$BUID_DIST_DIR
  local versionFolder=s3://${bucket}/${SOLUTION_NAME}/${VERSION}/
  # main templates deployed to latest folder
  local mainTemplate=$TEMPLATE_DIST_DIR
  local latestFolder=s3://${bucket}/${SOLUTION_NAME}/latest/

  # Get bucket region and ensure bucket is owned by the same AWS account.
  # LocationConstraint returns null if bucket is in us-east-1 region
  local location=$(aws s3api get-bucket-location --bucket ${bucket} --expected-bucket-owner ${ACCOUNTID} | jq .LocationConstraint | tr -d \")
  [ -z "$location" ] && \
    echo "Bucket '${bucket}' either doesn't exist or doesn't belong to accountId '${ACCOUNTID}'. exiting..." && \
    exit 1

  local region="us-east-1"
  [ "$location" != "null" ] && \
    region=$location

  local domain="s3.amazonaws.com"
  local optionalFlag="--acl ${ACL_SETTING}"

  if [ "$region" != "us-east-1" ]; then
    domain=s3.${region}.amazonaws.com
    optionalFlag="${optionalFlag} --region ${region}"
  fi

  # upload artifacts to bucket
  echo "== Deploy '${SOLUTION_NAME} ($VERSION)' package from '${fullPackages}' to '${versionFolder}' in '${region}' [BEGIN] =="
  aws s3 cp $fullPackages $versionFolder --recursive $optionalFlag
  aws s3 cp $mainTemplate $latestFolder --recursive $optionalFlag
  echo "== Deploy '${SOLUTION_NAME} ($VERSION)' package from '${fullPackages}' to '${versionFolder}' in '${region}' [COMPLETED] =="

  local url="https://${bucket}.${domain}/${SOLUTION_NAME}/${VERSION}/${MAIN_TEMPLATE}"
  local latestUrl="https://${bucket}.${domain}/${SOLUTION_NAME}/latest/${MAIN_TEMPLATE}"

  echo "== (VERSIONED URL) ============================"
  echo ""
  echo "HTTPS URL:"
  echo "$url"
  echo ""
  echo "One-click URL to create stack:"
  echo "https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate?templateURL=${url}&stackName=serverless-fixity"
  echo ""

  echo "== (LATEST URL) ==============================="
  echo ""
  echo "$latestUrl"
  echo ""
  echo "One-click URL to create stack:"
  echo "https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate?templateURL=${latestUrl}&stackName=serverless-fixity"
  echo ""
}

if [ "x$SINGLE_REGION" != "x" ]; then
  # deploy to a single region
  copy_to_bucket "${BUCKET_NAME}-${SINGLE_REGION}"
else
  # special case, deploy to main bucket (without region suffix)
  copy_to_bucket "${BUCKET_NAME}"
  # now, deploy to regional based buckets
  for region in ${REGIONS[@]}; do
    copy_to_bucket "${BUCKET_NAME}-${region}"
  done
fi
