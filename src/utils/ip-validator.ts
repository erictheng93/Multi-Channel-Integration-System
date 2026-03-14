// IP Whitelist Validator
// Validates IP addresses against platform-specific CIDR ranges
// Used for webhook security to ensure requests come from official platform IPs

import * as ipaddr from 'ipaddr.js';

/**
 * IP range configuration for a platform
 */
export interface IPRange {
  cidr: string;
  platform: 'line' | 'facebook' | 'whatsapp' | 'instagram';
}

/**
 * Parsed CIDR range
 */
interface ParsedCIDR {
  network: ipaddr.IPv4 | ipaddr.IPv6;
  prefixLength: number;
}

/**
 * IP Whitelist Validator
 * Validates incoming webhook IPs against official platform IP ranges
 */
export class IPValidator {
  private allowedRanges: IPRange[];
  private parsedRanges: Map<string, ParsedCIDR>;

  constructor(ranges: IPRange[]) {
    this.allowedRanges = ranges;
    this.parsedRanges = new Map();

    // Pre-parse all CIDR ranges for performance
    for (const range of ranges) {
      try {
        const parsed = this.parseCIDR(range.cidr);
        this.parsedRanges.set(range.cidr, parsed);
      } catch (error) {
        console.error(`[IPValidator] Failed to parse CIDR ${range.cidr}:`, error);
      }
    }
  }

  /**
   * Check if an IP address is in the allowed ranges for a platform
   *
   * @param ip - IP address to check (e.g., '147.92.150.1')
   * @param platform - Platform name (e.g., 'line', 'facebook')
   * @returns true if IP is whitelisted, false otherwise
   */
  isAllowed(ip: string, platform: string): boolean {
    try {
      // Parse incoming IP address
      let addr: ipaddr.IPv4 | ipaddr.IPv6;

      try {
        addr = ipaddr.parse(ip);
      } catch (parseError) {
        console.warn(`[IPValidator] Invalid IP address format: ${ip}`);
        return false;
      }

      // Check against all ranges for this platform
      const platformRanges = this.allowedRanges.filter(r => r.platform === platform);

      for (const range of platformRanges) {
        const parsed = this.parsedRanges.get(range.cidr);
        if (!parsed) continue;

        // Check if IP is in this CIDR range
        if (this.isInRange(addr, parsed)) {
          console.log(`[IPValidator] IP ${ip} matched ${platform} range ${range.cidr}`);
          return true;
        }
      }

      console.warn(`[IPValidator] IP ${ip} not in any ${platform} whitelist range`);
      return false;
    } catch (error) {
      console.error('[IPValidator] Error validating IP:', error);
      // Fail closed - reject unvalidated IPs
      return false;
    }
  }

  /**
   * Check if an IP address falls within a CIDR range
   */
  private isInRange(ip: ipaddr.IPv4 | ipaddr.IPv6, range: ParsedCIDR): boolean {
    try {
      // Ensure IP and network are same type (IPv4/IPv6)
      if (ip.kind() !== range.network.kind()) {
        return false;
      }

      // Use ipaddr.js match() method to check if IP is in CIDR range
      return ip.match(range.network, range.prefixLength);
    } catch (error) {
      console.error('[IPValidator] Error checking IP range:', error);
      return false;
    }
  }

  /**
   * Parse CIDR notation into network address and prefix length
   *
   * @param cidr - CIDR notation (e.g., '147.92.128.0/17')
   * @returns Parsed network and prefix length
   */
  private parseCIDR(cidr: string): ParsedCIDR {
    const [networkStr, prefixStr] = cidr.split('/');

    if (!networkStr || !prefixStr) {
      throw new Error(`Invalid CIDR notation: ${cidr}`);
    }

    const network = ipaddr.parse(networkStr);
    const prefixLength = parseInt(prefixStr, 10);

    if (isNaN(prefixLength)) {
      throw new Error(`Invalid prefix length in CIDR: ${cidr}`);
    }

    // Validate prefix length range
    const maxPrefix = network.kind() === 'ipv4' ? 32 : 128;
    if (prefixLength < 0 || prefixLength > maxPrefix) {
      throw new Error(`Prefix length out of range for ${network.kind()}: ${prefixLength}`);
    }

    return { network, prefixLength };
  }

  /**
   * Get all allowed ranges for a platform
   */
  getRangesForPlatform(platform: string): IPRange[] {
    return this.allowedRanges.filter(r => r.platform === platform);
  }

  /**
   * Get total number of configured ranges
   */
  getTotalRanges(): number {
    return this.allowedRanges.length;
  }
}

/**
 * Official IP ranges for LINE platform
 * Source: https://developers.line.biz/en/reference/messaging-api/#ip-addresses
 */
export const LINE_IP_RANGES: IPRange[] = [
  { cidr: '147.92.128.0/17', platform: 'line' },  // LINE official IPs
  { cidr: '203.104.128.0/17', platform: 'line' }  // LINE backup IPs
];

/**
 * Official IP ranges for Facebook/Instagram platform
 * Source: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#ip-ranges
 */
export const FACEBOOK_IP_RANGES: IPRange[] = [
  { cidr: '31.13.24.0/21', platform: 'facebook' },
  { cidr: '31.13.64.0/18', platform: 'facebook' },
  { cidr: '66.220.144.0/20', platform: 'facebook' },
  { cidr: '69.63.176.0/20', platform: 'facebook' },
  { cidr: '69.171.224.0/19', platform: 'facebook' },
  { cidr: '74.119.76.0/22', platform: 'facebook' },
  { cidr: '103.4.96.0/22', platform: 'facebook' },
  { cidr: '157.240.0.0/17', platform: 'facebook' },
  { cidr: '173.252.64.0/18', platform: 'facebook' },
  { cidr: '179.60.192.0/22', platform: 'facebook' },
  { cidr: '185.60.216.0/22', platform: 'facebook' },
  { cidr: '204.15.20.0/22', platform: 'facebook' }
];

/**
 * Create IP validator with all platform ranges
 */
export function createIPValidator(): IPValidator {
  return new IPValidator([...LINE_IP_RANGES, ...FACEBOOK_IP_RANGES]);
}
