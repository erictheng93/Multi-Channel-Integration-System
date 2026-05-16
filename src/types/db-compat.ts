export interface DbMutationResult {
  changes?: number;
}

export interface DbQuery<T> extends Promise<T[]> {
  from(table: unknown): DbQuery<T>;
  where(condition: unknown): DbQuery<T>;
  orderBy(...fields: unknown[]): DbQuery<T>;
  limit(limit: number): DbQuery<T>;
  offset(offset: number): DbQuery<T>;
}

export interface DbUpdateQuery {
  set(values: unknown): {
    where(condition: unknown): Promise<DbMutationResult>;
  };
}

export interface DbDeleteQuery {
  where(condition: unknown): Promise<DbMutationResult>;
}

export interface DbInsertQuery {
  values(values: unknown): Promise<DbMutationResult>;
}

export interface DbCompat {
  select<T = Record<string, unknown>>(fields?: unknown): DbQuery<T>;
  insert(table: unknown): DbInsertQuery;
  update(table: unknown): DbUpdateQuery;
  delete(table: unknown): DbDeleteQuery;
  batch(queries: unknown[]): Promise<unknown>;
  get<T = Record<string, unknown> | undefined>(query: unknown): Promise<T>;
}
