# GitHub Reconnect Prompt for Claude Code

A React-based GitHub reconnect prompt component and integration system for Claude Code UI. This feature automatically detects when GitHub authentication has expired or become invalid and prompts the user to reconnect.

## Overview

The GitHub Reconnect Prompt system provides:

- **Automatic Detection**: Monitors GitHub authentication status at regular intervals
- **User-Friendly Prompt**: Beautiful, accessible UI component that appears when reconnection is needed
- **Event-Based Architecture**: Flexible event system for integrating with your application
- **React Hooks**: Convenient hooks for easy integration into React components
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode Support**: Automatically adapts to system theme preferences

## Features

### 1. GitHub Reconnect Prompt Component

A React component that displays a user-friendly prompt when GitHub authentication is needed:

```tsx
import GitHubReconnectPrompt from './github-reconnect-prompt';

<GitHubReconnectPrompt
  onReconnect={() => handleReconnect()}
  onDismiss={() => handleDismiss()}
/>
```

### 2. Automatic Status Monitoring

The `GitHubReconnectManager` automatically checks GitHub authentication status:

- Checks every 30 seconds (configurable)
- Detects expired tokens, invalid tokens, and disconnected state
- Emits events when status changes
- Non-intrusive background monitoring

### 3. React Hooks

Easy-to-use React hook for integrating the prompt:

```tsx
import { useGitHubReconnectPrompt } from './useGitHubReconnectPrompt';

function MyComponent() {
  const { showPrompt, onReconnect, onDismiss } = useGitHubReconnectPrompt();

  return (
    <>
      {showPrompt && (
        <GitHubReconnectPrompt
          onReconnect={onReconnect}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
}
```

### 4. Event-Based Architecture

Subscribe to GitHub authentication status changes:

```typescript
import { githubReconnectManager } from './github-reconnect-integration';

githubReconnectManager.subscribe((event) => {
  console.log('GitHub status changed:', event.status);
});

githubReconnectManager.startMonitoring();
```

## Status Types

The system tracks four authentication states:

- **CONNECTED**: GitHub is properly authenticated
- **DISCONNECTED**: No GitHub connection available
- **EXPIRED**: GitHub token has expired
- **INVALID_TOKEN**: GitHub token is invalid or revoked

## Installation

### 1. Copy Files

Copy the following files to your Claude Code project:

```
src/
  ├── github-reconnect-prompt.tsx
  ├── github-reconnect-prompt.css
  ├── github-reconnect-integration.ts
  ├── useGitHubReconnectPrompt.ts
  └── example-integration.tsx
```

### 2. Install Dependencies

```bash
npm install react react-dom
npm install --save-dev typescript @types/react
```

### 3. Import Styles

In your main application file:

```tsx
import './src/github-reconnect-prompt.css';
```

## Usage

### Basic Integration

The simplest way to integrate the GitHub reconnect prompt:

```tsx
import React from 'react';
import GitHubReconnectPrompt from './src/github-reconnect-prompt';
import { useGitHubReconnectPrompt } from './src/useGitHubReconnectPrompt';
import './src/github-reconnect-prompt.css';

function App() {
  const { showPrompt, onReconnect, onDismiss } =
    useGitHubReconnectPrompt();

  return (
    <div className="app">
      <main>{/* Your app content */}</main>

      {showPrompt && (
        <GitHubReconnectPrompt
          onReconnect={onReconnect}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

export default App;
```

### Advanced: Custom Event Handling

For more control over how reconnection is handled:

```tsx
import {
  githubReconnectManager,
  GitHubAuthStatus,
} from './src/github-reconnect-integration';

// Subscribe to status changes
githubReconnectManager.subscribe((event) => {
  if (event.status === GitHubAuthStatus.EXPIRED) {
    // Handle expired token
    showReconnectDialog();
  }
});

// Start monitoring
githubReconnectManager.startMonitoring();

// Manually reconnect
async function handleReconnect() {
  const success = await githubReconnectManager.reconnect();
  if (success) {
    console.log('Reconnected successfully!');
  }
}
```

## API Reference

### GitHubReconnectPrompt Component

Props:
- `onReconnect: () => void` - Called when user clicks "Reconnect GitHub"
- `onDismiss: () => void` - Called when user clicks "Dismiss"

### useGitHubReconnectPrompt Hook

Returns:
- `showPrompt: boolean` - Whether the prompt should be visible
- `status: GitHubAuthStatus` - Current GitHub auth status
- `onReconnect: () => Promise<void>` - Function to trigger reconnection
- `onDismiss: () => void` - Function to dismiss the prompt

### GitHubReconnectManager

Methods:
- `startMonitoring(): void` - Start periodic status checks
- `stopMonitoring(): void` - Stop periodic status checks
- `subscribe(callback): () => void` - Subscribe to status changes
- `getStatus(): GitHubAuthStatus` - Get current status
- `reconnect(): Promise<boolean>` - Attempt to reconnect to GitHub

## Styling

The component uses CSS classes for styling:

- `.github-reconnect-prompt` - Main container
- `.prompt-content` - Content wrapper
- `.prompt-header` - Header section
- `.prompt-title` - Title text
- `.prompt-message` - Message text
- `.prompt-actions` - Action buttons container
- `.btn` - Base button style
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button

You can customize styles by overriding these classes in your CSS.

## Dark Mode

The component automatically supports dark mode through the `prefers-color-scheme` CSS media query. No additional configuration is needed.

## Responsive Design

The component is responsive and adapts to mobile screens:

- On mobile devices (< 480px), the prompt appears as a full-width banner at the top
- On larger screens, it appears as a fixed card in the top-right corner
- Touch-friendly button sizes on mobile devices

## API Endpoints

The component expects the following API endpoints to be available:

### GET /api/github/status

Check current GitHub authentication status.

**Response:**
```json
{
  "authenticated": true,
  "expiresAt": "2026-05-09T00:00:00Z"
}
```

### GET /api/github/check

Check if GitHub token is valid (returns 401/403 if invalid).

### POST /api/github/reconnect

Initiate the GitHub reconnection flow.

**Response:**
```json
{
  "success": true,
  "message": "Successfully reconnected to GitHub"
}
```

## Examples

See `src/example-integration.tsx` for complete working examples:

1. **Basic Integration** - Simple hook-based integration
2. **Manual Control** - Direct component usage
3. **Event Listening** - Custom event handling

## Testing

To test the GitHub reconnect prompt:

1. **Manual Test**: Click the "Test GitHub Reconnect" button in the example
2. **Automated Status Check**: The system checks every 30 seconds
3. **Force Reconnection**: Call `githubReconnectManager.reconnect()` directly

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE 11: ❌ Not supported (uses ES6+ features)

## Performance Considerations

- Status checks happen every 30 seconds (configurable)
- Minimal DOM updates (only prompt visibility state changes)
- Event-based architecture prevents unnecessary re-renders
- Automatic cleanup of event listeners on unmount

## License

Licensed under GNU General Public License v3.0. See LICENSE file for details.

## Contributing

To contribute improvements to this feature, please follow the standard Git workflow and create a pull request with your changes.

## Troubleshooting

### Prompt never appears

1. Check that the API endpoints are returning correct status codes
2. Verify that `startMonitoring()` is being called
3. Check browser console for any errors

### Reconnection fails silently

1. Verify the `/api/github/reconnect` endpoint is working
2. Check network tab in developer tools
3. Ensure GitHub OAuth configuration is correct

### Styles not applying

1. Make sure `github-reconnect-prompt.css` is imported
2. Check CSS file path is correct
3. Verify no CSS conflicts with your existing styles

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.
