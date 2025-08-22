// Clear localStorage authentication data
localStorage.removeItem('token');
localStorage.removeItem('refreshToken');
localStorage.removeItem('sessionExpiry');
console.log('✅ Cleared stored authentication data. Please refresh the page and try logging in again.');
