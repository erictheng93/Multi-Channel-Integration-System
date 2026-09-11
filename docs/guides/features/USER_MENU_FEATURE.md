

### 1.
 `AppLayout.vue`

- ****
- ****
- ****/

### 2.


- ****
- ****
- ****
- ****

### 3.

#### /
-
-
-


-
-
 1. API
 2.
 3.
 4.


-
-


- ****
- ****/
- ****
- ****


- **ChevronUpIcon**
- **UserIcon**
- **KeyIcon**
- **LogoutIcon**


```vue
<div class="user-profile" @click="toggleUserMenu()">
 <div class="user-avatar">{{ userInitials }}</div>
 <div class="user-info">
 <div class="user-name">{{ authStore.currentAgent?.name }}</div>
 <div class="user-role">{{ authStore.currentAgent?.role }}</div>
 </div>
 <button class="user-menu-btn">
 <ChevronUpIcon :class="{ 'rotated': showUserMenu }" />
 </button>
</div>

<div v-if="showUserMenu" class="user-menu">
 <div class="user-menu-item" @click="viewProfile"></div>
 <div class="user-menu-item" @click="changePassword"></div>
 <div class="user-menu-divider"></div>
 <div class="user-menu-item logout" @click="handleLogout"></div>
</div>
```


```typescript
const showUserMenu = ref(false)

const toggleUserMenu = () => {
 showUserMenu.value = !showUserMenu.value
}

const handleLogout = async () => {
 if (confirm('')) {
 await authStore.logout()
 }
}
```


- **** `document.addEventListener('click', handleClickOutside)`
- **** `@click.stop`


1.
2.
3.
4.


- ****admin@dacit.net / <ADMIN_PASSWORD>
- ****dacagent@dacit.net / <AGENT_PASSWORD>


### 1.
-
-
-

### 2.
-
-
-

### 3.
- `confirm()`
-


- API token
-
-
-


-
-
- 