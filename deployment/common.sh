#!/bin/bash
######################################################################
#
# common.sh stores the shared parameters used by different shell scripts
#
######################################################################

#
# @function runcmd
# @description print command before run
#
function runcmd() {
  echo "> ${@}"
  "${@}" || exit 1
}

#
# @function grep_package_version
# @description grep package version from package.json version field
#
function grep_package_version() {
  local list=($(grep "version" "$1"))
  local tmp=${list[1]%\"*}
  local version=v${tmp#\"}
  echo $version
}

#
# @function grep_package_name
# @description grep package name from package.json name field
#
function grep_package_name() {
  local list=($(grep "name" "$1"))
  local tmp=${list[1]%\"*}
  local package=${tmp#\"}
  echo $package
}

#
# @function grep_zip_name
# @description grep package zip name from package.json name field
#
function grep_zip_name() {
  local package=$(grep_package_name "$1")
  local version=$(grep_package_version "$1")
  echo "${package}_${version}.zip"
}

#
# REGIONS := these are the regions that supports Media2Cloud solution.
#
REGIONS=( \
  us-east-1 \
  us-east-2 \
  us-west-1 \
  us-west-2 \
  ap-south-1 \
  ap-northeast-3 \
  ap-northeast-2 \
  ap-southeast-1 \
  ap-southeast-2 \
  ap-northeast-1 \
  ca-central-1 \
  cn-north-1 \
  cn-northwest-1 \
  eu-central-1 \
  eu-west-1 \
  eu-west-2 \
  eu-west-3 \
  eu-north-1 \
  sa-east-1 \
)

#
# BUCKET_NAME := bucket base name. The 'actual' bucket name will be concatenated
#           with region. The bucket stores cloudformation template and package.
#           For example, if BUCKET is 'solutions' and is deployed in eu-west-1
#           Then, the actual deployment bucket will be 'solutions-eu-west-1'.
#           (Mandatory)
BUCKET_NAME=

#
# SOLUTION_ID := Solution ID
#
SOLUTION_ID=SO0081
