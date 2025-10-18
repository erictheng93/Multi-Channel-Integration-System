

### 1.
- [ ]
- [ ]
- [ ]

### 2.
- [ ] <10
- [ ] 10-50
- [ ] >50

### 3.
- [ ]
- [ ]
- [ ]
- [ ]

### 4.
- [ ]
- [ ] Network Slow 3G
- [ ]


### 1.
```javascript
//
console.log('Scroll info:', {
 scrollTop: document.querySelector('.messages-container').scrollTop,
 scrollHeight: document.querySelector('.messages-container').scrollHeight,
 clientHeight: document.querySelector('.messages-container').clientHeight
});

//
console.log('Messages order:',
 Array.from(document.querySelectorAll('.message-bubble'))
 .map(el => el.textContent?.substring(0, 30))
);
```

### 2.
- Network
- `/conversations/{id}/messages`
- `createdAt`

### 3.
```
 [ConversationDetail] Loading messages
 [ConversationDetail] Initial load complete
 [ConversationDetail] DOM mutation detected
 [ConversationDetail] Final scroll completed
```


1.
2. MutationObserver
3.


- 300ms
- MutationObserver


```javascript
//
console.time('scroll-to-bottom');
// ...
console.timeEnd('scroll-to-bottom');
```


1. ****
 - `setTimeout`
 - MutationObserver

2. ****
 - `orderBy(messages.createdAt)` `orderBy(desc(messages.createdAt))`
 - `reverse()`

3. ****
 - 500ms
 - 