// 對話管理頁面診斷腳本
// 在瀏覽器 Console 中運行此腳本來診斷問題

(function() {
    console.log('🔍 開始診斷對話管理頁面問題...\n');
    
    // 1. 檢查 URL 和路由
    console.group('📍 URL 和路由狀態');
    console.log('當前 URL:', window.location.href);
    console.log('路徑:', window.location.pathname);
    console.log('Hash:', window.location.hash);
    console.groupEnd();
    
    // 2. 檢查 localStorage
    console.group('💾 LocalStorage 狀態');
    const token = localStorage.getItem('token');
    const currentAgent = localStorage.getItem('currentAgent');
    const sessionStatus = localStorage.getItem('sessionStatus');
    
    console.log('Token 存在:', !!token);
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            const exp = new Date(payload.exp * 1000);
            console.log('Token 過期時間:', exp);
            console.log('Token 已過期:', exp < new Date());
        } catch {
            console.error('Token 解析失敗');
        }
    }
    
    console.log('Current Agent 存在:', !!currentAgent);
    if (currentAgent) {
        try {
            console.log('Current Agent:', JSON.parse(currentAgent));
        } catch {
            console.log('Current Agent (raw):', currentAgent);
        }
    }
    
    console.log('Session Status:', sessionStatus);
    console.groupEnd();
    
    // 3. 檢查 Vue 應用狀態
    console.group('🔧 Vue 應用狀態');
    const app = document.querySelector('#app');
    if (app && app.__vue_app__) {
        const vueApp = app.__vue_app__;
        console.log('Vue 應用已掛載: ✅');
        
        // 嘗試獲取 Pinia stores
        try {
            const pinia = vueApp.config.globalProperties.$pinia;
            if (pinia) {
                console.log('Pinia 已初始化: ✅');
                const stores = pinia._s;
                console.log('已註冊的 Stores:', Array.from(stores.keys()));
                
                // 檢查 auth store
                const authStore = stores.get('auth');
                if (authStore) {
                    console.log('Auth Store 狀態:', {
                        isAuthenticated: authStore.isAuthenticated,
                        sessionStatus: authStore.sessionStatus,
                        hasToken: !!authStore.token,
                        hasCurrentAgent: !!authStore.currentAgent,
                        error: authStore.error
                    });
                }
                
                // 檢查 conversations store
                const conversationsStore = stores.get('conversations');
                if (conversationsStore) {
                    console.log('Conversations Store 狀態:', {
                        loading: conversationsStore.loading,
                        conversationsCount: conversationsStore.conversations?.length || 0,
                        error: conversationsStore.error
                    });
                }
            } else {
                console.log('Pinia 未找到: ❌');
            }
        } catch {
            console.error('無法訪問 Pinia stores');
        }
        
        // 檢查路由
        const router = vueApp.config.globalProperties.$router;
        if (router) {
            console.log('當前路由:', router.currentRoute.value);
        }
    } else {
        console.log('Vue 應用未找到或未掛載: ❌');
    }
    console.groupEnd();
    
    // 4. 檢查 DOM 元素
    console.group('📄 DOM 檢查');
    console.log('App 容器存在:', !!document.querySelector('#app'));
    console.log('App 容器內容長度:', document.querySelector('#app')?.innerHTML.length || 0);
    
    // 檢查是否有錯誤邊界或白屏
    const appContent = document.querySelector('#app')?.innerHTML || '';
    if (appContent.length < 100) {
        console.warn('⚠️ App 容器內容很少，可能是白屏！');
    }
    
    // 檢查是否有錯誤訊息
    const errorElements = document.querySelectorAll('.error, .error-boundary, [class*="error"]');
    console.log('錯誤相關元素數量:', errorElements.length);
    if (errorElements.length > 0) {
        console.log('錯誤元素:', errorElements);
    }
    console.groupEnd();
    
    // 5. 檢查網絡請求
    console.group('🌐 最近的 API 請求');
    // 攔截 fetch 來記錄請求
    const originalFetch = window.fetch;
    const recentRequests = [];
    
    window.fetch = function(...args) {
        const url = args[0];
        console.log('API 請求:', url);
        recentRequests.push(url);
        return originalFetch.apply(this, args)
            .then(response => {
                console.log(`響應 ${url}:`, response.status, response.statusText);
                return response;
            })
            .catch(error => {
                console.error(`請求失敗 ${url}:`, error);
                throw error;
            });
    };
    
    console.log('已開始監控 API 請求');
    console.groupEnd();
    
    // 6. 提供修復建議
    console.group('💡 診斷結果和建議');
    
    const issues = [];
    
    if (!token) {
        issues.push('沒有找到認證 Token - 需要重新登入');
    }
    
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = new Date(payload.exp * 1000);
            if (exp < new Date()) {
                issues.push('Token 已過期 - 需要重新登入');
            }
        } catch {
            issues.push('Token 格式無效 - 需要重新登入');
        }
    }
    
    if (!app || !app.__vue_app__) {
        issues.push('Vue 應用未正確掛載 - 可能是 JavaScript 錯誤');
    }
    
    if (appContent.length < 100) {
        issues.push('頁面內容過少 - 可能是渲染錯誤或路由問題');
    }
    
    if (issues.length > 0) {
        console.warn('發現以下問題:');
        issues.forEach((issue, index) => {
            console.warn(`${index + 1}. ${issue}`);
        });
    } else {
        console.log('✅ 未發現明顯問題');
    }
    
    console.groupEnd();
    
    // 7. 手動觸發數據載入
    console.group('🔄 嘗試手動修復');
    console.log('嘗試手動觸發對話列表載入...');
    
    // 嘗試直接調用 API
    if (token) {
        fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            console.log('手動 API 調用響應:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('對話數據:', data);
        })
        .catch(error => {
            console.error('手動 API 調用失敗:', error);
        });
    }
    
    console.groupEnd();
    
    console.log('\n🏁 診斷完成！請將以上信息提供給開發者。');
    console.log('💡 提示: 可以訪問 /conversations-debug 頁面獲得更詳細的調試信息');
})();