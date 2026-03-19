# ActionEditor Collapsible Cards Design

## Problem

The `ActionEditor` component for auto-reply rules lacks a sense of completion when editing action items. Unlike the `ConditionEditor` (which has a clear "input -> add button -> pill tag" flow), action cards remain permanently in an expanded edit state with no visual "done" transition. This creates:

1. **No completion signal** — users cannot tell which actions are finalized
2. **Visual clutter** — all cards always show full forms, making it hard to overview a rule with multiple actions
3. **Inconsistent UX** — the condition section has a clear add/confirm flow, but the action section does not

## Solution

Transform `ActionEditor.vue` action cards into **collapsible dual-state cards** with an "editing" and "collapsed/done" mode. This mirrors the existing expand/collapse pattern used by `RuleCard.vue` at the rule level.

## Design

### Scope

- **Only `ActionEditor.vue` is modified** — no changes to parent components, composables, or event contracts
- The existing `emit('add')`, `emit('remove')`, `emit('update-content')` interface remains unchanged
- New state is purely local UI state (a `Set<number>` tracking which card indices are in editing mode)

### Dual-State Card Behavior

**Collapsed state (default for cards with content):**
- Single-row layout: `[status dot] [type badge] [preview text ...] [edit btn] [delete btn]`
- Preview text shows truncated content with `text-overflow: ellipsis`
- Green dot indicates "done" status
- Click anywhere on the row, or click the edit icon, to expand

**Editing state (default for newly added cards):**
- Full form visible (textarea for text/flex, input fields for image)
- Orange pulsing dot indicates "editing" status
- Card gets a subtle blue highlight: `box-shadow` with blue-light tint
- Footer with "Cancel" and "Confirm" buttons
- "Confirm" collapses the card; "Cancel" collapses the card visually (content already emitted to parent is not rolled back — Cancel is a visual-only operation)

**State transitions:**
```
[+Add Action] --> Card appears in EDITING state (auto-focus textarea)
                        |
                   [Confirm] --> Card collapses to COLLAPSED state
                        |           |
                   [Cancel]         [Click / Edit icon] --> back to EDITING
                        |
                   Collapses (reverts content if new and empty)
```

### Preview Text Logic

| Action Type   | Preview Content                                      |
|---------------|------------------------------------------------------|
| `reply_text`  | Parsed `JSON.text` value, truncated                  |
| `reply_image` | Parsed `JSON.url` value, truncated                   |
| `reply_flex`  | First 50 chars of raw JSON string                    |

### Data Flow

No changes to the parent data flow. The `update-content` event continues to fire on every input change (real-time sync to `formData.actions`). The collapse/expand is purely visual — it does not gate when content is emitted.

```
ActionEditor (local UI state: editingIndices Set<number>)
  |
  |-- emit('add', actionType)        --> useRuleEditor.addAction()
  |-- emit('remove', index)          --> useRuleEditor.removeAction()
  |-- emit('update-content', i, str) --> useRuleEditor.updateActionContent()
  |
  (No new events needed)
```

### Design System Compliance (Apple-Native Soft Minimalism)

| Element                | Specification                                          |
|------------------------|--------------------------------------------------------|
| Card background        | `var(--gray-50)` collapsed, `white` when editing       |
| Card border-radius     | `var(--radius-md)` (12px, nested card level)           |
| Editing highlight      | `box-shadow: var(--shadow-sm), 0 0 0 2px var(--blue-light)` |
| No hard borders        | Shadow + background difference only                    |
| Status dot (done)      | 8px circle, `#34C759` (green)                          |
| Status dot (editing)   | 8px circle, `#FF9500` (orange), pulse animation        |
| Confirm button         | `rounded-full`, `#007AFF` blue, capsule shape          |
| Cancel button          | `rounded-full`, `var(--gray-100)` background           |
| Edit/Delete icons      | Lucide Icons (`Pencil`, `Trash2`), 16px                |
| Transition duration    | 300ms ease-out                                         |
| Preview text color     | `var(--text-primary)` (#1C1C1E)                        |
| Badge styles           | Unchanged from current (blue/green/purple pastels)     |

### Component Changes

**`ActionEditor.vue` — template changes:**

1. Each action card gets a wrapper with conditional class `.action-card-new` + `.editing`
2. **Collapsed header**: badge + preview text + icon buttons (shown when NOT editing)
3. **Expanded body**: existing form fields + confirm/cancel footer (shown when editing)
4. New cards automatically enter editing state

**`ActionEditor.vue` — script changes:**

1. Add `editingIndices = ref<Set<number>>(new Set())` for tracking editing state
2. Add `confirmAction(index)` — removes index from editingIndices
3. Add `editAction(index)` — adds index to editingIndices
4. Add `cancelAction(index)` — removes index from editingIndices
5. Modify `handleAddAction()` — after emitting 'add', add new index to editingIndices
6. Add preview text helper functions (reuse existing parse functions)

**`ActionEditor.vue` — style changes:**

1. Add `.action-card-new` base styles (collapsed single-row)
2. Add `.action-card-new.editing` styles (expanded with blue highlight)
3. Add `.collapsed-header` layout styles
4. Add `.collapsed-preview` with ellipsis truncation
5. Add `.status-dot` + pulse animation
6. Add `.expanded-footer` button layout
7. Add `.btn-icon` for edit/delete icon buttons
8. Remove old `.action-card` styles (replaced)

### Edge Cases

- **Empty content on confirm**: Allow collapse even with empty content (the parent save validation handles required fields)
- **Index shift on delete**: When a card is deleted, recalculate `editingIndices` by removing the deleted index and shifting all higher indices down by 1
- **Multiple cards editing**: Allow multiple cards to be in editing state simultaneously (no accordion restriction)
- **Existing rules on expand**: When `RuleCard` expands a rule, all its actions start in collapsed state (content already exists)
- **New rule creation**: When creating a new rule and adding the first action, it starts in editing state

## Files Modified

| File | Change Type |
|------|-------------|
| `frontend/src/components/auto-reply/ActionEditor.vue` | Major rewrite (template + script + styles) |

## Testing Considerations

- Verify collapse/expand toggle works for all 3 action types
- Verify preview text renders correctly for each type
- Verify new cards auto-expand and existing cards start collapsed
- Verify delete correctly recalculates editingIndices
- Verify all existing emit events still fire correctly
- Verify keyboard accessibility (tab navigation, enter to confirm)
