// SMS Service for GoSMS.ge API
// API Documentation: https://api.gosms.ge

const API_KEY = '5c88b0316e44d076d4677a4860959ef71ce049ce704b559355568a362f40ade1';
const API_URL = 'https://api.gosms.ge/api/sendsms';
const SENDER_ID = 'OTOMOTORS';

interface SMSResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send SMS via GoSMS.ge API
 * @param phoneNumber - Recipient phone number (e.g., 511144486)
 * @param message - SMS text content
 * @returns Promise with success status and message
 */
export const sendSMS = async (phoneNumber: string, message: string): Promise<SMSResponse> => {
  try {
    // Clean phone number - remove any spaces, dashes, or country code prefix
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '').replace(/^995/, '');
    
    // Build the URL with query parameters
    const encodedMessage = encodeURIComponent(message);
    const url = `${API_URL}?api_key=${API_KEY}&to=${cleanPhone}&from=${SENDER_ID}&text=${encodedMessage}`;
    
    console.log('Sending SMS to:', cleanPhone);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('SMS API Response:', data);

    // Check response - GoSMS typically returns success status in response
    if (response.ok && (data.success || data.code === 0 || data.status === 'success')) {
      return {
        success: true,
        message: 'SMS გაგზავნილია წარმატებით',
      };
    } else {
      return {
        success: false,
        message: 'SMS გაგზავნა ვერ მოხერხდა',
        error: data.message || data.error || 'Unknown error',
      };
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      message: 'SMS გაგზავნა ვერ მოხერხდა',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Send service completion confirmation SMS with case type and total price
 * @param phoneNumber - Customer phone number
 * @param vehiclePlate - Vehicle license plate
 * @param totalPrice - Total price of the service
 * @param caseType - Type of case (დაზღვევა or საცალო)
 * @param assignedMechanic - Name of the assigned mechanic (optional)
 * @returns Promise with success status
 */
export const sendCompletionSMS = async (
  phoneNumber: string,
  vehiclePlate: string,
  totalPrice: number,
  caseType?: string | null,
  assignedMechanic?: string | null
): Promise<SMSResponse> => {
  // Format price as currency
  const formattedPrice = `${totalPrice.toFixed(2)} ₾`;
  
  let message: string;
  
  if (caseType === 'დაზღვევა' && assignedMechanic) {
    // Insurance case with mechanic name
    message = `${vehiclePlate} სერვისი დასრულებულია. მექანიკოსი: ${assignedMechanic}. ჯამი: ${formattedPrice}. OTOMOTORS`;
  } else {
    // Default message (საცალო or no case type)
    message = `${vehiclePlate} სერვისი დასრულებულია. ჯამი: ${formattedPrice}. OTOMOTORS`;
  }
  
  return sendSMS(phoneNumber, message);
};

export default {
  sendSMS,
  sendCompletionSMS,
};
