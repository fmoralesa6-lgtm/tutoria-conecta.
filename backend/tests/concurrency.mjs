import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
if (!process.env.TEST_DATABASE_URL) throw Error('Define TEST_DATABASE_URL con una base PostgreSQL de pruebas');
const pool = new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
const schema='test_slots_'+randomUUID().replaceAll('-','');
const a=await pool.connect(), b=await pool.connect();
try {
  await a.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await a.query(`CREATE SCHEMA ${schema}`);
  await a.query(`CREATE TABLE ${schema}.slots(user_id uuid NOT NULL,period tstzrange NOT NULL,EXCLUDE USING gist(user_id WITH =,period WITH &&))`);
  const user=randomUUID();
  await a.query('BEGIN');
  await a.query(`INSERT INTO ${schema}.slots VALUES($1,tstzrange('2030-01-01 10:00Z','2030-01-01 11:00Z','[)'))`,[user]);
  await b.query('BEGIN');
  await b.query("SET LOCAL statement_timeout='10s'");
  // Send a competing insert before committing the first transaction.
  const competing=b.query(`INSERT INTO ${schema}.slots VALUES($1,tstzrange('2030-01-01 10:30Z','2030-01-01 11:30Z','[)'))`,[user]).then(()=>null,e=>e);
  await a.query('COMMIT');
  const error=await competing;
  assert.equal(error?.code,'23P01','Una de las dos reservas debe ser rechazada por exclusión');
  await b.query('ROLLBACK');
  await a.query(`INSERT INTO ${schema}.slots VALUES($1,tstzrange('2030-01-01 11:00Z','2030-01-01 12:00Z','[)'))`,[user]);
  assert.equal((await a.query(`SELECT count(*)::int n FROM ${schema}.slots`)).rows[0].n,2);
  console.log('PASS: concurrencia rechazada y horarios adyacentes permitidos.');
} finally {
  await a.query('ROLLBACK').catch(()=>{}); await b.query('ROLLBACK').catch(()=>{});
  await a.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  a.release();b.release();await pool.end();
}
