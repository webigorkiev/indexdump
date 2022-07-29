# Manticore Search index dump utility

[Manticore Search](https://manticoresearch.com/) index dump utility

To work correctly, all text fields must be stored. If the field is only indexed - you can not get the original data.

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

### Simple example:

```shell
indexdump indexname > dump.sql
```

### All params

```shell
indexdump -h127.0.0.1 -P9306 -ch1000 indexname > dump.sql
```

## Restore from backup

```shell
mysql -P9306 < dump.sql
```

## Addition

You can set chunk size for bulk inserts (default: 1000)

```shell
indexdump -ch1000 indexname > dump.sql
```