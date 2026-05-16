/**
 * 簡單的資料庫檢視工具
 * 使用方式: npm run db:view
 */

interface TableInfo {
  name: string;
  sql: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

// 模擬 Cloudflare D1 環境
const mockEnv = {
  DB: {
    prepare: (query: string) => ({
      all: async () => {
        console.log(`執行查詢: ${query}`);
        return { results: [] };
      },
      first: async () => {
        console.log(`執行查詢: ${query}`);
        return null;
      }
    })
  }
};

async function listTables() {
  const query = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
  const result = await mockEnv.DB.prepare(query).all();
  return result.results as TableInfo[];
}

async function getTableSchema(tableName: string) {
  const query = `PRAGMA table_info(${tableName})`;
  const result = await mockEnv.DB.prepare(query).all();
  return result.results as ColumnInfo[];
}

async function getTableData(tableName: string, limit: number = 10) {
  const query = `SELECT * FROM ${tableName} LIMIT ${limit}`;
  const result = await mockEnv.DB.prepare(query).all();
  return result.results;
}

async function main() {
  console.log('=== 資料庫檢視工具 ===\n');
  
  try {
    const tables = await listTables();
    
    if (tables.length === 0) {
      console.log('沒有找到任何資料表');
      return;
    }
    
    console.log('資料表列表:');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.name}`);
    });
    
    console.log('\n詳細資訊:');
    
    for (const table of tables) {
      console.log(`\n--- ${table.name} ---`);
      
      // 顯示結構
      const schema = await getTableSchema(table.name);
      console.log('欄位:');
      schema.forEach(col => {
        const pk = col.pk ? ' (PK)' : '';
        const nullable = col.notnull ? ' NOT NULL' : '';
        console.log(`  - ${col.name}: ${col.type}${nullable}${pk}`);
      });
      
      // 顯示範例資料
      const data = await getTableData(table.name, 3);
      if (data.length > 0) {
        console.log('範例資料:');
        console.table(data);
      } else {
        console.log('  (無資料)');
      }
    }
    
  } catch (error) {
    console.error('錯誤:', error);
  }
}

if (require.main === module) {
  main();
}
