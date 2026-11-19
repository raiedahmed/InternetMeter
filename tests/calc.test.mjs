import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleBounds, computeStats, isNightHour, dateKey, GB } from '../shared/calc.mjs';

test('isNightHour handles normal and midnight-spanning windows', () => {
  // Window: 2 AM to 8 AM
  assert.equal(isNightHour(1, 2, 8), false);
  assert.equal(isNightHour(2, 2, 8), true);
  assert.equal(isNightHour(7, 2, 8), true);
  assert.equal(isNightHour(8, 2, 8), false);

  // Midnight-spanning window: 23 (11 PM) to 6 AM
  assert.equal(isNightHour(23, 23, 6), true);
  assert.equal(isNightHour(3, 23, 6), true);
  assert.equal(isNightHour(6, 23, 6), false);
  assert.equal(isNightHour(12, 23, 6), false);
});

test('cycleBounds accurately computes start and next dates', () => {
  // Fixed date: May 15, 2026, cycle renews on day 1
  const now = new Date(2026, 4, 15);
  const bounds = cycleBounds(1, now);
  assert.equal(bounds.start.getFullYear(), 2026);
  assert.equal(bounds.start.getMonth(), 4); // May
  assert.equal(bounds.start.getDate(), 1);

  assert.equal(bounds.next.getFullYear(), 2026);
  assert.equal(bounds.next.getMonth(), 5); // June
  assert.equal(bounds.next.getDate(), 1);
});

test('cycleBounds handles mid-cycle renewal day after today', () => {
  // Today is May 10, renewal day is 20 -> cycle started April 20, ends May 20
  const now = new Date(2026, 4, 10);
  const bounds = cycleBounds(20, now);
  assert.equal(bounds.start.getMonth(), 3); // April
  assert.equal(bounds.start.getDate(), 20);
  assert.equal(bounds.next.getMonth(), 4); // May
  assert.equal(bounds.next.getDate(), 20);
});

test('cycleBounds clamps day 31 for shorter months', () => {
  // Today is March 5, cycle day is 31 -> Previous month is February (28 days)
  const now = new Date(2026, 2, 5);
  const bounds = cycleBounds(31, now);
  assert.equal(bounds.start.getMonth(), 1); // February
  assert.equal(bounds.start.getDate(), 28); // Clamped to 28
});

test('computeStats correctly calculates quota, remaining, and safe daily allowance', () => {
  const settings = {
    quotaGB: 100,
    cycleDay: 1,
    alerts: [50, 80, 95],
    autoStart: false,
    configured: true,
  };

  const now = new Date(2026, 4, 11); // Day 11 of 31 days cycle
  const daily = {
    '2026-05-01': { d: 2 * GB, u: 0.5 * GB },
    '2026-05-02': { d: 3 * GB, u: 0.5 * GB },
    '2026-05-11': { d: 1 * GB, u: 0.2 * GB },
  };

  const stats = computeStats(settings, daily, now);

  assert.equal(stats.quota, 100 * GB);
  assert.equal(stats.used, 7.2 * GB);
  assert.equal(stats.remaining, 92.8 * GB);
  assert.ok(stats.daysLeft > 0);
  assert.ok(stats.dailySafe > 0);
  assert.equal(stats.status, 'ok');
});

test('computeStats excludes free night hours when nightEnabled and !nightDeduct', () => {
  const settings = {
    quotaGB: 100,
    cycleDay: 1,
    alerts: [50, 80],
    autoStart: false,
    configured: true,
    nightEnabled: true,
    nightStart: 2,
    nightEnd: 8,
    nightDeduct: false, // Free hours
  };

  const now = new Date(2026, 4, 2);
  const h = new Array(24).fill(0);
  h[3] = 5 * GB; // 5 GB downloaded at 3:00 AM (night)
  h[14] = 2 * GB; // 2 GB downloaded at 2:00 PM (day)

  const daily = {
    '2026-05-01': { d: 7 * GB, u: 0, h },
  };

  const stats = computeStats(settings, daily, now);

  assert.equal(stats.nightUsed, 5 * GB);
  // Main quota should only count the 2 GB daytime download!
  assert.equal(stats.used, 2 * GB);
  assert.equal(stats.remaining, 98 * GB);
});

test('computeStats calculates financial metrics accurately', () => {
  const settings = {
    quotaGB: 200,
    cycleDay: 1,
    alerts: [80],
    autoStart: false,
    configured: true,
    cost: 300,
    currency: 'EGP',
  };

  const now = new Date(2026, 4, 1);
  const daily = {
    '2026-05-01': { d: 10 * GB, u: 0 },
  };

  const stats = computeStats(settings, daily, now);

  assert.equal(stats.costPerGB, 1.5); // 300 / 200 = 1.5 EGP per GB
  assert.equal(stats.todayCost, 15); // 10 GB * 1.5 = 15 EGP
});
