/**
 * GitHub Reconnect Integration
 * Handles the detection and management of GitHub reconnection needs
 */

/**
 * GitHub authentication status enum
 */
export enum GitHubAuthStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  EXPIRED = 'expired',
  INVALID_TOKEN = 'invalid_token',
}

/**
 * GitHub reconnect event type
 */
export interface GitHubReconnectEvent {
  status: GitHubAuthStatus;
  error?: Error;
  timestamp: Date;
}

/**
 * Manager for GitHub reconnect prompts
 */
export class GitHubReconnectManager {
  private listeners: Set<(event: GitHubReconnectEvent) => void> = new Set();
  private currentStatus: GitHubAuthStatus = GitHubAuthStatus.CONNECTED;
  private checkInterval: number | null = null;
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

  /**
   * Subscribe to reconnect events
   */
  subscribe(callback: (event: GitHubReconnectEvent) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Start monitoring GitHub authentication status
   */
  startMonitoring(): void {
    if (this.checkInterval !== null) {
      return; // Already monitoring
    }

    this.checkAuthStatus();
    this.checkInterval = window.setInterval(
      () => this.checkAuthStatus(),
      this.CHECK_INTERVAL_MS
    );
  }

  /**
   * Stop monitoring GitHub authentication status
   */
  stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check current GitHub authentication status
   */
  private async checkAuthStatus(): Promise<void> {
    try {
      const response = await fetch('/api/github/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let newStatus: GitHubAuthStatus;

      if (response.ok) {
        const data = await response.json();
        newStatus = data.authenticated
          ? GitHubAuthStatus.CONNECTED
          : GitHubAuthStatus.DISCONNECTED;
      } else if (response.status === 401) {
        newStatus = GitHubAuthStatus.INVALID_TOKEN;
      } else if (response.status === 403) {
        newStatus = GitHubAuthStatus.EXPIRED;
      } else {
        newStatus = GitHubAuthStatus.DISCONNECTED;
      }

      if (newStatus !== this.currentStatus) {
        this.currentStatus = newStatus;
        this.notifyListeners({
          status: newStatus,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to check GitHub auth status:', error);
      this.notifyListeners({
        status: GitHubAuthStatus.DISCONNECTED,
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get current authentication status
   */
  getStatus(): GitHubAuthStatus {
    return this.currentStatus;
  }

  /**
   * Initiate GitHub reconnection flow
   */
  async reconnect(): Promise<boolean> {
    try {
      const response = await fetch('/api/github/reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.currentStatus = GitHubAuthStatus.CONNECTED;
        this.notifyListeners({
          status: GitHubAuthStatus.CONNECTED,
          timestamp: new Date(),
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to reconnect to GitHub:', error);
      return false;
    }
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(event: GitHubReconnectEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in GitHub reconnect listener:', error);
      }
    });
  }
}

/**
 * Global instance of GitHub reconnect manager
 */
export const githubReconnectManager = new GitHubReconnectManager();

/**
 * Hook-like function to use GitHub reconnect in React components
 */
export function useGitHubReconnect() {
  return {
    manager: githubReconnectManager,
    status: githubReconnectManager.getStatus(),
    startMonitoring: () => githubReconnectManager.startMonitoring(),
    stopMonitoring: () => githubReconnectManager.stopMonitoring(),
    reconnect: () => githubReconnectManager.reconnect(),
  };
}
