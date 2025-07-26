# UI/UX Patterns & Features

## Overview
This document describes the user interface patterns, user experience flows, and design decisions implemented in Cutty.

## Authentication-Based UI States

### Sidebar Navigation
The application uses conditional sidebar navigation based on authentication status:

#### Logged-Out Users
- **Home/About**: Always visible
- **Login**: Available for authentication
- **CSV Cutter**: Basic functionality available
- **Files**: Direct link to `/manage_files` (shows dramatic logged-out state)

#### Logged-In Users  
- **Logout**: Authentication controls
- **CSV Cutter PLUS**: Enhanced functionality
- **Files**: Expandable group with sub-items:
  - Upload: Direct file upload functionality
  - Manage: File management interface
- **People**: Expandable group with sub-items:
  - Load Person Records: Import functionality
  - Generate Fake Data: Synthetic data creation
- **FAQ**: Help documentation

## Files Feature

### Authentication-Based Behavior

#### For Logged-Out Users
**Route**: `/manage_files`
**Behavior**: Dramatic visual warning with authentication prompt

**Visual Design**:
- **Large Cutty Image**: 
  - 400px wide
  - Horizontally flipped (`scaleX(-1)`)
  - Red glow effect with CSS filters and drop-shadows
  - Animated pulsing glow effect (2s alternate)
  
- **Warning Text**:
  - Message: "YOU ARE NOT LOGGED IN."
  - Font: Creepster (threatening style)
  - Size: 3rem
  - Color: Red (#ff0000)
  - Animated glow effect with text-shadow
  
- **Call-to-Action**:
  - Small friendly Cutty image (100px)
  - Message: "log in or sign up here!"
  - Login/Sign Up buttons linking to `/login` and `/register`

**Implementation Details**:
- File: `app/frontend/src/components/ManageFiles.jsx:237-327`
- Uses Material-UI components with custom CSS animations
- Responsive centered layout with 80vh minimum height

#### For Logged-In Users
**Route**: `/manage_files`
**Behavior**: Full file management interface

**Features**:
- File upload with drag-and-drop support
- File listing with metadata (size, date, source)
- Download functionality with progress indicators
- Delete functionality with confirmation dialogs
- Support for CSV, TXT, and TSV files (50MB limit)
- Integration with synthetic data generation

**Visual Design**:
- Clean table-based layout
- Material-UI components
- Action buttons with loading states
- File type indicators and source chips
- Responsive design

## Design System

### Color Palette
```css
--primary-bg: #262c43     /* Main background */
--navbar-bg: #1c2031     /* Sidebar background */
--secondary-bg: #576587   /* Secondary elements */
--primary-text: #e3f0f7   /* Main text */
--accent: #7795ee         /* Primary accent */
--action: #00ccf0         /* Action elements */
--secondary: #5894ff      /* Secondary accent */
```

### Typography
- **Main Font**: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif
- **Threatening Font**: 'Creepster', cursive (for dramatic warnings)
- **Font Scale**: 1 (configurable via CSS variables)

### Animation Patterns
- **Glow Effects**: 2s ease-in-out infinite alternate
- **Loading States**: Material-UI CircularProgress
- **Transitions**: 0.2s ease for hover states
- **Blinking Cursor**: 1s infinite blink animation

## Cutty Character Integration

### Contextual Messages
Cutty provides context-aware messages based on current page:
- **Home**: Welcome messages (different for logged-in/out)
- **Files**: "I can't be managed. But your files can be!"
- **Login**: "Have we met?"
- **Logout**: Dramatic threatening message in red Creepster font
- **FAQ**: Existential questions in threatening style

### Visual States
- **Normal**: Standard cuttlefish logo
- **Angry/Warning**: Flipped, red glow, animated (for authentication warnings)
- **Friendly**: Smaller size for call-to-action contexts

## Responsive Design
- Mobile-first approach
- Sidebar drawer on mobile devices
- Flexible layouts using Material-UI Grid and Box components
- Consistent spacing using Material-UI theme spacing

## Accessibility
- Semantic HTML elements
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatible
- Color contrast compliance

## Performance Considerations
- Optimized imports for tree-shaking
- Image optimization for Cutty logo assets
- Lazy loading for non-critical components
- Efficient re-rendering with React.memo where appropriate

---
*Last updated: Feature implementation for authenticated/unauthenticated Files page states*