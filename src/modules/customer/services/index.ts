// Customer Services 導出
// 統一導出所有客戶服務類

import type { D1Database } from '@cloudflare/workers-types';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import { CustomerSearchService } from '@modules/customer/services/customer-search';
import { CustomerStatsService } from '@modules/customer/services/customer-stats';
import { CustomerTagService } from '@modules/customer/services/customer-tags';

export { CustomerCrudService, CustomerSearchService, CustomerStatsService, CustomerTagService };

// 服務工廠函數 (可選)
export function createCustomerServices(db: D1Database) {
  return {
    crud: new CustomerCrudService(db),
    search: new CustomerSearchService(db),
    stats: new CustomerStatsService(db),
    tags: new CustomerTagService(db)
  };
}