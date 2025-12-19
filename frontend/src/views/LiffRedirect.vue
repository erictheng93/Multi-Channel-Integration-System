<template>
  <div class="liff-container">
    <div class="liff-card">
      <!-- Loading State -->
      <div v-if="state === 'loading'" class="liff-loading">
        <div class="spinner"></div>
        <p>正在處理中...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="state === 'success'" class="liff-success">
        <div class="success-icon">✓</div>
        <h2>加入成功！</h2>
        <p>您已成功加入客服團隊</p>
        <p class="team-name" v-if="teamName">{{ teamName }}</p>
        <button @click="closeLiff" class="btn-primary">關閉</button>
      </div>

      <!-- Error State -->
      <div v-else-if="state === 'error'" class="liff-error">
        <div class="error-icon">✕</div>
        <h2>發生錯誤</h2>
        <p>{{ errorMessage }}</p>
        <button @click="retry" class="btn-secondary">重試</button>
      </div>

      <!-- Not in LINE State -->
      <div v-else-if="state === 'not-in-line'" class="liff-not-in-line">
        <div class="line-icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path fill="#06C755" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
        </div>
        <h2>請使用 LINE 開啟</h2>
        <p>請在 LINE 應用程式中掃描 QR Code</p>
        <a :href="lineAddFriendUrl" class="btn-line">在 LINE 中開啟</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

// LIFF SDK 類型
declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
      isInClient: () => boolean;
      closeWindow: () => void;
      getAccessToken: () => string | null;
    };
  }
}

type LiffState = 'loading' | 'success' | 'error' | 'not-in-line';

const route = useRoute();
const state = ref<LiffState>('loading');
const errorMessage = ref('');
const teamName = ref('');
const lineAddFriendUrl = ref('');

// 從環境變數或配置獲取
const LIFF_ID = import.meta.env.VITE_LIFF_ID || '';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

onMounted(async () => {
  await initLiff();
});

async function initLiff() {
  const token = route.query.token as string;
  
  if (!token) {
    state.value = 'error';
    errorMessage.value = '無效的連結，缺少追蹤參數';
    return;
  }

  // 先驗證 token 並獲取團隊資訊
  try {
    const verifyResponse = await fetch(`${API_BASE_URL}/api/liff/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      state.value = 'error';
      errorMessage.value = error.message || 'QR Code 已失效或不存在';
      return;
    }

    const tokenData = await verifyResponse.json();
    teamName.value = tokenData.teamName || '';
    lineAddFriendUrl.value = tokenData.lineUrl || '';
  } catch (err) {
    console.error('Token verification failed:', err);
    state.value = 'error';
    errorMessage.value = '無法驗證 QR Code，請稍後再試';
    return;
  }

  // 載入 LIFF SDK
  if (!window.liff) {
    await loadLiffSdk();
  }

  try {
    await window.liff.init({ liffId: LIFF_ID });

    // 檢查是否在 LINE 內開啟
    if (!window.liff.isInClient()) {
      state.value = 'not-in-line';
      return;
    }

    // 檢查登入狀態
    if (!window.liff.isLoggedIn()) {
      window.liff.login({ redirectUri: window.location.href });
      return;
    }

    // 獲取用戶資料
    const profile = await window.liff.getProfile();
    const accessToken = window.liff.getAccessToken();

    // 發送到後端完成團隊綁定
    await bindUserToTeam(token, profile, accessToken);

  } catch (err) {
    console.error('LIFF initialization failed:', err);
    state.value = 'error';
    errorMessage.value = '初始化失敗，請稍後再試';
  }
}

async function loadLiffSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load LIFF SDK'));
    document.head.appendChild(script);
  });
}

async function bindUserToTeam(
  token: string,
  profile: { userId: string; displayName: string; pictureUrl?: string },
  accessToken: string | null
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/liff/bind-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        accessToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '綁定失敗');
    }

    const result = await response.json();
    teamName.value = result.teamName || teamName.value;
    state.value = 'success';

  } catch (err) {
    console.error('Bind to team failed:', err);
    state.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : '綁定失敗，請稍後再試';
  }
}

function closeLiff() {
  if (window.liff?.isInClient()) {
    window.liff.closeWindow();
  } else {
    window.close();
  }
}

function retry() {
  state.value = 'loading';
  initLiff();
}
</script>

<style scoped>
.liff-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #06C755 0%, #00B900 100%);
  padding: 20px;
}

.liff-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.liff-loading {
  padding: 20px 0;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #06C755;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #06C755;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  font-size: 32px;
  font-weight: bold;
}

.error-icon {
  width: 64px;
  height: 64px;
  background: #ff4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  font-size: 32px;
  font-weight: bold;
}

.line-icon {
  margin-bottom: 20px;
}

h2 {
  margin: 0 0 12px;
  font-size: 24px;
  color: #333;
}

p {
  margin: 0 0 8px;
  color: #666;
  font-size: 14px;
}

.team-name {
  font-weight: 600;
  color: #06C755;
  font-size: 16px;
  margin-top: 12px;
}

.btn-primary {
  background: #06C755;
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #05a847;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e8e8e8;
}

.btn-line {
  display: inline-block;
  background: #06C755;
  color: white;
  text-decoration: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 20px;
  transition: background 0.2s;
}

.btn-line:hover {
  background: #05a847;
}
</style>
