/**
 * Helper function to extract items/products from SumUp transaction data
 * SumUp API may provide items in different formats depending on the endpoint
 */
export function extractItemsFromSumUpTransaction(transaction: any): Array<{
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  raw_data?: any
}> {
  const items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
    raw_data?: any
  }> = []

  // Try different possible locations for items in SumUp transaction data
  // Format 1: items array directly in transaction
  if (transaction.items && Array.isArray(transaction.items)) {
    for (const item of transaction.items) {
      items.push({
        product_name: item.name || item.product_name || item.title || 'Unbekannt',
        quantity: parseFloat(item.quantity || item.qty || '1') || 1,
        unit_price: parseFloat(item.unit_price || item.price || item.amount || '0') || 0,
        total_price: parseFloat(item.total_price || item.total || item.amount || '0') || 0,
        raw_data: item
      })
    }
    return items
  }

  // Format 2: products array
  if (transaction.products && Array.isArray(transaction.products)) {
    for (const product of transaction.products) {
      items.push({
        product_name: product.name || product.product_name || product.title || 'Unbekannt',
        quantity: parseFloat(product.quantity || product.qty || '1') || 1,
        unit_price: parseFloat(product.unit_price || product.price || product.amount || '0') || 0,
        total_price: parseFloat(product.total_price || product.total || product.amount || '0') || 0,
        raw_data: product
      })
    }
    return items
  }

  // Format 3: line_items array
  if (transaction.line_items && Array.isArray(transaction.line_items)) {
    for (const lineItem of transaction.line_items) {
      items.push({
        product_name: lineItem.name || lineItem.product_name || lineItem.title || 'Unbekannt',
        quantity: parseFloat(lineItem.quantity || lineItem.qty || '1') || 1,
        unit_price: parseFloat(lineItem.unit_price || lineItem.price || lineItem.amount || '0') || 0,
        total_price: parseFloat(lineItem.total_price || lineItem.total || lineItem.amount || '0') || 0,
        raw_data: lineItem
      })
    }
    return items
  }

  // Format 4: receipt_data.items
  if (transaction.receipt_data?.items && Array.isArray(transaction.receipt_data.items)) {
    for (const item of transaction.receipt_data.items) {
      items.push({
        product_name: item.name || item.product_name || item.title || 'Unbekannt',
        quantity: parseFloat(item.quantity || item.qty || '1') || 1,
        unit_price: parseFloat(item.unit_price || item.price || item.amount || '0') || 0,
        total_price: parseFloat(item.total_price || item.total || item.amount || '0') || 0,
        raw_data: item
      })
    }
    return items
  }

  // Format 5: transaction_data.items
  if (transaction.transaction_data?.items && Array.isArray(transaction.transaction_data.items)) {
    for (const item of transaction.transaction_data.items) {
      items.push({
        product_name: item.name || item.product_name || item.title || 'Unbekannt',
        quantity: parseFloat(item.quantity || item.qty || '1') || 1,
        unit_price: parseFloat(item.unit_price || item.price || item.amount || '0') || 0,
        total_price: parseFloat(item.total_price || item.total || item.amount || '0') || 0,
        raw_data: item
      })
    }
    return items
  }

  // If no items found, create a single item from the transaction total
  // This is a fallback for when SumUp doesn't provide item-level data
  if (items.length === 0 && transaction.amount) {
    items.push({
      product_name: 'Gesamtbetrag',
      quantity: 1,
      unit_price: parseFloat(transaction.amount) || 0,
      total_price: parseFloat(transaction.amount) || 0,
      raw_data: { note: 'No item-level data available from SumUp' }
    })
  }

  return items
}



