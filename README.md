# Manticore Search index dump utility

[Manticore Search](https://manticoresearch.com/) index dump utility

To work correctly, all text fields must be stored. If the field is only indexed - you can not get the original data.
If the index specifies absolute empty spaces for the exceptions, stopwords and wordforms files, they are required for backup.
File paths are automatically changed to current_directory/index_name/file_name
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

### Connection options

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

## Backup scenarios

Testing on Debian 10

This is the complete script for cases with exceptions, stopwords and wordforms files

### Backup

```shell
cd /var/backups
mkdir indexdumpfiles
cd indexdumpfiles
indexdump --all --add-drop-table | gzip > dump.sql.gz
cd ../
tar -czvf indexdumpfiles.tar.gz indexdumpfiles/
chmod 0755 indexdumpfiles.tar.gz
rm -rf indexdumpfiles/

```

### Restore

```shell
cd /var/backups
tar -xzvf indexdumpfiles.tar.gz
cd indexdumpfiles
ungzip < dump.sql.gz | mysql -P9306
```

If you want to restore a backup on another node or from another directory you need to specify the parameter --path=dir_for_resore

This only matters if the exceptions, stopwords and wordforms files are listed in any of the indexes. 

In other cases, you can restore a backup from any path.