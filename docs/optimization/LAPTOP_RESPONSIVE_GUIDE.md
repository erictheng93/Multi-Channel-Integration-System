

| | | | | | |
|---------|---------|-----------|----------|---------|---------|
| | | 1080x720 | ~1000px | 1025-1119px | |
| | 13 | 1920x1080 | ~1200px | 1120-1279px | |
| | 14 | 1920x1080 | ~1350px | 1280-1439px | |
| | 15.6 | 1920x1080+ | ~1500px | 1440-1679px | |
| | 17+ | 2560x1440+ | ~1650px+ | 1680px+ | |


### 1.
```css
/* */
max-width: clamp(1200px, 85vw, 1650px);

/* */
font-size: clamp(1.75rem, 1.5rem + 2vw, 2.8rem);

/* */
padding: clamp(1rem, 2vw, 2rem);

/* */
grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
```

### 2.
- **1025-1119px**:
- **1120-1279px**:
- **1280-1439px**:
- **1440-1679px**:
- **1680px+**:

### 3.
```css
/* : 2 */
@media (min-width: 1025px) and (max-width: 1119px) {
 .stats-grid { grid-template-columns: repeat(2, 1fr); }
 .content-grid { grid-template-columns: 1fr; }
}

/* : 3-4 */
@media (min-width: 1280px) and (max-width: 1439px) {
 .stats-grid { grid-template-columns: repeat(4, 1fr); }
}
```


### 1: CSS
```html
<link rel="stylesheet" href="/src/styles/laptop-responsive.css">
```

### 2:
```vue
<div class="laptop-container">
 <h1 class="laptop-title fluid-title"></h1>
 <div class="laptop-grid">
 <!-- -->
 </div>
</div>
```

### 3:
```css
.fluid-text /* */
.fluid-title /* */
.fluid-padding /* */
.fluid-margin /* */
.fluid-gap /* */
```


1. (F12)
2.
3.
 - 1080px ()
 - 1200px (13)
 - 1350px (14)
 - 1500px (15.6)
 - 1650px (17)


-
- 80%90%110%
-


1. **** - clamp()vw
2. **** - 1080x7204K
3. **** -


- CSS
-
- transformlayout


```javascript
//
const testSizes = {
 'low-res': '1080px',
 'small-laptop': '1200px',
 'medium-laptop': '1350px',
 'large-laptop': '1500px',
 'xl-laptop': '1650px'
};

function testLaptopSize(size) {
 document.body.style.width = testSizes[size];
 console.log(\`Testing \${size}: \${testSizes[size]}\`);
}

// : testLaptopSize('small-laptop')
```


-
-
-
-
-

1080x7204K