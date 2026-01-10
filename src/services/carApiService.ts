/**
 * Car2DB API Service
 * Fetches car makes and models from car2db.com API
 * API Documentation: https://api.car2db.com/api/auto/v1/
 * 
 * Note: If API fails, fallback to hardcoded common car makes/models
 */

const CAR_API_BASE_URL = 'https://api.car2db.com/api/auto/v1';
const CAR_API_KEY = 'n.bikashvili88@gmail.com4680eb612be3f4a9d2a55b5065f738bd';

// Vehicle type ID for cars (id_type=1)
const VEHICLE_TYPE_CAR = 1;

// Fallback data for common car makes (used when API fails)
const FALLBACK_MAKES: CarMake[] = [
  { id: '1', name: 'Acura' },
  { id: '2', name: 'Alfa Romeo' },
  { id: '3', name: 'Audi' },
  { id: '4', name: 'BMW' },
  { id: '5', name: 'Buick' },
  { id: '6', name: 'Cadillac' },
  { id: '7', name: 'Chevrolet' },
  { id: '8', name: 'Chrysler' },
  { id: '9', name: 'Citroen' },
  { id: '10', name: 'Dacia' },
  { id: '11', name: 'Daewoo' },
  { id: '12', name: 'Dodge' },
  { id: '13', name: 'Fiat' },
  { id: '14', name: 'Ford' },
  { id: '15', name: 'Genesis' },
  { id: '16', name: 'GMC' },
  { id: '17', name: 'Honda' },
  { id: '18', name: 'Hyundai' },
  { id: '19', name: 'Infiniti' },
  { id: '20', name: 'Jaguar' },
  { id: '21', name: 'Jeep' },
  { id: '22', name: 'Kia' },
  { id: '23', name: 'Land Rover' },
  { id: '24', name: 'Lexus' },
  { id: '25', name: 'Lincoln' },
  { id: '26', name: 'Maserati' },
  { id: '27', name: 'Mazda' },
  { id: '28', name: 'Mercedes-Benz' },
  { id: '29', name: 'Mini' },
  { id: '30', name: 'Mitsubishi' },
  { id: '31', name: 'Nissan' },
  { id: '32', name: 'Opel' },
  { id: '33', name: 'Peugeot' },
  { id: '34', name: 'Porsche' },
  { id: '35', name: 'Ram' },
  { id: '36', name: 'Renault' },
  { id: '37', name: 'Skoda' },
  { id: '38', name: 'Subaru' },
  { id: '39', name: 'Suzuki' },
  { id: '40', name: 'Tesla' },
  { id: '41', name: 'Toyota' },
  { id: '42', name: 'Volkswagen' },
  { id: '43', name: 'Volvo' },
  { id: '44', name: 'სხვა (Other)' },
];

