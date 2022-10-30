export const getDatabaseIcon = type => {
  let iconUrl = null;
  switch (type) {
    case 'mysql2':
      iconUrl = 'logo/mysql-logo.svg';
      break;
    case 'maria':
      iconUrl = 'logo/mariadb-logo.svg';
      break;
    case 'pg':
      iconUrl = 'logo/pgsql-logo.svg';
      break;
    case 'oracledb':
      iconUrl = 'logo/oracle-logo.svg';
      break;
    case 'db2':
      iconUrl = 'logo/db2-logo.svg';
      break;
    case 'redshift':
      iconUrl = 'logo/redshift-logo.svg';
      break;
    case 'bigquery':
      iconUrl = 'logo/bigquery-logo.svg';
      break;
    case 'sqlite3':
      iconUrl = 'logo/sqlite-logo.svg';
      break;
    case 'mssql':
      iconUrl = 'logo/mssql-logo.svg';
      break;
    case 'snowflake':
      iconUrl = 'logo/snowflake-logo.svg';
      break;
    case 'aurora':
      iconUrl = 'logo/aurora-logo.svg';
      break;
  }
  return iconUrl;
};
