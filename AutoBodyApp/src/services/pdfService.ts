import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { InvoiceData, EstimateReviewData } from '../types';
import { GEORGIAN_LABELS } from '../config/georgian';
import { formatCurrency } from '../utils/helpers';

export class PDFService {
  /**
   * Generate PDF for estimate review
   */
  static async generateEstimatePDF(data: EstimateReviewData): Promise<string> {
    try {
      const htmlContent = this.generateEstimateHTML(data);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      return uri;
    } catch (error) {
      console.error('Error generating estimate PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  /**
   * Generate PDF for final invoice
   */
  static async generateInvoicePDF(data: InvoiceData): Promise<string> {
    try {
      const htmlContent = this.generateInvoiceHTML(data);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      return uri;
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  /**
   * Share PDF file
   */
  static async sharePDF(uri: string, filename: string = 'estimate.pdf'): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Estimate',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      throw new Error('Failed to share PDF');
    }
  }

  /**
   * Save PDF to device
   */
  static async savePDF(uri: string, filename: string): Promise<string> {
    try {
      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        throw new Error('Document directory not available');
      }

      const fileUri = `${documentDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });

      return fileUri;
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw new Error('Failed to save PDF');
    }
  }

  /**
   * Generate HTML content for estimate
   */
  private static generateEstimateHTML(data: EstimateReviewData): string {
    const currentDate = new Date().toLocaleDateString('ka-GE');
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ka-GE'); // 30 days

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${this.getCommonStyles()}
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="company-info">
                <h1>${GEORGIAN_LABELS.shopName}</h1>
                <p>${GEORGIAN_LABELS.shopAddress}</p>
                <p>${GEORGIAN_LABELS.shopPhone}</p>
                <p>${GEORGIAN_LABELS.shopEmail}</p>
              </div>
              <div class="document-info">
                <h2>${GEORGIAN_LABELS.estimateTitle}</h2>
                <p>${GEORGIAN_LABELS.issueDate}: ${currentDate}</p>
                <p>${GEORGIAN_LABELS.validUntil}: ${validUntil}</p>
              </div>
            </div>

            <hr class="separator">

            <!-- Customer and Vehicle Info -->
            <div class="info-section">
              <div class="customer-info">
                <h3>${GEORGIAN_LABELS.customerInfo}</h3>
                <p><strong>${GEORGIAN_LABELS.customerName}:</strong> ${data.customer.firstName} ${data.customer.lastName}</p>
                <p><strong>${GEORGIAN_LABELS.customerPhone}:</strong> ${data.customer.phone}</p>
                ${data.customer.email ? `<p><strong>${GEORGIAN_LABELS.customerEmail}:</strong> ${data.customer.email}</p>` : ''}
              </div>
              
              <div class="vehicle-info">
                <h3>${GEORGIAN_LABELS.vehicleInfo}</h3>
                <p><strong>${GEORGIAN_LABELS.vehicleYear}:</strong> ${data.vehicle.year}</p>
                <p><strong>${GEORGIAN_LABELS.vehicleMake}:</strong> ${data.vehicle.make}</p>
                <p><strong>${GEORGIAN_LABELS.vehicleModel}:</strong> ${data.vehicle.model}</p>
                ${data.vehicle.vin ? `<p><strong>${GEORGIAN_LABELS.vehicleVin}:</strong> ${data.vehicle.vin}</p>` : ''}
              </div>
            </div>

            <!-- Services Table -->
            <div class="table-section">
              <h3>${GEORGIAN_LABELS.servicesTable}</h3>
              <table class="services-table">
                <thead>
                  <tr>
                    <th>${GEORGIAN_LABELS.columnItem}</th>
                    <th>${GEORGIAN_LABELS.columnDamageZone}</th>
                    <th>${GEORGIAN_LABELS.columnQuantity}</th>
                    <th>${GEORGIAN_LABELS.columnPrice}</th>
                    <th>${GEORGIAN_LABELS.columnTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.lineItems.map(item => `
                    <tr>
                      <td>${item.nameKa}</td>
                      <td>${item.damageZone || '-'}</td>
                      <td class="center">${item.quantity}</td>
                      <td class="right">${this.formatGEL(item.unitPrice)}</td>
                      <td class="right">${this.formatGEL(item.totalPrice)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-table">
                <div class="total-row">
                  <span class="total-label">${GEORGIAN_LABELS.subtotal}:</span>
                  <span class="total-value">${this.formatGEL(data.subtotal)}</span>
                </div>
                <div class="total-row">
                  <span class="total-label">${GEORGIAN_LABELS.tax} (${(data.taxRate * 100).toFixed(0)}%):</span>
                  <span class="total-value">${this.formatGEL(data.taxAmount)}</span>
                </div>
                <div class="total-row final-total">
                  <span class="total-label">${GEORGIAN_LABELS.totalAmount}:</span>
                  <span class="total-value">${this.formatGEL(data.total)}</span>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>${GEORGIAN_LABELS.thankYouMessage}</p>
              <p><em>${GEORGIAN_LABELS.termsAndConditions}: სამუშაოს შეფასება 30 დღით არის ვალიდური.</em></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML content for invoice
   */
  private static generateInvoiceHTML(data: InvoiceData): string {
    const currentDate = new Date(data.createdAt).toLocaleDateString('ka-GE');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${this.getCommonStyles()}
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="company-info">
                <h1>${GEORGIAN_LABELS.shopName}</h1>
                <p>${GEORGIAN_LABELS.shopAddress}</p>
                <p>${GEORGIAN_LABELS.shopPhone}</p>
                <p>${GEORGIAN_LABELS.shopEmail}</p>
              </div>
              <div class="document-info">
                <h2>${GEORGIAN_LABELS.invoiceTitle}</h2>
                <p>№ ${data.invoiceNumber}</p>
                <p>${GEORGIAN_LABELS.issueDate}: ${currentDate}</p>
              </div>
            </div>

            <hr class="separator">

            <!-- Customer and Vehicle Info -->
            <div class="info-section">
              <div class="customer-info">
                <h3>${GEORGIAN_LABELS.customerInfo}</h3>
                <p><strong>${GEORGIAN_LABELS.customerName}:</strong> ${data.customer.firstName} ${data.customer.lastName}</p>
                <p><strong>${GEORGIAN_LABELS.customerPhone}:</strong> ${data.customer.phone}</p>
                ${data.customer.email ? `<p><strong>${GEORGIAN_LABELS.customerEmail}:</strong> ${data.customer.email}</p>` : ''}
              </div>
              
              <div class="vehicle-info">
                <h3>${GEORGIAN_LABELS.vehicleInfo}</h3>
                <p><strong>${GEORGIAN_LABELS.vehicleYear}:</strong> ${data.vehicle.year}</p>
                <p><strong>${GEORGIAN_LABELS.vehicleMake}:</strong> ${data.vehicle.make}</p>
                <p><strong>${GEORGIAN_LABELS.vehicleModel}:</strong> ${data.vehicle.model}</p>
                ${data.vehicle.vin ? `<p><strong>${GEORGIAN_LABELS.vehicleVin}:</strong> ${data.vehicle.vin}</p>` : ''}
              </div>
            </div>

            <!-- Services Table -->
            <div class="table-section">
              <h3>${GEORGIAN_LABELS.servicesTable}</h3>
              <table class="services-table">
                <thead>
                  <tr>
                    <th>${GEORGIAN_LABELS.columnItem}</th>
                    <th>${GEORGIAN_LABELS.columnQuantity}</th>
                    <th>${GEORGIAN_LABELS.columnPrice}</th>
                    <th>${GEORGIAN_LABELS.columnTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.lineItems.map(item => `
                    <tr>
                      <td>${item.nameKa}</td>
                      <td class="center">${item.quantity}</td>
                      <td class="right">${this.formatGEL(item.unitPrice)}</td>
                      <td class="right">${this.formatGEL(item.totalPrice)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-table">
                <div class="total-row">
                  <span class="total-label">${GEORGIAN_LABELS.subtotal}:</span>
                  <span class="total-value">${this.formatGEL(data.subtotal)}</span>
                </div>
                <div class="total-row">
                  <span class="total-label">${GEORGIAN_LABELS.tax} (${(data.taxRate * 100).toFixed(0)}%):</span>
                  <span class="total-value">${this.formatGEL(data.taxAmount)}</span>
                </div>
                <div class="total-row final-total">
                  <span class="total-label">${GEORGIAN_LABELS.totalAmount}:</span>
                  <span class="total-value">${this.formatGEL(data.total)}</span>
                </div>
              </div>
            </div>

            ${data.notes ? `
              <div class="notes-section">
                <h3>${GEORGIAN_LABELS.notesLabel}</h3>
                <p>${data.notes}</p>
              </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
              <p>${GEORGIAN_LABELS.thankYouMessage}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Common CSS styles for PDFs
   */
  private static getCommonStyles(): string {
    return `
      @page {
        margin: 20mm;
        size: A4;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #333;
        margin: 0;
        padding: 0;
      }
      
      .container {
        max-width: 100%;
        margin: 0 auto;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      
      .company-info h1 {
        color: #1976D2;
        font-size: 24px;
        margin: 0 0 10px 0;
        font-weight: bold;
      }
      
      .company-info p {
        margin: 2px 0;
        font-size: 11px;
        color: #666;
      }
      
      .document-info {
        text-align: right;
      }
      
      .document-info h2 {
        color: #1976D2;
        font-size: 20px;
        margin: 0 0 10px 0;
        font-weight: bold;
      }
      
      .document-info p {
        margin: 2px 0;
        font-size: 11px;
        color: #666;
      }
      
      .separator {
        border: none;
        border-top: 2px solid #1976D2;
        margin: 20px 0;
      }
      
      .info-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
      }
      
      .customer-info, .vehicle-info {
        width: 48%;
      }
      
      .customer-info h3, .vehicle-info h3 {
        color: #1976D2;
        font-size: 14px;
        margin: 0 0 10px 0;
        font-weight: bold;
      }
      
      .customer-info p, .vehicle-info p {
        margin: 4px 0;
        font-size: 11px;
      }
      
      .table-section {
        margin-bottom: 30px;
      }
      
      .table-section h3 {
        color: #1976D2;
        font-size: 14px;
        margin: 0 0 15px 0;
        font-weight: bold;
      }
      
      .services-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      
      .services-table th {
        background-color: #f5f5f5;
        color: #333;
        font-weight: bold;
        padding: 10px 8px;
        text-align: left;
        border: 1px solid #ddd;
        font-size: 11px;
      }
      
      .services-table td {
        padding: 8px;
        border: 1px solid #ddd;
        font-size: 11px;
      }
      
      .services-table tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .center {
        text-align: center;
      }
      
      .right {
        text-align: right;
      }
      
      .totals-section {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 30px;
      }
      
      .totals-table {
        width: 300px;
      }
      
      .total-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid #eee;
      }
      
      .total-row.final-total {
        border-top: 2px solid #1976D2;
        border-bottom: 2px solid #1976D2;
        font-weight: bold;
        font-size: 14px;
        color: #1976D2;
        margin-top: 5px;
        padding: 8px 0;
      }
      
      .total-label {
        font-weight: 500;
      }
      
      .total-value {
        font-weight: bold;
      }
      
      .notes-section {
        margin-bottom: 30px;
      }
      
      .notes-section h3 {
        color: #1976D2;
        font-size: 14px;
        margin: 0 0 10px 0;
        font-weight: bold;
      }
      
      .notes-section p {
        font-size: 11px;
        line-height: 1.5;
        color: #666;
      }
      
      .footer {
        border-top: 1px solid #eee;
        padding-top: 20px;
        text-align: center;
      }
      
      .footer p {
        margin: 5px 0;
        font-size: 11px;
        color: #666;
      }
      
      .footer em {
        font-style: italic;
        color: #999;
        font-size: 10px;
      }
    `;
  }

  /**
   * Format currency in Georgian Lari
   */
  private static formatGEL(amount: number): string {
    return `${amount.toFixed(2)} ${GEORGIAN_LABELS.currencySymbol}`;
  }
}