// Fallback models for common makes
const FALLBACK_MODELS: { [makeId: string]: CarModel[] } = {
  '41': [ // Toyota
    { id: 't1', makeId: '41', name: 'Camry' },
    { id: 't2', makeId: '41', name: 'Corolla' },
    { id: 't3', makeId: '41', name: 'RAV4' },
    { id: 't4', makeId: '41', name: 'Highlander' },
    { id: 't5', makeId: '41', name: 'Prius' },
    { id: 't6', makeId: '41', name: 'Land Cruiser' },
    { id: 't7', makeId: '41', name: 'Yaris' },
    { id: 't8', makeId: '41', name: 'Avalon' },
    { id: 't9', makeId: '41', name: '4Runner' },
    { id: 't10', makeId: '41', name: 'Tacoma' },
  ],
  '17': [ // Honda
    { id: 'h1', makeId: '17', name: 'Accord' },
    { id: 'h2', makeId: '17', name: 'Civic' },
    { id: 'h3', makeId: '17', name: 'CR-V' },
    { id: 'h4', makeId: '17', name: 'Pilot' },
    { id: 'h5', makeId: '17', name: 'HR-V' },
    { id: 'h6', makeId: '17', name: 'Odyssey' },
    { id: 'h7', makeId: '17', name: 'Fit' },
  ],
  '4': [ // BMW
    { id: 'b1', makeId: '4', name: '3 Series' },
    { id: 'b2', makeId: '4', name: '5 Series' },
    { id: 'b3', makeId: '4', name: '7 Series' },
    { id: 'b4', makeId: '4', name: 'X3' },
    { id: 'b5', makeId: '4', name: 'X5' },
    { id: 'b6', makeId: '4', name: 'X7' },
    { id: 'b7', makeId: '4', name: 'M3' },
    { id: 'b8', makeId: '4', name: 'M5' },
  ],
  '28': [ // Mercedes-Benz
    { id: 'm1', makeId: '28', name: 'C-Class' },
    { id: 'm2', makeId: '28', name: 'E-Class' },
    { id: 'm3', makeId: '28', name: 'S-Class' },
    { id: 'm4', makeId: '28', name: 'GLC' },
    { id: 'm5', makeId: '28', name: 'GLE' },
    { id: 'm6', makeId: '28', name: 'GLS' },
    { id: 'm7', makeId: '28', name: 'A-Class' },
    { id: 'm8', makeId: '28', name: 'CLA' },
  ],
  '18': [ // Hyundai
    { id: 'hy1', makeId: '18', name: 'Elantra' },
    { id: 'hy2', makeId: '18', name: 'Sonata' },
    { id: 'hy3', makeId: '18', name: 'Tucson' },
    { id: 'hy4', makeId: '18', name: 'Santa Fe' },
    { id: 'hy5', makeId: '18', name: 'Palisade' },
    { id: 'hy6', makeId: '18', name: 'Kona' },
    { id: 'hy7', makeId: '18', name: 'Accent' },
  ],
  '22': [ // Kia
    { id: 'k1', makeId: '22', name: 'Optima' },
    { id: 'k2', makeId: '22', name: 'Sportage' },
    { id: 'k3', makeId: '22', name: 'Sorento' },
    { id: 'k4', makeId: '22', name: 'Telluride' },
    { id: 'k5', makeId: '22', name: 'Forte' },
    { id: 'k6', makeId: '22', name: 'Rio' },
    { id: 'k7', makeId: '22', name: 'Soul' },
  ],
  '42': [ // Volkswagen
    { id: 'v1', makeId: '42', name: 'Golf' },
    { id: 'v2', makeId: '42', name: 'Passat' },
    { id: 'v3', makeId: '42', name: 'Tiguan' },
    { id: 'v4', makeId: '42', name: 'Atlas' },
    { id: 'v5', makeId: '42', name: 'Jetta' },
    { id: 'v6', makeId: '42', name: 'Arteon' },
    { id: 'v7', makeId: '42', name: 'ID.4' },
  ],
  '31': [ // Nissan
    { id: 'n1', makeId: '31', name: 'Altima' },
    { id: 'n2', makeId: '31', name: 'Sentra' },
    { id: 'n3', makeId: '31', name: 'Maxima' },
    { id: 'n4', makeId: '31', name: 'Rogue' },
    { id: 'n5', makeId: '31', name: 'Pathfinder' },
    { id: 'n6', makeId: '31', name: 'Murano' },
    { id: 'n7', makeId: '31', name: 'Armada' },
  ],
  '14': [ // Ford
    { id: 'f1', makeId: '14', name: 'F-150' },
    { id: 'f2', makeId: '14', name: 'Mustang' },
    { id: 'f3', makeId: '14', name: 'Explorer' },
    { id: 'f4', makeId: '14', name: 'Escape' },
    { id: 'f5', makeId: '14', name: 'Edge' },
    { id: 'f6', makeId: '14', name: 'Bronco' },
    { id: 'f7', makeId: '14', name: 'Focus' },
  ],
  '7': [ // Chevrolet
    { id: 'c1', makeId: '7', name: 'Silverado' },
    { id: 'c2', makeId: '7', name: 'Malibu' },
    { id: 'c3', makeId: '7', name: 'Equinox' },
    { id: 'c4', makeId: '7', name: 'Tahoe' },
    { id: 'c5', makeId: '7', name: 'Suburban' },
    { id: 'c6', makeId: '7', name: 'Traverse' },
    { id: 'c7', makeId: '7', name: 'Camaro' },
  ],
  '3': [ // Audi
    { id: 'a1', makeId: '3', name: 'A3' },
    { id: 'a2', makeId: '3', name: 'A4' },
    { id: 'a3', makeId: '3', name: 'A6' },
    { id: 'a4', makeId: '3', name: 'A8' },
    { id: 'a5', makeId: '3', name: 'Q3' },
    { id: 'a6', makeId: '3', name: 'Q5' },
    { id: 'a7', makeId: '3', name: 'Q7' },
    { id: 'a8', makeId: '3', name: 'Q8' },
  ],
  '24': [ // Lexus
    { id: 'l1', makeId: '24', name: 'ES' },
    { id: 'l2', makeId: '24', name: 'IS' },
    { id: 'l3', makeId: '24', name: 'LS' },
    { id: 'l4', makeId: '24', name: 'RX' },
    { id: 'l5', makeId: '24', name: 'NX' },
    { id: 'l6', makeId: '24', name: 'GX' },
    { id: 'l7', makeId: '24', name: 'LX' },
  ],
  '44': [ // Other
    { id: 'o1', makeId: '44', name: 'სხვა მოდელი (Other)' },
  ],
};

export interface CarMake {
  id: string;
  name: string;
}

