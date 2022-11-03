#!/bin/sh
BASEDIR=$(PWD)
cd $HOME/Downloads
curl -O https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basic-macos.x64-19.8.0.0.0dbru.dmg
hdiutil mount instantclient-basic-macos.x64-19.8.0.0.0dbru.dmg
/Volumes/instantclient-basic-macos.x64-19.8.0.0.0dbru/install_ic.sh
hdiutil unmount /Volumes/instantclient-basic-macos.x64-19.8.0.0.0dbru
cd $BASEDIR
cp ~/Downloads/instantclient_19_8/{libclntsh.dylib.19.1,libclntshcore.dylib.19.1,libnnz19.dylib,libociei.dylib} node_modules/oracledb/build/Release
cd node_modules/oracledb/build/Release/ && ln -s libclntsh.dylib.19.1 libclntsh.dylib