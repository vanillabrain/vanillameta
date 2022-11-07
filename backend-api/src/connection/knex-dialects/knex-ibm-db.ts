// import Client from "knex/lib/client";

import { Knex, knex } from 'knex';
import { Database } from 'ibm_db';
import Client = knex.Client;

export class IbmDbClient extends Client {
  constructor(config) {
    super(config);
    this.dialect = 'ibm_db';
    this.driverName = 'ibm_db';
    this.canCancelQuery = true;
  }

  _driver() {
    return new Database();
  }

  acquireRawConnection() {
    return Promise.resolve({
      driver: this.driver,
      job: null,
    });
  }

  // validateConnection(connection) {
  //   return (
  //     connection &&
  //     !connection._fatalError &&
  //     !connection._protocolError &&
  //     !connection._closing &&
  //     !connection.stream.destroyed
  //   );
  // }

  destroyRawConnection(connection) {
    return this.cancelJob(connection);
  }

  wrapIdentifier(value) {
    return value !== '*' ? `\`${value}\`` : '*';
  }

  cancelJob(connection) {
    if (connection.job === null) {
      return Promise.resolve();
    }
    const cancelJobRequest = connection.job.cancel();
    connection.job = null;
    return cancelJobRequest;
  }

  _query(connection, obj) {
    const queryConfig = {
      ...obj.options,
      query: obj.sql,
      params: obj.bindings,
    };

    return this.createJob(connection, queryConfig)
      .then(connection => this.getJobResults(connection, obj))
      .catch(err => {
        this.cancelJob(connection);
        throw err;
      });
  }

  createJob(connection, queryConfig) {
    return Promise.resolve(
      connection.driver.createQueryJob(queryConfig).then(res => {
        connection.job = res[0];
        return connection;
      }),
    );
  }

  getJobResults(connection, obj) {
    return connection.job.getQueryResults({ autoPaginate: false }).then(res => {
      obj.response = res[0];
      connection.job = null;
      return obj;
    });
  }
}
