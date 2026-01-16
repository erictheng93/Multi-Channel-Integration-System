#!/usr/bin/env python3
import re

# Read the file
with open('src/durable-objects/ConversationRoom.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix single quotes to backticks for template literals containing ${getEmojiPrefix
# Pattern: testSafe*('${getEmojiPrefix -> testSafe*(`${getEmojiPrefix
content = re.sub(
    r"testSafe(Log|Error)\('(\$\{getEmojiPrefix\([^)]+\)}[^']*)',",
    r"testSafe\1(`\2`,",
    content
)

# Write back
with open('src/durable-objects/ConversationRoom.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed quote issues")
