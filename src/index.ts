/**
 * GitHub Reconnect Prompt for Claude Code
 * Public API exports
 */

// Components
export { default as GitHubReconnectPrompt } from './github-reconnect-prompt';
export type { default as GitHubReconnectPromptProps } from './github-reconnect-prompt';

// Hooks
export { useGitHubReconnectPrompt } from './useGitHubReconnectPrompt';

// Integration
export {
  GitHubReconnectManager,
  githubReconnectManager,
  useGitHubReconnect,
  GitHubAuthStatus,
  type GitHubReconnectEvent,
} from './github-reconnect-integration';

// Examples
export {
  AppWithGitHubPrompt,
  AppWithManualPromptControl,
  AppWithReconnectEventListener,
} from './example-integration';
