$filePath = "D:\Code\Multi_Channel_Integration_System\frontend\src\services\realtimeConnectionManager.ts"

# Read the file
$content = Get-Content $filePath -Raw

# Fix 1: Add stateChangeHandler variable after mappedState
$pattern1 = '  // Map SSE connection state to unified state\r\n  const mappedState = ref<ConnectionState>\(''disconnected''\)\r\n\r\n  // Watch SSE state'
$replacement1 = '  // Map SSE connection state to unified state
  const mappedState = ref<ConnectionState>(''disconnected'')

  // Store registered handlers
  let stateChangeHandler: ((state: ConnectionState) => void) | null = null

  // Watch SSE state'

$content = $content -replace [regex]::Escape($pattern1), $replacement1

# Fix 2: Update updateMappedState function to call handler
$pattern2 = @'
  // Watch SSE state and map to unified state
  const updateMappedState = \(\) => \{
    if \(sseConnection\.isConnected\.value\) \{
      mappedState\.value = 'connected'
    \} else if \(sseConnection\.isConnecting\.value\) \{
      mappedState\.value = 'connecting'
    \} else if \(sseConnection\.isReconnecting\.value\) \{
      mappedState\.value = 'reconnecting'
    \} else if \(sseConnection\.hasError\.value\) \{
      mappedState\.value = 'error'
    \} else \{
      mappedState\.value = 'disconnected'
    \}
  \}
'@

$replacement2 = @'
  // Watch SSE state and map to unified state
  const updateMappedState = () => {
    const previousState = mappedState.value

    if (sseConnection.isConnected.value) {
      mappedState.value = 'connected'
    } else if (sseConnection.isConnecting.value) {
      mappedState.value = 'connecting'
    } else if (sseConnection.isReconnecting.value) {
      mappedState.value = 'reconnecting'
    } else if (sseConnection.hasError.value) {
      mappedState.value = 'error'
    } else {
      mappedState.value = 'disconnected'
    }

    // Call registered handler when state changes
    if (stateChangeHandler && previousState !== mappedState.value) {
      console.log(`[SSE Wrapper] State changed: ${previousState} -> ${mappedState.value}`)
      stateChangeHandler(mappedState.value)
    }
  }
'@

$content = $content -replace $pattern2, $replacement2

# Fix 3: Update onStateChange method to actually call the handler
$pattern3 = @'
    onStateChange\(_handler: \(state: ConnectionState\) => void\) \{\r?\n      // State changes are automatically tracked\r?\n      console\.log\('\[SSE\] State change handler registered \(automatic\)'\)\r?\n    \}
'@

$replacement3 = @'
    onStateChange(handler: (state: ConnectionState) => void) {
      // Store the handler and call immediately with current state
      stateChangeHandler = handler
      console.log(`[SSE] State change handler registered, current state: ${mappedState.value}`)
      // Immediately notify of current state
      handler(mappedState.value)
    }
'@

$content = $content -replace $pattern3, $replacement3

# Write the modified content back
Set-Content $filePath -Value $content

Write-Host "File fixed successfully!"
