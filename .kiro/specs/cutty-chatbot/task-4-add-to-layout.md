# Task 4: Add ChatBot to App Layout

## Overview
Integrate the ChatBot component into the main application layout so it appears on all pages.

## Implementation Steps

### 1. Import and Add ChatBot to Layout
The Cutty app uses a Layout component that wraps all pages. Add the ChatBot here:

```jsx
// app/frontend/src/components/Layout.jsx
import React, { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
// ... other imports

// Lazy load the ChatBot for better performance
const ChatBot = lazy(() => import('./ChatBot'));

function Layout() {
  // ... existing layout code

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Existing layout components */}
      <AppBar position="fixed">
        {/* ... existing app bar content */}
      </AppBar>
      
      <Drawer>
        {/* ... existing drawer content */}
      </Drawer>
      
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet /> {/* Page content renders here */}
      </Box>

      {/* Add ChatBot component here */}
      <Suspense fallback={null}>
        <ChatBot />
      </Suspense>
    </Box>
  );
}

export default Layout;
```

### 2. Alternative: Add to App.jsx
If the app structure is different, you might need to add it to App.jsx:

```jsx
// app/frontend/src/App.jsx
import { lazy, Suspense } from 'react';
// ... other imports

const ChatBot = lazy(() => import('./components/ChatBot'));

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        {/* Existing app content */}
        <Routes>
          {/* ... routes */}
        </Routes>
        
        {/* Add ChatBot at the root level */}
        <Suspense fallback={null}>
          <ChatBot />
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

### 3. Check for Layout Variations
The app has different layout components. Check which one is primary:

```bash
# Find the main layout file
grep -r "Layout" app/frontend/src/components/ | grep -E "(export|function|const)"
```

Based on the codebase structure, there might be:
- `Layout.jsx` - Main layout
- `SidebarLayout.jsx` - Layout with sidebar
- `CompactLayout.jsx` - Compact version

Add ChatBot to the most parent/common layout component.

### 4. Handle Z-Index Conflicts
Ensure ChatBot appears above other floating elements:

```jsx
// In ChatBot component, update z-index if needed
sx={{
  zIndex: (theme) => theme.zIndex.drawer + 2, // Above drawer
  // or use a high fixed value
  zIndex: 1300
}}
```

### 5. Conditional Rendering (Optional)
If ChatBot should only appear for authenticated users:

```jsx
// In Layout.jsx
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { user } = useAuth();
  
  return (
    <>
      {/* ... existing layout */}
      
      {/* Only show ChatBot for authenticated users */}
      {user && (
        <Suspense fallback={null}>
          <ChatBot />
        </Suspense>
      )}
    </>
  );
}
```

## Verification Steps

### 1. Check Component Loads
```bash
# Start the dev server
cd app/frontend
npm run dev

# Open browser console and check for errors
# Should see no errors related to ChatBot loading
```

### 2. Test on Different Pages
Navigate to different routes and verify:
- ChatBot button appears on all pages
- Position stays consistent
- No z-index issues with other components

### 3. Check Performance
```javascript
// In browser DevTools Console
// Check that ChatBot is lazy loaded
// Network tab should show ChatBot.jsx loading only when needed
```

## Common Integration Issues

### Issue: ChatBot doesn't appear
**Debug Steps**:
1. Check browser console for errors
2. Verify import path is correct
3. Check if Suspense wrapper is present
4. Verify component is inside the Router context

### Issue: ChatBot appears multiple times
**Solution**: Ensure it's only added to one parent layout, not multiple

### Issue: ChatBot hidden behind other elements
**Solution**: 
```jsx
// Force highest z-index
<ChatBot sx={{ '& > *': { zIndex: 9999 } }} />
```

### Issue: Layout shift when ChatBot loads
**Solution**: The Suspense fallback={null} prevents this

## API Endpoint Configuration

Make sure the frontend API calls use the correct base URL:

```jsx
// If needed, update the fetch call in ChatBot.jsx
const API_BASE = import.meta.env.VITE_API_URL || '';

const response = await fetch(`${API_BASE}/api/v1/chat`, {
  // ... rest of the fetch config
});
```

## Environment-Specific Configuration

For different environments:

```jsx
// app/frontend/.env.development
VITE_API_URL=http://localhost:8788

// app/frontend/.env.production
VITE_API_URL=https://cutty.emilycogsdill.com
```

## Final Checklist

- [ ] ChatBot imported in main layout component
- [ ] Wrapped in Suspense for lazy loading
- [ ] Appears on all pages consistently
- [ ] No console errors
- [ ] Proper z-index (above other elements)
- [ ] API calls work in both dev and prod
- [ ] Mobile responsive
- [ ] No performance issues

## Testing Different Scenarios

### 1. New User Flow
- Register new account
- ChatBot should appear after login
- Welcome message displays

### 2. Existing User Flow  
- Login with existing account
- ChatBot available immediately
- Can ask questions about app features

### 3. Guest User Flow (if applicable)
- Browse without login
- ChatBot either hidden or shows limited functionality
- Prompts to login for full features