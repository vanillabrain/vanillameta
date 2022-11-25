// import Transaction from 'knex/lib/execution/transaction';
//
// class TransactionDb2 extends Transaction {
//   begin(conn) {
//     return conn.beginTransactionAsync().then(this._resolver).catch(this._rejecter);
//   }
//
//   commit(conn, value) {
//     this._completed = true;
//     return conn
//       .commitTransactionAsync()
//       .then(() => this._resolver(value))
//       .catch(this._rejecter);
//   }
// }
//
// module.exports = TransactionDb2;
