#!/usr/bin/env python3
"""
Script to replace console.log/error calls with testSafe* equivalents in ConversationRoom.ts
"""
import re

# Read the file
with open('src/durable-objects/ConversationRoom.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define replacements (emoji -> prefix helper)
replacements = [
    # console.log with emojis
    (r"console\.log\(`🏗️ \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('BUILD')}[ConversationRoom]"),
    (r"console\.log\('🏗️ \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('BUILD')}[ConversationRoom]"),
    (r"console\.log\(`🔐 \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('INFO')}[ConversationRoom]"),
    (r"console\.log\('🔐 \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('INFO')}[ConversationRoom]"),
    (r"console\.log\(`✅ \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('CHECK')}[ConversationRoom]"),
    (r"console\.log\('✅ \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('CHECK')}[ConversationRoom]"),
    (r"console\.log\(`🔌 \[ConversationRoom\]", r"testSafeLog(`[ConversationRoom]"),
    (r"console\.log\('🔌 \[ConversationRoom\]", r"testSafeLog('[ConversationRoom]"),
    (r"console\.log\(`📤 \[ConversationRoom\]", r"testSafeLog(`[ConversationRoom]"),
    (r"console\.log\('📤 \[ConversationRoom\]", r"testSafeLog('[ConversationRoom]"),
    (r"console\.log\(`🎉 \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('SUCCESS')}[ConversationRoom]"),
    (r"console\.log\('🎉 \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('SUCCESS')}[ConversationRoom]"),
    (r"console\.log\(`📊 \[ConversationRoom\]", r"testSafeLog(`[ConversationRoom]"),
    (r"console\.log\('📊 \[ConversationRoom\]", r"testSafeLog('[ConversationRoom]"),
    (r"console\.log\(`ℹ️ \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('INFO')}[ConversationRoom]"),
    (r"console\.log\('ℹ️ \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('INFO')}[ConversationRoom]"),
    (r"console\.log\(`🚀 \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('ROCKET')}[ConversationRoom]"),
    (r"console\.log\('🚀 \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('ROCKET')}[ConversationRoom]"),

    # console.error with emojis
    (r"console\.error\(`❌ \[ConversationRoom\]", r"testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom]"),
    (r"console\.error\('❌ \[ConversationRoom\]", r"testSafeError('${getEmojiPrefix('ERROR')}[ConversationRoom]"),
    (r"console\.warn\(`⚠️ \[ConversationRoom\]", r"testSafeLog(`${getEmojiPrefix('WARNING')}[ConversationRoom]"),
    (r"console\.warn\('⚠️ \[ConversationRoom\]", r"testSafeLog('${getEmojiPrefix('WARNING')}[ConversationRoom]"),
]

# Apply all replacements
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# Write back the file
with open('src/durable-objects/ConversationRoom.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("✅ Replaced all console calls in ConversationRoom.ts")
print("Total replacements:", sum(1 for p, _ in replacements))
