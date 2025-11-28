#!/usr/bin/env python3
import re

# Read the file
with open('src/durable-objects/ConversationRoom.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Simple replacements - catch ALL console.log/error/warn patterns
replacements = [
    # Match any console.log starting with emoji
    (r'console\.log\(`([🔧📂🧹❌🔍⚠️🔄📡🔔🔕🌐📨]+) \[ConversationRoom\]', r"testSafeLog(`[ConversationRoom]"),
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# Write back
with open('src/durable-objects/ConversationRoom.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Done")
