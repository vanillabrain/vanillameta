// import { Knex, knex } from 'knex';
// import { Database } from 'ibm_db';
// import Client = knex.Client;

// const Promise = require('bluebird');
// const Client = require('knex/lib/client');
//
// class DB2Client extends Client {
//   constructor(config) {
//     super(config);
//   }
//
//   get dialect() {
//     return 'ibm_db';
//   }
//
//   get driverName() {
//     return 'ibm_db';
//   }
//
//   get canCancelQuery() {
//     return true;
//   }
//
//   _driver() {
//     return Promise.promisifyAll(require(this.driverName));
//   }
//
//   // transaction() {
//   //   return new Transaction(this, ...arguments);
//   // }
//
//   wrapIdentifierImpl(value) {
//     // override default wrapper ("). we don't want to use it since
//     // it makes identifiers case-sensitive in DB2
//     return value;
//   }
//
//   // printDebug(message) {
//   //   if (process.env.DEBUG === 1) {
//   //     this.logger.log(message);
//   //   }
//   // }
//
//   // Get a raw connection, called by the pool manager whenever a new
//   // connection needs to be added to the pool.
//   acquireRawConnection() {
//     // this.printDebug('acquiring raw connection.');
//     const connectionConfig = this.config.connection;
//     return new Promise((resolve, reject) => {
//       this.driver.open(this._getConnectionString(connectionConfig), (err, connection) => {
//         if (err) {
//           return reject(err);
//         }
//
//         return resolve(connection);
//       });
//     });
//   }
//
//   // Used to explicitly close a connection, called internally by the pool manager
//   // when a connection times out or the pool is shutdown.
//   destroyRawConnection(connection) {
//     // this.printDebug('destroying raw connection');
//
//     return connection.closeAsync();
//   }
//
//   validateConnection(connection) {
//     return Promise.resolve(connection.connected);
//   }
//
//   _stream(connection, obj, stream, options) {
//     this._stream(connection, obj, stream, options);
//     throw new Error('Not yet implemented');
//   }
//
//   _getConnectionString(connectionConfig = {}) {
//     const connectionStringParams = connectionConfig.connectionStringParams || {};
//     const connectionStringExtension = Object.keys(connectionStringParams).reduce((result, key) => {
//       const value = connectionStringParams[key];
//       return `${result}${key}=${value};`;
//     }, '');
//
//     const connectionString = `${
//       `DRIVER=${connectionConfig.driver};SYSTEM=${connectionConfig.host};HOSTNAME=${connectionConfig.host};` +
//       `PORT=${connectionConfig.port};DATABASE=${connectionConfig.database};` +
//       `UID=${connectionConfig.user};PWD=${connectionConfig.password};`
//     }${connectionStringExtension}`;
//
//     return connectionString;
//   }
//
//   // Runs the query on the specified connection, providing the bindings
//   // and any other necessary prep work.
//   _query(connection, obj) {
//     // TODO: verify correctness
//     if (!obj || typeof obj === 'string') obj = { sql: obj };
//
//     const method = (obj.method !== 'raw' ? obj.method : obj.sql.split(' ')[0]).toLowerCase();
//
//     obj.sqlMethod = method;
//
//     // Different functions are used since query() doesn't return # of rows affected,
//     // which is needed for queries that modify the database
//     if (method === 'select' || method === 'first' || method === 'pluck') {
//       return connection.queryAsync(obj.sql, obj.bindings).then(rows => {
//         obj.response = {
//           rows,
//           rowCount: rows.length,
//         };
//
//         return obj;
//       });
//     }
//
//     return connection
//       .prepareAsync(obj.sql)
//       .then(statement => statement.executeNonQueryAsync(obj.bindings))
//       .then(numRowsAffected => {
//         obj.response = {
//           rowCount: numRowsAffected,
//         };
//
//         return obj;
//       });
//   }
//
//   // Process / normalize the response as returned from the query
//   processResponse(obj, runner) {
//     // TODO: verify correctness
//
//     if (obj === null) return null;
//
//     const resp = obj.response;
//     const method = obj.sqlMethod;
//     const { rows } = resp;
//
//     if (obj.output) return obj.output.call(runner, resp);
//
//     switch (method) {
//       case 'select':
//       case 'pluck':
//       case 'first': {
//         if (method === 'pluck') return rows.map(obj.pluck);
//         return method === 'first' ? rows[0] : rows;
//       }
//       case 'insert':
//       case 'del':
//       case 'delete':
//       case 'update':
//       case 'counter':
//         return resp.rowCount;
//       default:
//         return resp;
//     }
//   }
// }
//
// module.exports = { DB2Client };
