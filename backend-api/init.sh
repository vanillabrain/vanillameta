#!/bin/bash
    #init.sh
#    mysql_config_editor set --login-path=test --host=dev-sellerking-service.cpxfjdgipx1h.ap-northeast-2.rds.amazonaws.com --user=vanillabrain --password
#    Enter password: qkslffk123123

    mysqldump --single-transaction --databases --column-statistics=0 vanillameta_auth -h localhost -u vanillabrain -pqkslffk123123 < /docker-entrypoint-initdb.d
    #    mysqldump -h dev-sellerking-service.cpxfjdgipx1h.ap-northeast-2.rds.amazonaws.com -u vanillabrain --password > dump_data.sql

    #end of init.sh

#    mysqldump --single-transaction --databases --column-statistics=0 vanillameta_auth -h localhost -u vanillabrain -pqkslffk123123 < dump_data.sql