# Manticore Search index dump utility

[Manticore Search](https://manticoresearch.com/) index dump utility

## Install

```shell
yarn add indexdump
```

## Create backup

```shell
indexdump -h127.0.01 -P9306 indexname > dump.sql
```

## Restore from backup

```shell
mysql -P9306 < dump.sql
```