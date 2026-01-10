/**
 * Car2DB API Service
 * Fetches car makes and models from car2db.com API
 * API Documentation: https://api.car2db.com/api/auto/v1/
 */

const CAR_API_BASE_URL = 'https://api.car2db.com/api/auto/v1';
const CAR_API_KEY = 'n.bikashvili88@gmail.com4680eb612be3f4a9d2a55b5065f738bd';

// Vehicle type ID for cars (id_type=1)
const VEHICLE_TYPE_CAR = 1;

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
 * @returns Array of car makes
 */
export const fetchCarMakes = async (): Promise<CarMake[]> => {
  try {
    const url = `${CAR_API_BASE_URL}/make.getAll.csv.en?api_key=${CAR_API_KEY}&id_type=${VEHICLE_TYPE_CAR}`;
    
    console.log('[Car API] Fetching car makes...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    
    // Sort alphabetically by name
    makes.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[Car API] Fetched ${makes.length} car makes`);
    return makes;
  } catch (error) {
    console.error('[Car API] Error fetching car makes:', error);
    throw error;
  }
};

/**
 * Fetch all car models from Car2DB API
 * @returns Array of car models with their make IDs
 */
export const fetchCarModels = async (): Promise<CarModel[]> => {
  try {
    const url = `${CAR_API_BASE_URL}/model.getAll.csv.en?api_key=${CAR_API_KEY}&id_type=${VEHICLE_TYPE_CAR}`;
    
    console.log('[Car API] Fetching car models...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    
    // Sort alphabetically by name
    models.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[Car API] Fetched ${models.length} car models`);
    return models;
  } catch (error) {
    console.error('[Car API] Error fetching car models:', error);
    throw error;
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
