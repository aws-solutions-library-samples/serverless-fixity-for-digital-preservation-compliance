# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2024-04-24
### Changed
- update to NodeJS 20.x
- added aws-sdk layer to all lambda functions

## [1.3.0] - 2023-01-12
### Added
- added suport to run checksum with cross-account buckets by assuming cross-account IAM roles through $.VendorRole and $.VendorExternalId (optional)
- added a stack parameter to specify a list of Vendor's IAM roles

### Changed
- update README

### Removed

## [1.2.0] - 2022-10-20
### Added
- added `sha256` checksum
- added a stack parameter to specify a list of buckets to give access. default to asterisk (*) for all buckets and objects 

### Changed
- revise the fixity state machine to use $.SecondsPath and uses `Step Functions Execution Status Change` to handle execution errors
- clean up CFN templates to use yaml syntax
- update README

### Removed

## [1.1.0] - 2021-09-16
### Added

### Changed
- handles zero byte object size
- updated runtime to nodejs14.x
- updated deploy script to check bucket ownership
- added solution-specific user agent to AWS service requests
- updated Copyright

### Removed

__


## [1.0.0] - 2019-11-21
### Added
- initial release

### Changed

### Removed
