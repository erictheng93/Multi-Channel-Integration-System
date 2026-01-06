import { Database as BunDatabase } from 'bun:sqlite';

class BunStatement {
  private stmt: any;
  
  constructor(stmt: any) {
    this.stmt = stmt;
  }
  
  run(...params: any[]) {
    const result = this.stmt.run(...params);
    return {
      changes: result.changes ?? 0,
      lastInsertRowid: result.lastInsertRowid ?? 0
    };
  }
  
  get(...params: any[]) {
    return this.stmt.get(...params);
  }
  
  all(...params: any[]) {
    return this.stmt.all(...params);
  }
}

export class BunSQLiteAdapter {
  private db: BunDatabase;
  
  constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean }) {
    const bunOptions = {
      readonly: options?.readonly ?? false,
      create: !(options?.fileMustExist ?? false)
    };
    this.db = new BunDatabase(filename, bunOptions);
  }
  
  prepare(sql: string) {
    return new BunStatement(this.db.prepare(sql));
  }
  
  exec(sql: string) {
    this.db.exec(sql);
    return this;
  }
  
  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      return this.db.transaction(fn)(...args);
    }) as T;
  }
  
  close() {
    this.db.close();
  }
  
  get open() {
    try {
      this.db.prepare('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  
  get name() {
    return this.db.filename;
  }
}

export default BunSQLiteAdapter;
