#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

# Change to the correct directory
os.chdir('src/stores')

with open('auth.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the code block
old_code = """  // Initialize from localStorage with simplified logic
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('token');
    const expiry = localStorage.getItem('sessionExpiry');

    // Check session validity first
    const isSessionValid = expiry && Date.now() <= parseInt(expiry, 10);

    if (isSessionValid && storedToken) {
      token.value = storedToken;
      refreshToken.value = localStorage.getItem('refreshToken');
      sessionExpiry.value = parseInt(expiry || '0', 10);

      // Restore agent data
      const storedAgent = localStorage.getItem('currentAgent');
      if (storedAgent) {
        try {
          currentAgent.value = JSON.parse(storedAgent);
        } catch {
          clearAuthStorage();
        }
      }
    } else {
      clearAuthStorage();
    }
  }"""

new_code = """  // Initialize from localStorage with JWT validation
  // Fix infinite refresh: Check JWT token validity
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('token');
    const expiry = localStorage.getItem('sessionExpiry');

    // Check session validity first
    const isSessionValid = expiry && Date.now() <= parseInt(expiry, 10);

    if (isSessionValid && storedToken) {
      // Validate JWT token (check format and expiration)
      let isJwtValid = false;
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          // Check required fields
          if (payload.userId && payload.role) {
            // Check JWT expiration
            if (payload.exp) {
              const currentTime = Math.floor(Date.now() / 1000);
              isJwtValid = payload.exp > currentTime;
              if (!isJwtValid) {
                console.warn('[Auth Init] JWT token expired, clearing storage');
              }
            } else {
              // No exp field, assume valid
              isJwtValid = true;
            }
          }
        }
      } catch (e) {
        console.error('[Auth Init] JWT validation failed:', e);
        isJwtValid = false;
      }

      // Only restore token if JWT is valid
      if (isJwtValid) {
        token.value = storedToken;
        refreshToken.value = localStorage.getItem('refreshToken');
        sessionExpiry.value = parseInt(expiry || '0', 10);

        // Restore agent data
        const storedAgent = localStorage.getItem('currentAgent');
        if (storedAgent) {
          try {
            currentAgent.value = JSON.parse(storedAgent);
          } catch {
            clearAuthStorage();
          }
        }
      } else {
        // JWT expired or invalid, clear all data
        clearAuthStorage();
      }
    } else {
      clearAuthStorage();
    }
  }"""

# Replace
new_content = content.replace(old_code, new_code)

if new_content != content:
    with open('auth.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: auth.ts modified")
    sys.exit(0)
else:
    print("WARNING: No matching code block found")
    sys.exit(1)
