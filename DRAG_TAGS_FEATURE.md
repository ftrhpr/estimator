# Drag-to-Move Tags Feature

## Overview
Added ability to move damage tags on photos by touching and swiping/dragging them to new positions.

## How It Works

### User Interaction
1. **Touch a tag** - Place your finger on any numbered damage tag
2. **Drag/Swipe** - Move your finger across the image to reposition the tag
3. **Release** - Lift your finger to drop the tag at the new location
4. **Tap the dot** - Quick tap on the tag number still opens price adjustment

## Technical Implementation

### New Imports
- Added `PanResponder` from React Native for gesture handling
- Added `useRef` hook for storing pan responder instances

### State Variables
```tsx
const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
const dragStartPos = useRef({ x: 0, y: 0 });
const tagPanResponders = useRef<Record<string, any>>({});
```

### New Function: `createPanResponder(tagId)`
Creates a gesture responder for each tag that:
- **onPanResponderGrant**: Captures the initial touch position
- **onPanResponderMove**: Updates tag coordinates while dragging
- **onPanResponderRelease**: Finalizes the new position

**Key Features:**
- Updates both absolute (x, y) and percentage-based coordinates for responsive positioning
- Prevents tags from moving outside image bounds (x/y ≥ 0)
- Maintains visual feedback during drag (reduces opacity)
- Uses refs to cache responders for performance

### Modified Tag Rendering
Changed from `TouchableOpacity` to `View` with PanResponder:
```tsx
<View {...panResponder.panHandlers}>
  <TouchableOpacity onPress={...}>
    {/* Tag content */}
  </TouchableOpacity>
</View>
```

**Why this structure:**
- Outer `View` captures drag gestures
- Inner `TouchableOpacity` handles quick taps for price adjustment
- Prevents gesture conflicts

### Updated Styles
- Added `tagDotContainer` style for the inner touchable area
- Modified `photoTag` styles to support drag visual feedback (opacity change during drag)

## Features
✅ Smooth drag-to-move interaction
✅ Touch-friendly with visual feedback
✅ Automatic bounds checking (tags stay on image)
✅ Coordinate persistence (both px and % based)
✅ Quick-tap still works for price adjustment
✅ Works with both portrait and landscape orientations

## User Experience
- **Drag**: Visually dimmed while dragging (0.8 opacity) → Returns to normal when released
- **Responsive**: Tag follows finger smoothly without lag
- **Bounds Safe**: Can't drag tags outside the image area
- **Undo**: Each new position is automatically saved to the database on completion

## Testing
Try these scenarios:
1. Drag a tag across the image - should move smoothly
2. Drag tag near image edge - should stop at boundary
3. Rotate image and drag tag - should work in new orientation
4. Tap tag while not moving - should open price adjustment modal
5. Long press and hold - tag should remain selected until release

## Files Modified
- `app/capture/PhotoTaggingScreen.tsx`
  - Lines 1-10: Added PanResponder import and useRef hook
  - Lines 97-100: Added dragging state variables
  - Lines 256-305: Added createPanResponder() function
  - Lines 597-618: Modified renderPhotoTag() to use PanResponder
  - Lines 1095-1098: Added tagDotContainer style
