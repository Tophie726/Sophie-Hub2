/**
 * Connector Registry
 *
 * Singleton registry for managing data source connectors.
 * All connectors must be registered here to be available for use.
 *
 * Usage:
 * ```typescript
 * import { getConnector, getConnectorRegistry } from '@/lib/connectors'
 *
 * // Get a specific connector
 * const sheetsConnector = getConnector('google_sheet')
 *
 * // List all available connectors
 * const all = getConnectorRegistry().getAll()
 * ```
 */

import type { IConnector } from './base'
import type { ConnectorTypeId, ConnectorMetadata, ConnectorConfig } from './types'

/**
 * Registry for managing connector instances
 */
export class ConnectorRegistry {
  private connectors = new Map<ConnectorTypeId, IConnector>()

  /**
   * Register a connector implementation
   *
   * @param connector - The connector instance to register
   * @throws Error if a connector with the same ID is already registered
   */
  register(connector: IConnector): void {
    const typeId = connector.metadata.id
    if (this.connectors.has(typeId)) {
      throw new Error(`Connector '${typeId}' is already registered`)
    }
    this.connectors.set(typeId, connector)
  }

  /**
   * Get a connector by type ID
   *
   * @param typeId - The connector type identifier
   * @returns The connector instance
   * @throws Error if connector is not found
   */
  get<T extends ConnectorConfig = ConnectorConfig>(
    typeId: ConnectorTypeId
  ): IConnector<T> {
    const connector = this.connectors.get(typeId)
    if (!connector) {
      throw new Error(`Connector '${typeId}' is not registered`)
    }
    return connector as IConnector<T>
  }

  /**
   * Check if a connector type is registered
   *
   * @param typeId - The connector type identifier
   * @returns true if registered
   */
  has(typeId: ConnectorTypeId): boolean {
    return this.connectors.has(typeId)
  }

  /**
   * Get metadata for all registered connectors
   *
   * @param enabledOnly - If true, only return enabled connectors (default: false)
   * @returns Array of connector metadata
   */
  getAll(enabledOnly = false): ConnectorMetadata[] {
    const all = Array.from(this.connectors.values()).map((c) => c.metadata)
    if (enabledOnly) {
      return all.filter((m) => m.enabled)
    }
    return all
  }

  /**
   * Get all registered connector type IDs
   *
   * @returns Array of type IDs
   */
  getTypeIds(): ConnectorTypeId[] {
    return Array.from(this.connectors.keys())
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let registryInstance: ConnectorRegistry | null = null

/**
 * Get the singleton connector registry instance
 *
 * This singleton pattern prevents multiple registry instances
 * and ensures all connectors are registered in one place.
 */
export function getConnectorRegistry(): ConnectorRegistry {
  if (!registryInstance) {
    registryInstance = new ConnectorRegistry()
  }
  return registryInstance
}

// =============================================================================
// Convenience Helpers
// =============================================================================

/**
 * Get a connector by type ID (convenience wrapper)
 *
 * @param typeId - The connector type identifier
 * @returns The connector instance
 * @throws Error if connector is not found
 */
export function getConnector<T extends ConnectorConfig = ConnectorConfig>(
  typeId: ConnectorTypeId
): IConnector<T> {
  return getConnectorRegistry().get<T>(typeId)
}

/**
 * Check if a connector type is registered (convenience wrapper)
 *
 * @param typeId - The connector type identifier
 * @returns true if registered
 */
export function hasConnector(typeId: ConnectorTypeId): boolean {
  return getConnectorRegistry().has(typeId)
}

/**
 * Register a connector (convenience wrapper)
 *
 * @param connector - The connector instance to register
 */
export function registerConnector(connector: IConnector): void {
  getConnectorRegistry().register(connector)
}
