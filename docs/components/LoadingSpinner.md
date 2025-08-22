# LoadingSpinner 載入動畫組件

一個可重用的載入動畫組件，支援自訂尺寸、變體和可選文字。

## 屬性 (Props)

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | 動畫尺寸 |
| `variant` | `'primary' \| 'secondary' \| 'white'` | `'primary'` | 動畫顏色變體 |
| `text` | `string` | `''` | 在動畫下方顯示的可選文字 |

## 使用方法

### 基本用法
```vue
<template>
  <LoadingSpinner />
</template>
```

### 自訂尺寸和變體
```vue
<template>
  <LoadingSpinner 
    size="lg" 
    variant="secondary" 
  />
</template>
```

### 帶載入文字
```vue
<template>
  <LoadingSpinner 
    size="md" 
    variant="primary" 
    text="載入資料中..." 
  />
</template>
```

### 在按鈕中使用（常見模式）
```vue
<template>
  <button 
    type="submit" 
    :disabled="loading"
  >
    <LoadingSpinner
      v-if="loading"
      size="sm"
      variant="white"
    />
    <span v-else>提交</span>
  </button>
</template>
```

## 尺寸規格

- `xs`: 12px × 12px（1px 邊框）
- `sm`: 16px × 16px（2px 邊框）
- `md`: 24px × 24px（2px 邊框）- 預設
- `lg`: 32px × 32px（3px 邊框）

## 變體樣式

- `primary`: 藍色動畫，灰色背景
- `secondary`: 灰色動畫，淺灰色背景
- `white`: 白色動畫，透明背景（適用於深色背景）

## 無障礙設計

組件包含多項無障礙功能：

- **動作偏好設定**：尊重使用者的 `prefers-reduced-motion` 設定。當偏好減少動作時，動畫會被停用並替換為靜態沙漏表情符號（⏳）
- **螢幕閱讀器支援**：當提供 `text` 屬性時，會顯示為螢幕閱讀器可讀的文字
- **語義結構**：使用適當的 HTML 結構和有意義的類別名稱

## 最新變更

### v2.1.0 (2025-01-08)
- 為 `text` 屬性新增預設空字串值以改善類型安全性
- 為保持一致性進行了小幅模板格式改進
- **無障礙增強**：新增 `prefers-reduced-motion` 支援，並提供沙漏表情符號作為後備
- 新增無障礙功能的完整測試覆蓋
- 所有現有功能保持不變