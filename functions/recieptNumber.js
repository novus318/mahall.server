export const NextReceiptNumber = async (lastNumber) => {
    // Regular expression to match the prefix and numeric part
    const match = lastNumber.match(/^([A-Za-z]*-?)(\d+)$/);
  
    if (!match) {
      throw new Error("Invalid receipt number format");
    }
  
    const prefix = match[1]; // e.g., "KA-" or ""
    const numericPart = match[2]; // e.g., "0001" or "00009"
  
    // Increment the numeric part
    const incrementedNumber = (parseInt(numericPart, 10) + 1).toString();
  
    // Ensure the incremented number retains the original number of digits
    const nextNumber = incrementedNumber.padStart(numericPart.length, "0");
  
    // Combine the prefix and the next number
    return `${prefix}${nextNumber}`;
  };
  
  