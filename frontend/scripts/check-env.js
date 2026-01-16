// 檢查環境變數配置
console.log('=== 環境變數檢查 ===');
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('Mode:', import.meta.env.MODE);
console.log('DEV:', import.meta.env.DEV);
console.log('All env vars:', import.meta.env);