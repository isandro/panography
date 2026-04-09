/**
 * React Hook for GitHub Reconnect Prompt
 * Manages the display of the GitHub reconnect prompt
 */

import { useEffect, useState, useCallback } from 'react';
import {
  githubReconnectManager,
  GitHubAuthStatus,
  type GitHubReconnectEvent,
} from './github-reconnect-integration';

/**
 * Hook to manage GitHub reconnect prompt visibility and actions
 * @returns Object with prompt state and handlers
 */
export function useGitHubReconnectPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [status, setStatus] = useState(GitHubAuthStatus.CONNECTED);

  const handleReconnect = useCallback(async () => {
    const success = await githubReconnectManager.reconnect();
    if (success) {
      setShowPrompt(false);
    } else {
      console.error('Failed to reconnect GitHub');
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  useEffect(() => {
    // Start monitoring on mount
    githubReconnectManager.startMonitoring();

    // Subscribe to status changes
    const unsubscribe = githubReconnectManager.subscribe(
      (event: GitHubReconnectEvent) => {
        setStatus(event.status);

        // Show prompt if status is not connected
        const shouldShowPrompt =
          event.status === GitHubAuthStatus.EXPIRED ||
          event.status === GitHubAuthStatus.INVALID_TOKEN ||
          event.status === GitHubAuthStatus.DISCONNECTED;

        setShowPrompt(shouldShowPrompt);
      }
    );

    return () => {
      unsubscribe();
      githubReconnectManager.stopMonitoring();
    };
  }, []);

  return {
    showPrompt,
    status,
    onReconnect: handleReconnect,
    onDismiss: handleDismiss,
  };
}
