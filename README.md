# [Manticore Search](https://manticoresearch.com/) index dump utility

Used for logical backup of indexes and exceptions, stopwords and wordforms files. 
For a physical backup of the index files, use [indexbackup](https://github.com/webigorkiev/indexbackup)

To work correctly, all **text fields must be stored**. If the field is only indexed - you can not get the original data.
If the index specifies absolute path for the exceptions, stopwords and wordforms files, they are required for backup.
File paths are automatically changed to current_directory/index_name/file_name. To backup these files, you need to have read access or use sudo

WARNING: Testing only on Manticore Search 5 for RT indexes

## Quick start

### Install
```shell
:/var/backup# yarn global add indexdump
```

### Check backup possibility

```shell
:/var/backup# indexdump --dry-run test_index
```

### Backup

```shell
:/var/backup# indexdump test_index > test_index.tar.gz 
```

### Restore

```shell
:/var/backup# tar -xOzf test_index.tar.gz dump.sql | mysql -P9306
```

### View advanced settings

```shell
:/var/backup# indexdump --help
```

### View version

```shell
:/var/backup# indexdump -v
```

## Full sample dump to AWS s3

### Install and config aws cli

For this example, you must have [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured

Dumping indexes is associated with transferring large amounts of data, so you need to set the [chunk size for aws s3](https://docs.aws.amazon.com/es_es/cli/latest/topic/s3-config.html)

I use **eu-central-1** but you can choose any available

```shell
# ~/.aws/config
[default]
region = eu-central-1
output = json
s3 =
    multipart_chunksize = 256MB
```

### Create bucket

```shell
:/var/backup# aws s3 mb s3://bucketname --region=eu-central-1
```

Check result

```shell
:/var/backup# aws s3 ls
```

### Check possibility for dump

```shell
:/var/backup# indexdump --dry-run limit=10 --all 
```

### Create dump and send to aws s3 in stream

```shell
:/var/backup# indexdump --add-drop-index --all | aws s3 cp - s3://bucketname/alldump.tar.gz
```

### Restore

#### Extract exceptions, stopwords and wordforms files

```shell
aws s3 cp s3://bucketname/alldump.tar.gz - | tar -C . -xzf --exclude="dump.sql" -
```

#### Restore indexes dump

```shell
aws s3 cp s3://bucketname/alldump.tar.gz - | tar -xOzf - dump.sql | mysql -P9306
```