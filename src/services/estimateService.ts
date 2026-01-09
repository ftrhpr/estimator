import { EstimateReviewData, InvoiceLineItem, VisualEstimate, Service, Customer, Vehicle } from '../types';
import { ServiceService } from './serviceService';
import { APP_CONFIG } from '../config/constants';
import { DEFAULT_SERVICES } from '../config/services';

export class EstimateService {
  /**
   * Convert visual estimates to review data structure
   */
  static async convertVisualEstimatesToReview(
    customer: Customer,
    vehicle: Vehicle,
    visualEstimates: VisualEstimate[]
  ): Promise<EstimateReviewData> {
    try {
      // Load available services
      const services = await ServiceService.getAllServices();
      
      // Convert visual estimates to line items
      const lineItems: InvoiceLineItem[] = [];
      
      for (const estimate of visualEstimates) {
        // For each repair type in the estimate, create a line item
        for (const repairTypeName of estimate.repairType) {
          // Find the service
          const service = services.find(s => s.nameEn === repairTypeName) || 
                         Object.values(DEFAULT_SERVICES).find(s => s.nameEn === repairTypeName);
          
          if (service) {
            const lineItem: InvoiceLineItem = {
              id: `${estimate.id}_${repairTypeName}`,
              type: 'service',
              nameEn: service.nameEn,
              nameKa: service.nameKa || service.nameEn,
              quantity: 1,
              unitPrice: service.basePrice || estimate.cost / estimate.repairType.length,
              totalPrice: service.basePrice || estimate.cost / estimate.repairType.length,
              damageZone: estimate.damageZone,
            };
            lineItems.push(lineItem);
          }
        }
      }

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const taxRate = APP_CONFIG.defaultTaxRate;
      const taxAmount = subtotal * taxRate;
      const total = subtotal + taxAmount;

      // Get selected services (unique services from line items)
      const selectedServiceKeys = Array.from(new Set(lineItems.map(item => 
        services.find(s => s.nameEn === item.nameEn)?.key || item.nameEn.toLowerCase().replace(/\s+/g, '_')
      )));
      
      const selectedServices = services.filter(service => 
        selectedServiceKeys.includes(service.key)
      );

      return {
        customer,
        vehicle,
        visualEstimates,
        selectedServices,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
      };
    } catch (error) {
      console.error('Error converting visual estimates to review data:', error);
      throw error;
    }
  }

  /**
   * Generate estimate number
   */
  static generateEstimateNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `EST-${year}${month}${day}-${random}`;
  }

  /**
   * Add custom line item to review data
   */
  static addLineItem(
    reviewData: EstimateReviewData,
    item: Omit<InvoiceLineItem, 'id'>
  ): EstimateReviewData {
    const newItem: InvoiceLineItem = {
      ...item,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const newLineItems = [...reviewData.lineItems, newItem];
    const newSubtotal = newLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const newTaxAmount = newSubtotal * reviewData.taxRate;
    const newTotal = newSubtotal + newTaxAmount;

    return {
      ...reviewData,
      lineItems: newLineItems,
      subtotal: newSubtotal,
      taxAmount: newTaxAmount,
      total: newTotal,
    };
  }

  /**
   * Remove line item from review data
   */
  static removeLineItem(
    reviewData: EstimateReviewData,
    itemId: string
  ): EstimateReviewData {
    const newLineItems = reviewData.lineItems.filter(item => item.id !== itemId);
    const newSubtotal = newLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const newTaxAmount = newSubtotal * reviewData.taxRate;
    const newTotal = newSubtotal + newTaxAmount;

    return {
      ...reviewData,
      lineItems: newLineItems,
      subtotal: newSubtotal,
      taxAmount: newTaxAmount,
      total: newTotal,
    };
  }

  /**
   * Update line item quantity and recalculate totals
   */
  static updateLineItemQuantity(
    reviewData: EstimateReviewData,
    itemId: string,
    newQuantity: number
  ): EstimateReviewData {
    const newLineItems = reviewData.lineItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: item.unitPrice * newQuantity,
        };
      }
      return item;
    });

    const newSubtotal = newLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const newTaxAmount = newSubtotal * reviewData.taxRate;
    const newTotal = newSubtotal + newTaxAmount;

    return {
      ...reviewData,
      lineItems: newLineItems,
      subtotal: newSubtotal,
      taxAmount: newTaxAmount,
      total: newTotal,
    };
  }

  /**
   * Convert review data to Georgian Lari (GEL) from USD
   * Using approximate exchange rate - in production, you'd fetch from an API
   */
  static convertToGEL(reviewData: EstimateReviewData, exchangeRate: number = 2.65): EstimateReviewData {
    const convertedLineItems = reviewData.lineItems.map(item => ({
      ...item,
      unitPrice: item.unitPrice * exchangeRate,
      totalPrice: item.totalPrice * exchangeRate,
    }));

    return {
      ...reviewData,
      lineItems: convertedLineItems,
      subtotal: reviewData.subtotal * exchangeRate,
      taxAmount: reviewData.taxAmount * exchangeRate,
      total: reviewData.total * exchangeRate,
    };
  }

  /**
   * Get estimate summary for display
   */
  static getEstimateSummary(reviewData: EstimateReviewData): {
    serviceCount: number;
    damageZoneCount: number;
    avgCostPerService: number;
    totalHours: number;
  } {
    const serviceCount = reviewData.lineItems.length;
    const damageZones = new Set(reviewData.lineItems.map(item => item.damageZone).filter(Boolean));
    const damageZoneCount = damageZones.size;
    const avgCostPerService = serviceCount > 0 ? reviewData.subtotal / serviceCount : 0;
    
    // Estimate total hours based on service complexity (rough calculation)
    const totalHours = reviewData.lineItems.reduce((hours, item) => {
      // Basic estimation: higher cost services take more time
      const estimatedHours = item.unitPrice > 100 ? 3 : item.unitPrice > 50 ? 2 : 1;
      return hours + (estimatedHours * item.quantity);
    }, 0);

    return {
      serviceCount,
      damageZoneCount,
      avgCostPerService: Math.round(avgCostPerService * 100) / 100,
      totalHours,
    };
  }
}