import { Pool } from "pg";
import  fs  from "fs";
import path from "path";

// Configuración del pool de conexiones
const sslCertPath = process.env.SSL_CERT_PATH;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT as string, 10),
 //connectionString: process.env.POSTGRE_CONNECTION_STRING,
  ssl: sslCertPath
    ? {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.resolve(sslCertPath)).toString(),
      }
    : false, 
});

// Corrigiendo errores de pool
/*
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT as string, 10),
 //connectionString: process.env.POSTGRE_CONNECTION_STRING,
  ssl: sslCertPath
});


const poolNueva verison = new Pool({
  user: process.env.DB_USER,
 //connectionString: process.env.POSTGRE_CONNECTION_STRING,
  ssl: sslCertPath
});

pool.connect()
  .then(() => console.log('Conexión exitosa con SSL'))
  .catch(err => console.error('Error al conectar con PostgreSQL', err));

// Exportar el pool para usarlo en otros archivos
export default pool;
 */

pool.connect()
  .then(() => console.log('Conexión exitosa con SSL'))
  .catch(err => console.error('Error al conectar con PostgreSQL', err));

// Exportar el pool para usarlo en otros archivos
export default pool;