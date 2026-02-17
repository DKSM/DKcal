const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

function getUserDir(userId = 'default') {
  return path.join(__dirname, '..', '..', 'data', 'users', userId);
}

async function readJSON(filePath, defaultValue = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    if (err instanceof SyntaxError) {
      console.error(`[storage] Corrupt JSON at ${filePath}, returning default`);
      return defaultValue;
    }
    throw err;
  }
}

async function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

// Items
function itemsPath(userId = 'default') {
  return path.join(getUserDir(userId), 'items.json');
}

async function readItems(userId = 'default') {
  return readJSON(itemsPath(userId), []);
}

async function writeItems(userId = 'default', items) {
  return writeJSON(itemsPath(userId), items);
}

// Days
function dayPath(userId = 'default', dateStr) {
  return path.join(getUserDir(userId), 'days', `${dateStr}.json`);
}

async function readDay(userId = 'default', dateStr) {
  return readJSON(dayPath(userId, dateStr), {
    date: dateStr,
    weight: null,
    entries: [],
    totals: { kcal: 0, protein: 0 },
  });
}

async function writeDay(userId = 'default', dateStr, dayData) {
  return writeJSON(dayPath(userId, dateStr), dayData);
}

// Profile
function profilePath(userId = 'default') {
  return path.join(getUserDir(userId), 'profile.json');
}

async function readProfile(userId = 'default') {
  return readJSON(profilePath(userId), { name: 'default' });
}

async function writeProfile(userId = 'default', profile) {
  return writeJSON(profilePath(userId), profile);
}

// Accounts
function accountsPath() {
  return path.join(__dirname, '..', '..', 'data', 'accounts.json');
}

async function readAccounts() {
  return readJSON(accountsPath(), []);
}

async function writeAccounts(accounts) {
  return writeJSON(accountsPath(), accounts);
}

// List day files
async function listDayDates(userId = 'default') {
  const daysDir = path.join(getUserDir(userId), 'days');
  try {
    const files = await fs.readdir(daysDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Admins list
async function readAdmins() {
  const filePath = path.join(__dirname, '..', '..', 'data', 'admins.txt');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = {
  readJSON,
  writeJSON,
  getUserDir,
  readItems,
  writeItems,
  readDay,
  writeDay,
  readProfile,
  writeProfile,
  listDayDates,
  readAccounts,
  writeAccounts,
  readAdmins,
};
