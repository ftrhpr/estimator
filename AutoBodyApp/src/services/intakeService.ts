import { CustomerService } from './customerService';
import { VehicleService } from './vehicleService';
import { Customer, Vehicle, CustomerIntakeFormData, IntakeResult } from '../types';

export class IntakeService {
  /**
   * Complete customer and vehicle intake process
   */
  static async processIntake(formData: CustomerIntakeFormData): Promise<IntakeResult> {
    try {
      // Parse customer name (assume it's "First Last" format)
      const nameParts = formData.customerName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Check if customer already exists by phone number
      const existingCustomers = await CustomerService.searchCustomers(formData.phoneNumber);
      let customerId: string;
      let customer: Customer;

      if (existingCustomers.length > 0) {
        // Update existing customer if found
        customer = existingCustomers[0];
        customerId = customer.id;
        
        await CustomerService.updateCustomer(customerId, {
          firstName,
          lastName,
          phone: formData.phoneNumber,
        });
        
        // Refresh customer data
        const updatedCustomer = await CustomerService.getCustomer(customerId);
        customer = updatedCustomer!;
      } else {
        // Create new customer
        const customerData = {
          firstName,
          lastName,
          phone: formData.phoneNumber,
          email: '', // Optional for now
        };

        customerId = await CustomerService.createCustomer(customerData);
        const newCustomer = await CustomerService.getCustomer(customerId);
        customer = newCustomer!;
      }

      // Check if vehicle already exists by VIN (if provided)
      let vehicleId: string;
      let vehicle: Vehicle;

      if (formData.vin.trim()) {
        const existingVehicles = await VehicleService.searchVehiclesByVIN(formData.vin);
        
        if (existingVehicles.length > 0) {
          // Update existing vehicle
          vehicle = existingVehicles[0];
          vehicleId = vehicle.id;
          
          await VehicleService.updateVehicle(vehicleId, {
            customerId, // Update to current customer
            make: formData.vehicleMake.trim(),
            model: formData.vehicleModel.trim(),
            year: parseInt(formData.vehicleYear),
          });
          
          // Refresh vehicle data
          const updatedVehicle = await VehicleService.getVehicle(vehicleId);
          vehicle = updatedVehicle!;
        } else {
          // Create new vehicle
          const vehicleData = {
            customerId,
            make: formData.vehicleMake.trim(),
            model: formData.vehicleModel.trim(),
            year: parseInt(formData.vehicleYear),
            color: '', // Will be filled later in estimate
            vin: formData.vin.trim(),
            licensePlate: '',
            mileage: undefined,
          };

          vehicleId = await VehicleService.createVehicle(vehicleData);
          const newVehicle = await VehicleService.getVehicle(vehicleId);
          vehicle = newVehicle!;
        }
      } else {
        // Create new vehicle without VIN
        const vehicleData = {
          customerId,
          make: formData.vehicleMake.trim(),
          model: formData.vehicleModel.trim(),
          year: parseInt(formData.vehicleYear),
          color: '',
          licensePlate: '',
          mileage: undefined,
        };

        vehicleId = await VehicleService.createVehicle(vehicleData);
        const newVehicle = await VehicleService.getVehicle(vehicleId);
        vehicle = newVehicle!;
      }

      return {
        customerId,
        vehicleId,
        customer,
        vehicle,
      };
    } catch (error) {
      console.error('Error processing intake:', error);
      throw new Error('Failed to process customer and vehicle information');
    }
  }

  /**
   * Get customer's previous vehicles for quick selection
   */
  static async getCustomerHistory(phoneNumber: string): Promise<{
    customers: Customer[];
    vehicles: Vehicle[];
  }> {
    try {
      const customers = await CustomerService.searchCustomers(phoneNumber);
      let vehicles: Vehicle[] = [];

      if (customers.length > 0) {
        const vehiclePromises = customers.map(customer => 
          VehicleService.getCustomerVehicles(customer.id)
        );
        const vehicleArrays = await Promise.all(vehiclePromises);
        vehicles = vehicleArrays.flat();
      }

      return { customers, vehicles };
    } catch (error) {
      console.error('Error getting customer history:', error);
      return { customers: [], vehicles: [] };
    }
  }
}