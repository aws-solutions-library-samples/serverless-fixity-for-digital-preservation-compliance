#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-open-source-dist.sh [--solution solution-name]
#
# Paramenters:
#  - solution-name: [optional] name of the solution for consistency

# include shared configuration file
source ./common.sh

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script helps you to build open source code package
It should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./build-open-source-dist.sh [--solution SOLUTION]

where
  --solution SOLUTION  [optional] if not specified, use 'solution name' from package.json
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
      -s|--solution)
      SOLUTION="$2"
      shift # past key
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

[ -z "${SOLUTION}" ] && \
  SOLUTION=$(grep_package_name "../source/checksum/package.json")

[ -z "${SOLUTION}" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

# Get reference for all important folders
source_template_dir="$PWD"
dist_dir="$source_template_dir/open-source"
dist_template_dir="$dist_dir/deployment"
source_dir="$source_template_dir/../source"
images_dir="$source_template_dir/images"

function clean_start() {
  echo "------------------------------------------------------------------------------"
  echo "[Init] Clean old open-source folder"
  echo "------------------------------------------------------------------------------"
  for dir in "$dist_dir" "$dist_template_dir"; do
    echo "rm -rf $dir"
    rm -rf "$dir"
    echo "mkdir -p $dir"
    mkdir -p "$dir"
  done
}

function copy_templates() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Templates"
  echo "------------------------------------------------------------------------------"
  pushd "$source_template_dir"
  echo "cp $source_template_dir/*.template $dist_template_dir/"
  cp *.template $dist_template_dir/
  echo "copy yaml templates and rename"
  cp *.yaml $dist_template_dir/
  cd $dist_template_dir
  popd
}

function copy_images() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Copy images"
  echo "------------------------------------------------------------------------------"
  echo "cp -r $images_dir $dist_template_dir"
  cp -r $images_dir $dist_template_dir
}

function copy_build_scripts() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Build Script"
  echo "------------------------------------------------------------------------------"
  pushd "$source_template_dir"
  for file in *.sh; do
    echo "cp $file $dist_template_dir"
    cp "$file" "$dist_template_dir"
  done
  popd
}

function copy_standard_documents() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Legal Documents"
  echo "------------------------------------------------------------------------------"
  pushd "$source_template_dir/.."
  for file in "LICENSE.txt" "NOTICE.txt" "README.md" "CODE_OF_CONDUCT.md" "CONTRIBUTING.md" "CHANGELOG.md"; do
    echo "cp $file $dist_dir"
    cp $file $dist_dir
  done
  popd
}

function copy_sources() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Clean dist, node_modules and bower_components folders"
  echo "------------------------------------------------------------------------------"
  echo "cp -r $source_dir $dist_dir"
  cp -r $source_dir $dist_dir
  pushd "$dist_dir"
  echo "find $dist_dir -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
  find ./ -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null
  echo "find $dist_dir -iname "tests" -type d -exec rm -r "{}" \; 2> /dev/null"
  find ./ -iname "tests" -type d -exec rm -r "{}" \; 2> /dev/null
  echo "find $dist_dir -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
  find ./ -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null
  echo "find $dist_dir -iname "bower_components" -type d -exec rm -r "{}" \; 2> /dev/null"
  find ./ -iname "bower_components" -type d -exec rm -r "{}" \; 2> /dev/null
  echo "find ../ -type f -name 'package-lock.json' -delete"
  find ../ -type f -name 'package-lock.json' -delete
}

function create_github_zip() {
  echo "------------------------------------------------------------------------------"
  echo "[Packing] Create GitHub (open-source) zip file"
  echo "------------------------------------------------------------------------------"
  echo "cd $dist_dir"
  cd $dist_dir
  echo "zip -q -r9 ../${SOLUTION}.zip *"
  zip -q -r9 ../${SOLUTION}.zip *
  echo "Clean up open-source folder"
  echo "rm -rf *"
  rm -rf *
  echo "mv ../${SOLUTION}.zip ."
  mv ../${SOLUTION}.zip .
  echo "Completed building ${SOLUTION}.zip dist"
}

#
# main routine
#
clean_start
copy_templates
copy_images
copy_build_scripts
copy_standard_documents
copy_sources
create_github_zip
