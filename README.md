# Manticore Search index dump utility

[Manticore Search](https://manticoresearch.com/) index dump utility

To work correctly, all text fields must be stored. If the field is only indexed - you can not get the original data.
If the index specifies absolute empty spaces for the exceptions, stopwords and wordforms files, they are required for backup.
File paths are automatically changed to <current directory>/<index name>/<file name>
If the user does not have access to the index files, a warning will be written to the dump file

WARNING: Testing only on Manticore Search 5

## Install

```shell
yarn global add indexdump
```

## Create backup

default:

    * host: 127.0.0.1
    * port: 9306
    * chunk: 1000

### Quick start:

```shell
indexdump indexname > dump.sql
```

OR

```shell
indexdump indexname | gzip > dump.sql.gz
```
### Dump all

```shell
indexdump --all | gzip > dump.sql.gz
```

### Dump all without data

```shell
indexdump --limit=0 --all  > dump.sql
```

### Dump all with prefix

```shell
indexdump --prefix=db --all | gzip > dump.sql.gz
```

### Dump for development all with prefix with limit

```shell
indexdump --limit=100 --prefix=db --all | gzip > dump.sql.gz
```

### Dump with indication of base directory for exceptions, stopwords and wordforms files

```shell
indexdump --limit=100 --prefix=db --path=/var/wordsforms --all | gzip > dump.sql.gz
```

### All params

```shell
indexdump -h127.0.0.1 -P9306 -ch1000 indexname > dump.sql
```

### Restore from backup

```shell
mysql -P9306 < dump.sql
```

### Add LOCK statement

```shell
indexdump --add-locks indexname > dump.sql
```

### Add DROP TABLE statement

```shell
indexdump --add-drop-table indexname > dump.sql
```

### Rename index

```shell
indexdump --to-table new-index-name indexname > dump.sql
```
## Settings

### Chunk size

You can set chunk size for bulk inserts (default: 1000)

```shell
indexdump -ch1000 indexname > dump.sql
```

### Check version

```shell
indexdump -v
```
