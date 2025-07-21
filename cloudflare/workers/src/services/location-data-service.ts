/**
 * Location Data Service
 * Fetches and caches real-world location data for synthetic data generation
 */

interface CityZipData {
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

interface AreaCodeData {
  areaCode: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
}

interface LocationData {
  cityZipData: Map<string, CityZipData[]>; // Key: state code
  areaCodeData: Map<string, AreaCodeData[]>; // Key: state code
  lastUpdated: number;
}

export class LocationDataService {
  private static instance: LocationDataService;
  private locationData: LocationData | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  // SimpleMaps free ZIP database (requires attribution)
  private readonly SIMPLEMAPS_URL = 'https://simplemaps.com/static/data/us-zips/1.911/basic/simplemaps_uszips_basicv1.911.zip';
  
  // GitHub raw CSV URLs for area codes
  private readonly AREA_CODE_URL = 'https://raw.githubusercontent.com/ravisorg/Area-Code-Geolocation-Database/master/us-area-code-cities.csv';
  
  // Additional comprehensive dataset
  private readonly GEOINFO_ZIP_URL = 'https://raw.githubusercontent.com/djbelieny/geoinfo-dataset/master/unique_zip_codes.csv';

  private constructor() {}

  public static getInstance(): LocationDataService {
    if (!LocationDataService.instance) {
      LocationDataService.instance = new LocationDataService();
    }
    return LocationDataService.instance;
  }

  /**
   * Get location data, fetching if necessary
   */
  public async getLocationData(): Promise<LocationData> {
    if (this.locationData && this.isCacheValid()) {
      return this.locationData;
    }

    await this.fetchLocationData();
    if (!this.locationData) {
      throw new Error('Failed to fetch location data');
    }
    
    return this.locationData;
  }

  /**
   * Get list of supported states with real data
   */
  public async getSupportedStates(): Promise<string[]> {
    const data = await this.getLocationData();
    return Array.from(data.cityZipData.keys()).sort();
  }

  /**
   * Get cities for a specific state
   */
  public async getCitiesForState(state: string): Promise<CityZipData[]> {
    const data = await this.getLocationData();
    return data.cityZipData.get(state.toUpperCase()) || [];
  }

  /**
   * Get area codes for a specific state
   */
  public async getAreaCodesForState(state: string): Promise<AreaCodeData[]> {
    const data = await this.getLocationData();
    return data.areaCodeData.get(state.toUpperCase()) || [];
  }

  /**
   * Get a random city/ZIP combination for a state
   */
  public async getRandomCityZip(state?: string): Promise<CityZipData | null> {
    const data = await this.getLocationData();
    
    if (state) {
      const stateCities = data.cityZipData.get(state.toUpperCase());
      if (!stateCities || stateCities.length === 0) return null;
      return stateCities[Math.floor(Math.random() * stateCities.length)];
    }
    
    // If no state specified, pick from all states
    const allStates = Array.from(data.cityZipData.keys());
    if (allStates.length === 0) return null;
    
    const randomState = allStates[Math.floor(Math.random() * allStates.length)];
    const stateCities = data.cityZipData.get(randomState)!;
    return stateCities[Math.floor(Math.random() * stateCities.length)];
  }

  /**
   * Get a random area code for a state
   */
  public async getRandomAreaCode(state?: string): Promise<string> {
    const data = await this.getLocationData();
    
    if (state) {
      const stateAreaCodes = data.areaCodeData.get(state.toUpperCase());
      if (!stateAreaCodes || stateAreaCodes.length === 0) {
        // Fallback to generic area codes if state not found
        return this.generateFallbackAreaCode();
      }
      return stateAreaCodes[Math.floor(Math.random() * stateAreaCodes.length)].areaCode;
    }
    
    // If no state specified, pick from all area codes
    const allStates = Array.from(data.areaCodeData.keys());
    if (allStates.length === 0) return this.generateFallbackAreaCode();
    
    const randomState = allStates[Math.floor(Math.random() * allStates.length)];
    const stateAreaCodes = data.areaCodeData.get(randomState)!;
    return stateAreaCodes[Math.floor(Math.random() * stateAreaCodes.length)].areaCode;
  }

  private isCacheValid(): boolean {
    if (!this.locationData) return false;
    return Date.now() - this.locationData.lastUpdated < this.CACHE_DURATION;
  }

