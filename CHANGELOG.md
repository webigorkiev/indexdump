## 1.2.0

### Improvements

* Create archive
* Add --dry-run option
* Add --data-dir options
* Add --add-config option
* Add --help option
* Documentation changed

## 1.1.3

### Improvements

* Add backup and restore scenarios

### Bug Fixes

* Fix bug with enabled index_field_lengths

## 1.1.2

## Improvements

* Added documentation

## 1.1.1

### Bug Fixes

* Fix create dir for exceptions, stopwords and wordforms

## 1.1.0

## Improvements

* add --path option (path to base dir for exceptions, stopwords and wordforms)
* copy exceptions, stopwords and wordforms to the curren path or path in --path option (only locally and need access to index files)

## 1.0.3

### Bug Fixes

* fix --add-drop-table

## 1.0.2

### Improvements

* Add IF EXISTS to DROP TABLE

## 1.0.1

### Improvements

* add --prefix option
* add --limit option (--limit=0 dump without data)
* add --all option
* add --indexes option 

## 0.0.8

### Improvements

* add --add-locks option to add LOCK and UNLOCK statements (Requires >= 5.0.3 version ManticoreSearch)
* add --add-drop-table to add DROP TABLE
* add --to-table new-table-name to rename index for dump 
* 
### Bug Fixes

* Fix bug with enabled index_field_lengths

