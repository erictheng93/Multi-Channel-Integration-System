# 腳本目錄

此目錄包含多通道平台的實用工具腳本。

## 密碼雜湊生成器

### 使用方法

生成預設密碼 (`admin123`) 的雜湊：
```bash
npm run hash
```

生成指定密碼的雜湊：
```bash
npm run hash mypassword123
```

批量生成多個密碼的雜湊：
```bash
npm run hash:batch
```

### TypeScript 模組

你也可以在 TypeScript 代碼中使用密碼雜湊工具：

```typescript
import { generatePasswordHash, verifyPassword } from '../src/utils/password-hash';

// 生成雜湊
const hash = await generatePasswordHash('mypassword');

// 驗證密碼
const isValid = await verifyPassword('mypassword', hash);
```

### 安全性說明

- 使用 bcrypt 搭配 12 輪鹽值進行強密碼雜湊
- 密碼長度驗證（8-128 字元）
- 適用於認證系統的生產環境使用