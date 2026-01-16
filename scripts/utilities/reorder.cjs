const fs = require('fs');
const lines = fs.readFileSync('src/modules/customer/handlers/index.ts.backup', 'utf8').split('\n');

// Helper: Get lines from line numbers (1-indexed, inclusive)
const getLines = (start, end) => lines.slice(start-1, end).join('\n');

// Header (lines 1-97)
const header = getLines(1, 97);

// Priority 1: Static routes
const p1 = [
  '',
  '// ======================== PRIORITY 1: STATIC 路由 ========================',
  '// 靜態路徑路由 - 必須在任何參數化路由之前註冊',
  '',
  getLines(220, 229), // find-or-create
  '',
  getLines(246, 255), // search  
  '',
  getLines(257, 268), // advanced-search
  '',
  getLines(270, 278), // search/suggestions
  '',
  getLines(282, 291), // stats
  '',
  getLines(293, 302), // stats/platform-distribution
  '',
  getLines(304, 313), // stats/team-distribution
  '',
  getLines(315, 324), // stats/activity
  '',
  getLines(326, 335), // stats/growth
  '',
  getLines(393, 401), // tags/available
  '',
  getLines(403, 412), // tags/usage-stats
  '',
  getLines(414, 422), // find-by-tags
  '',
  getLines(424, 432), // without-tags
  '',
  getLines(436, 445), // batch/basic
  '',
  getLines(447, 456)  // batch/tags
].join('\n');

// Priority 2: Multi-segment routes
const p2 = [
  '',
  '// ======================== PRIORITY 2: MULTI-SEGMENT 參數化路由 ========================',
  '// 多段參數路由 - 必須在單段參數路由之前註冊',
  '',
  getLines(190, 198), // platform/:platform/:platformUserId
  '',
  getLines(200, 208), // OPTIONS platform
  '',
  getLines(210, 218), // platform/exists
  '',
  getLines(125, 135), // :id/basic
  '',
  getLines(176, 186), // :id/exists
  '',
  getLines(339, 349), // :id/tags GET
  '',
  getLines(351, 363), // :id/tags POST
  '',
  getLines(365, 377), // :id/tags DELETE
  '',
  getLines(379, 391)  // :id/tags PUT
].join('\n');

// Priority 3: Single param routes
const p3 = [
  '',
  '// ======================== PRIORITY 3: SINGLE PARAM 路由 ========================',
  '// 單段參數路由 - 必須在通配符路由之前註冊',
  '',
  getLines(113, 123), // GET :id
  '',
  getLines(137, 149), // PUT :id
  '',
  getLines(151, 162), // DELETE :id
  '',
  getLines(164, 174)  // OPTIONS :id
].join('\n');

// Priority 4: Wildcard routes
const p4 = [
  '',
  '// ======================== PRIORITY 4: WILDCARD 路由 ========================',
  '// 通配符路由 - 必須最後註冊，避免攔截其他路由',
  '',
  getLines(101, 111), // POST /
  '',
  getLines(233, 244)  // GET /
].join('\n');

// Footer (exports)
const footer = '\n\n' + getLines(458, 466);

const result = header + p1 + p2 + p3 + p4 + footer;
fs.writeFileSync('src/modules/customer/handlers/index.ts', result, 'utf8');
console.log('✓ File reorganized successfully');
console.log('  Total lines:', result.split('\n').length);
