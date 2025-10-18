
****: 2025-08-07
****: 17:10-17:12
****: **71.4% ** -

---


### DOM

### - `frontend/`
```
: 285
 : 265 (93.0%)
 : 20 (7.0%)
 : 19 (18 , 1 )
 : 2.70
 : 0 DOM (!)
```

****: +5.5% (87.5% 93.0%)

### - `tests/`
```
: 902
 : 581 (64.4%)
 : 321 (35.6%)
 : 58 (24 , 34 )
 : ~18
 :
```

### +
```
: 1,187
 : 846 (71.3%)
 : 341 (28.7%)
 : 77 (42 , 35 )
 : DOM !
```

---


### 1. DOM

****: 33 (12.5% )
****: `TypeError: SupportedEventInterface is not a constructor`

****:
- `MessageInput.test.ts` - 25 (75.8% )
- `ConversationCard.test.ts` - 1
- `MessageBubble.test.ts` - 2
- `EmptyState.test.ts` - 1
- `PlatformBadge.test.ts` - 2
- `StatusBadge.test.ts` - 2

****: Vue Test Utils JSDOM

### 2.

****: 8
****:

****:
```
Expected: ""
Received: "Failed to fetch conversations"

Expected: ""
Received: "Failed to close conversation"
```

### 3.

****:
****: API

****:
```
AssertionError: Target cannot be null or undefined.
expect(extractResponseData(result).data.items).toHaveLength(3)

AssertionError: expected undefined to be 2
expect(extractResponseData(result).data.page).toBe(2)
```

---


### -
1. **** - `unit/utils/auth.test.ts` (36/36 )
 - JWT 100%
 - 100%
 - 100%
 - 100%

2. **API ** - `unit/api/base.test.ts` (2/2 )

### -
1. **API ** - 100% (59/59 )
2. **Composables ** - 100% (10/10 )
3. **** - 100% (4/4 )
4. **** - 100% (4/4 )
5. **** - 100% (22/22 )

---


### DOM 1-2

 12.5%

#### Vitest

** 1**: `frontend/vitest.setup.ts`
** 2**: `frontend/vitest.config.ts`
** 3**:

### 2-3


** 1**: `src/utils/error-messages.ts`
** 2**:
** 3**:

### 3-4

#### API

** 1**: `src/utils/api-response.ts`
** 2**:
** 3**:

---


### DOM
```
: 87.5% 100% (+12.5%)
: 71.4% 74.2% (+2.8%)
: 33 0 (-33)
```


```
: 64.4% 65.3% (+0.9%)
: 74.2% 75.0% (+0.8%)
: 321 313 (-8)
```


```
: 65.3% 80%+ (+15%+)
: 75.0% 85%+ (+10%+)
: 313 180 (-133)
```


```
: 85%+
: 100%
: 80%+
: < 180
```

---


1. **** - 100%
 - JWT
 -
 -
 -

2. ** API ** - 100%
 - HTTP
 -
 - API
 - API
 - API


1. **** - 87.5%
 -
 - DOM
 -

2. **** - 65%
 - /
 -
 -

3. **** - 60%
 -
 -
 -

---


### - 4-6
- [ ] ** DOM **1-2 -
- [ ] ****2-3
- [ ] ****1-2

### 1-2
- [ ] ****
- [ ] ****


- [ ] ****
- [ ] ****

---


### : 71.4%

****:
- (100% )
- API (100% )
-
-

****:
- DOM ( 33 ) - ****
- ( 8 ) - ****
- () - ****

****:
- DOM
-
-


- ****: ( 100%)
- **API **: ( API 100%)
- ****: (JWT)
- ****: DOM


1. ** DOM ** - 12.5%
2. **** -
3. **** - API

****: DOM 85%

****: 4-6 1-2
****: 