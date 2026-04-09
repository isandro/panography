/**
 * Example: How to integrate GitHub reconnect prompt in Claude Code
 * This example shows how to use the GitHubReconnectPrompt component
 * and hooks in your application
 */

import React from 'react';
import GitHubReconnectPrompt from './github-reconnect-prompt';
import { useGitHubReconnectPrompt } from './useGitHubReconnectPrompt';
import './github-reconnect-prompt.css';

/**
 * Example App Component
 * Shows how to integrate the GitHub reconnect prompt
 */
export function AppWithGitHubPrompt() {
  const { showPrompt, onReconnect, onDismiss } =
    useGitHubReconnectPrompt();

  return (
    <div className="app">
      {/* Your main application content */}
      <main className="app-content">
        <h1>Claude Code</h1>
        <p>Your code editor here...</p>
      </main>

      {/* GitHub Reconnect Prompt */}
      {showPrompt && (
        <GitHubReconnectPrompt
          onReconnect={onReconnect}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

/**
 * Alternative: Manual control over prompt visibility
 */
export function AppWithManualPromptControl() {
  const [showPrompt, setShowPrompt] = React.useState(false);
  const { manager } = React.useMemo(() => {
    return {
      manager: require('./github-reconnect-integration')
        .githubReconnectManager,
    };
  }, []);

  const handleReconnect = React.useCallback(async () => {
    const success = await manager.reconnect();
    if (success) {
      setShowPrompt(false);
      // Show success message
      console.log('GitHub reconnected successfully');
    }
  }, [manager]);

  const handleDismiss = React.useCallback(() => {
    setShowPrompt(false);
  }, []);

  return (
    <div className="app">
      <main className="app-content">
        <h1>Claude Code</h1>
        <p>Your code editor here...</p>

        {/* Manual button to show prompt for testing */}
        <button onClick={() => setShowPrompt(true)}>
          Test GitHub Reconnect
        </button>
      </main>

      {showPrompt && (
        <GitHubReconnectPrompt
          onReconnect={handleReconnect}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

/**
 * Example of listening to reconnect events
 */
export function AppWithReconnectEventListener() {
  const { manager } = React.useMemo(() => {
    return {
      manager: require('./github-reconnect-integration')
        .githubReconnectManager,
    };
  }, []);

  React.useEffect(() => {
    // Subscribe to reconnect events
    const unsubscribe = manager.subscribe((event) => {
      console.log('GitHub reconnect event:', event);

      // Handle different status changes
      switch (event.status) {
        case 'connected':
          console.log('✅ GitHub is connected');
          break;
        case 'disconnected':
          console.log('❌ GitHub is disconnected');
          break;
        case 'expired':
          console.log('⏰ GitHub token expired');
          break;
        case 'invalid_token':
          console.log('🔐 Invalid GitHub token');
          break;
      }
    });

    // Start monitoring
    manager.startMonitoring();

    return () => {
      unsubscribe();
      manager.stopMonitoring();
    };
  }, [manager]);

  return (
    <div className="app">
      <main className="app-content">
        <h1>Claude Code with GitHub Event Monitoring</h1>
        <p>Check the console for GitHub status events</p>
      </main>
    </div>
  );
}
