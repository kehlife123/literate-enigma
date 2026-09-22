'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal, dependency-free JSON file store.
 * - No database. Two flat files: config.json and strikes.json.
 * - Writes are atomic (write to a temp file, then rename) so a crash or a
 *   Railway redeploy mid-write can never leave a half-written, corrupt file.
 * - Reads happen once at startup; after that everything is kept in memory
 *   and only flushed to disk on change, so the panel feels instant.
 */
class JsonStore {
  /**
   * @param {string} filePath Absolute path to the JSON file on disk.
   * @param {object} defaults Default shape used when the file doesn't exist yet.
   */
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      // Shallow-merge so new default keys added in future updates show up
      // for existing installs without wiping what the owner already set.
      return { ...structuredClone(this.defaults), ...parsed };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[store] Failed to read ${this.filePath}, falling back to defaults:`, err.message);
      }
      return structuredClone(this.defaults);
    }
  }

  /** Persist the current in-memory state to disk atomically. */
  save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  get() {
    return this.data;
  }

  /**
   * Merge a partial update into the store and persist it immediately.
   * @param {object|Function} patch Object to shallow-merge, or a function
   *   that receives the current data and mutates/returns the new data.
   */
  update(patch) {
    if (typeof patch === 'function') {
      const result = patch(this.data);
      this.data = result !== undefined ? result : this.data;
    } else {
      this.data = { ...this.data, ...patch };
    }
    this.save();
    return this.data;
  }
}

module.exports = { JsonStore };
