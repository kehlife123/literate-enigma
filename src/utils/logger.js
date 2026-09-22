'use strict';

function tag(scope) {
  return `[${scope}]`;
}

module.exports = {
  info: (scope, ...args) => console.log(tag(scope), ...args),
  warn: (scope, ...args) => console.warn(tag(scope), ...args),
  error: (scope, ...args) => console.error(tag(scope), ...args),
};