export interface CarModel {
  id: string;
  makeId: string;
  name: string;
}

/**
 * Parse CSV response from Car2DB API
 * First row is headers, subsequent rows are data
 */
const parseCSV = (csvText: string): string[][] => {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    // Handle quoted values with commas inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    return values;
  });
};

/**
 * Fetch all car makes from Car2DB API
 * Falls back to hardcoded data if API fails
 * @returns Array of car makes
 */
export const fetchCarMakes = async (): Promise<CarMake[]> => {
  try {
    const url = `${CAR_API_BASE_URL}/make.getAll.csv.en?api_key=${CAR_API_KEY}&id_type=${VEHICLE_TYPE_CAR}`;
    
    console.log('[Car API] Fetching car makes...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Car API] API returned ${response.status}, using fallback data`);
      return FALLBACK_MAKES;
    }
    
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    // Skip header row, parse data rows
    // Expected format: "id_make","name","id_type"
    const makes: CarMake[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2 && row[0] && row[1]) {
        makes.push({
          id: row[0],
          name: row[1],
        });
      }
    }
    
    // If no makes found, use fallback
    if (makes.length === 0) {
      console.warn('[Car API] No makes found in API response, using fallback data');
      return FALLBACK_MAKES;
    }
    
    // Sort alphabetically by name
    makes.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[Car API] Fetched ${makes.length} car makes`);
    return makes;
  } catch (error) {
    console.warn('[Car API] Error fetching car makes, using fallback data:', error);
    return FALLBACK_MAKES;
  }
};

/**
 * Fetch all car models from Car2DB API
 * Falls back to hardcoded data if API fails
 * @returns Array of car models with their make IDs
 */
export const fetchCarModels = async (): Promise<CarModel[]> => {
  try {
    const url = `${CAR_API_BASE_URL}/model.getAll.csv.en?api_key=${CAR_API_KEY}&id_type=${VEHICLE_TYPE_CAR}`;
    
    console.log('[Car API] Fetching car models...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Car API] API returned ${response.status}, using fallback data`);
      // Flatten all fallback models into a single array
      const allFallbackModels: CarModel[] = [];
      Object.values(FALLBACK_MODELS).forEach(models => {
        allFallbackModels.push(...models);
      });
      return allFallbackModels;
    }
    
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    // Skip header row, parse data rows
    // Expected format: "id_model","name","id_make","id_type"
    const models: CarModel[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 3 && row[0] && row[1] && row[2]) {
        models.push({
          id: row[0],
          name: row[1],
          makeId: row[2],
        });
      }
    }
    
    // If no models found, use fallback
    if (models.length === 0) {
      console.warn('[Car API] No models found in API response, using fallback data');
      const allFallbackModels: CarModel[] = [];
      Object.values(FALLBACK_MODELS).forEach(models => {
        allFallbackModels.push(...models);
      });
      return allFallbackModels;
    }
    
    // Sort alphabetically by name
    models.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[Car API] Fetched ${models.length} car models`);
    return models;
  } catch (error) {
    console.warn('[Car API] Error fetching car models, using fallback data:', error);
    // Flatten all fallback models into a single array
    const allFallbackModels: CarModel[] = [];
    Object.values(FALLBACK_MODELS).forEach(models => {
      allFallbackModels.push(...models);
    });
    return allFallbackModels;
  }
};

/**
 * Get models for a specific make
 * @param makeId - The make ID to filter by
 * @param allModels - All models (pre-fetched)
 * @returns Filtered array of models for the specified make
 */
export const getModelsForMake = (makeId: string, allModels: CarModel[]): CarModel[] => {
  return allModels.filter(model => model.makeId === makeId);
};

/**
 * Search makes by name
 * @param query - Search query
 * @param allMakes - All makes (pre-fetched)
 * @returns Filtered array of matching makes
 */
export const searchMakes = (query: string, allMakes: CarMake[]): CarMake[] => {
  if (!query.trim()) return allMakes;
  
  const lowerQuery = query.toLowerCase();
  return allMakes.filter(make => 
    make.name.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Search models by name within a make
 * @param query - Search query
 * @param makeId - Make ID to filter by
 * @param allModels - All models (pre-fetched)
 * @returns Filtered array of matching models
 */
export const searchModels = (query: string, makeId: string, allModels: CarModel[]): CarModel[] => {
  const makeModels = getModelsForMake(makeId, allModels);
  
  if (!query.trim()) return makeModels;
  
  const lowerQuery = query.toLowerCase();
  return makeModels.filter(model => 
    model.name.toLowerCase().includes(lowerQuery)
  );
};

export default {
  fetchCarMakes,
  fetchCarModels,
  getModelsForMake,
  searchMakes,
  searchModels,
};