  private async fetchLocationData(): Promise<void> {
    try {
      // For now, we'll use hardcoded data samples
      // In production, this would fetch from the URLs above
      this.locationData = await this.loadSampleData();
    } catch (error) {
      console.error('Failed to fetch location data:', error);
      // Fall back to hardcoded data
      this.locationData = this.getHardcodedData();
    }
  }

  private async loadSampleData(): Promise<LocationData> {
    // In a real implementation, this would:
    // 1. Fetch CSV data from the URLs
    // 2. Parse the CSV
    // 3. Build the data structures
    
    // For now, return hardcoded comprehensive data
    return this.getHardcodedData();
  }

  private generateFallbackAreaCode(): string {
    // Generate a valid-looking area code (avoiding reserved codes)
    const validFirstDigits = [2, 3, 4, 5, 6, 7, 8, 9];
    const firstDigit = validFirstDigits[Math.floor(Math.random() * validFirstDigits.length)];
    const secondDigit = Math.floor(Math.random() * 10);
    const thirdDigit = Math.floor(Math.random() * 10);
    return `${firstDigit}${secondDigit}${thirdDigit}`;
  }

  private getHardcodedData(): LocationData {
    const cityZipData = new Map<string, CityZipData[]>();
    const areaCodeData = new Map<string, AreaCodeData[]>();
    
    // Comprehensive city/ZIP data by state
    cityZipData.set('CA', [
      { city: 'Los Angeles', state: 'CA', zip: '90001', lat: 33.9731, lng: -118.2479 },
      { city: 'Los Angeles', state: 'CA', zip: '90210', lat: 34.0901, lng: -118.4065 },
      { city: 'San Francisco', state: 'CA', zip: '94102', lat: 37.7813, lng: -122.4189 },
      { city: 'San Francisco', state: 'CA', zip: '94107', lat: 37.7665, lng: -122.3962 },
      { city: 'San Diego', state: 'CA', zip: '92101', lat: 32.7194, lng: -117.1629 },
      { city: 'San Diego', state: 'CA', zip: '92128', lat: 33.0061, lng: -117.0678 },
      { city: 'Sacramento', state: 'CA', zip: '95814', lat: 38.5789, lng: -121.4944 },
      { city: 'Oakland', state: 'CA', zip: '94612', lat: 37.8095, lng: -122.2708 },
      { city: 'Fresno', state: 'CA', zip: '93721', lat: 36.7797, lng: -119.7901 },
      { city: 'San Jose', state: 'CA', zip: '95113', lat: 37.3337, lng: -121.8907 },
      { city: 'Palo Alto', state: 'CA', zip: '94301', lat: 37.4444, lng: -122.1607 },
      { city: 'Pasadena', state: 'CA', zip: '91101', lat: 34.1467, lng: -118.1445 }
    ]);

    cityZipData.set('TX', [
      { city: 'Houston', state: 'TX', zip: '77001', lat: 29.7543, lng: -95.3588 },
      { city: 'Houston', state: 'TX', zip: '77056', lat: 29.7329, lng: -95.4860 },
      { city: 'Austin', state: 'TX', zip: '78701', lat: 30.2711, lng: -97.7437 },
      { city: 'Austin', state: 'TX', zip: '78759', lat: 30.4011, lng: -97.7481 },
      { city: 'Dallas', state: 'TX', zip: '75201', lat: 32.7817, lng: -96.7970 },
      { city: 'Dallas', state: 'TX', zip: '75225', lat: 32.8354, lng: -96.7899 },
      { city: 'San Antonio', state: 'TX', zip: '78205', lat: 29.4246, lng: -98.4951 },
      { city: 'Fort Worth', state: 'TX', zip: '76102', lat: 32.7478, lng: -97.3261 },
      { city: 'El Paso', state: 'TX', zip: '79901', lat: 31.7592, lng: -106.4874 },
      { city: 'Plano', state: 'TX', zip: '75074', lat: 33.0506, lng: -96.7485 }
    ]);

    cityZipData.set('NY', [
      { city: 'New York', state: 'NY', zip: '10001', lat: 40.7506, lng: -73.9972 },
      { city: 'New York', state: 'NY', zip: '10013', lat: 40.7203, lng: -74.0049 },
      { city: 'Brooklyn', state: 'NY', zip: '11201', lat: 40.6943, lng: -73.9892 },
      { city: 'Brooklyn', state: 'NY', zip: '11215', lat: 40.6627, lng: -73.9857 },
      { city: 'Queens', state: 'NY', zip: '11101', lat: 40.7471, lng: -73.9400 },
      { city: 'Buffalo', state: 'NY', zip: '14201', lat: 42.8927, lng: -78.8737 },
      { city: 'Rochester', state: 'NY', zip: '14604', lat: 43.1572, lng: -77.6080 },
      { city: 'Syracuse', state: 'NY', zip: '13202', lat: 43.0410, lng: -76.1436 },
      { city: 'Albany', state: 'NY', zip: '12207', lat: 42.6598, lng: -73.7539 },
      { city: 'Yonkers', state: 'NY', zip: '10701', lat: 40.9338, lng: -73.8987 }
    ]);

    cityZipData.set('FL', [
      { city: 'Miami', state: 'FL', zip: '33125', lat: 25.7788, lng: -80.2341 },
      { city: 'Miami', state: 'FL', zip: '33131', lat: 25.7658, lng: -80.1885 },
      { city: 'Tampa', state: 'FL', zip: '33602', lat: 27.9481, lng: -82.4569 },
      { city: 'Orlando', state: 'FL', zip: '32801', lat: 28.5469, lng: -81.3790 },
      { city: 'Jacksonville', state: 'FL', zip: '32202', lat: 30.3270, lng: -81.6556 },
      { city: 'Tallahassee', state: 'FL', zip: '32301', lat: 30.4547, lng: -84.2533 },
      { city: 'Fort Lauderdale', state: 'FL', zip: '33301', lat: 26.1237, lng: -80.1436 },
      { city: 'West Palm Beach', state: 'FL', zip: '33401', lat: 26.7105, lng: -80.0643 },
      { city: 'Naples', state: 'FL', zip: '34102', lat: 26.1420, lng: -81.7948 }
    ]);

    cityZipData.set('IL', [
      { city: 'Chicago', state: 'IL', zip: '60601', lat: 41.8855, lng: -87.6227 },
      { city: 'Chicago', state: 'IL', zip: '60611', lat: 41.8954, lng: -87.6243 },
      { city: 'Chicago', state: 'IL', zip: '60657', lat: 41.9396, lng: -87.6547 },
      { city: 'Aurora', state: 'IL', zip: '60505', lat: 41.7519, lng: -88.3227 },
      { city: 'Rockford', state: 'IL', zip: '61101', lat: 42.2583, lng: -89.0644 },
      { city: 'Springfield', state: 'IL', zip: '62701', lat: 39.7911, lng: -89.6446 },
      { city: 'Naperville', state: 'IL', zip: '60540', lat: 41.7508, lng: -88.1535 }
    ]);

    // Area code data by state
    areaCodeData.set('CA', [
      { areaCode: '213', city: 'Los Angeles', state: 'CA' },
      { areaCode: '310', city: 'Los Angeles', state: 'CA' },
      { areaCode: '323', city: 'Los Angeles', state: 'CA' },
      { areaCode: '415', city: 'San Francisco', state: 'CA' },
      { areaCode: '510', city: 'Oakland', state: 'CA' },
      { areaCode: '619', city: 'San Diego', state: 'CA' },
      { areaCode: '626', city: 'Pasadena', state: 'CA' },
      { areaCode: '650', city: 'Palo Alto', state: 'CA' },
      { areaCode: '714', city: 'Anaheim', state: 'CA' },
      { areaCode: '818', city: 'San Fernando', state: 'CA' },
      { areaCode: '916', city: 'Sacramento', state: 'CA' },
      { areaCode: '925', city: 'Concord', state: 'CA' },
      { areaCode: '949', city: 'Irvine', state: 'CA' }
    ]);

    areaCodeData.set('TX', [
      { areaCode: '214', city: 'Dallas', state: 'TX' },
      { areaCode: '281', city: 'Houston', state: 'TX' },
      { areaCode: '409', city: 'Beaumont', state: 'TX' },
      { areaCode: '469', city: 'Dallas', state: 'TX' },
      { areaCode: '512', city: 'Austin', state: 'TX' },
      { areaCode: '713', city: 'Houston', state: 'TX' },
      { areaCode: '737', city: 'Austin', state: 'TX' },
      { areaCode: '817', city: 'Fort Worth', state: 'TX' },
      { areaCode: '832', city: 'Houston', state: 'TX' },
      { areaCode: '903', city: 'Tyler', state: 'TX' },
      { areaCode: '915', city: 'El Paso', state: 'TX' },
      { areaCode: '972', city: 'Dallas', state: 'TX' }
    ]);

    areaCodeData.set('NY', [
      { areaCode: '212', city: 'New York', state: 'NY' },
      { areaCode: '315', city: 'Syracuse', state: 'NY' },
      { areaCode: '347', city: 'Brooklyn', state: 'NY' },
      { areaCode: '516', city: 'Nassau', state: 'NY' },
      { areaCode: '518', city: 'Albany', state: 'NY' },
      { areaCode: '585', city: 'Rochester', state: 'NY' },
      { areaCode: '607', city: 'Binghamton', state: 'NY' },
      { areaCode: '631', city: 'Suffolk', state: 'NY' },
      { areaCode: '646', city: 'Manhattan', state: 'NY' },
      { areaCode: '716', city: 'Buffalo', state: 'NY' },
      { areaCode: '718', city: 'New York', state: 'NY' },
      { areaCode: '845', city: 'Poughkeepsie', state: 'NY' },
      { areaCode: '914', city: 'White Plains', state: 'NY' },
      { areaCode: '917', city: 'New York', state: 'NY' },
      { areaCode: '929', city: 'Brooklyn', state: 'NY' }
    ]);

    areaCodeData.set('FL', [
      { areaCode: '239', city: 'Fort Myers', state: 'FL' },
      { areaCode: '305', city: 'Miami', state: 'FL' },
      { areaCode: '321', city: 'Orlando', state: 'FL' },
      { areaCode: '352', city: 'Gainesville', state: 'FL' },
      { areaCode: '386', city: 'Daytona Beach', state: 'FL' },
      { areaCode: '407', city: 'Orlando', state: 'FL' },
      { areaCode: '561', city: 'West Palm Beach', state: 'FL' },
      { areaCode: '727', city: 'St. Petersburg', state: 'FL' },
      { areaCode: '754', city: 'Fort Lauderdale', state: 'FL' },
      { areaCode: '786', city: 'Miami', state: 'FL' },
      { areaCode: '813', city: 'Tampa', state: 'FL' },
      { areaCode: '850', city: 'Tallahassee', state: 'FL' },
      { areaCode: '863', city: 'Lakeland', state: 'FL' },
      { areaCode: '904', city: 'Jacksonville', state: 'FL' },
      { areaCode: '941', city: 'Sarasota', state: 'FL' },
      { areaCode: '954', city: 'Fort Lauderdale', state: 'FL' }
    ]);

    areaCodeData.set('IL', [
      { areaCode: '217', city: 'Springfield', state: 'IL' },
      { areaCode: '224', city: 'Arlington Heights', state: 'IL' },
      { areaCode: '309', city: 'Peoria', state: 'IL' },
      { areaCode: '312', city: 'Chicago', state: 'IL' },
      { areaCode: '331', city: 'Aurora', state: 'IL' },
      { areaCode: '618', city: 'Belleville', state: 'IL' },
      { areaCode: '630', city: 'Aurora', state: 'IL' },
      { areaCode: '708', city: 'Cicero', state: 'IL' },
      { areaCode: '773', city: 'Chicago', state: 'IL' },
      { areaCode: '779', city: 'Rockford', state: 'IL' },
      { areaCode: '815', city: 'Rockford', state: 'IL' },
      { areaCode: '847', city: 'Arlington Heights', state: 'IL' },
      { areaCode: '872', city: 'Chicago', state: 'IL' }
    ]);

    // Add more states with comprehensive data
    const additionalStates = {
      'PA': {
        cities: [
          { city: 'Philadelphia', state: 'PA', zip: '19102', lat: 39.9513, lng: -75.1638 },
          { city: 'Pittsburgh', state: 'PA', zip: '15222', lat: 40.4397, lng: -79.9965 },
          { city: 'Allentown', state: 'PA', zip: '18101', lat: 40.6023, lng: -75.4714 },
          { city: 'Erie', state: 'PA', zip: '16501', lat: 42.1168, lng: -80.0733 },
          { city: 'Reading', state: 'PA', zip: '19601', lat: 40.3356, lng: -75.9268 },
          { city: 'Scranton', state: 'PA', zip: '18503', lat: 41.4044, lng: -75.6649 },
          { city: 'Bethlehem', state: 'PA', zip: '18015', lat: 40.6278, lng: -75.3704 },
          { city: 'Lancaster', state: 'PA', zip: '17601', lat: 40.0420, lng: -76.3012 }
        ],
        areaCodes: [
          { areaCode: '215', city: 'Philadelphia', state: 'PA' },
          { areaCode: '267', city: 'Philadelphia', state: 'PA' },
          { areaCode: '412', city: 'Pittsburgh', state: 'PA' },
          { areaCode: '484', city: 'Allentown', state: 'PA' },
          { areaCode: '570', city: 'Scranton', state: 'PA' },
          { areaCode: '610', city: 'Reading', state: 'PA' },
          { areaCode: '717', city: 'Lancaster', state: 'PA' },
          { areaCode: '724', city: 'New Castle', state: 'PA' },
          { areaCode: '814', city: 'Erie', state: 'PA' },
          { areaCode: '878', city: 'Pittsburgh', state: 'PA' }
        ]
      },
      'OH': {
        cities: [
          { city: 'Columbus', state: 'OH', zip: '43215', lat: 39.9652, lng: -83.0033 },
          { city: 'Cleveland', state: 'OH', zip: '44114', lat: 41.5051, lng: -81.6934 },
          { city: 'Cincinnati', state: 'OH', zip: '45202', lat: 39.1014, lng: -84.5125 },
          { city: 'Toledo', state: 'OH', zip: '43604', lat: 41.6639, lng: -83.5552 },
          { city: 'Akron', state: 'OH', zip: '44308', lat: 41.0798, lng: -81.5190 },
          { city: 'Dayton', state: 'OH', zip: '45402', lat: 39.7595, lng: -84.1917 }
        ],
        areaCodes: [
          { areaCode: '216', city: 'Cleveland', state: 'OH' },
          { areaCode: '234', city: 'Youngstown', state: 'OH' },
          { areaCode: '330', city: 'Akron', state: 'OH' },
          { areaCode: '380', city: 'Columbus', state: 'OH' },
          { areaCode: '419', city: 'Toledo', state: 'OH' },
          { areaCode: '440', city: 'Parma', state: 'OH' },
          { areaCode: '513', city: 'Cincinnati', state: 'OH' },
          { areaCode: '567', city: 'Toledo', state: 'OH' },
          { areaCode: '614', city: 'Columbus', state: 'OH' },
          { areaCode: '740', city: 'Marion', state: 'OH' },
          { areaCode: '937', city: 'Dayton', state: 'OH' }
        ]
      },
      'GA': {
        cities: [
          { city: 'Atlanta', state: 'GA', zip: '30303', lat: 33.7491, lng: -84.3902 },
          { city: 'Augusta', state: 'GA', zip: '30901', lat: 33.4709, lng: -81.9748 },
          { city: 'Columbus', state: 'GA', zip: '31901', lat: 32.4597, lng: -84.9878 },
          { city: 'Savannah', state: 'GA', zip: '31401', lat: 32.0810, lng: -81.0912 },
          { city: 'Athens', state: 'GA', zip: '30601', lat: 33.9550, lng: -83.3824 },
          { city: 'Macon', state: 'GA', zip: '31201', lat: 32.8407, lng: -83.6324 }
        ],
        areaCodes: [
          { areaCode: '229', city: 'Albany', state: 'GA' },
          { areaCode: '404', city: 'Atlanta', state: 'GA' },
          { areaCode: '470', city: 'Atlanta', state: 'GA' },
          { areaCode: '478', city: 'Macon', state: 'GA' },
          { areaCode: '678', city: 'Atlanta', state: 'GA' },
          { areaCode: '706', city: 'Augusta', state: 'GA' },
          { areaCode: '762', city: 'Augusta', state: 'GA' },
          { areaCode: '770', city: 'Atlanta', state: 'GA' },
          { areaCode: '912', city: 'Savannah', state: 'GA' }
        ]
      }
    };

    // Add additional states to the maps
    for (const [state, data] of Object.entries(additionalStates)) {
      cityZipData.set(state, data.cities);
      areaCodeData.set(state, data.areaCodes);
    }

    return {
      cityZipData,
      areaCodeData,
      lastUpdated: Date.now()
    };
  }
}