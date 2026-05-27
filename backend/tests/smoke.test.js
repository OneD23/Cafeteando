const test = require('node:test');
const assert = require('node:assert/strict');

test('auth route module exports a router', () => {
  const authRoutes = require('../src/routes/auth');
  assert.equal(typeof authRoutes, 'function');
  assert.equal(typeof authRoutes.use, 'function');
});

test('database connector is a function', () => {
  const connectDB = require('../src/config/database');
  assert.equal(typeof connectDB, 'function');
});
