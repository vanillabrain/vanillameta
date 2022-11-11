export const getDatabaseIcon = type => {
  let iconUrl = null;
  switch (type) {
    case 'mysql':
      iconUrl = 'logo/mysql-logo.svg';
      break;
    case 'maria':
      iconUrl = 'logo/mariadb-logo.svg';
      break;
    case 'postgres':
      iconUrl = 'logo/pgsql-logo.svg';
      break;
    case 'oracle':
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
    case 'sqlite':
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
    case 'cockroachDB':
      iconUrl = 'logo/cockroachdb-logo.svg';
      break;
    case 'postGIS':
      iconUrl = 'logo/postgis-logo.svg';
      break;
  }
  return iconUrl;
};
