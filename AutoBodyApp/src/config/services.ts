// Default services with English keys and Georgian display text
export const DEFAULT_SERVICES = {
  painting: {
    key: 'painting',
    nameEn: 'Painting Services',
    nameKa: 'სამღებრო სამუშაო',
    basePrice: 50.00,
    category: 'bodywork',
  },
  paint_mixing: {
    key: 'paint_mixing',
    nameEn: 'Paint Mixing',
    nameKa: 'საღებავის შეზავება',
    basePrice: 25.00,
    category: 'painting',
  },
  plastic_restoration: {
    key: 'plastic_restoration',
    nameEn: 'Plastic Restoration',
    nameKa: 'პლასტმასის აღდგენა',
    basePrice: 75.00,
    category: 'bodywork',
  },
  robotic_work: {
    key: 'robotic_work',
    nameEn: 'Robotic Work',
    nameKa: 'სარობოტე სამუშაო',
    basePrice: 120.00,
    category: 'specialized',
  },
  dent_repair: {
    key: 'dent_repair',
    nameEn: 'Dent Repair',
    nameKa: 'თუნუქის გასწორება',
    basePrice: 80.00,
    category: 'bodywork',
  },
  disassembly_assembly: {
    key: 'disassembly_assembly',
    nameEn: 'Disassembly & Assembly',
    nameKa: 'დაშლა-აწყობა',
    basePrice: 60.00,
    category: 'mechanical',
  },
  polishing: {
    key: 'polishing',
    nameEn: 'Polishing',
    nameKa: 'პოლირება',
    basePrice: 40.00,
    category: 'finishing',
  },
};

export const SERVICE_CATEGORIES = [
  { value: 'bodywork', label: 'Body Work', labelKa: 'კორპუსის სამუშაო' },
  { value: 'painting', label: 'Painting', labelKa: 'ღებავა' },
  { value: 'mechanical', label: 'Mechanical', labelKa: 'მექანიკური' },
  { value: 'specialized', label: 'Specialized', labelKa: 'სპეციალიზებული' },
  { value: 'finishing', label: 'Finishing', labelKa: 'დამთავრება' },
];