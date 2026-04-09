/**
 * GitHub Reconnect Prompt Component
 * Displays a prompt when GitHub authentication token is invalid or expired
 */

import React, { useState, useEffect } from 'react';

interface GitHubReconnectPromptProps {
  onReconnect: () => void;
  onDismiss: () => void;
}

/**
 * Component that shows a prompt to reconnect GitHub
 * This appears when the GitHub token is invalid or has expired
 */
export const GitHubReconnectPrompt: React.FC<GitHubReconnectPromptProps> = ({
  onReconnect,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleReconnect = () => {
    setIsVisible(false);
    onReconnect();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="github-reconnect-prompt"
      role="alert"
      aria-label="GitHub reconnect required"
    >
      <div className="prompt-content">
        <div className="prompt-header">
          <span className="prompt-icon">⚠️</span>
          <h3 className="prompt-title">GitHub Connection Lost</h3>
        </div>

        <p className="prompt-message">
          Your GitHub authentication has expired. Please reconnect to continue
          using GitHub features in Claude Code.
        </p>

        <div className="prompt-actions">
          <button
            onClick={handleReconnect}
            className="btn btn-primary"
            aria-label="Reconnect to GitHub"
          >
            Reconnect GitHub
          </button>
          <button
            onClick={handleDismiss}
            className="btn btn-secondary"
            aria-label="Dismiss reconnect prompt"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to check if GitHub reconnection is needed
 */
export const useGitHubReconnectCheck = () => {
  const [needsReconnect, setNeedsReconnect] = useState(false);

  useEffect(() => {
    const checkGitHubStatus = async () => {
      try {
        // Check if GitHub token is valid
        const response = await fetch('/api/github/check', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401 || response.status === 403) {
          setNeedsReconnect(true);
        }
      } catch (error) {
        console.error('Failed to check GitHub status:', error);
      }
    };

    checkGitHubStatus();
  }, []);

  return needsReconnect;
};

export default GitHubReconnectPrompt;
