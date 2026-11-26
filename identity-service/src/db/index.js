
const postgres = require("postgres").default;
const { drizzle } = require("drizzle-orm/postgres-js");
require("dotenv").config();

const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

const db = drizzle(client);

module.exports = { db, client };
