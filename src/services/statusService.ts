import AsyncStorage from '@react-native-async-storage/async-storage';
import * as cpanelService from './cpanelService';

export interface Status {
  id: number;
  type: 'case_status' | 'repair_status';
  name: string;
  color: string;
  bgColor: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StatusesResponse {
  case_status: Status[];
  repair_status: Status[];
}

const STORAGE_KEY = '@statuses_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

class StatusService {
  private cachedStatuses: StatusesResponse | null = null;
  private lastFetchTime: number = 0;

  /**
   * Fetch statuses from cPanel with caching
   */
  async getStatuses(forceRefresh: boolean = false): Promise<StatusesResponse> {
    const now = Date.now();
    
    // Return cached data if available and not expired
    if (!forceRefresh && this.cachedStatuses && (now - this.lastFetchTime) < CACHE_EXPIRY) {
      console.log('[StatusService] Returning cached statuses');
      return this.cachedStatuses;
    }

    try {
      console.log('[StatusService] Fetching statuses from cPanel...');
      console.log('[StatusService] cpanelService methods:', Object.keys(cpanelService));
      
      const response = await cpanelService.fetchFromCPanel('get-statuses.php', {
        method: 'GET',
      });

      console.log('[StatusService] Response received:', JSON.stringify(response).substring(0, 200));

      if (!response.success || !response.data?.statuses) {
        throw new Error('Failed to fetch statuses from server');
      }

      const statuses: StatusesResponse = response.data.statuses;

      // Cache in memory
      this.cachedStatuses = statuses;
      this.lastFetchTime = now;

      // Cache in AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        statuses,
        timestamp: now
      }));

      console.log('[StatusService] Fetched', response.data.count, 'statuses:', {
        case_status: statuses.case_status.length,
        repair_status: statuses.repair_status.length
      });

      return statuses;

    } catch (error) {
      console.error('[StatusService] Error fetching statuses:', error);
      
      // Try to return cached data from AsyncStorage
      const cached = await this.getCachedStatuses();
      if (cached) {
        console.log('[StatusService] Returning cached statuses from storage');
        this.cachedStatuses = cached;
        return cached;
      }

      // Return empty arrays as fallback
      return {
        case_status: [],
        repair_status: []
      };
    }
  }

  /**
   * Get cached statuses from AsyncStorage
   */
  private async getCachedStatuses(): Promise<StatusesResponse | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { statuses, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        // Return cached data even if expired (better than nothing)
        if (age < CACHE_EXPIRY * 2) { // Allow 48 hours for offline mode
          return statuses;
        }
      }
    } catch (error) {
      console.error('[StatusService] Error reading cached statuses:', error);
    }
    return null;
  }

  /**
   * Get case statuses only
   */
  async getCaseStatuses(forceRefresh: boolean = false): Promise<Status[]> {
    const statuses = await this.getStatuses(forceRefresh);
    return statuses.case_status;
  }

  /**
   * Get repair statuses only
   */
  async getRepairStatuses(forceRefresh: boolean = false): Promise<Status[]> {
    const statuses = await this.getStatuses(forceRefresh);
    return statuses.repair_status;
  }

  /**
   * Find status by ID
   */
  async getStatusById(id: number, type: 'case_status' | 'repair_status'): Promise<Status | null> {
    const statuses = await this.getStatuses();
    const statusList = type === 'case_status' ? statuses.case_status : statuses.repair_status;
    return statusList.find(s => s.id === id) || null;
  }

  /**
   * Find status by name (legacy compatibility)
   */
  async getStatusByName(name: string, type: 'case_status' | 'repair_status'): Promise<Status | null> {
    const statuses = await this.getStatuses();
    const statusList = type === 'case_status' ? statuses.case_status : statuses.repair_status;
    return statusList.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Clear cache and force refresh
   */
  async clearCache(): Promise<void> {
    this.cachedStatuses = null;
    this.lastFetchTime = 0;
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('[StatusService] Cache cleared');
  }

  /**
   * Preload statuses in the background
   */
  async preloadStatuses(): Promise<void> {
    try {
      await this.getStatuses();
    } catch (error) {
      // Silently fail, not critical
      console.log('[StatusService] Preload failed:', error);
    }
  }
}

export default new StatusService();
