const Fs = require('fs-extra');
const Path = require('path');
const Noop = function() {};

/**
 * FileStore constructor
 * @param {Object} options
 * @param {String} options.tmpDir
 * @api public
 */
function FileStore(options) {
  var self = this;
  self.tmpDir = options.tmpDir || Path.join(process.cwd(), 'tmp');

  if (!Fs.existsSync(self.tmpDir)) Fs.mkdirSync(self.tmpDir);

  var cacheFiles = Fs.readdirSync(self.tmpDir);
  self.cache = {};
  cacheFiles.forEach(function(file) {
    file = file.replace('.json', '').replace('_', ':');
    self.cache[file] = true;
  });
}

/**
 * Get entry
 * @param {String} key
 * @param {Function} fn
 * @api public
 */
FileStore.prototype.get = function get(key, fn) {
  var self = this;
  var val = null;
  var data = null;
  var fileKey = key.replace(':', '_');
  var cacheFile = Path.join(self.tmpDir, fileKey + '.json');

  fn = fn || Noop;

  if (Fs.existsSync(cacheFile)) {
    data = Fs.readFileSync(cacheFile);
    data = JSON.parse(data);
  } else {
    return fn(null, null);
  }

  if (!this.cache[key]) {
    return fn(null, null);
  }

  if (!data) return fn(null, data);
  if (data.expire < Date.now()) {
    this.del(key);
    return fn(null, null);
  }

  try {
    val = JSON.parse(data.value);
  } catch (e) {
    return fn(e);
  }

  process.nextTick(function tick() {
    fn(null, val);
  });
};

/**
 * Set an entry.
 * @param {String} key
 * @param {Mixed} val
 * @param {Number} ttl
 * @param {Function} fn
 * @api public
 */
FileStore.prototype.set = function set(key, val, ttl, fn) {
  var data, self = this;

  if (typeof val === 'undefined' || null) return fn(new Error('val not set'));
  if (typeof ttl === 'function') fn = ttl;
  fn = fn || Noop;
  ttl = ttl * 1000 || 60 * 1000;

  try {
    data = {
      value: JSON.stringify(val),
      expire: JSON.stringify(Date.now() + ttl)
    };
  } catch (e) {
    return fn(e);
  }

  var fileKey = key.replace(':', '_');
  var cacheFile = Path.join(self.tmpDir, fileKey + '.json');

  Fs.writeFileSync(cacheFile, JSON.stringify(data, null, 4));

  process.nextTick(function tick() {
    self.cache[key] = data.expire;
    fn(null, val);
  });
};

/**
 * Delete an entry.
 * @param {String} key
 * @param {Function} fn
 * @api public
 */
FileStore.prototype.del = function del(key, fn) {
  var self = this;
  var fileKey = key.replace(':', '_');
  var cacheFile = Path.join(self.tmpDir, fileKey + '.json');

  fn = fn || Noop;

  if (!Fs.existsSync(cacheFile)) {
    self.cache[key] = null;
    return fn();
  }

  try {
    Fs.removeSync(cacheFile);
  } catch (e) {
    return fn(e);
  }

  process.nextTick(function tick() {
    self.cache[key] = null;
    fn(null);
  });
};

/**
 * Clear all cached files
 * @param {String} key
 * @param {Function} fn
 * @api public
 */
FileStore.prototype.clear = function clear(key, fn) {
  var self = this;

  if ('function' === typeof key) {
    fn = key;
    key = null;
  }

  fn = fn || Noop;

  try {
    Fs.removeSync(self.tmpDir);
    Fs.mkdirSync(self.tmpDir);
  } catch (e) {
    return fn(e);
  }

  process.nextTick(function tick() {
    self.cache = {};
    fn(null);
  });
};

module.exports = FileStore;
