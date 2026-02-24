
const fs = require('fs');
const target = 'tests/unit/modules/tags/services/tag-service.test.ts';

const c = \;
fs.writeFileSync(target, c, 'utf8');
console.log('Done');
