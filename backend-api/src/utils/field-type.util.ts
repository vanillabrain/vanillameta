import { convert, DateTimeFormatter, LocalDate, LocalDateTime } from 'js-joda';

export class FieldTypeUtil {
  private static FIELD_TYPE_NUMBER = 'number';
  private static FIELD_TYPE_STRING = 'string';
  private static FIELD_TYPE_DATE = 'date';

  static mysqlFieldType(fieldType: string): string {
    switch (+fieldType) {
      case 0: //'DECIMAL', // aka DECIMAL
      case 1: //'TINY', // aka TINYINT, 1 byte
      case 2: //'SHORT', // aka SMALLINT, 2 bytes
      case 3: //'LONG', // aka INT, 4 bytes
      case 4: //'FLOAT', // aka FLOAT, 4-8 bytes
      case 5: //'DOUBLE', // aka DOUBLE, 8 bytes
      case 8: //'LONGLONG', // aka BIGINT, 8 bytes
      case 9: //'INT24', // aka MEDIUMINT, 3 bytes
      case 16: //'BIT', // aka BIT, 1-8 byte
      case 246:
        return this.FIELD_TYPE_NUMBER; //'NEWDECIMAL', // aka DECIMAL
      case 7: //'TIMESTAMP', // aka TIMESTAMP
      case 10: //'DATE', // aka DATE
      case 11: //'TIME', // aka TIME
      case 12: //'DATETIME', // aka DATETIME
      case 13: //'YEAR', // aka YEAR, 1 byte (don't ask)
      case 14:
        return this.FIELD_TYPE_DATE; //'NEWDATE', // aka ?
      case 6: // NULL (used for prepared statements, I think)
      case 15: //'VARCHAR', // aka VARCHAR (?)
      case 245: //'JSON',
      case 247: //'ENUM', // aka ENUM
      case 248: //'SET', // aka SET
      case 249: //'TINY_BLOB', // aka TINYBLOB, TINYTEXT
      case 250: //'MEDIUM_BLOB', // aka MEDIUMBLOB, MEDIUMTEXT
      case 251: //'LONG_BLOB', // aka LONGBLOG, LONGTEXT
      case 252: //'BLOB', // aka BLOB, TEXT
      case 253: //'VAR_STRING', // aka VARCHAR, VARBINARY
      case 254: //'STRING', // aka CHAR, BINARY
      case 255:
        return this.FIELD_TYPE_STRING; //'GEOMETRY' // aka GEOMETRY
      default:
        return this.FIELD_TYPE_STRING;
    }
  }

  static FieldType(fieldType: any[]): string {

      switch (typeof(fieldType[0])) {
        case 'string':
          const stringList = fieldType.filter(el => typeof(el) === 'string')
          return stringList.length === fieldType.length ? this.FIELD_TYPE_STRING : this.FIELD_TYPE_NUMBER
              break;
        case 'number':
          const numberList = fieldType.filter(el => typeof(el) === 'number')
          return numberList.length === fieldType.length ? this.FIELD_TYPE_NUMBER : this.FIELD_TYPE_STRING
              break;

        case 'object':
          const objectList = fieldType.filter(el => typeof(el) === 'object')
          return objectList.length === fieldType.length ? this.FIELD_TYPE_DATE : this.FIELD_TYPE_STRING
              break;
      }






  }
}
